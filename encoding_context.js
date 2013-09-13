'use strict';

// For simplicity, we assume that the character codes of a string
// represent an octet sequence. This implies that strings with
// characters greater than \xff are invalid; this policy is
// encapsulated in the isValidHeader{Name,Value}() functions below.

// Indexed header (4.2).
var INDEX_OPCODE = 0x1;
var INDEX_N = 7;

// Literal header without indexing (4.3.1).
var LITERAL_NO_INDEX_OPCODE = 0x3;
var LITERAL_NO_INDEX_N = 5;

// Literal header with incremental indexing (4.3.2).
var LITERAL_INCREMENTAL_OPCODE = 0x2;
var LITERAL_INCREMENTAL_N = 5;

// Literal header with substitution indexing (4.3.3).
var LITERAL_SUBSTITUTION_OPCODE = 0x0;
var LITERAL_SUBSTITUTION_N = 6;

// Constants for the direction parameter to EncodingContext (which
// controls which of the two pre-defined header tables below are
// used).
var REQUEST = 0;
var RESPONSE = 1;

var PRE_DEFINED_REQUEST_HEADER_TABLE = [
  [ ':scheme',             'http'  ],  // 0
  [ ':scheme',             'https' ],  // 1
  [ ':host',               ''      ],  // 2
  [ ':path',               '/'     ],  // 3
  [ ':method',             'GET'   ],  // 4
  [ 'accept',              ''      ],  // 5
  [ 'accept-charset',      ''      ],  // 6
  [ 'accept-encoding',     ''      ],  // 7
  [ 'accept-language',     ''      ],  // 8
  [ 'cookie',              ''      ],  // 9
  [ 'if-modified-since',   ''      ],  // 10
  [ 'user-agent',          ''      ],  // 11
  [ 'referer',             ''      ],  // 12
  [ 'authorization',       ''      ],  // 13
  [ 'allow',               ''      ],  // 14
  [ 'cache-control',       ''      ],  // 15
  [ 'connection',          ''      ],  // 16
  [ 'content-length',      ''      ],  // 17
  [ 'content-type',        ''      ],  // 18
  [ 'date',                ''      ],  // 19
  [ 'expect',              ''      ],  // 20
  [ 'from',                ''      ],  // 21
  [ 'if-match',            ''      ],  // 22
  [ 'if-none-match',       ''      ],  // 23
  [ 'if-range',            ''      ],  // 24
  [ 'if-unmodified-since', ''      ],  // 25
  [ 'max-forwards',        ''      ],  // 26
  [ 'proxy-authorization', ''      ],  // 27
  [ 'range',               ''      ],  // 28
  [ 'via',                 ''      ]   // 29
];

var PRE_DEFINED_RESPONSE_HEADER_TABLE = [
  [ ':status',                     '200' ],  // 0
  [ 'age',                         ''    ],  // 1
  [ 'cache-control',               ''    ],  // 2
  [ 'content-length',              ''    ],  // 3
  [ 'content-type',                ''    ],  // 4
  [ 'date',                        ''    ],  // 5
  [ 'etag',                        ''    ],  // 6
  [ 'expires',                     ''    ],  // 7
  [ 'last-modified',               ''    ],  // 8
  [ 'server',                      ''    ],  // 9
  [ 'set-cookie',                  ''    ],  // 10
  [ 'vary',                        ''    ],  // 11
  [ 'via',                         ''    ],  // 12
  [ 'access-control-allow-origin', ''    ],  // 13
  [ 'accept-ranges',               ''    ],  // 14
  [ 'allow',                       ''    ],  // 15
  [ 'connection',                  ''    ],  // 16
  [ 'content-disposition',         ''    ],  // 17
  [ 'content-encoding',            ''    ],  // 18
  [ 'content-language',            ''    ],  // 19
  [ 'content-location',            ''    ],  // 20
  [ 'content-range',               ''    ],  // 21
  [ 'link',                        ''    ],  // 22
  [ 'location',                    ''    ],  // 23
  [ 'proxy-authenticate',          ''    ],  // 24
  [ 'refresh',                     ''    ],  // 25
  [ 'retry-after',                 ''    ],  // 26
  [ 'strict-transport-security',   ''    ],  // 27
  [ 'transfer-encoding',           ''    ],  // 28
  [ 'www-authenticate',            ''    ],  // 29
];

// This regexp matches a string exactly when the octets represented by
// that string match the header-name rule in 4.1.2. Note that - comes
// first in the character set since it has special meaning otherwise.
var VALID_HEADER_NAME_REGEXP = /^:?[-!#$%&'*+.^_`|~0-9a-z]+$/;

// This regexp matches a string exactly when the octets represented by
// that string conforms to (the expected future content of) 4.1.3.
//
// 4.1.3 says that header values must be "sequences of UTF-8 encoded
// text". However, this will most likely change to allow arbitrary
// octet sequences so we don't bother trying to check UTF-8 validity.
var VALID_HEADER_VALUE_REGEXP = /^[\x00-\xff]*$/;

// Returns whether the given sequence of octets (represented as a
// string) matches the header-name rule in 4.1.2.
function isValidHeaderName(str) {
  return VALID_HEADER_NAME_REGEXP.test(str);
}

// Returns whether the given sequence of octets (represented as a
// string) conforms to (the expected future content of) 4.1.3.
function isValidHeaderValue(str) {
  return VALID_HEADER_VALUE_REGEXP.test(str);
}

// A constant-time string comparison function, as suggested by section
// 6.
function stringsEqualConstantTime(str1, str2) {
  var length = str1.length;
  if (str2.length != length) {
    return false;
  }

  var x = 0;
  for (var i = 0; i < length; ++i) {
    x |= str1.charCodeAt(i) ^ str2.charCodeAt(i);
  }
  return x == 0;
}

// A structure for an entry in the header table (3.1.2) and the
// reference set (3.1.3). This structure also keeps track of how many
// times a header has been 'touched', which is useful for both
// encoding and decoding.
function HeaderTableEntry(name, value) {
  this.name = name;
  this.value = value;
}

HeaderTableEntry.prototype.equals = function(other) {
  if (!stringsEqualConstantTime(this.name, other.name) ||
      !stringsEqualConstantTime(this.value, other.value) ||
      (this.isReferenced() != other.isReferenced()) ||
      (this.getTouchCount() != other.getTouchCount())) {
    return false;
  }

  return true;
}

// This size calculation comes from 3.1.2.
HeaderTableEntry.prototype.size = function() {
  return this.name.length + this.value.length + 32;
};

HeaderTableEntry.prototype.isReferenced = function() {
  return 'referenced_' in this;
};

HeaderTableEntry.prototype.setReferenced = function() {
  this.referenced_ = true;
};

HeaderTableEntry.prototype.unsetReferenced = function() {
  delete this.referenced_;
};

// Returns how many times this entry has been touched, or null if it
// hasn't been touched. Note that an entry can be touched 0 times,
// which is distinct from it not having been touched at all.
HeaderTableEntry.prototype.getTouchCount = function() {
  return ('touchCount_' in this) ? this.touchCount_ : null;
};

HeaderTableEntry.prototype.addTouches = function(touchCount) {
  this.touchCount_ = this.touchCount_ || 0;
  this.touchCount_ += touchCount;
};

HeaderTableEntry.prototype.clearTouches = function() {
  delete this.touchCount_;
};

// A data structure for both the header table (described in 3.1.2) and
// the reference set (3.1.3). This structure also keeps track of how
// many times a header has been 'touched', which is useful for both
// encoding and decoding.
function HeaderTable() {
  this.entries_ = [];
  this.size_ = 0;
  this.maxSize_ = 4096;
}

HeaderTable.prototype.removeFirstEntry_ = function() {
  var firstEntry = this.entries_.shift();
  this.size_ -= firstEntry.size();
}

// The draft doesn't specify which entries to evict when the max size
// is lowered, so we just start from the beginning.
HeaderTable.prototype.setMaxSize = function(maxSize) {
  this.maxSize_ = maxSize;
  while (this.size_ > this.maxSize_) {
    this.removeFirstEntry_();
  }
};

HeaderTable.prototype.equals = function(other) {
  if (this.size_ != other.size_ || this.maxSize_ != other.maxSize_ ||
      this.entries_.length != other.entries_.length) {
    return false;
  }

  for (var i = 0; i < this.entries_.length; ++i) {
    if (!this.entries_[i].equals(other.entries_[i])) {
      return false;
    }
  }

  return true;
}

HeaderTable.prototype.getEntry = function(index) {
  if (!(index in this.entries_)) {
    throw new Error('Invalid index ' + index);
  }
  return this.entries_[index];
}

// Returns the index of the first header table entry with the given
// name, or -1 if none exists.
HeaderTable.prototype.findIndexWithName = function(name) {
  if (!isValidHeaderName(name)) {
    throw new Error('Invalid header name: ' + name);
  }

  for (var i = 0; i < this.entries_.length; ++i) {
    var entry = this.entries_[i];
    if (stringsEqualConstantTime(entry.name, name)) {
      return i;
    }
  }
  return -1;
};

// Returns the index of the first header table entry with the given
// name and value, or -1 if none exists.
HeaderTable.prototype.findIndexWithNameAndValue = function(name, value) {
  if (!isValidHeaderName(name)) {
    throw new Error('Invalid header name: ' + name);
  }

  if (!isValidHeaderValue(value)) {
    throw new Error('Invalid header value: ' + value);
  }

  for (var i = 0; i < this.entries_.length; ++i) {
    var entry = this.entries_[i];
    if (stringsEqualConstantTime(entry.name, name) &&
        stringsEqualConstantTime(entry.value, value)) {
      return i;
    }
  }
  return -1;
};

// fn is called with the index, name, value, isReferenced, and
// touchCount for each entry in order.
HeaderTable.prototype.forEachEntry = function(fn) {
  for (var i = 0; i < this.entries_.length; ++i) {
    var entry = this.entries_[i];
    fn(i, entry.name, entry.value, entry.isReferenced(), entry.getTouchCount());
  }
}

// Tries to append a new entry with the given name and value. Returns
// the index of the new entry if successful, or -1 if not.
HeaderTable.prototype.tryAppendEntry = function(name, value) {
  if (!isValidHeaderName(name)) {
    throw new Error('Invalid header name: ' + name);
  }

  if (!isValidHeaderValue(value)) {
    throw new Error('Invalid header value: ' + value);
  }

  // The algorithm used here is described in 3.2.4.
  var index = -1;
  var newEntry = new HeaderTableEntry(name, value);
  var sizeDelta = newEntry.size();
  while ((this.entries_.length > 0) &&
         ((this.size_ + sizeDelta) > this.maxSize_)) {
    this.removeFirstEntry_();
  }
  if ((this.size_ + sizeDelta) <= this.maxSize_) {
    this.size_ += sizeDelta;
    index = this.entries_.length;
    this.entries_.push(newEntry);
  }
  return index;
}

// Tries to replace the entry at the given index with the given name
// and value. Returns the index of the new or replaced entry if
// successful, or -1 if not.
HeaderTable.prototype.tryReplaceEntry = function(index, name, value) {
  if (!isValidHeaderName(name)) {
    throw new Error('Invalid header name: ' + name);
  }

  if (!isValidHeaderValue(value)) {
    throw new Error('Invalid header value: ' + value);
  }

  // The algorithm used here is described in 3.2.4.
  var newEntry = new HeaderTableEntry(name, value);
  var sizeDelta = newEntry.size() - this.getEntry(index).size();
  while ((this.entries_.length > 0) &&
         (this.size_ + sizeDelta) > this.maxSize_) {
    --index;
    if (index < 0) {
      sizeDelta = newEntry.size();
    }
    this.removeFirstEntry_();
  }
  if ((this.size_ + sizeDelta) <= this.maxSize_) {
    this.size_ += sizeDelta;
    if (index >= 0) {
      this.entries_[index] = newEntry;
    } else {
      index = 0;
      this.entries_.unshift(newEntry);
    }
  } else {
    index = -1;
  }
  return index;
}

// direction can be either REQUEST or RESPONSE, which controls the
// pre-defined header table to use.
function EncodingContext(direction) {
  this.headerTable_ = new HeaderTable();

  var initialHeaderTable =
    (direction == REQUEST) ?
    PRE_DEFINED_REQUEST_HEADER_TABLE :
    PRE_DEFINED_RESPONSE_HEADER_TABLE;
  for (var i = 0; i < initialHeaderTable.length; ++i) {
    var nameValuePair = initialHeaderTable[i];
    this.headerTable_.tryAppendEntry(nameValuePair[0], nameValuePair[1]);
  }
}

EncodingContext.prototype.setHeaderTableMaxSize = function(maxSize) {
  this.headerTable_.setMaxSize(maxSize);
};

EncodingContext.prototype.equals = function(other) {
  return this.headerTable_.equals(other.headerTable_);
};

EncodingContext.prototype.isReferenced = function(index) {
  return this.headerTable_.getEntry(index).isReferenced();
};

EncodingContext.prototype.getTouchCount = function(index) {
  return this.headerTable_.getEntry(index).getTouchCount();
};

EncodingContext.prototype.addTouches = function(index, touchCount) {
  return this.headerTable_.getEntry(index).addTouches(touchCount);
};

EncodingContext.prototype.clearTouches = function(index) {
  return this.headerTable_.getEntry(index).clearTouches();
};

EncodingContext.prototype.getIndexedHeaderName = function(index) {
  return this.headerTable_.getEntry(index).name;
}

EncodingContext.prototype.getIndexedHeaderValue = function(index) {
  return this.headerTable_.getEntry(index).value;
}

EncodingContext.prototype.findIndexWithName = function(name) {
  return this.headerTable_.findIndexWithName(name);
}

EncodingContext.prototype.findIndexWithNameAndValue = function(name, value) {
  return this.headerTable_.findIndexWithNameAndValue(name, value);
}

EncodingContext.prototype.forEachEntry = function(fn) {
  return this.headerTable_.forEachEntry(fn);
}

EncodingContext.prototype.processIndexedHeader = function(index) {
  var entry = this.headerTable_.getEntry(index);
  if (entry.isReferenced()) {
    entry.unsetReferenced();
  } else {
    entry.setReferenced();
  }
}

EncodingContext.prototype.processLiteralHeaderWithIncrementalIndexing =
function(name, value) {
  var index = this.headerTable_.tryAppendEntry(name, value);
  if (index >= 0) {
    this.headerTable_.getEntry(index).setReferenced();
  }
  return index;
}

EncodingContext.prototype.processLiteralHeaderWithSubstitutionIndexing =
function(name, substitutedIndex, value) {
  var index = this.headerTable_.tryReplaceEntry(substitutedIndex, name, value);
  if (index >= 0) {
    this.headerTable_.getEntry(index).setReferenced();
  }
  return index;
}

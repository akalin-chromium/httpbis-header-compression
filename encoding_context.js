'use strict';

var REQUEST = 0;
var RESPONSE = 1;

var PRE_DEFINED_REQUEST_HEADER_TABLE = [
  [ ":scheme",             "http"  ],  // 0
  [ ":scheme",             "https" ],  // 1
  [ ":host",               ""      ],  // 2
  [ ":path",               "/"     ],  // 3
  [ ":method",             "GET"   ],  // 4
  [ "accept",              ""      ],  // 5
  [ "accept-charset",      ""      ],  // 6
  [ "accept-encoding",     ""      ],  // 7
  [ "accept-language",     ""      ],  // 8
  [ "cookie",              ""      ],  // 9
  [ "if-modified-since",   ""      ],  // 10
  [ "user-agent",          ""      ],  // 11
  [ "referer",             ""      ],  // 12
  [ "authorization",       ""      ],  // 13
  [ "allow",               ""      ],  // 14
  [ "cache-control",       ""      ],  // 15
  [ "connection",          ""      ],  // 16
  [ "content-length",      ""      ],  // 17
  [ "content-type",        ""      ],  // 18
  [ "date",                ""      ],  // 19
  [ "expect",              ""      ],  // 20
  [ "from",                ""      ],  // 21
  [ "if-match",            ""      ],  // 22
  [ "if-none-match",       ""      ],  // 23
  [ "if-range",            ""      ],  // 24
  [ "if-unmodified-since", ""      ],  // 25
  [ "max-forwards",        ""      ],  // 26
  [ "proxy-authorization", ""      ],  // 27
  [ "range",               ""      ],  // 28
  [ "via",                 ""      ]   // 29
];

var PRE_DEFINED_RESPONSE_HEADER_TABLE = [
  [ ":status",                     "200" ],  // 0
  [ "age",                         ""    ],  // 1
  [ "cache-control",               ""    ],  // 2
  [ "content-length",              ""    ],  // 3
  [ "content-type",                ""    ],  // 4
  [ "date",                        ""    ],  // 5
  [ "etag",                        ""    ],  // 6
  [ "expires",                     ""    ],  // 7
  [ "last-modified",               ""    ],  // 8
  [ "server",                      ""    ],  // 9
  [ "set-cookie",                  ""    ],  // 10
  [ "vary",                        ""    ],  // 11
  [ "via",                         ""    ],  // 12
  [ "access-control-allow-origin", ""    ],  // 13
  [ "accept-ranges",               ""    ],  // 14
  [ "allow",                       ""    ],  // 15
  [ "connection",                  ""    ],  // 16
  [ "content-disposition",         ""    ],  // 17
  [ "content-encoding",            ""    ],  // 18
  [ "content-language",            ""    ],  // 19
  [ "content-location",            ""    ],  // 20
  [ "content-range",               ""    ],  // 21
  [ "link",                        ""    ],  // 22
  [ "location",                    ""    ],  // 23
  [ "proxy-authenticate",          ""    ],  // 24
  [ "refresh",                     ""    ],  // 25
  [ "retry-after",                 ""    ],  // 26
  [ "strict-transport-security",   ""    ],  // 27
  [ "transfer-encoding",           ""    ],  // 28
  [ "www-authenticate",            ""    ],  // 29
];

function HeaderTable() {
  this.entries_ = [];
  this.size_ = 0;
  this.maxSize_ = 4096;
}

HeaderTable.prototype.removeFirstEntry_ = function() {
  var firstEntry = this.entries_.shift();
  this.size_ -= firstEntry.name.length + firstEntry.value.length + 32;
}

HeaderTable.prototype.setMaxSize = function(maxSize) {
  this.maxSize_ = maxSize;
  var offset = 0;
  while (this.size_ > this.maxSize_) {
    this.removeFirstEntry_();
    --offset;
  }
  return offset;
};

HeaderTable.prototype.equals = function(other) {
  if (this.size_ != other.size_ || this.maxSize_ != other.maxSize_ ||
      this.entries_.length != other.entries_.length) {
    return false;
  }

  for (var i = 0; i < this.entries_.length; ++i) {
    var entry = this.entries_[i];
    var otherEntry = other.entries_[i];
    // TODO(akalin): Compare names case-insensitively.
    if (entry.name != otherEntry.name || entry.value != otherEntry.value) {
      return false;
    }
  }

  return true;
}

HeaderTable.prototype.getEntry = function(index) {
  return (index in this.entries_) ? this.entries_[index] : null;
}

HeaderTable.prototype.findName = function(name) {
  for (var i = 0; i < this.entries_.length; ++i) {
    var entry = this.entries_[i];
    // TODO(akalin): Use constant-time string comparison.
    if (entry.name == name) {
      return i;
    }
  }
  return null;
};

HeaderTable.prototype.findNameAndValue = function(name, value) {
  for (var i = 0; i < this.entries_.length; ++i) {
    var entry = this.entries_[i];
    // TODO(akalin): Use constant-time string comparison.
    if (entry.name == name && entry.value == value) {
      return i;
    }
  }
  return null;
};

HeaderTable.prototype.tryAppendEntry = function(name, value) {
  var index = -1;
  var offset = 0;
  var sizeDelta = name.length + value.length + 32;
  while (this.entries_.length > 0 && this.size_ + sizeDelta > this.maxSize_) {
    --offset;
    this.removeFirstEntry_();
  }
  if (this.size_ + sizeDelta <= this.maxSize_) {
    this.size_ += sizeDelta;
    index = this.entries_.length;
    this.entries_.push({ name: name, value: value });
  }
  return { offset: offset, index: index };
}

HeaderTable.prototype.tryReplaceEntry = function(index, name, value) {
  var offset = 0;
  var existingEntry = this.entries_[index];
  var sizeDelta =
    (name.length + value.length + 32) -
    (existingEntry.name.length + existingEntry.value.length + 32);
  while (this.entries_.length > 0 && this.size_ + sizeDelta > this.maxSize_) {
    --index;
    --offset;
    this.removeFirstEntry_();
  }
  if (this.size_ + sizeDelta <= this.maxSize_) {
    this.size_ += sizeDelta;
    var newEntry = { name: name, value: value };
    if (index >= 0) {
      this.entries_[index] = newEntry;
    } else {
      index = 0;
      ++offset;
      this.entries_.unshift(newEntry);
    }
  } else {
    index = -1;
  }
  return { offset: offset, index: index };
}

function ReferenceSet() {
  this.references_ = {};
}

ReferenceSet.prototype.getNumReferences = function() {
  return Object.keys(this.references_).length;
}

ReferenceSet.prototype.equals = function(other) {
  if (this.getNumReferences() != other.getNumReferences()) {
    return false;
  }
  var diff1 = this.getDifference(other);
  var diff2 = other.getDifference(this);
  return (diff1.getNumReferences() + diff2.getNumReferences()) == 0;
}

ReferenceSet.prototype.hasReference = function(index) {
  return index.toString(10) in this.references_;
}

ReferenceSet.prototype.getReferenceCount = function(index) {
  return this.hasReference(index) ? this.references_[index.toString(10)] : null;
}

ReferenceSet.prototype.addReference = function(index, count) {
  index = index.toString(10);
  if (index < 0) {
    throw new Error('negative index ' + index);
  }
  if (count === undefined) {
    count = 1;
  }
  this.references_[index] = this.references_[index] || 0;
  this.references_[index] += count;
}

ReferenceSet.prototype.removeReference = function(index) {
  delete this.references_[index.toString(10)];
}

ReferenceSet.prototype.processReferences = function(fn) {
  for (var indexStr in this.references_) {
    var index = parseInt(indexStr, 10);
    fn(index);
  }
}

ReferenceSet.prototype.getDifference = function(other) {
  var difference = new ReferenceSet();
  this.processReferences(function(index) {
    if (!other.hasReference(index)) {
      difference.addReference(index);
    }
  });
  return difference;
}

ReferenceSet.prototype.offsetIndices = function(offset) {
  var newReferences = {};
  this.processReferences(function(index) {
    var newIndex = index + offset;
    if (newIndex >= 0) {
      newReferences[newIndex] = 1;
    }
  });
  this.references_ = newReferences;
}

function EncodingContext(direction) {
  this.headerTable_ = new HeaderTable();
  this.referenceSet_ = new ReferenceSet();

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
  var offset = this.headerTable_.setMaxSize(maxSize);
  this.referenceSet_.offsetIndices(offset);
};

EncodingContext.prototype.equals = function(other) {
  return this.headerTable_.equals(other.headerTable_) &&
    this.referenceSet_.equals(other.referenceSet_);
};

EncodingContext.prototype.hasReference = function(index) {
  return this.referenceSet_.hasReference(index);
};

EncodingContext.prototype.getIndexedHeaderName = function(index) {
  var entry = this.headerTable_.getEntry(index);
  if (entry === null) {
    return null;
  }
  return entry.name;
}

EncodingContext.prototype.getIndexedHeaderNameAndValue = function(index) {
  var entry = this.headerTable_.getEntry(index);
  if (entry === null) {
    return null;
  }
  return { name: entry.name, value: entry.value };
}

EncodingContext.prototype.findName = function(name) {
  return this.headerTable_.findName(name);
}

EncodingContext.prototype.findNameAndValue = function(name, value) {
  return this.headerTable_.findNameAndValue(name, value);
}

EncodingContext.prototype.getDifference = function(touched) {
  return this.referenceSet_.getDifference(touched);
}

EncodingContext.prototype.processIndexedHeader = function(index) {
  if (this.referenceSet_.hasReference(index)) {
    this.referenceSet_.removeReference(index);
    return false;
  }
  this.referenceSet_.addReference(index);
  return true;
}

EncodingContext.prototype.processLiteralHeaderWithoutIndexing = function(
  name, value) {
}

EncodingContext.prototype.processLiteralHeaderWithIncrementalIndexing =
function(name, value) {
  var result = this.headerTable_.tryAppendEntry(name, value);
  this.referenceSet_.offsetIndices(result.offset);
  if (result.index >= 0) {
    this.referenceSet_.addReference(result.index);
  }
  return result;
}

EncodingContext.prototype.processLiteralHeaderWithSubstitutionIndexing =
function(name, substitutedIndex, value) {
  var result = this.headerTable_.tryReplaceEntry(substitutedIndex, name, value);
  this.referenceSet_.offsetIndices(result.offset);
  if (result.index >= 0) {
    this.referenceSet_.addReference(result.index);
  }
  return result;
}

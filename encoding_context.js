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
    var entry = this.entries_[i];
    var otherEntry = other.entries_[i];
    // TODO(akalin): Compare names case-insensitively.
    if (entry.name != otherEntry.name || entry.value != otherEntry.value ||
        ('referenced' in entry) != ('referenced' in otherEntry)) {
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

HeaderTable.prototype.isReferenced = function(index) {
  return 'referenced' in this.getEntry(index);
};

HeaderTable.prototype.setReferenced = function(index) {
  this.getEntry(index).referenced = true;
};

HeaderTable.prototype.unsetReferenced = function(index) {
  delete this.getEntry(index).referenced;
};

HeaderTable.prototype.getTouchCount = function(index) {
  var entry = this.getEntry(index);
  return ('touchCount' in entry) ? entry.touchCount : null;
};

HeaderTable.prototype.addTouches = function(index, touchCount) {
  var entry = this.getEntry(index);
  entry.touchCount = entry.touchCount || 0;
  entry.touchCount += touchCount;
};

HeaderTable.prototype.clearTouches = function(index) {
  delete this.getEntry(index).touchCount;
};

HeaderTable.prototype.forEachEntry = function(fn) {
  for (var i = 0; i < this.entries_.length; ++i) {
    var entry = this.entries_[i];
    fn(i, entry.name, entry.value, this.isReferenced(i), this.getTouchCount(i));
  }
}

HeaderTable.prototype.tryAppendEntry = function(name, value) {
  var index = -1;
  var sizeDelta = name.length + value.length + 32;
  while (this.entries_.length > 0 && this.size_ + sizeDelta > this.maxSize_) {
    this.removeFirstEntry_();
  }
  if (this.size_ + sizeDelta <= this.maxSize_) {
    this.size_ += sizeDelta;
    index = this.entries_.length;
    this.entries_.push({ name: name, value: value });
  }
  return index;
}

HeaderTable.prototype.tryReplaceEntry = function(index, name, value) {
  var existingEntry = this.entries_[index];
  var sizeDelta =
    (name.length + value.length + 32) -
    (existingEntry.name.length + existingEntry.value.length + 32);
  while (this.entries_.length > 0 && this.size_ + sizeDelta > this.maxSize_) {
    --index;
    this.removeFirstEntry_();
  }
  if (this.size_ + sizeDelta <= this.maxSize_) {
    this.size_ += sizeDelta;
    var newEntry = { name: name, value: value };
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
  return this.headerTable_.isReferenced(index);
};

EncodingContext.prototype.getTouchCount = function(index) {
  return this.headerTable_.getTouchCount(index);
};

EncodingContext.prototype.addTouches = function(index, touchCount) {
  return this.headerTable_.addTouches(index, touchCount);
};

EncodingContext.prototype.clearTouches = function(index) {
  return this.headerTable_.clearTouches(index);
};

EncodingContext.prototype.getIndexedHeaderName = function(index) {
  return this.headerTable_.getEntry(index).name;
}

EncodingContext.prototype.getIndexedHeaderNameAndValue = function(index) {
  var entry = this.headerTable_.getEntry(index);
  return { name: entry.name, value: entry.value };
}

EncodingContext.prototype.findName = function(name) {
  return this.headerTable_.findName(name);
}

EncodingContext.prototype.findNameAndValue = function(name, value) {
  return this.headerTable_.findNameAndValue(name, value);
}

EncodingContext.prototype.forEachEntry = function(fn) {
  return this.headerTable_.forEachEntry(fn);
}

EncodingContext.prototype.processIndexedHeader = function(index) {
  if (this.headerTable_.isReferenced(index)) {
    this.headerTable_.unsetReferenced(index);
  } else {
    this.headerTable_.setReferenced(index);
  }
}

EncodingContext.prototype.processLiteralHeaderWithIncrementalIndexing =
function(name, value) {
  var index = this.headerTable_.tryAppendEntry(name, value);
  if (index >= 0) {
    this.headerTable_.setReferenced(index);
  }
  return index;
}

EncodingContext.prototype.processLiteralHeaderWithSubstitutionIndexing =
function(name, substitutedIndex, value) {
  var index = this.headerTable_.tryReplaceEntry(substitutedIndex, name, value);
  if (index >= 0) {
    this.headerTable_.setReferenced(index);
  }
  return index;
}

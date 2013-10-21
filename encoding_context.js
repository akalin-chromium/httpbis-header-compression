'use strict';

var CLIENT_TO_SERVER_CODEBOOK = buildCodebook(CLIENT_TO_SERVER_FREQ_TABLE);
var SERVER_TO_CLIENT_CODEBOOK = buildCodebook(SERVER_TO_CLIENT_FREQ_TABLE);

var INVERSE_CLIENT_TO_SERVER_CODEBOOK = buildInverseCodebook(CLIENT_TO_SERVER_CODEBOOK);
var INVERSE_SERVER_TO_CLIENT_CODEBOOK = buildInverseCodebook(SERVER_TO_CLIENT_CODEBOOK);

var ENCODE_HUFFMAN = 1;
var IS_REQUEST = 1;     // 1 implies request. 0 implies response.
var USE_STATIC_TABLE = 1;

// For simplicity, we assume that the character codes of a string
// represent an octet sequence. This implies that strings with
// characters greater than \xff are invalid; this policy is
// encapsulated in the isValidHeader{Name,Value}() functions below.

// Indexed header (4.2).
var INDEX_VALUE = 0x1;
var INDEX_N = 7;

// Literal header without indexing (4.3.1).
var LITERAL_NO_INDEX_VALUE = 0x1;
var LITERAL_NO_INDEX_N = 6;

// Literal header with incremental indexing (4.3.2).
var LITERAL_INCREMENTAL_VALUE = 0x0;
var LITERAL_INCREMENTAL_N = 6;

var OPCODES = {
  UNKNOWN_OPCODE             : {value:   0, opcode_len: 8, prefix_len: 0, name: "UNKNOWN_OPCODE"},
  INDEX_OPCODE               : {value: 0x0, opcode_len: 1, prefix_len: 7, name: "INDEX_OPCODE"},
  LITERAL_INCREMENTAL_OPCODE : {value: 0x0, opcode_len: 2, prefix_len: 6, name: "LITERAL_INCREMENTAL_OPCODE"},
  LITERAL_NO_INDEX_OPCODE    : {value: 0x1, opcode_len: 2, prefix_len: 6, name: "LITERAL_NO_INDEX_OPCODE"},
};

// Constants for the direction parameter to EncodingContext (which
// controls which of the two pre-defined header tables below are
// used).
var REQUEST = 0;
var RESPONSE = 1;

// From Appendix C
var STATIC_HEADER_TABLE = [
  {name: ":authority"                  , value: ""           }, // 0
  {name: ":method"                     , value: "GET"        }, // 1
  {name: ":method"                     , value: "POST"       }, // 2
  {name: ":path"                       , value: "/"          }, // 3
  {name: ":path"                       , value: "/index.html"}, // 4
  {name: ":scheme"                     , value: "http"       }, // 5
  {name: ":scheme"                     , value: "https"      }, // 6
  {name: ":status"                     , value: "200"        }, // 7
  {name: ":status"                     , value: "500"        }, // 8
  {name: ":status"                     , value: "404"        }, // 9
  {name: ":status"                     , value: "403"        }, // 10
  {name: ":status"                     , value: "400"        }, // 11
  {name: ":status"                     , value: "401"        }, // 12
  {name: "accept-charset"              , value: ""           }, // 13
  {name: "accept-encoding"             , value: ""           }, // 14
  {name: "accept-language"             , value: ""           }, // 15
  {name: "accept-ranges"               , value: ""           }, // 16
  {name: "accept"                      , value: ""           }, // 17
  {name: "access-control-allow-origin" , value: ""           }, // 18
  {name: "age"                         , value: ""           }, // 19
  {name: "allow"                       , value: ""           }, // 20
  {name: "authorization"               , value: ""           }, // 21
  {name: "cache-control"               , value: ""           }, // 22
  {name: "content-disposition"         , value: ""           }, // 23
  {name: "content-encoding"            , value: ""           }, // 24
  {name: "content-language"            , value: ""           }, // 25
  {name: "content-length"              , value: ""           }, // 26
  {name: "content-location"            , value: ""           }, // 27
  {name: "content-range"               , value: ""           }, // 28
  {name: "content-type"                , value: ""           }, // 29
  {name: "cookie"                      , value: ""           }, // 30
  {name: "date"                        , value: ""           }, // 31
  {name: "etag"                        , value: ""           }, // 32
  {name: "expect"                      , value: ""           }, // 33
  {name: "expires"                     , value: ""           }, // 34
  {name: "from"                        , value: ""           }, // 35
  {name: "if-match"                    , value: ""           }, // 36
  {name: "if-modified-since"           , value: ""           }, // 37
  {name: "if-none-match"               , value: ""           }, // 38
  {name: "if-range"                    , value: ""           }, // 39
  {name: "if-unmodified-since"         , value: ""           }, // 40
  {name: "last-modified"               , value: ""           }, // 41
  {name: "link"                        , value: ""           }, // 42
  {name: "location"                    , value: ""           }, // 43
  {name: "max-forwards"                , value: ""           }, // 44
  {name: "proxy-authenticate"          , value: ""           }, // 45
  {name: "proxy-authorization"         , value: ""           }, // 46
  {name: "range"                       , value: ""           }, // 47
  {name: "referer"                     , value: ""           }, // 48
  {name: "refresh"                     , value: ""           }, // 49
  {name: "retry-after"                 , value: ""           }, // 50
  {name: "server"                      , value: ""           }, // 51
  {name: "set-cookie"                  , value: ""           }, // 52
  {name: "strict-transport-security"   , value: ""           }, // 53
  {name: "transfer-encoding"           , value: ""           }, // 54
  {name: "user-agent"                  , value: ""           }, // 55
  {name: "vary"                        , value: ""           }, // 56
  {name: "via"                         , value: ""           }, // 57
  {name: "www-authenticate"            , value: ""           }, // 58
];

// This regexp matches a string exactly when the octets represented by
// that string match the header-name rule in 4.1.2. Note that - comes
// first in the character set since it has special meaning otherwise.
var VALID_HEADER_NAME_REGEXP = /^:?[-!#$%&'*+.^_`|~0-9a-z]+$/;

// This regexp matches a string exactly when the octets represented by
// that string conforms to (the expected future content of) 4.1.3.
//
// The specification allows for arbitrary octet sequences in values.
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
function HeaderTableEntry(name, value, isStatic) {
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
};

// This size calculation comes from 3.1.2.
HeaderTableEntry.prototype.size = function() {
  return this.name.length + this.value.length + 32;
};

HeaderTableEntry.prototype.isReferenced = function() {
  return 'referenced_' in this;
};

HeaderTableEntry.prototype.setReferenced = function() {
  //console.log("setting referenced: ", this)
  this.referenced_ = true;
};

HeaderTableEntry.prototype.unsetReferenced = function() {
  //console.log("unsetting referenced: ", this)
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

// Since the reference set is encoded as part of every/any entry's data,
// removing the entry removes references to it as well.
HeaderTable.prototype.removeLastEntry_ = function() {
  var firstEntry = this.entries_.shift();
  this.size_ -= firstEntry.size();
};

HeaderTable.prototype.setMaxSize = function(maxSize) {
  this.maxSize_ = maxSize;
  while (this.size_ > this.maxSize_ && this.entries_.length > 0) {
    this.removeLastEntry_();
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
};

HeaderTable.prototype.getEntry = function(index) {
  if (index < 0) {
    throw new Error('Invalid index ' + index);
  }
  if (index < this.entries_.length) {
    return this.entries_[index];
  }
  if (USE_STATIC_TABLE) {
    var static_index = index - this.entries_.length;
    if (static_index < STATIC_HEADER_TABLE.length) {
      var static_entry = STATIC_HEADER_TABLE[static_index];
      return new HeaderTableEntry(static_entry.name, static_entry.value);
    }
  }
  throw new Error('Invalid index ' + index);
};

// Returns the index of the first header table entry with the given
// name, or -1 if none exists.
HeaderTable.prototype.findIndexWithName = function(name) {
  if (!isValidHeaderName(name)) {
    throw new Error('Invalid header name: ' + name);
  }
  //console.log("findIndexWithName: ", name);

  for (var i = 0; i < this.entries_.length; ++i) {
    var entry = this.entries_[i];
    if (stringsEqualConstantTime(entry.name, name)) {
      //console.log("found at idx: ", i);
      return i;
    }
  }
  if (USE_STATIC_TABLE) {
    for (var i = 0; i < STATIC_HEADER_TABLE.length; ++i) {
      var entry = STATIC_HEADER_TABLE[i];
      if (stringsEqualConstantTime(entry.name, name)) {
        //console.log("found at idx: ", i);
        return i + this.entries_.length;
      }
    }
  }
  //console.log("Nothing found.");
  return -1;
};

// Returns the index of the first header table entry with the given
// name and value, or -1 if none exists.
HeaderTable.prototype.findIndexWithNameAndValue = function(name, value) {
  //console.log("findIndexWithNameAndValue: ", name, value);
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
      //console.log("found at idx: ", i);
      return i;
    }
  }
  if (USE_STATIC_TABLE) {
    for (var i = 0; i < STATIC_HEADER_TABLE; ++i) {
      var entry = STATIC_HEADER_TABLE[i];
      if (stringsEqualConstantTime(entry.name, name) &&
          stringsEqualConstantTime(entry.value, value)) {
            //console.log("found at idx: ", i);
            return i + this.entries_.length();
          }
    }
  }
  //console.log("Nothing found.");
  return -1;
};

// fn is called with the index, name, value, isReferenced, and
// touchCount for each entry in order.
HeaderTable.prototype.forEachEntry = function(fn) {
  for (var i = 0; i < this.entries_.length; ++i) {
    var entry = this.entries_[i];
    fn(i, entry.name, entry.value, entry.isReferenced(), entry.getTouchCount());
  }
};

// Tries to append a new entry with the given name and value. Returns
// the index of the new entry if successful, or -1 if
// not. onReferenceSetRemovalFn is called with the index of every
// entry in the reference set that will be removed, before any of them
// are removed.
HeaderTable.prototype.tryAppendEntry = function(
  name, value, onReferenceSetRemovalFn) {
  if (!isValidHeaderName(name)) {
    throw new Error('Invalid header name: ' + name);
  }

  if (!isValidHeaderValue(value)) {
    throw new Error('Invalid header value: ' + value);
  }
  //console.log("tryAppendEntry with ", name, value);

  // The algorithm used here is described in 3.2.4.
  var newEntry = new HeaderTableEntry(name, value);
  var sizeDelta = newEntry.size();
  var targetSize = Math.max(0, this.maxSize_ - sizeDelta);
  while (this.entries_.length > 0 && (this.size_ > targetSize)) {
    onReferenceSetRemovalFn(this.entries_.length - 1);
    var evicted = this.entries_.shift();
    this.size_ -= evicted.size();
  }
  if (sizeDelta <= this.maxSize_) {
    this.entries_.unshift(newEntry);
    this.size_ += sizeDelta;
    //console.log("Added new element ", newEntry);
    return 0;
  }
  return -1;
};

// direction can be either REQUEST or RESPONSE, which controls the
// pre-defined header table to use.
function EncodingContext(direction) {
  // As described in 3.1.1, the encoding context contains a header
  // table and a reference set. Since HeaderTable already has the
  // functionality of a reference set, and since the StaticTable
  // is shared that's the only thing we need.
  this.headerTable_ = new HeaderTable();
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
};

EncodingContext.prototype.getIndexedHeaderValue = function(index) {
  return this.headerTable_.getEntry(index).value;
};

EncodingContext.prototype.findIndexWithName = function(name) {
  return this.headerTable_.findIndexWithName(name);
};

EncodingContext.prototype.findIndexWithNameAndValue = function(name, value) {
  return this.headerTable_.findIndexWithNameAndValue(name, value);
};

EncodingContext.prototype.forEachEntry = function(fn) {
  return this.headerTable_.forEachEntry(fn);
};

// The functions below must be called when the corresponding operation
// is done by the encoder/decoder.

EncodingContext.prototype.processIndexedHeader = function(index) {
// This follows the process described in 3.2.1.
  var entry = this.headerTable_.getEntry(index);
  //console.log("referenced:", index, this.headerTable_.getEntry(index));
  if (entry.isReferenced()) {
    entry.unsetReferenced();
  } else {
    entry.setReferenced();
  }
};

// Returns the index of the new entry if the header was successfully
// indexed, or -1 if not. onReferenceSetRemovalFn is called with the
// index of every entry in the reference set that will be removed,
// before any of them are removed.
EncodingContext.prototype.processLiteralHeaderWithIncrementalIndexing =
function(name, value, onReferenceSetRemovalFn) {
  // This follows the process described in 3.2.1.
  var index = this.headerTable_.tryAppendEntry(
    name, value, onReferenceSetRemovalFn);
  if (index >= 0) {
    //console.log("literal+incremental_indexing:", this.headerTable_.getEntry(index));
    this.headerTable_.getEntry(index).setReferenced();
  }
  return index;
};


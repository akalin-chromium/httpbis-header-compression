'use strict';

var CLIENT_TO_SERVER_CODEBOOK = buildCodebook(CLIENT_TO_SERVER_FREQ_TABLE);
var SERVER_TO_CLIENT_CODEBOOK = buildCodebook(SERVER_TO_CLIENT_FREQ_TABLE);

var INVERSE_CLIENT_TO_SERVER_CODEBOOK = buildInverseCodebook(CLIENT_TO_SERVER_CODEBOOK);
var INVERSE_SERVER_TO_CLIENT_CODEBOOK = buildInverseCodebook(SERVER_TO_CLIENT_CODEBOOK);

var ENCODE_HUFFMAN = 0; // 1 to enable, 0 to disable.
var IS_REQUEST = 1;     // 1 implies request. 0 implies response.

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
  [":authority"                  , ""           ], // 0
  [":method"                     , "GET"        ], // 1
  [":method"                     , "POST"       ], // 2
  [":path"                       , "/"          ], // 3
  [":path"                       , "/index.html"], // 4
  [":scheme"                     , "http"       ], // 5
  [":scheme"                     , "https"      ], // 6
  [":status"                     , "200"        ], // 7
  [":status"                     , "500"        ], // 8
  [":status"                     , "404"        ], // 9
  [":status"                     , "403"        ], // 10
  [":status"                     , "400"        ], // 11
  [":status"                     , "401"        ], // 12
  ["accept-charset"              , ""           ], // 13
  ["accept-encoding"             , ""           ], // 14
  ["accept-language"             , ""           ], // 15
  ["accept-ranges"               , ""           ], // 16
  ["accept"                      , ""           ], // 17
  ["access-control-allow-origin" , ""           ], // 18
  ["age"                         , ""           ], // 19
  ["allow"                       , ""           ], // 20
  ["authorization"               , ""           ], // 21
  ["cache-control"               , ""           ], // 22
  ["content-disposition"         , ""           ], // 23
  ["content-encoding"            , ""           ], // 24
  ["content-language"            , ""           ], // 25
  ["content-length"              , ""           ], // 26
  ["content-location"            , ""           ], // 27
  ["content-range"               , ""           ], // 28
  ["content-type"                , ""           ], // 29
  ["cookie"                      , ""           ], // 30
  ["date"                        , ""           ], // 31
  ["etag"                        , ""           ], // 32
  ["expect"                      , ""           ], // 33
  ["expires"                     , ""           ], // 34
  ["from"                        , ""           ], // 35
  ["if-match"                    , ""           ], // 36
  ["if-modified-since"           , ""           ], // 37
  ["if-none-match"               , ""           ], // 38
  ["if-range"                    , ""           ], // 39
  ["if-unmodified-since"         , ""           ], // 40
  ["last-modified"               , ""           ], // 41
  ["link"                        , ""           ], // 42
  ["location"                    , ""           ], // 43
  ["max-forwards"                , ""           ], // 44
  ["proxy-authenticate"          , ""           ], // 45
  ["proxy-authorization"         , ""           ], // 46
  ["range"                       , ""           ], // 47
  ["referer"                     , ""           ], // 48
  ["refresh"                     , ""           ], // 49
  ["retry-after"                 , ""           ], // 50
  ["server"                      , ""           ], // 51
  ["set-cookie"                  , ""           ], // 52
  ["strict-transport-security"   , ""           ], // 53
  ["transfer-encoding"           , ""           ], // 54
  ["user-agent"                  , ""           ], // 55
  ["vary"                        , ""           ], // 56
  ["via"                         , ""           ], // 57
  ["www-authenticate"            , ""           ], // 58
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
};

// This size calculation comes from 3.1.2.
HeaderTableEntry.prototype.size = function() {
  return this.name.length + this.value.length + 32;
};

HeaderTableEntry.prototype.isReferenced = function() {
  return 'referenced_' in this;
};

HeaderTableEntry.prototype.setReferenced = function() {
  console.log("setting referenced: ", this)
  this.referenced_ = true;
};

HeaderTableEntry.prototype.unsetReferenced = function() {
  console.log("unsetting referenced: ", this)
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

HeaderTable.prototype.removeLastEntry_ = function() {
  var firstEntry = this.entries_.shift();
  this.size_ -= firstEntry.size();
};

HeaderTable.prototype.setMaxSize = function(maxSize) {
  this.maxSize_ = maxSize;
  while (this.size_ > this.maxSize_ &&
         this.entries_.length > 0) {
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
  if (!(index in this.entries_)) {
    throw new Error('Invalid index ' + index);
  }
  return this.entries_[index];
};

// Returns the index of the first header table entry with the given
// name, or -1 if none exists.
HeaderTable.prototype.findIndexWithName = function(name) {
  if (!isValidHeaderName(name)) {
    throw new Error('Invalid header name: ' + name);
  }
  console.log("findIndexWithName: ", name);

  for (var i = 0; i < this.entries_.length; ++i) {
    var entry = this.entries_[i];
    if (stringsEqualConstantTime(entry.name, name)) {
      console.log("found at idx: ", i);
      return i;
    }
  }
  console.log("Nothing found.");
  return -1;
};

// Returns the index of the first header table entry with the given
// name and value, or -1 if none exists.
HeaderTable.prototype.findIndexWithNameAndValue = function(name, value) {
  console.log("findIndexWithNameAndValue: ", name, value);
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
      console.log("found at idx: ", i);
      return i;
    }
  }
  console.log("Nothing found.");
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
  console.log("tryAppendEntry with ", name, value);

  // The algorithm used here is described in 3.2.4.
  var index = -1;
  var newEntry = new HeaderTableEntry(name, value);
  var sizeDelta = newEntry.size();
  var numToShift = 0;
  var sizeAfterShift = this.size_;
  while (this.entries_.length > 0 &&
         ((sizeAfterShift + sizeDelta) > this.maxSize_)) {
    onReferenceSetRemovalFn(this.entries_.length - 1);
    var evicted = this.entries_.shift();
    sizeAfterShift -= evicted.size();
  }
  this.size_ = sizeAfterShift;
  if (sizeDelta <= this.maxSize_) {
    index = 0;
    this.entries_.unshift(newEntry);
    console.log("Added new element ", newEntry);
  } else {
    console.log("New element size", sizeDelta, "is too large to add");
  }
  return index;
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
  console.log("referenced:", index, this.headerTable_.getEntry(index));
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
    console.log("literal+incremental_indexing:", this.headerTable_.getEntry(index));
    this.headerTable_.getEntry(index).setReferenced();
  }
  return index;
};


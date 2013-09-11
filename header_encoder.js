'use strict';

function Encoder() {
  this.buffer_ = [];
}

Encoder.prototype.encodeOctet = function(o) {
  this.buffer_.push(o & 0xff);
};

Encoder.prototype.encodeInteger = function(firstOctetMask, N, I) {
  var nextMarker = (1 << N) - 1;

  if (I < nextMarker) {
    this.encodeOctet(firstOctetMask | I);
    return;
  }

  if (N > 0) {
    this.encodeOctet(firstOctetMask | nextMarker);
  }

  I -= nextMarker;
  while (I >= 128) {
    this.encodeOctet(I % 128 | 128);
    // Divide I by 128. (Remember that / in JavaScript is
    // floating-point division).
    I >>= 7;
  }
  this.encodeOctet(I);
}

Encoder.prototype.encodeASCIIString = function(str) {
  this.encodeInteger(0, 0, str.length);
  for (var i = 0; i < str.length; ++i) {
    this.encodeOctet(str.charCodeAt(i));
  }
}

Encoder.prototype.encodeIndexedHeader = function(index) {
  var opCode = 0x80;
  var prefixLength = 7;
  this.encodeInteger(opCode, prefixLength, index);
}

Encoder.prototype.encodeLiteralHeaderWithoutIndexing = function(
  indexOrName, value) {
  var opCode = 0x60;
  var prefixLength = 5;
  switch (typeof indexOrName) {
    case 'number':
      this.encodeInteger(opCode, prefixLength, indexOrName + 1);
      this.encodeASCIIString(value);
      return;

    case 'string':
      this.encodeInteger(opCode, prefixLength, 0);
      this.encodeASCIIString(indexOrName);
      this.encodeASCIIString(value);
      return;
  }

  throw new Error('not an index or name: ' + indexOrName);
}

Encoder.prototype.encodeLiteralHeaderWithIncrementalIndexing = function(
  indexOrName, value) {
  var opCode = 0x20;
  var prefixLength = 5;
  switch (typeof indexOrName) {
    case 'number':
      this.encodeInteger(opCode, prefixLength, indexOrName + 1);
      this.encodeASCIIString(value);
      return;

    case 'string':
      this.encodeInteger(opCode, prefixLength, 0);
      this.encodeASCIIString(indexOrName);
      this.encodeASCIIString(value);
      return;
  }

  throw new Error('not an index or name: ' + indexOrName);
}

Encoder.prototype.encodeLiteralHeaderWithSubstitutionIndexing = function(
  indexOrName, substitutedIndex, value) {
  var opCode = 0x0;
  var prefixLength = 6;
  switch (typeof indexOrName) {
    case 'number':
      this.encodeInteger(opCode, prefixLength, indexOrName + 1);
      this.encodeInteger(0, 0, substitutedIndex);
      this.encodeASCIIString(value);
      return;

    case 'string':
      this.encodeInteger(opCode, prefixLength, 0);
      this.encodeASCIIString(indexOrName);
      this.encodeInteger(0, 0, substitutedIndex);
      this.encodeASCIIString(value);
      return;
  }

  throw new Error('not an index or name: ' + indexOrName);
}

Encoder.prototype.flush = function() {
  var buffer = this.buffer_;
  this.buffer_ = [];
  return buffer;
}

function HeaderEncoder(direction, compressionLevel) {
  this.encodingContext_ = new EncodingContext(direction);
  this.compressionLevel_ = compressionLevel;
}

HeaderEncoder.prototype.encodeHeaderSet = function(headerSet) {
  var encoder = new Encoder();
  for (var i = 0; i < headerSet.length; ++i) {
    var nameValuePair = headerSet[i];
    var name = nameValuePair[0];
    var index = null;
    if (this.compressionLevel_ > 0) {
      index = this.encodingContext_.findName(name);
    }
    var indexOrName = (index === null) ? name : index;
    var value = nameValuePair[1];
    this.encodingContext_.processLiteralHeaderWithoutIndexing(
      indexOrName, value);
    encoder.encodeLiteralHeaderWithoutIndexing(indexOrName, value);
  }
  return encoder.flush();
}

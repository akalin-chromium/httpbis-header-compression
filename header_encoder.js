'use strict';

function Encoder() {
  this.buffer_ = [];
}

Encoder.prototype.encodeOctet = function(o) {
  this.buffer_.push(o & 0xff);
};

// Encodes an integer I into the representation described in 4.1.1. N
// is the number of bits of the prefix as described in 4.1.1, and
// opCode is put into the top (8 - N) bytes of the first octet of the
// encoded integer.
Encoder.prototype.encodeInteger = function(opCode, N, I) {
  var nextMarker = (1 << N) - 1;

  if (I < nextMarker) {
    this.encodeOctet((opCode << N) | I);
    return;
  }

  if (N > 0) {
    this.encodeOctet((opCode << N) | nextMarker);
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

// Encodes the given octet sequence represented by a string as a
// length-prefixed octet sequence.
Encoder.prototype.encodeOctetSequence = function(str) {
  this.encodeInteger(0, 0, str.length);
  for (var i = 0; i < str.length; ++i) {
    this.encodeOctet(str.charCodeAt(i));
  }
}

// Encode an indexed header as described in 4.2.
Encoder.prototype.encodeIndexedHeader = function(index) {
  var opCode = 0x1;
  var prefixLength = 7;
  this.encodeInteger(opCode, prefixLength, index);
}

// Encode a literal header without indexing as described in 4.3.1.
Encoder.prototype.encodeLiteralHeaderWithoutIndexing = function(
  indexOrName, value) {
  var opCode = 0x3;
  var prefixLength = 5;
  switch (typeof indexOrName) {
    case 'number':
      this.encodeInteger(opCode, prefixLength, indexOrName + 1);
      this.encodeOctetSequence(value);
      return;

    case 'string':
      this.encodeInteger(opCode, prefixLength, 0);
      this.encodeOctetSequence(indexOrName);
      this.encodeOctetSequence(value);
      return;
  }

  throw new Error('not an index or name: ' + indexOrName);
}

// Encode a literal header with incremental indexing as described in
// 4.3.2.
Encoder.prototype.encodeLiteralHeaderWithIncrementalIndexing = function(
  indexOrName, value) {
  var opCode = 0x2;
  var prefixLength = 5;
  switch (typeof indexOrName) {
    case 'number':
      this.encodeInteger(opCode, prefixLength, indexOrName + 1);
      this.encodeOctetSequence(value);
      return;

    case 'string':
      this.encodeInteger(opCode, prefixLength, 0);
      this.encodeOctetSequence(indexOrName);
      this.encodeOctetSequence(value);
      return;
  }

  throw new Error('not an index or name: ' + indexOrName);
}

// Encode a literal header with substitution indexing as described in
// 4.3.3.
Encoder.prototype.encodeLiteralHeaderWithSubstitutionIndexing = function(
  indexOrName, substitutedIndex, value) {
  var opCode = 0x0;
  var prefixLength = 6;
  switch (typeof indexOrName) {
    case 'number':
      this.encodeInteger(opCode, prefixLength, indexOrName + 1);
      this.encodeInteger(0, 0, substitutedIndex);
      this.encodeOctetSequence(value);
      return;

    case 'string':
      this.encodeInteger(opCode, prefixLength, 0);
      this.encodeOctetSequence(indexOrName);
      this.encodeInteger(0, 0, substitutedIndex);
      this.encodeOctetSequence(value);
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

HeaderEncoder.prototype.setHeaderTableMaxSize = function(maxSize) {
  this.encodingContext_.setHeaderTableMaxSize(maxSize);
};

HeaderEncoder.prototype.encodeHeaderSet = function(headerSet) {
  var encoder = new Encoder();
  for (var i = 0; i < headerSet.length; ++i) {
    var nameValuePair = headerSet[i];
    var name = nameValuePair[0];
    var value = nameValuePair[1];
    if (!isValidHeaderName(name)) {
      throw new Error('Invalid header name: ' + name);
    }

    if (!isValidHeaderValue(value)) {
      throw new Error('Invalid header value: ' + value);
    }

    if (this.compressionLevel_ > 1) {
      var nameValueIndex = this.encodingContext_.findNameAndValue(name, value);
      if (nameValueIndex !== null) {
        if (this.encodingContext_.isReferenced(nameValueIndex)) {
          var emittedCount =
            this.encodingContext_.getTouchCount(nameValueIndex);
          if (emittedCount === null) {
            this.encodingContext_.addTouches(nameValueIndex, 0);
          } else if (emittedCount == 0) {
            encoder.encodeIndexedHeader(nameValueIndex);
            this.encodingContext_.processIndexedHeader(nameValueIndex);
            encoder.encodeIndexedHeader(nameValueIndex);
            this.encodingContext_.processIndexedHeader(nameValueIndex);
            encoder.encodeIndexedHeader(nameValueIndex);
            this.encodingContext_.processIndexedHeader(nameValueIndex);
            encoder.encodeIndexedHeader(nameValueIndex);
            this.encodingContext_.processIndexedHeader(nameValueIndex);
            this.encodingContext_.addTouches(nameValueIndex, 2);
          } else {
            encoder.encodeIndexedHeader(nameValueIndex);
            this.encodingContext_.processIndexedHeader(nameValueIndex);
            encoder.encodeIndexedHeader(nameValueIndex);
            this.encodingContext_.processIndexedHeader(nameValueIndex);
            this.encodingContext_.addTouches(nameValueIndex, 1);
          }
        } else {
          encoder.encodeIndexedHeader(nameValueIndex);
          this.encodingContext_.processIndexedHeader(nameValueIndex);
          this.encodingContext_.addTouches(nameValueIndex, 1);
        }
        continue;
      }
    }

    var index = null;
    if (this.compressionLevel_ > 0) {
      index = this.encodingContext_.findName(name);
    }

    if (this.compressionLevel_ > 2) {
      if (index !== null) {
        encoder.encodeLiteralHeaderWithSubstitutionIndexing(
          index, index, value);
        index =
          this.encodingContext_.processLiteralHeaderWithSubstitutionIndexing(
            name, index, value);
        if (index >= 0) {
          this.encodingContext_.addTouches(index, 1);
        }
        continue;
      }
    }

    if (this.compressionLevel_ > 3) {
      if (index === null) {
        index =
          this.encodingContext_.processLiteralHeaderWithIncrementalIndexing(
            name, value);
        encoder.encodeLiteralHeaderWithIncrementalIndexing(name, value);
        if (index >= 0) {
          this.encodingContext_.addTouches(index, 1);
        }
        continue;
      }
    }

    var indexOrName = (index === null) ? name : index;
    encoder.encodeLiteralHeaderWithoutIndexing(indexOrName, value);
  }

  this.encodingContext_.forEachEntry(
    function(index, name, value, referenced, touchCount) {
      if (referenced && (touchCount === null)) {
        encoder.encodeIndexedHeader(index);
        this.encodingContext_.processIndexedHeader(index);
      }
      this.encodingContext_.clearTouches(index);
    }.bind(this));

  return encoder.flush();
}

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
  var opCode = 0x40;
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

HeaderEncoder.prototype.setHeaderTableMaxSize = function(maxSize) {
  this.encodingContext_.setHeaderTableMaxSize(maxSize);
};

HeaderEncoder.prototype.encodeHeaderSet = function(headerSet) {
  var encoder = new Encoder();
  var emitted = new ReferenceSet();
  for (var i = 0; i < headerSet.length; ++i) {
    var nameValuePair = headerSet[i];
    var name = nameValuePair[0];
    var value = nameValuePair[1];
    if (this.compressionLevel_ > 1) {
      var nameValueIndex = this.encodingContext_.findNameAndValue(name, value);
      if (nameValueIndex !== null) {
        if (this.encodingContext_.hasReference(nameValueIndex)) {
          var emittedCount = emitted.getReferenceCount(nameValueIndex);
          if (emittedCount === null) {
            emitted.addReference(nameValueIndex, 0);
          } else if (emittedCount == 0) {
            encoder.encodeIndexedHeader(nameValueIndex);
            this.encodingContext_.processIndexedHeader(nameValueIndex);
            encoder.encodeIndexedHeader(nameValueIndex);
            this.encodingContext_.processIndexedHeader(nameValueIndex);
            encoder.encodeIndexedHeader(nameValueIndex);
            this.encodingContext_.processIndexedHeader(nameValueIndex);
            encoder.encodeIndexedHeader(nameValueIndex);
            this.encodingContext_.processIndexedHeader(nameValueIndex);
            emitted.addReference(nameValueIndex, 2);
          } else {
            encoder.encodeIndexedHeader(nameValueIndex);
            this.encodingContext_.processIndexedHeader(nameValueIndex);
            encoder.encodeIndexedHeader(nameValueIndex);
            this.encodingContext_.processIndexedHeader(nameValueIndex);
            emitted.addReference(nameValueIndex, 1);
          }
        } else {
          encoder.encodeIndexedHeader(nameValueIndex);
          this.encodingContext_.processIndexedHeader(nameValueIndex);
          emitted.addReference(nameValueIndex, 1);
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
        var result =
          this.encodingContext_.processLiteralHeaderWithSubstitutionIndexing(
            name, index, value);
        encoder.encodeLiteralHeaderWithSubstitutionIndexing(
          index, index, value);
        emitted.offsetIndices(result.offset);
        if (result.index >= 0) {
          emitted.addReference(result.index);
        }
        continue;
      }
    }

    if (this.compressionLevel_ > 3) {
      if (index === null) {
        var result =
          this.encodingContext_.processLiteralHeaderWithIncrementalIndexing(
            name, value);
        encoder.encodeLiteralHeaderWithIncrementalIndexing(name, value);
        emitted.offsetIndices(result.offset);
        if (result.index >= 0) {
          emitted.addReference(result.index);
        }
        continue;
      }
    }

    this.encodingContext_.processLiteralHeaderWithoutIndexing(
      name, value);
    var indexOrName = (index === null) ? name : index;
    encoder.encodeLiteralHeaderWithoutIndexing(indexOrName, value);
  }

  var untouched = this.encodingContext_.getDifference(emitted);
  var self = this;
  untouched.processReferences(function(index) {
    encoder.encodeIndexedHeader(index);
    self.encodingContext_.processIndexedHeader(index);
  });

  return encoder.flush();
}

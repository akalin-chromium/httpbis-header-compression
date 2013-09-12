'use strict';

function Decoder(buffer) {
  this.buffer_ = buffer;
  this.i_ = 0;
}

Decoder.prototype.hasData = function() {
  return this.i_ < this.buffer_.length;
};

Decoder.prototype.peekNextOctet = function() {
  if (!this.hasData()) {
    return null;
  }
  return this.buffer_[this.i_] & 0xff;
};

Decoder.prototype.decodeNextOctet = function() {
  var nextOctet = this.peekNextOctet();
  if (nextOctet === null) {
    return null;
  }
  ++this.i_;
  return nextOctet;
};

Decoder.prototype.decodeNextInteger = function(N) {
  var I = 0;
  var hasMore = true;
  var shift = N;

  if (N > 0) {
    var nextMarker = (1 << N) - 1;
    var nextOctet = this.decodeNextOctet();
    if (nextOctet === null) {
      return null;
    }
    I = nextOctet & nextMarker;
    hasMore = (I == nextMarker);
  }

  while (hasMore) {
    var nextOctet = this.decodeNextOctet();
    if (nextOctet === null) {
      return null;
    }
    // Check the high bit. (Remember that / in JavaScript is
    // floating-point division).
    hasMore = ((nextOctet & 0x80) != 0);
    I += (nextOctet % 128) << shift;
    shift += 7;
  }

  return I;
};

Decoder.prototype.decodeNextASCIIString = function() {
  var length = this.decodeNextInteger(0);
  if (length === null) {
    return null;
  }
  var str = '';
  for (var i = 0; i < length; ++i) {
    var nextOctet = this.decodeNextOctet();
    if (nextOctet === null) {
      return null;
    }
    str += String.fromCharCode(nextOctet);
  }
  return str;
};

Decoder.prototype.decodeNextName = function(N, encodingContext) {
  var indexPlusOneOrZero = this.decodeNextInteger(N);
  if (indexPlusOneOrZero === null) {
    return null;
  }
  var name = null;
  if (indexPlusOneOrZero == 0) {
    name = this.decodeNextASCIIString();
  } else {
    var index = indexPlusOneOrZero - 1;
    name = encodingContext.getIndexedHeaderName(index);
  }
  return name;
};

Decoder.prototype.decodeNextOpcode = function(encodingContext, emitFunction) {
  var nextOctet = this.peekNextOctet();
  if (nextOctet === null) {
    return null;
  }
  if ((nextOctet >> 7) == 0x1) {
    // Indexed header.
    var index = this.decodeNextInteger(7);
    if (index === null) {
      return null;
    }
    if (!encodingContext.processIndexedHeader(index)) {
      return 1;
    }
    encodingContext.addTouches(index, 0);
    var result = encodingContext.getIndexedHeaderNameAndValue(index);
    emitFunction(result.name, result.value);
    return 1;
  } else if ((nextOctet >> 6) == 0x0) {
    // Literal header with substitution indexing.
    var name = this.decodeNextName(6, encodingContext);
    if (name === null) {
      return null;
    }
    var substitutedIndex = this.decodeNextInteger(0);
    if (substitutedIndex === null) {
      return null;
    }
    var value = this.decodeNextASCIIString();
    if (value === null) {
      return null;
    }
    var result =
      encodingContext.processLiteralHeaderWithSubstitutionIndexing(
        name, substitutedIndex, value);
    if (result.index >= 0) {
      encodingContext.addTouches(result.index, 0);
    }
    emitFunction(name, value);
    return 1;
  } else if ((nextOctet >> 5) == 0x2) {
    // Literal header with incremental indexing.
    var name = this.decodeNextName(5, encodingContext);
    if (name === null) {
      return null;
    }
    var value = this.decodeNextASCIIString();
    if (value === null) {
      return null;
    }
    var result = encodingContext.processLiteralHeaderWithIncrementalIndexing(
      name, value);
    if (result.index >= 0) {
      encodingContext.addTouches(result.index, 0);
    }
    emitFunction(name, value);
    return 1;
  } else if ((nextOctet >> 5) == 0x3) {
    // Literal header without indexing.
    var name = this.decodeNextName(5, encodingContext);
    if (name === null) {
      return null;
    }
    var value = this.decodeNextASCIIString();
    if (value === null) {
      return null;
    }
    emitFunction(name, value);
    return 1;
  } else {
    return null;
  }
};

function HeaderDecoder(direction) {
  this.encodingContext_ = new EncodingContext(direction);
}

HeaderDecoder.prototype.setHeaderTableMaxSize = function(maxSize) {
  this.encodingContext_.setHeaderTableMaxSize(maxSize);
};

HeaderDecoder.prototype.decodeHeaderSet = function(
  encodedHeaderSet, emitFunction) {
  var decoder = new Decoder(encodedHeaderSet);
  while (decoder.hasData()) {
    var result = decoder.decodeNextOpcode(this.encodingContext_, emitFunction);
    if (result === null) {
      return null;
    }
  }
  var self = this;
  this.encodingContext_.forEachEntry(
    function(index, name, value, referenced, touchCount) {
      if (referenced) {
        if (touchCount !== null) {
          self.encodingContext_.clearTouches(index);
        } else {
          emitFunction(name, value);
        }
      }
    });
};

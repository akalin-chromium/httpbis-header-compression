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

Decoder.prototype.decodeNextOpcode = function(encodingContext) {
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
    return null;
  } else if ((nextOctet >> 6) == 0x0) {
    // Literal header with substitution indexing.
    var indexPlusOneOrZero = this.decodeNextInteger(6);
    if (indexPlusOneOrZero === null) {
      return null;
    }
    return null;
  } else if ((nextOctet >> 5) == 0x1) {
    // Literal header with incremental indexing.
    var indexPlusOneOrZero = this.decodeNextInteger(5);
    if (indexPlusOneOrZero === null) {
      return null;
    }
    return null;
  } else if ((nextOctet >> 5) == 0x3) {
    // Literal header without indexing.
    var indexPlusOneOrZero = this.decodeNextInteger(5);
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
    if (name === null) {
      return null;
    }
    var value = this.decodeNextASCIIString();
    if (value === null) {
      return null;
    }
    encodingContext.processLiteralHeaderWithoutIndexing(name, value);
    return { name: name, value: value };
  } else {
    return null;
  }
};

function HeaderDecoder(direction) {
  this.encodingContext_ = new EncodingContext(direction);
}

HeaderDecoder.prototype.decodeHeaderSet = function(encodedHeaderSet) {
  var decoder = new Decoder(encodedHeaderSet);
  var headerSet = [];
  while (decoder.hasData()) {
    var result = decoder.decodeNextOpcode(this.encodingContext_);
    if (result === null) {
      return null;
    }
    headerSet.push([ result.name, result.value ]);
  }
  return headerSet;
};

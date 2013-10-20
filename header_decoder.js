'use strict';

// emitFunction will be called with the name and value of each header
// encountered while decoding.
function Decoder(buffer, encodingContext, emitFunction) {
  this.buffer_ = buffer;
  this.i_ = 0;
  this.encodingContext_ = encodingContext;
  this.emitFunction_ = emitFunction;
  this.opcodeStack_ = [];
  this.currentOpcode_ = [];
}

Decoder.prototype.pushOntoCurrentOpcode = function(x) {
  this.currentOpcode_.push(x);
}

function formatOpcode(opFields) {
  // format this: [ {fieldName: 'blah', otherKey: foo}, {fieldname...} ]
  function octetsToHex(octets, use_spaces) {
    var str = '';
    for (var i = 0; i < octets.length; ++i) {
      var octet = octets[i];
      if (octet < 16) {
        str += '0';
      }
      str += '' + octet.toString(16);
      if (use_spaces) str += ' ';
    }
    return str;
  }
  var output = '';
  for (var i = 0; i < opFields.length; ++i) {
    var field = opFields[i];
    if (field.fieldName) {
      output += field.fieldName + ': [';
    }
    var keys = []
    for (var key in field) {
      if (key == 'fieldName') continue;
      keys.push(key);
    }
    for (var j = 0; j < keys.length; ++j) {
      var key = keys[j];
      var data = field[key];
      if (key == "encoded") {
        data = '"' + octetsToHex(data) + '"';
      }
      output += key + ': ' + data;
      if (j + 1 < keys.length) output += ', ';
    }
    output += '] ';
  }

  return output;
}

Decoder.prototype.finishedCurrentOpcode = function() {
  console.log(formatOpcode(this.currentOpcode_));
  this.opcodeStack_.push(this.currentOpcode_);
  this.currentOpcode_ = [];
}

Decoder.prototype.getFormattedOpcodeList = function() {
  var output = "";
  for (var i = 0; i < this.opcodeStack_.length; ++i) {
    output += formatOpcode(this.opcodeStack_[i]) + '\n';
  }
  return output;
}


Decoder.prototype.hasMoreData = function() {
  return this.i_ < this.buffer_.length;
};

Decoder.prototype.peekNextOctet_ = function() {
  if (!this.hasMoreData()) {
    throw new Error('Unexpected end of buffer');
  }
  return this.buffer_[this.i_] & 0xff;
};

Decoder.prototype.decodeNextOctet_ = function() {
  var nextOctet = this.peekNextOctet_();
  ++this.i_;
  return nextOctet;
};

// Decodes the next integer based on the representation described in
// 4.1.1. N is the number of bits of the prefix as described in 4.1.1.
Decoder.prototype.decodeNextInteger_ = function(N, description) {
  var I = 0;
  var hasMore = true;
  var R = 0;
  var shift = 0;
  var start = this.i_;
  if (!description) description = "int";

  if (N > 0) {
    var nextMarker = (1 << N) - 1;
    var nextOctet = this.decodeNextOctet_();
    I = nextOctet & nextMarker;
    hasMore = (I == nextMarker);
  }

  while (hasMore) {
    var nextOctet = this.decodeNextOctet_();
    // Check the high bit. (Remember that / in JavaScript is
    // floating-point division).
    hasMore = ((nextOctet & 0x80) != 0);
    R += (nextOctet % 128) << shift;
    shift += 7;
  }
  I += R;
  var data = this.buffer_.slice(start, this.i_);
  this.pushOntoCurrentOpcode( {fieldName: description,
                               prefixLen: N,
                               encoded: data,
                               decoded: I} );
  //console.log("Decoded", description, ": ", I, "from: ", this.buffer_.slice(start, this.i_));
  return I;
};

// Decodes the next length-prefixed octet sequence and returns it as a
// string with character codes representing the octets.
Decoder.prototype.decodeNextOctetSequence_ = function(description) {
  var is_huffman_encoded = this.peekNextOctet_() >> 7 & 1;
  var length = this.decodeNextInteger_(7, description + "_length");
  var data = this.buffer_.slice(this.i_, this.i_ + length);
  var str = '';
  if (is_huffman_encoded) {
    var inv_code_table = INVERSE_CLIENT_TO_SERVER_CODEBOOK;
    if (!IS_REQUEST) {
      inv_code_table = INVERSE_SERVER_TO_CLIENT_CODEBOOK;
    }
    //console.log("decoding huffman data:", data);
    str = decodeBYTES(data, 0, inv_code_table).str;
    this.i_ += length;
  } else {
    for (var i = 0; i < length; ++i) {
      var nextOctet = this.decodeNextOctet_();
      str += String.fromCharCode(nextOctet);
    }
  }
  this.pushOntoCurrentOpcode( { fieldName: description,
                                is_huffman_encoded: is_huffman_encoded,
                                encoded: data,
                                decoded: '"' + str + '"'} );
  //console.log("Decoded str: ", str, " len: ", length,
  //            "is_huffman_encoded: ", is_huffman_encoded,
  //            "is_request: ", IS_REQUEST, "from: ", data);
  return str;
};

// Decodes the next header name based on the representation described
// in 4.1.2. N is the number of bits of the prefix of the length of
// the header name as described in 4.1.1.
Decoder.prototype.decodeNextName_ = function(N) {
  var indexPlusOneOrZero = this.decodeNextInteger_(N, "name_index");
  var name = null;
  if (indexPlusOneOrZero == 0) {
    name = this.decodeNextOctetSequence_("name_data");
  } else {
    var index = indexPlusOneOrZero - 1;
    name = this.encodingContext_.getIndexedHeaderName(index);
  }
  if (!isValidHeaderName(name)) {
    throw new Error('Invalid header name: ' + name);
  }
  return name;
};

// Decodes the next header value based on the representation described
// in 4.1.3.
Decoder.prototype.decodeNextValue_ = function() {
  var value = this.decodeNextOctetSequence_("value_data");
  if (!isValidHeaderValue(value)) {
    throw new Error('Invalid header value: ' + value);
  }
  return value;
};

function determineOpcode(nextOctet) {
  var opcode = OPCODES.UNKNOWN_OPCODE;
  if ((nextOctet >> INDEX_N) == INDEX_VALUE) {
    opcode = OPCODES.INDEX_OPCODE;
  } else if ((nextOctet >> LITERAL_NO_INDEX_N) == LITERAL_NO_INDEX_VALUE) {
    opcode = OPCODES.LITERAL_NO_INDEX_OPCODE;
  } else if((nextOctet >> LITERAL_INCREMENTAL_N) == LITERAL_INCREMENTAL_VALUE) {
    opcode = OPCODES.LITERAL_INCREMENTAL_OPCODE;
  }
  return opcode;
}

// Processes the next header representation as described in 3.2.1.
Decoder.prototype.processNextHeaderRepresentation = function() {
  var nextOctet = this.peekNextOctet_();
  var opcodeStartIndex = this.i_;
  var opcode = determineOpcode(nextOctet);

  // Touches are used below to track which headers have been emitted.
  this.pushOntoCurrentOpcode({fieldName: opcode.name, opcodeLengthInBits: opcode.opcode_len, firstBytePeek: nextOctet});
  switch (opcode) {
    case OPCODES.INDEX_OPCODE:
      var index = this.decodeNextInteger_(7, "entry_index");
      this.encodingContext_.processIndexedHeader(index);
      if (!this.encodingContext_.isReferenced(index)) {
        break;
      }
      this.encodingContext_.addTouches(index, 0);
      var name = this.encodingContext_.getIndexedHeaderName(index);
      var value = this.encodingContext_.getIndexedHeaderValue(index);
      this.emitFunction_(name, value);
      break;
    case OPCODES.LITERAL_INCREMENTAL_OPCODE:
      // Literal header with incremental indexing (4.3.2).
      var name = this.decodeNextName_(LITERAL_INCREMENTAL_N);
      var value = this.decodeNextValue_();
      var index =
        this.encodingContext_.processLiteralHeaderWithIncrementalIndexing(
            name, value, function(referenceIndex) { /* Do nothing */ });
      if (index >= 0) {
        this.encodingContext_.addTouches(index, 0);
      }
      this.emitFunction_(name, value);
      break;
    case OPCODES.LITERAL_NO_INDEX_OPCODE:
      // Literal header without indexing (4.3.1).
      var name = this.decodeNextName_(LITERAL_NO_INDEX_N);
      var value = this.decodeNextValue_();
      this.emitFunction_(name, value);
      break;
    default:
      throw new Error('Could not decode opcode from ' + nextOctet);
  }
  this.finishedCurrentOpcode();
};

// direction can be either REQUEST or RESPONSE, which controls the
// pre-defined header table to use.
function HeaderDecoder(direction) {
  this.encodingContext_ = new EncodingContext(direction);
}

HeaderDecoder.prototype.setHeaderTableMaxSize = function(maxSize) {
  this.encodingContext_.setHeaderTableMaxSize(maxSize);
};


// encodedHeaderSet must be the complete encoding of an header set,
// represented as an array of octets. emitFunction will be called with
// the name and value of each header in the header set. An exception
// will be thrown if an error is encountered.
HeaderDecoder.prototype.decodeHeaderSet = function(
  encodedHeaderSet, emitFunction) {
  var decoder =
    new Decoder(encodedHeaderSet, this.encodingContext_, emitFunction);
  while (decoder.hasMoreData()) {
    decoder.processNextHeaderRepresentation();
  }
  var formattedOpcodes = decoder.getFormattedOpcodeList();

  // Emits each header contained in the reference set that has not
  // already been emitted as described in 3.2.2.
  this.encodingContext_.forEachEntry(
    function(index, name, value, referenced, touchCount) {
      if (referenced && (touchCount === null)) {
        emitFunction(name, value);
      }
      this.encodingContext_.clearTouches(index);
    }.bind(this));
  return formattedOpcodes;
};



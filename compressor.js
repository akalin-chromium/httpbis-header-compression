'use strict';

var STATIC_ENTRIES = [
  [ ':path', '/' ],
  [ ':scheme', 'http' ],
  [ ':scheme', 'https' ],
  [ ':method', 'get' ],
  [ ':host', '' ],
  [ 'cookie', '' ],
  [ ':status', '200' ],
  [ ':status-text', 'OK' ],
  [ ':version', '1.1' ],
  [ 'accept', '' ],
  [ 'accept-charset', '' ],
  [ 'accept-encoding', '' ],
  [ 'accept-language', '' ],
  [ 'accept-ranges', '' ],
  [ 'allow', '' ],
  [ 'authorizations', '' ],
  [ 'cache-control', '' ],
  [ 'content-base', '' ],
  [ 'content-encoding', '' ],
  [ 'content-length', '' ],
  [ 'content-location', '' ],
  [ 'content-md5', '' ],
  [ 'content-range', '' ],
  [ 'content-type', '' ],
  [ 'date', '' ],
  [ 'etag', '' ],
  [ 'expect', '' ],
  [ 'expires', '' ],
  [ 'from', '' ],
  [ 'if-match', '' ],
  [ 'if-modified-since', '' ],
  [ 'if-none-match', '' ],
  [ 'if-range', '' ],
  [ 'if-unmodified-since', '' ],
  [ 'last-modified', '' ],
  [ 'location', '' ],
  [ 'max-forwards', '' ],
  [ 'origin', '' ],
  [ 'pragma', '' ],
  [ 'proxy-authenticate', '' ],
  [ 'proxy-authorization', '' ],
  [ 'range', '' ],
  [ 'referer', '' ],
  [ 'retry-after', '' ],
  [ 'server', '' ],
  [ 'set-cookie', '' ],
  [ 'status', '' ],
  [ 'te', '' ],
  [ 'trailer', '' ],
  [ 'transfer-encoding', '' ],
  [ 'upgrade', '' ],
  [ 'user-agent', '' ],
  [ 'vary', '' ],
  [ 'via', '' ],
  [ 'warning', '' ],
  [ 'www-authenticate', '' ],
  [ 'access-control-allow-origin', '' ],
  [ 'content-disposition', '' ],
  [ 'get-dictionary', '' ],
  [ 'p3p', '' ],
  [ 'x-content-type-options', '' ],
  [ 'x-frame-options', '' ],
  [ 'x-powered-by', '' ],
  [ 'x-xss-protection', '' ],
];

var STATIC_ENTRY_INDICES = {};
{
  for (var i = 0; i < STATIC_ENTRIES.length; ++i) {
    STATIC_ENTRY_INDICES[STATIC_ENTRIES[i][0]] = i;
  }
}

function findStaticEntryIndex(kv) {
  if (kv.key in STATIC_ENTRY_INDICES) {
    var i = STATIC_ENTRY_INDICES[kv.key];
    var result = { index: i };
    if (STATIC_ENTRIES[i][1] == kv.val) {
      result.matchesValue = true;
    }
    return result;
  } else {
    return null;
  }
}

function headerListToInstructions(headerList) {
  var skvstos = [];
  var stoggls = [];
  var sclones = [];

  for (var i = 0; i < headerList.length; ++i) {
    var kv = headerList[i];
    // TODO(akalin): Implement the LRU.
    var result = findStaticEntryIndex(kv);
    if (result) {
      if (result.matchesValue) {
        stoggls.push(result.index);
      } else {
        sclones.push({ keyIndex: result.index, val: kv.val });
      }
    } else {
      skvstos.push(kv);
    }
  }

  return {
    skvsto: skvstos,
    stoggl: stoggls,
    sclone: sclones
  };
}

function Serializer() {
  this.buffer_ = [];
}

Serializer.prototype.getStringValue = function() {
  return String.fromCharCode.apply(null,this.buffer_);
};

Serializer.prototype.writeUint8 = function(x) {
  this.buffer_.push(x & 0xff);
};

// TODO(akalin): Figure out correct endianness.

Serializer.prototype.writeUint16 = function(x) {
  this.buffer_.push((x >>> 8) & 0xff);
  this.buffer_.push(x & 0xff);
};

Serializer.prototype.encodeAndWriteString = function(s) {
  // TODO(akalin): Do Huffman encoding instead.
  this.writeUint16(s.length);
  for (var i = 0; i < s.length; ++i) {
    this.writeUint8(s.charCodeAt(i));
  }
};

var INSTRUCTION_NAMES = [
  'stoggl', 'etoggl', 'strang', 'etrang',
  'eclone', 'ekvsto', 'sclone', 'skvsto'
];

var OPCODES = {
  stoggl: 0x00,
  etoggl: 0x01,
  strang: 0x02,
  etrang: 0x03,
  skvsto: 0x04,
  ekvsto: 0x05,
  sclone: 0x06,
  eclone: 0x07
};

function serializeInstructions(instructions) {
  var serializer = new Serializer();
  for (var i = 0; i < INSTRUCTION_NAMES.length; ++i) {
    var name = INSTRUCTION_NAMES[i];
    var ops = instructions[name];
    if (!ops || ops.length == 0) continue;

    serializer.writeUint8(OPCODES[name]);
    serializer.writeUint8(ops.length - 1);
    for (var j = 0; j < ops.length; ++j) {
      var op = ops[j];
      if (name == 'skvsto' || name == 'ekvsto') {
        serializer.encodeAndWriteString(op.key);
        serializer.encodeAndWriteString(op.val);
      } else if (name == 'stoggl' || name == 'etoggl') {
        serializer.writeUint16(op);
      } else if (name == 'sclone' || name == 'clone') {
        serializer.writeUint16(op.keyIndex);
        serializer.encodeAndWriteString(op.val);
      }
      // TODO(akalin): Implement other instructions.
    }
  }
  return serializer.getStringValue();
}

function Deserializer(buffer) {
  this.buffer_ = buffer;
  this.i_ = 0;
}

Deserializer.prototype.hasData = function() {
  return this.i_ < this.buffer_.length;
};

Deserializer.prototype.readUint8 = function() {
  if (!this.hasData()) {
    throw new Error('Unexpected EOF');
  }
  return this.buffer_.charCodeAt(this.i_++) & 0xff;
};

// TODO(akalin): Figure out correct endianness.

Deserializer.prototype.readUint16 = function() {
  return (this.readUint8() << 8) || this.readUint8();
};

Deserializer.prototype.readAndDecodeString = function() {
  // TODO(akalin): Do Huffman encoding instead.
  var length = this.readUint16();
  var a = [];
  for (var i = 0; i < length; ++i) {
    a[i] = String.fromCharCode(this.readUint8());
  }
  return a.join('');
};

function deserializeInstructions(serializedInstructions) {
  var deserializer = new Deserializer(serializedInstructions);

  var instructions = [];

  while (deserializer.hasData()) {
    var op = deserializer.readUint8();
    var numFields = deserializer.readUint8() + 1;
    var instruction = {};
    if (OPCODES['skvsto'] == op) {
      instruction.op = 'skvsto';
      var kvs = [];
      for (var i = 0; i < numFields; ++i) {
        var key = deserializer.readAndDecodeString();
        var val = deserializer.readAndDecodeString();
        kvs.push({ key: key, val: val });
      }
      instruction.kvs = kvs;
    } else if (OPCODES['stoggl'] == op) {
      instruction.op = 'stoggl';
      var is = [];
      for (var i = 0; i < numFields; ++i) {
        is.push(deserializer.readUint16());
      }
      instruction.is = is;
    } else if (OPCODES['sclone'] == op) {
      instruction.op = 'sclone';
      var kivs = [];
      for (var i = 0; i < numFields; ++i) {
        var keyIndex = deserializer.readUint16();
        var val = deserializer.readAndDecodeString();
        kivs.push({ keyIndex: keyIndex, val: val });
      }
      instruction.kivs = kivs;
    }
    // TODO(akalin): Implement other instructions.
    instructions.push(instruction);
  }

  return instructions;
}

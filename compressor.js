'use strict';

var STATIC_ENTRIES = [
  { key: ':path', val: '/' },
  { key: ':scheme', val: 'http' },
  { key: ':scheme', val: 'https' },
  { key: ':method', val: 'get' },
  { key: ':host', val: '' },
  { key: 'cookie', val: '' },
  { key: ':status', val: '200' },
  { key: ':status-text', val: 'OK' },
  { key: ':version', val: '1.1' },
  { key: 'accept', val: '' },
  { key: 'accept-charset', val: '' },
  { key: 'accept-encoding', val: '' },
  { key: 'accept-language', val: '' },
  { key: 'accept-ranges', val: '' },
  { key: 'allow', val: '' },
  { key: 'authorizations', val: '' },
  { key: 'cache-control', val: '' },
  { key: 'content-base', val: '' },
  { key: 'content-encoding', val: '' },
  { key: 'content-length', val: '' },
  { key: 'content-location', val: '' },
  { key: 'content-md5', val: '' },
  { key: 'content-range', val: '' },
  { key: 'content-type', val: '' },
  { key: 'date', val: '' },
  { key: 'etag', val: '' },
  { key: 'expect', val: '' },
  { key: 'expires', val: '' },
  { key: 'from', val: '' },
  { key: 'if-match', val: '' },
  { key: 'if-modified-since', val: '' },
  { key: 'if-none-match', val: '' },
  { key: 'if-range', val: '' },
  { key: 'if-unmodified-since', val: '' },
  { key: 'last-modified', val: '' },
  { key: 'location', val: '' },
  { key: 'max-forwards', val: '' },
  { key: 'origin', val: '' },
  { key: 'pragma', val: '' },
  { key: 'proxy-authenticate', val: '' },
  { key: 'proxy-authorization', val: '' },
  { key: 'range', val: '' },
  { key: 'referer', val: '' },
  { key: 'retry-after', val: '' },
  { key: 'server', val: '' },
  { key: 'set-cookie', val: '' },
  { key: 'status', val: '' },
  { key: 'te', val: '' },
  { key: 'trailer', val: '' },
  { key: 'transfer-encoding', val: '' },
  { key: 'upgrade', val: '' },
  { key: 'user-agent', val: '' },
  { key: 'vary', val: '' },
  { key: 'via', val: '' },
  { key: 'warning', val: '' },
  { key: 'www-authenticate', val: '' },
  { key: 'access-control-allow-origin', val: '' },
  { key: 'content-disposition', val: '' },
  { key: 'get-dictionary', val: '' },
  { key: 'p3p', val: '' },
  { key: 'x-content-type-options', val: '' },
  { key: 'x-frame-options', val: '' },
  { key: 'x-powered-by', val: '' },
  { key: 'x-xss-protection', val: '' }
];

var STATIC_ENTRY_INDICES = {};
{
  for (var i = 0; i < STATIC_ENTRIES.length; ++i) {
    STATIC_ENTRY_INDICES[STATIC_ENTRIES[i].key] = i;
  }
}

function findStaticEntryIndex(kv) {
  if (kv.key in STATIC_ENTRY_INDICES) {
    var i = STATIC_ENTRY_INDICES[kv.key];
    var result = { index: i };
    if (STATIC_ENTRIES[i].val == kv.val) {
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

function instructionsToHeaderList(instructions) {
  var headerList = [];

  var stoggls = {};

  for (var i = 0; i < instructions.length; ++i) {
    var instruction = instructions[i];
    if (instruction.op == 'skvsto') {
      var kvs = instruction.kvs;
      Array.prototype.push.apply(headerList, kvs);
    } else if (instruction.op == 'stoggl') {
      var is = instruction.is;
      for (var j = 0; j < is.length; ++j) {
        var index = is[j];
        if (index in stoggls) {
          delete stoggls[index];
        } else {
          stoggls[index] = 1;
        }
      }
    } else if (instruction.op == 'sclone') {
      var kivs = instruction.kivs;
      for (var j = 0; j < kivs.length; ++j) {
        var key = STATIC_ENTRIES[kivs[j].keyIndex].key;
        headerList.push({ key: key, val: kivs[j].val });
      }
    }
  }

  for (var i in stoggls) {
    headerList.push(STATIC_ENTRIES[i]);
  }

  return headerList;
}

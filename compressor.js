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

function headerListToInstructions(headerList) {
  var skvstos = [];

  // TODO(akalin): Do something smarter here.
  for (var i = 0; i < headerList.length; ++i) {
    skvstos.push(headerList[i]);
  }

  return {
    skvsto: skvstos
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
      }
      // TODO(akalin): Implement other instructions.
    }
  }
  return serializer.getStringValue();
}

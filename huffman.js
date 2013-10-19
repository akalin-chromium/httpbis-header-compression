'use strict';

function getOptimalCodeLengths(weights) {
  var nodes = weights
    .map(function(w, i) { return { w: w, i: i }})
    .filter(function(n) { return n.w > 0; });

  function nodeCMP(a, b) {
    if (a.w < b.w) return -1;
    if (a.w > b.w) return +1;
    if (a.i < b.i) return -1;
    if (a.i > b.i) return +1;
    return 0;
  }

  nodes.sort(nodeCMP);

  var q1 = nodes;
  var q2 = [];

  function shiftMin() {
    if (q1.length == 0) return q2.shift();
    if (q2.length == 0) return q1.shift();
    if (nodeCMP(q1[0], q2[0]) == -1) return q1.shift();
    return q2.shift();
  }

  while (q1.length + q2.length > 1) {
    var n1 = shiftMin();
    var n2 = shiftMin();
    var n = { w: n1.w + n2.w, l: n1, r: n2 };
    q2.push(n);
  }

  var root = (q1.length > 0) ? q1[0] : q2[0];
  var codeLengths = [];

  function traverseDFS(n, d) {
    if (n.l) traverseDFS(n.l, d + 1);
    if (n.r) traverseDFS(n.r, d + 1);
    if ('i' in n) codeLengths[n.i] = d;
  }

  traverseDFS(root, 0);
  return codeLengths;
}

function codeLengthsToCanonicalEncoding(codeLengths) {
  var nodes = codeLengths.map(function(l, i) { return { l: l, i: i }});

  nodes.sort(function(a, b) {
    if (a.l < b.l) return -1;
    if (a.l > b.l) return +1;
    if (a.i < b.i) return -1;
    if (a.i > b.i) return +1;
    return 0;
  });

  if (nodes.length > 0) {
    nodes[0].code = 0;
    for (var i = 1; i < nodes.length; ++i) {
      nodes[i].code = (nodes[i-1].code + 1) << (nodes[i].l - nodes[i - 1].l);
    }
  }

  var codes = [];
  for (var i = 0; i < nodes.length; ++i) {
    var j = nodes[i].i;
    delete nodes[i].i;
    codes[j] = nodes[i];
  }
  return codes;
}

function buildCodebook(freqTable) {
  var divisor = 1;

  while (true) {
    var freqTableAdjusted = [];
    for (var i = 0; i < freqTable.length; ++i) {
      var freq = freqTable[i];
      if (freq == 0) {
        freq = 1.0 / 512.0;
      }
      freqTableAdjusted[i] = freq / divisor;
    }
    var codeLengths = getOptimalCodeLengths(freqTableAdjusted);
    console.log(codeLengths);
    var maxCodeLen = 0;
    for (var i = 0; i < codeLengths.length; ++i) {
      maxCodeLen = Math.max(maxCodeLen, codeLengths[i]);
    }
    if (maxCodeLen <= 32) break;
    console.log(maxCodeLen)
  }
  return codeLengthsToCanonicalEncoding(codeLengths);
}

function buildInverseCodebook(codebook) {
  var inverseCodebook = [];
  for (var i = 0; i < codebook.length; ++i) {
    if (codebook[i]) {
      inverseCodebook[codebook[i].code] = { l: codebook[i].l, i: i };
    }
  }
  return inverseCodebook;
}

function encodeBYTES(str, codebook) {
  var a = [];
  var aByte = 0;
  var aByteBitLength = 0;
  function appendCode(code, l) {
    for (var i = 0; i < l; ++i) {
      var bit = (code & (1 << (l - i - 1))) ? 1 : 0;
      aByte = (aByte << 1) | bit;
      ++aByteBitLength;
      if (aByteBitLength == 8) {
        a.push(aByte);
        aByte = 0;
        aByteBitLength = 0;
      }
    }
  }
  function finishCoding() {
    var eosCode = codebook[256];
    if (aByteBitLength % 8 == 0) {
      return;
    }
    var bits_to_pad = 8 - aByteBitLength;
    appendCode(eosCode.code, bits_to_pad);
    if (aByteBitLength > 0) {
      aByte <<= (8 - aByteBitLength);
      a.push(aByte);
    }
  }
  for (var i = 0; i < str.length; ++i) {
    var ch = str.charCodeAt(i);
    var code = codebook[ch];
    console.log('huffman coding: ', String.fromCharCode(ch), code.code, code.l);
    appendCode(code.code, code.l);
  }
  finishCoding();
  return a;
}

function decodeBYTES(a, start, inverseCodebook) {
  var code = 0;
  var codeLength = 0;
  var str = '';
  var i = start * 8;
  for (; i < a.length * 8; ++i) {
    var byteIndex = (i / 8) >>> 0;
    var b = (typeof(a) == 'string') ? a.charCodeAt(byteIndex) : a[byteIndex];
    var bit = (b & (1 << (7 - (i % 8)))) ? 1 : 0;
    code = (code << 1) | bit;
    ++codeLength;
    if (code >= inverseCodebook.length) {
      throw new Error('Invalid code ' + code);
    }
    if (code in inverseCodebook && inverseCodebook[code].l == codeLength) {
      var ch = inverseCodebook[code].i;
      code = 0;
      codeLength = 0;
      if (ch == 256) {
        console.log("decodeBYTES: got EOS");
        break;
      }
      console.log("decodeBYTES: decoded: ", ch);
      str += String.fromCharCode(ch);
    }
  }
  return { end: (((i / 8) >>> 0) + 1), str: str };
}


'use strict';

function getOptimalCodeLengths(weights) {
  var nodes =
    weights
    .map(function(w, i) { return { w: w, i: i }})
    .filter(function(n) { return n.w > 0; });
  nodes.sort(function(a, b) {
    if (a.w < b.w) return -1;
    if (a.w > b.w) return +1;
    return 0;
  });
  var q1 = nodes;
  var q2 = [];
  function shiftMin() {
    if (q1.length == 0) return q2.shift();
    if (q2.length == 0) return q1.shift();
    return (q1[0].w < q2[0].w) ? q1.shift() : q2.shift();
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
  traverseDFS(root, 1);
  return codeLengths;
}

function codeLengthsToCanonicalEncoding(codeLengths) {
  var nodes =
    codeLengths
    .map(function(l, i) { return { l: l, i: i }});
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

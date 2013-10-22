'use strict';

var EXAMPLE_REQUESTS_AND_RESPONSES = [
[ // requests
  { ":method": "GET",
    ":scheme": "http",
    ":path": "/",
    ":authority": "www.foo.com",
  },
  { ":method": "GET",
    ":scheme": "https",
    ":path": "/",
    ":authority": "www.bar.com",
    "cache-control": "no-cache",
  },
  { ":method": "GET",
    ":scheme": "https",
    ":path": "/custom-path.css",
    ":authority": "www.bar.com",
    "custom-key": "custom-value",
  },
],
[ // responses
  { ":status": "302",
    "cache-control": "private",
    "date": "Mon, 21 OCt 2013 20:13:21 GMT",
    "location: ": "https://www.bar.com",
  },
  { ":status": "200",
    "cache-control": "private",
    "date": "Mon, 21 OCt 2013 20:13:22 GMT",
    "location": "https://www.bar.com",
    "content-encoding": "gzip",
    "set-cookie": "foo=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
                  "LASDJKHQKBZXOQWEOPIUAXQWEOIUAXLJKHQWOEIUALQWEOIUAXLQEUAXLLKJASDQWEOUIAXN1234" +
                  "LASDJKHQKBZXOQWEOPIUAXQWEOIUAXLJKHQWOEIUALQWEOIUAXLQEUAXLLKJASDQWEOUIAXN1234" +
                  "LASDJKHQKBZXOQWEOPIUAXQWEOIUAXLJKHQWOEIUALQWEOIUAXLQEUAXLLKJASDQWEOUIAXN1234" +
                  "LASDJKHQKBZXOQWEOPIUAXQWEOIUAXLJKHQWOEIUALQWEOIUAXLQEUAXLLKJASDQWEOUIAXN1234" +
                  "ZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZ1234" +
                  " max-age=3600; version=1"
  },
  { ":status": "200",
    "cache-control": "private",
    "date": "Mon, 21 OCt 2013 20:13:22 GMT",
    "location": "https://www.bar.com",
    "content-encoding": "gzip",
    "set-cookie": "foo=ZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZ" +
                  "LASDJKHQKBZXOQWEOPIUAXQWEOIUAXLJKHQWOEIUALQWEOIUAXLQEUAXLLKJASDQWEOUIAXN1234" +
                  "LASDJKHQKBZXOQWEOPIUAXQWEOIUAXLJKHQWOEIUALQWEOIUAXLQEUAXLLKJASDQWEOUIAXN1234" +
                  "LASDJKHQKBZXOQWEOPIUAXQWEOIUAXLJKHQWOEIUALQWEOIUAXLQEUAXLLKJASDQWEOUIAXN1234" +
                  "LASDJKHQKBZXOQWEOPIUAXQWEOIUAXLJKHQWOEIUALQWEOIUAXLQEUAXLLKJASDQWEOUIAXN1234" +
                  "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA1234" +
                  " max-age=3600; version=1"
  },
]
];

function formatExampleHeaders(isRequest, exampleIndex) {
  var index = 0;
  if (!isRequest) {
    index = 1;
  }
  var exampleHeaders = EXAMPLE_REQUESTS_AND_RESPONSES[index];
  exampleIndex %= exampleHeaders.length;
  var exampleHeadersInstance = exampleHeaders[exampleIndex];
  var output = "";
  for (var key in exampleHeadersInstance) {
    output += key + ":";
    var val = exampleHeadersInstance[key];
    if (val) {
      output += " " + val;
    }
    output += '\n';
  }
  return output;
}


'use strict';

var REQUEST = 0;
var RESPONSE = 1;

var PRE_DEFINED_REQUEST_HEADER_TABLE = [
  [ ":scheme",             "http"  ],  // 0
  [ ":scheme",             "https" ],  // 1
  [ ":host",               ""      ],  // 2
  [ ":path",               "/"     ],  // 3
  [ ":method",             "GET"   ],  // 4
  [ "accept",              ""      ],  // 5
  [ "accept-charset",      ""      ],  // 6
  [ "accept-encoding",     ""      ],  // 7
  [ "accept-language",     ""      ],  // 8
  [ "cookie",              ""      ],  // 9
  [ "if-modified-since",   ""      ],  // 10
  [ "user-agent",          ""      ],  // 11
  [ "referer",             ""      ],  // 12
  [ "authorization",       ""      ],  // 13
  [ "allow",               ""      ],  // 14
  [ "cache-control",       ""      ],  // 15
  [ "connection",          ""      ],  // 16
  [ "content-length",      ""      ],  // 17
  [ "content-type",        ""      ],  // 18
  [ "date",                ""      ],  // 19
  [ "expect",              ""      ],  // 20
  [ "from",                ""      ],  // 21
  [ "if-match",            ""      ],  // 22
  [ "if-none-match",       ""      ],  // 23
  [ "if-range",            ""      ],  // 24
  [ "if-unmodified-since", ""      ],  // 25
  [ "max-forwards",        ""      ],  // 26
  [ "proxy-authorization", ""      ],  // 27
  [ "range",               ""      ],  // 28
  [ "via",                 ""      ]   // 29
];

var PRE_DEFINED_RESPONSE_HEADER_TABLE = [
  [ ":status",                     "200" ],  // 0
  [ "age",                         ""    ],  // 1
  [ "cache-control",               ""    ],  // 2
  [ "content-length",              ""    ],  // 3
  [ "content-type",                ""    ],  // 4
  [ "date",                        ""    ],  // 5
  [ "etag",                        ""    ],  // 6
  [ "expires",                     ""    ],  // 7
  [ "last-modified",               ""    ],  // 8
  [ "server",                      ""    ],  // 9
  [ "set-cookie",                  ""    ],  // 10
  [ "vary",                        ""    ],  // 11
  [ "via",                         ""    ],  // 12
  [ "access-control-allow-origin", ""    ],  // 13
  [ "accept-ranges",               ""    ],  // 14
  [ "allow",                       ""    ],  // 15
  [ "connection",                  ""    ],  // 16
  [ "content-disposition",         ""    ],  // 17
  [ "content-encoding",            ""    ],  // 18
  [ "content-language",            ""    ],  // 19
  [ "content-location",            ""    ],  // 20
  [ "content-range",               ""    ],  // 21
  [ "link",                        ""    ],  // 22
  [ "location",                    ""    ],  // 23
  [ "proxy-authenticate",          ""    ],  // 24
  [ "refresh",                     ""    ],  // 25
  [ "retry-after",                 ""    ],  // 26
  [ "strict-transport-security",   ""    ],  // 27
  [ "transfer-encoding",           ""    ],  // 28
  [ "www-authenticate",            ""    ],  // 29
];

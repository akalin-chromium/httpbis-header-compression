
'use strict';

// Request frequency table
var FREQ_TABLE1 = [
        0,      0,      0,
        0,      0,      0,
        0,      0,      0,
        0,      0,      0,
        0,      0,      0,
        0,      0,      0,
        0,      0,      0,
        0,      0,      0,
        0,      0,      0,
        0,      0,      0,
        0,      0,   7610,
      930,    202,    134,
      123,  44564,  25746,
      103,   1917,   1958,
     3102,   1031,   7830,
    38776,  61420, 115378,
    78519,  75265,  83362,
    54510,  37403,  40823,
    35068,  36398,  33595,
    36340,   5530,   9240,
       16,  42481,     50,
     5865,    205,  16369,
     9310,  11301,  12701,
     7543,  17618,   5510,
     5226,   6981,   4233,
     3072,   5795,   8677,
     5276,   6132,   5241,
     4150,   5655,   8546,
     8826,   5201,   5305,
     6627,   5961,   4464,
     3212,    266,      0,
      275,    149,  34919,
        9,  85465,  32815,
    67786,  50950, 125495,
    33026,  46142,  30069,
    87001,  21311,  14902,
    55591,  55290,  64016,
    72711,  57459,   8956,
    60591,  84899,  90992,
    35484,  16925,  29268,
    14687,  13536,   7943,
       30,    988,     30,
      748,      0,      0,
        0,      0,      0,
        0,      0,      0,
        0,      0,      0,
        0,      0,      0,
        0,      0,      0,
        0,      0,      0,
        0,      0,      0,
        0,      0,      0,
        0,      0,      0,
        0,      0,      0,
        0,      0,      0,
        0,      0,      0,
        0,      0,      0,
        0,      0,      0,
        0,      0,      0,
        0,      0,      0,
        0,      0,      0,
        0,      0,      0,
        0,      0,      0,
        0,      0,      0,
        0,      0,      0,
        0,      0,      0,
        0,      0,      0,
        0,      0,      0,
        0,      0,      0,
        0,      0,      0,
        0,      0,      0,
        0,      0,      0,
        0,      0,      0,
        0,      0,      0,
        0,      0,      0,
        0,      0,      0,
        0,      0,      0,
        0,      0,      0,
        0,      0,      0,
        0,      0,      0,
        0,      0,      0,
        0,      0,      0,
        0,      0,      0,
        0,      0,      0,
        0,      0,      0,
        0,      0,      0,
        0,  33889,
];

// Response freq table
var FREQ_TABLE2 = [
        0,      0,      0,
        0,      0,      0,
        0,      0,      0,
        0,      0,      0,
        0,      0,      0,
        0,      0,      0,
        0,      0,      0,
        0,      0,      0,
        0,      0,      0,
        0,      0,      0,
        0,      0, 172375,
      473,  13272,    183,
       61,   2657,   1589,
      211,   3754,   3785,
      370,   1191,  34525,
    26062,  23541,  12241,
   117394, 134469, 122382,
    71163,  58165,  51636,
    39978,  40887,  48498,
    42766,  60664,   4316,
       19,  13958,     96,
      359,     15,  12315,
     5339,   6633,   6866,
     6922,   9760,  30326,
     3827,   6145,   7748,
     1863,   3633,  37849,
     8346,   7175,   4494,
     2389,   3339,  23801,
    47093,   3671,   2909,
     7187,   2260,   2436,
     1980,    724,    122,
      735,     53,   3823,
       12,  52595,  15736,
    41143,  24731,  64607,
    19373,  18801,  16429,
    28479,   4545,   4740,
    17737,  20585,  28096,
    35949,  27630,   4091,
    26111,  21098,  29704,
    26652,  10503,   5251,
    11828,   6472,   3535,
       16,     79,     16,
       24,      0,      0,
        0,      0,      0,
        0,      0,      0,
        0,      0,      0,
        0,      0,      0,
        0,      0,      0,
        0,      0,      0,
        0,      0,      0,
        0,      0,      0,
        0,      0,      0,
        0,      0,      0,
        0,      0,      0,
        0,      0,      0,
        0,      0,      0,
        0,      0,      0,
        0,      0,      0,
        0,      0,      0,
        0,      0,      0,
        0,      0,      0,
        0,      0,      0,
        0,      0,      0,
        0,      0,      0,
        0,      0,      0,
        0,      0,      0,
        0,      0,      0,
        0,      0,      0,
        0,      0,      0,
        0,      0,      0,
        0,      0,      0,
        0,      0,      0,
        0,      0,      0,
        0,      0,      0,
        0,      0,      0,
        0,      0,      0,
        0,      0,      0,
        0,      0,      0,
        0,      0,      0,
        0,      0,      0,
        0,      0,      0,
        0,      0,      0,
        0,      0,      0,
        0,      0,      0,
        0,      0,      0,
        0,  84578,
];


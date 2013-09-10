'use strict';

function HeaderDecoder(direction) {
  this.encodingContext_ = new EncodingContext();

  var initialHeaderTable =
    (direction == REQUEST) ?
    PRE_DEFINED_REQUEST_HEADER_TABLE :
    PRE_DEFINED_RESPONSE_HEADER_TABLE;
  for (var i = 0; i < initialHeaderTable.length; ++i) {
    var nameValuePair = initialHeaderTable[i];
    this.encodingContext_.processInitialHeader(
      nameValuePair[0], nameValuePair[1]);
  }
}

HeaderDecoder.prototype.decodeHeaderSet = function(encodedHeaderSet) {
  throw new Error('Not implemented');
};

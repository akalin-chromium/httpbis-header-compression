'use strict';

function HeaderEncoder(direction) {
  this.encoder_ = new Encoder();
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

HeaderEncoder.prototype.encodeHeaderSet = function(headerSet) {
  for (var i = 0; i < headerSet.length; ++i) {
    var nameValuePair = headerSet[i];
    this.encodingContext_.processLiteralHeaderWithoutIndexing(
      nameValuePair[0], nameValuePair[1]);
    this.encoder_.encodeLiteralHeaderWithoutIndexing(
      nameValuePair[0], nameValuePair[1]);
  }
  return this.encoder_.flush();
}

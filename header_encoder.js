'use strict';

function HeaderEncoder(direction) {
  this.encodingContext_ = new EncodingContext();

  var initialHeaderTable =
    (direction == REQUEST) ?
    PRE_DEFINED_REQUEST_HEADER_TABLE :
    PRE_DEFINED_RESPONSE_HEADER_TABLE;
  for (var i = 0; i < initialHeaderTable.length; ++i) {
    var nameValuePair = initialHeaderTable[i];
    this.encodingContext_.addInitialHeader(nameValuePair[0], nameValuePair[1]);
  }
}

HeaderEncoder.prototype.encodeHeaderBlock = function(headerBlock) {
  for (var i = 0; i < headerBlock.length; ++i) {
    var nameValuePair = headerBlock[i];
    this.encodingContext_.encodeLiteralHeaderWithoutIndexing(
      nameValuePair[0], nameValuePair[1]);
  }
  return this.encodingContext_.flush();
}

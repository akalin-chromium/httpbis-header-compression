'use strict';

function HeaderDecoder(direction) {
  this.encodingContext_ = new EncodingContext(direction);
}

HeaderDecoder.prototype.decodeHeaderSet = function(encodedHeaderSet) {
  throw new Error('Not implemented');
};

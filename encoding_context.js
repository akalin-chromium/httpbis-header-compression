'use strict';

function Encoder() {
  this.buffer_ = [];
}

Encoder.prototype.encodeOctet = function(o) {
  this.buffer_.push(o & 0xff);
};

Encoder.prototype.encodeInteger = function(firstOctetMask, N, I) {
  var nextMarker = (1 << N) - 1;

  if (I < nextMarker) {
    this.encodeOctet(firstOctetMask | I);
    return;
  }

  if (N > 0) {
    this.encodeOctet(firstOctetMask | nextMarker);
  }

  I -= nextMarker;
  while (I >= 128) {
    this.encodeOctet(I % 128 | 128);
    I /= 128;
  }
  this.encodeOctet(I);
}

Encoder.prototype.encodeASCIIString = function(str) {
  this.encodeInteger(0, 0, str.length);
  for (var i = 0; i < str.length; ++i) {
    this.encodeOctet(str.charCodeAt(i));
  }
}

Encoder.prototype.encodeIndexedHeader = function(index) {
  var opCode = 0x80;
  var prefixLength = 7;
  this.encodeInteger(opCode, prefixLength, index);
}

Encoder.prototype.encodeLiteralHeaderWithoutIndexing = function(
  indexOrName, value) {
  var opCode = 0x60;
  var prefixLength = 5;
  switch (typeof indexOrName) {
    case 'number':
      this.encodeInteger(opCode, prefixLength, indexOrName + 1);
      this.encodeASCIIString(value);
      return;

    case 'string':
      this.encodeInteger(opCode, prefixLength, 0);
      this.encodeASCIIString(indexOrName);
      this.encodeASCIIString(value);
      return;
  }

  throw new Error('not an index or name: ' + indexOrName);
}

Encoder.prototype.encodeLiteralHeaderWithIncrementalIndexing = function(
  indexOrName, value) {
  var opCode = 0x20;
  var prefixLength = 5;
  switch (typeof indexOrName) {
    case 'number':
      this.encodeInteger(opCode, prefixLength, indexOrName + 1);
      this.encodeASCIIString(value);
      return;

    case 'string':
      this.encodeInteger(opCode, prefixLength, 0);
      this.encodeASCIIString(indexOrName);
      this.encodeASCIIString(value);
      return;
  }

  throw new Error('not an index or name: ' + indexOrName);
}

Encoder.prototype.encodeLiteralHeaderWithSubstitutionIndexing = function(
  indexOrName, substitutedIndex, value) {
  var opCode = 0x0;
  var prefixLength = 6;
  switch (typeof indexOrName) {
    case 'number':
      this.encodeInteger(opCode, prefixLength, indexOrName + 1);
      this.encodeInteger(0, 0, substitutedIndex);
      this.encodeASCIIString(value);
      return;

    case 'string':
      this.encodeInteger(opCode, prefixLength, 0);
      this.encodeASCIIString(indexOrName);
      this.encodeInteger(0, 0, substitutedIndex);
      this.encodeASCIIString(value);
      return;
  }

  throw new Error('not an index or name: ' + indexOrName);
}

Encoder.prototype.flush = function() {
  var buffer = this.buffer_;
  this.buffer_ = [];
  return buffer;
}

function HeaderTable() {
  this.entries_ = [];
  this.size_ = 0;
  this.maxSize_ = 4096;
}

HeaderTable.prototype.removeFirstEntry_ = function() {
  var firstEntry = this.entries_.shift();
  this.size_ -= firstEntry.name.length + firstEntry.value.length + 32;
}

HeaderTable.prototype.tryAppendEntry = function(name, value) {
  var index = -1;
  var offset = 0;
  var sizeDelta = name.length + value.length + 32;
  while (this.entries_.length > 0 && this.size_ + sizeDelta > this.maxSize_) {
    --offset;
    this.removeFirstEntry_();
  }
  if (this.size_ + sizeDelta <= this.maxSize_) {
    this.size_ += sizeDelta;
    index = this.entries_.length;
    this.entries_.push({ name: name, value: value });
  }
  return { offset: offset, index: index };
}

HeaderTable.prototype.tryReplaceEntry = function(index, name, value) {
  var offset = 0;
  var existingEntry = this.entries_[index];
  var sizeDelta =
    (name.length + value.length + 32) -
    (existingEntry.name.length + existingEntry.value.length + 32);
  while (this.entries_.length > 0 && this.size_ + sizeDelta > this.maxSize_) {
    --index;
    --offset;
    this.removeFirstEntry_();
  }
  if (this.size_ + sizeDelta <= this.maxSize_) {
    this.size_ += sizeDelta;
    var newEntry = { name: name, value: value };
    if (index >= 0) {
      this.entries_[index] = newEntry;
    } else {
      index = 0;
      ++offset;
      this.entries_.unshift(newEntry);
    }
  } else {
    index = -1;
  }
  return { offset: offset, index: index };
}

function ReferenceSet() {
  this.references_ = {};
}

ReferenceSet.prototype.hasReference = function(index) {
  return index.toString(10) in this.references_;
}

ReferenceSet.prototype.addReference = function(index) {
  this.references_[index.toString(10)] = 1;
}

ReferenceSet.prototype.removeReference = function(index) {
  delete this.references_[index.toString(10)];
}

ReferenceSet.prototype.offsetIndices = function(offset) {
  var newReferences = {};
  for (var indexStr in this.references_) {
    var index = parseInt(indexStr, 10);
    newReferences[index + offset] = 1;
  }
  this.references_ = newReferences;
}

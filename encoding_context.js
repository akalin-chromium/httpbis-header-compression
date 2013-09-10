'use strict';

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

function EncodingContext() {
  this.headerTable_ = new HeaderTable();
  this.referenceSet_ = new ReferenceSet();
}

EncodingContext.prototype.processInitialHeader = function(name, value) {
  this.headerTable_.tryAppendEntry(name, value);
}

EncodingContext.prototype.processIndexedHeader = function(index) {
  if (this.referenceSet_.hasReference(index)) {
    this.referenceSet_.removeReference(index);
  } else {
    this.referenceSet_.addReference(index);
  }
}

EncodingContext.prototype.processLiteralHeaderWithoutIndexing = function(
  indexOrName, value) {
}

EncodingContext.prototype.processLiteralHeaderWithIncrementalIndexing =
function(indexOrName, value) {
  var name;
  switch (typeof indexOrName) {
    case 'number':
      name = this.headerTable_.getEntryName(indexOrName);
      break;

    case 'string':
      name = indexOrName;
      break;
  }
  var result = this.headerTable_.tryAppendEntry(name, value);
  this.referenceSet_.offsetIndices(result.offset);
  this.referenceSet_.addReference(result.index);
}

EncodingContext.prototype.processLiteralHeaderWithSubstitutionIndexing =
function(indexOrName, substitutedIndex, value) {
  var name;
  switch (typeof indexOrName) {
    case 'number':
      name = this.headerTable_.getEntryName(indexOrName);
      break;

    case 'string':
      name = indexOrName;
      break;
  }
  var result = this.headerTable_.tryReplaceEntry(substitutedIndex, name, value);
  this.referenceSet_.offsetIndices(result.offset);
  this.referenceSet_.addReference(result.index);
}

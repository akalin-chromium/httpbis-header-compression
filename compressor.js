'use strict';

function headerListToInstructions(headerList) {
  var skvstos = [];

  // TODO(akalin): Do something smarter here.
  for (var i = 0; i < headerList.length; ++i) {
    skvstos.push(headerList[i]);
  }

  return {
    skvstos: skvstos
  };
}

function serializeInstructions(instructions) {
  // TODO(akalin): Actually serialize the instructions.
  return JSON.stringify(instructions, null, '  ');
}

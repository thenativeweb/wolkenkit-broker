'use strict';

const { Event } = require('commands-events'),
      uuid = require('uuidv4');

const buildEvent = function (modelType, modelName, eventType, data) {
  const modelEvent = new Event({
    context: { name: modelType },
    aggregate: { name: modelName, id: uuid() },
    name: eventType,
    data,
    metadata: { correlationId: uuid(), causationId: uuid() }
  });

  return modelEvent;
};

module.exports = buildEvent;

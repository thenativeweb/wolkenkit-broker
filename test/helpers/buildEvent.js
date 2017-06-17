'use strict';

const Event = require('commands-events').Event,
      uuid = require('uuidv4');

const buildEvent = function (contextName, aggregateName, aggregateId, eventName, data) {
  if (!data) {
    data = eventName;
    eventName = aggregateId;
    aggregateId = uuid();
  }

  const domainEvent = new Event({
    context: { name: contextName },
    aggregate: { name: aggregateName, id: aggregateId },
    name: eventName,
    data,
    metadata: {
      correlationId: uuid(),
      causationId: uuid(),
      isAuthorized: {
        owner: uuid(),
        forAuthenticated: false,
        forPublic: true
      }
    }
  });

  domainEvent.metadata.position = 1;

  return domainEvent;
};

module.exports = buildEvent;

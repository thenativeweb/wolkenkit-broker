'use strict';

const ListAggregate = require('./ListAggregate');

const create = function ({ readModel, modelStore, modelType, modelName, domainEvent }) {
  if (!readModel) {
    throw new Error('Read model is missing.');
  }
  if (!modelStore) {
    throw new Error('Model store is missing.');
  }
  if (!modelType) {
    throw new Error('Model type is missing.');
  }
  if (!modelName) {
    throw new Error('Model name is missing.');
  }

  switch (modelType) {
    case 'lists': {
      if (domainEvent) {
        return new ListAggregate.Writable({
          readModel,
          modelStore,
          modelName,
          domainEvent,
          uncommittedEvents: []
        });
      }

      return new ListAggregate.Readable({
        readModel,
        modelStore,
        modelName
      });
    }
    default: {
      throw new Error('Invalid operation.');
    }
  }
};

module.exports = create;

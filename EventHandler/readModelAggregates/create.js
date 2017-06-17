'use strict';

const ListAggregate = require('./ListAggregate');

const create = function (options) {
  if (!options) {
    throw new Error('Options are missing.');
  }
  if (!options.readModel) {
    throw new Error('Read model is missing.');
  }
  if (!options.modelStore) {
    throw new Error('Model store is missing.');
  }
  if (!options.modelType) {
    throw new Error('Model type is missing.');
  }
  if (!options.modelName) {
    throw new Error('Model name is missing.');
  }

  switch (options.modelType) {
    case 'lists':
      if (options.domainEvent) {
        return new ListAggregate.Writable({
          readModel: options.readModel,
          modelStore: options.modelStore,
          modelName: options.modelName,
          domainEvent: options.domainEvent,
          uncommittedEvents: []
        });
      }

      return new ListAggregate.Readable({
        readModel: options.readModel,
        modelStore: options.modelStore,
        modelName: options.modelName
      });
    default:
      throw new Error('Invalid operation.');
  }
};

module.exports = create;

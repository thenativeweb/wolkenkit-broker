'use strict';

const createReadModelAggregate = require('../../readModelAggregates/create');

const App = function (options) {
  if (!options) {
    throw new Error('Options are missing.');
  }
  if (!options.app) {
    throw new Error('App is missing.');
  }
  if (!options.readModel) {
    throw new Error('Read model is missing.');
  }
  if (!options.modelStore) {
    throw new Error('Model store is missing.');
  }

  this.app = options.app;
  this.readModel = options.readModel;

  Object.keys(options.readModel).forEach(modelType => {
    this[modelType] = {};

    Object.keys(options.readModel[modelType]).forEach(modelName => {
      this[modelType][modelName] = createReadModelAggregate({
        readModel: options.readModel[modelType][modelName],
        modelStore: options.modelStore,
        modelType,
        modelName
      });
    });
  });
};

module.exports = App;

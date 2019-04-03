'use strict';

const memoize = require('lodash/memoize');

const createReadModelAggregate = require('../EventHandler/readModelAggregates/create');

const getApp = function ({ readModel, modelStore }) {
  if (!readModel) {
    throw new Error('Read model is missing.');
  }
  if (!modelStore) {
    throw new Error('Model store is missing.');
  }

  const app = {};

  Object.keys(readModel).forEach(modelType => {
    app[modelType] = {};

    Object.keys(readModel[modelType]).forEach(modelName => {
      app[modelType][modelName] = createReadModelAggregate({
        readModel: readModel[modelType][modelName],
        modelStore,
        modelType,
        modelName
      });
    });
  });

  return app;
};

module.exports = memoize(getApp);

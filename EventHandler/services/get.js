'use strict';

const getApp = require('./getApp'),
      getLogger = require('./getLogger');

const get = function ({ app, readModel, modelStore, modelType, modelName }) {
  if (!app) {
    throw new Error('App is missing.');
  }
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

  const services = {
    app: getApp({ readModel, modelStore }),
    logger: getLogger({ app, modelType, modelName })
  };

  return services;
};

module.exports = get;

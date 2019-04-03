'use strict';

const path = require('path');

const getApp = require('./getApp'),
      getClient = require('./getClient'),
      getLogger = require('./getLogger');

const getForReadModelQueries = function ({
  app,
  metadata,
  readModel,
  modelStore,
  modelType,
  modelName
}) {
  if (!app) {
    throw new Error('App is missing.');
  }
  if (!metadata) {
    throw new Error('Metadata are missing.');
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
    client: getClient({ metadata }),
    logger: getLogger({
      app,
      fileName: path.join('readModel', modelType, `${modelName}.js`)
    })
  };

  return services;
};

module.exports = getForReadModelQueries;

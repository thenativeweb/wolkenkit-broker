'use strict';

const path = require('path');

const getApp = require('./getApp'),
      getClient = require('./getClient'),
      getLogger = require('./getLogger');

const getForWriteModelEventPreparation = function ({
  app,
  event,
  metadata,
  readModel,
  modelStore
}) {
  if (!app) {
    throw new Error('App is missing.');
  }
  if (!event) {
    throw new Error('Event is missing.');
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

  const services = {
    app: getApp({ readModel, modelStore }),
    client: getClient({ metadata }),
    logger: getLogger({
      app,
      fileName: path.join('writeModel', event.context.name, `${event.aggregate.name}.js`)
    })
  };

  return services;
};

module.exports = getForWriteModelEventPreparation;

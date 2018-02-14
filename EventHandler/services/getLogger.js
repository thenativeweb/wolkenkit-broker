'use strict';

const path = require('path');

const basePath = path.join('/', 'wolkenkit', 'app', 'server', 'readModel');

const getLogger = function ({ app, modelType, modelName }) {
  if (!app) {
    throw new Error('App is missing.');
  }
  if (!modelType) {
    throw new Error('Model type is missing.');
  }
  if (!modelName) {
    throw new Error('Model name is missing.');
  }

  const logger = app.services.getLogger(
    path.join(basePath, modelType, `${modelName}.js`)
  );

  return logger;
};

module.exports = getLogger;

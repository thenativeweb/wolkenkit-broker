'use strict';

const path = require('path');

const basePath = path.join('/', 'wolkenkit', 'app', 'server');

const getLogger = function ({ app, fileName }) {
  if (!app) {
    throw new Error('App is missing.');
  }
  if (!fileName) {
    throw new Error('File name is missing.');
  }

  const logger = app.services.getLogger(
    path.join(basePath, fileName)
  );

  return logger;
};

module.exports = getLogger;

'use strict';

const path = require('path');

const runfork = require('runfork'),
      shell = require('shelljs');

const env = require('../../../helpers/env'),
      ListStore = require('../../../../modelStoreMongoDb/ListStore'),
      runIntegrationTests = require('../../modelStore/integrationTests/lists'),
      waitForMongo = require('../../../helpers/waitForMongo');

runIntegrationTests({
  ListStore,
  url: env.MONGO_URL_UNITS,
  resetDatabase (callback) {
    runfork({
      path: path.join(__dirname, '..', '..', '..', 'helpers', 'runResetMongo.js'),
      env: {
        URL: env.MONGO_URL_UNITS
      },
      onExit (exitCode) {
        if (exitCode > 0) {
          return callback(new Error('Failed to reset MongoDB.'));
        }
        callback(null);
      }
    }, errfork => {
      if (errfork) {
        return callback(errfork);
      }
    });
  },
  startContainer (callback) {
    shell.exec('docker start mongodb-units', statusCode => {
      if (statusCode) {
        return callback(new Error(`Unexpected status code ${statusCode}.`));
      }
      waitForMongo({ url: env.MONGO_URL_UNITS }, callback);
    });
  },
  stopContainer () {
    shell.exec('docker kill mongodb-units');
  }
});

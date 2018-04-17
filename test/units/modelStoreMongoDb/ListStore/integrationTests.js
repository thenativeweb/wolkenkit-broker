'use strict';

const path = require('path');

const runfork = require('runfork'),
      shell = require('shelljs');

const env = require('../../../shared/env'),
      ListStore = require('../../../../modelStoreMongoDb/ListStore'),
      runIntegrationTests = require('../../modelStore/integrationTests/lists'),
      waitForMongo = require('../../../shared/waitForMongo');

runIntegrationTests({
  ListStore,
  url: env.MONGO_URL_UNITS,

  async resetDatabase () {
    await new Promise((resolve, reject) => {
      try {
        runfork({
          path: path.join(__dirname, '..', '..', '..', 'shared', 'runResetMongo.js'),
          env: {
            URL: env.MONGO_URL_UNITS
          },
          onExit (exitCode) {
            if (exitCode > 0) {
              return reject(new Error('Failed to reset MongoDB.'));
            }
            resolve();
          }
        });
      } catch (ex) {
        reject(ex);
      }
    });
  },

  async startContainer () {
    shell.exec('docker start mongodb-units');
    await waitForMongo({ url: env.MONGO_URL_UNITS });
  },

  async stopContainer () {
    shell.exec('docker kill mongodb-units');
  }
});

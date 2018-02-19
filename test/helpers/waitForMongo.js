'use strict';

const { MongoClient } = require('mongodb'),
      retry = require('retry');

const waitForMongo = async function (options) {
  if (!options) {
    throw new Error('Options are missing.');
  }
  if (!options.url) {
    throw new Error('Url is missing.');
  }

  const { url } = options;

  const operation = retry.operation();

  await new Promise((resolve, reject) => {
    operation.attempt(() => {
      /* eslint-disable id-length */
      MongoClient.connect(url, { w: 1 }, (err, db) => {
        /* eslint-enable id-length */
        if (operation.retry(err)) {
          return;
        }

        if (err) {
          return reject(operation.mainError());
        }

        db.close(errClose => {
          if (errClose) {
            return reject(errClose);
          }

          resolve(null);
        });
      });
    });
  });
};

module.exports = waitForMongo;

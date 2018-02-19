'use strict';

const { parse } = require('pg-connection-string'),
      pg = require('pg'),
      retry = require('retry');

const waitForPostgres = async function (options) {
  if (!options) {
    throw new Error('Options are missing.');
  }
  if (!options.url) {
    throw new Error('Url is missing.');
  }

  const { url } = options;

  const operation = retry.operation();
  const pool = new pg.Pool(parse(url));

  await new Promise((resolve, reject) => {
    operation.attempt(() => {
      pool.connect((err, db, done) => {
        if (operation.retry(err)) {
          return;
        }

        if (err) {
          return reject(operation.mainError());
        }

        /* eslint-disable callback-return */
        pool.end();
        done();
        resolve(null);
        /* eslint-enable callback-return */
      });
    });
  });
};

module.exports = waitForPostgres;

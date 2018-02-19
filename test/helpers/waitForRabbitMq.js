'use strict';

const amqp = require('amqplib/callback_api'),
      retry = require('retry');

const waitForRabbitMq = async function (options) {
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
      amqp.connect(url, {}, (err, connection) => {
        if (operation.retry(err)) {
          return;
        }

        if (err) {
          return reject(operation.mainError());
        }

        connection.close(errClose => {
          if (errClose) {
            return reject(errClose);
          }

          resolve(null);
        });
      });
    });
  });
};

module.exports = waitForRabbitMq;

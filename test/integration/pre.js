'use strict';

const shell = require('shelljs');

const env = require('../shared/env'),
      waitForMongo = require('../shared/waitForMongo'),
      waitForPostgres = require('../shared/waitForPostgres'),
      waitForRabbitMq = require('../shared/waitForRabbitMq');

const pre = async function () {
  /* eslint-disable no-process-env */
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = 0;
  /* eslint-enable no-process-env */

  shell.exec('docker run -d -p 5674:5672 --name rabbitmq-integration rabbitmq:3.6.6-alpine');
  shell.exec('docker run -d -p 27019:27017 --name mongodb-integration mongo:3.4.2');
  shell.exec('docker run -d -p 5434:5432 -e POSTGRES_USER=wolkenkit -e POSTGRES_PASSWORD=wolkenkit -e POSTGRES_DB=wolkenkit --name postgres-integration postgres:9.6.4-alpine');

  await waitForRabbitMq({ url: env.RABBITMQ_URL_INTEGRATION });
  await waitForMongo({ url: env.MONGO_URL_INTEGRATION });
  await waitForPostgres({ url: env.POSTGRES_URL_INTEGRATION });
};

module.exports = pre;

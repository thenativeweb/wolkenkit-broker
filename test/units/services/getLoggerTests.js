'use strict';

const path = require('path');

const assert = require('assertthat'),
      record = require('record-stdstreams'),
      tailwind = require('tailwind');

const getLogger = require('../../../services/getLogger');

const app = tailwind.createApp({
  keys: path.join(__dirname, '..', '..', 'shared', 'keys'),
  identityProviders: [
    {
      issuer: 'https://auth.thenativeweb.io',
      certificate: path.join(__dirname, '..', '..', 'shared', 'keys', 'certificate.pem')
    }
  ]
});

const fileName = 'readModel/lists/peerGroups.js';

suite('getLogger', () => {
  test('is a function.', async () => {
    assert.that(getLogger).is.ofType('function');
  });

  test('throws an error if app is missing.', async () => {
    assert.that(() => {
      getLogger({});
    }).is.throwing('App is missing.');
  });

  test('throws an error if file name is missing.', async () => {
    assert.that(() => {
      getLogger({ app });
    }).is.throwing('File name is missing.');
  });

  test('returns a logger.', async () => {
    const logger = getLogger({ app, fileName });

    assert.that(logger).is.ofType('object');
    assert.that(logger.info).is.ofType('function');
  });

  test('returns a logger that uses the correct file name.', async () => {
    const logger = getLogger({ app, fileName });
    const stop = record();

    logger.info('Some log message...');

    const { stdout } = stop();
    const logMessage = JSON.parse(stdout);

    assert.that(logMessage.source.endsWith('server/readModel/lists/peerGroups.js')).is.true();
  });
});

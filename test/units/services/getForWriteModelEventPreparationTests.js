'use strict';

const path = require('path');

const applicationManager = require('wolkenkit-application'),
      assert = require('assertthat'),
      tailwind = require('tailwind');

const buildEvent = require('../../shared/buildEvent'),
      getServices = require('../../../services/getForWriteModelEventPreparation'),
      ModelStore = require('../../../modelStore/ModelStore');

const app = tailwind.createApp({
  keys: path.join(__dirname, '..', '..', 'shared', 'keys'),
  identityProviders: [
    {
      issuer: 'https://auth.thenativeweb.io',
      certificate: path.join(__dirname, '..', '..', 'shared', 'keys', 'certificate.pem')
    }
  ]
});

const event = buildEvent('planning', 'peerGroup', 'started', {
  initiator: 'Jane Doe',
  destination: 'Riva'
});

const metadata = { client: {}};
const modelStore = new ModelStore();

suite('getForWriteModelEventPreparation', () => {
  let readModel;

  suiteSetup(async () => {
    readModel = (await applicationManager.load({
      directory: path.join(__dirname, '..', '..', '..', 'app')
    })).readModel;
  });

  test('is a function.', async () => {
    assert.that(getServices).is.ofType('function');
  });

  test('throws an error if app is missing.', async () => {
    assert.that(() => {
      getServices({});
    }).is.throwing('App is missing.');
  });

  test('throws an error if event is missing.', async () => {
    assert.that(() => {
      getServices({ app });
    }).is.throwing('Event is missing.');
  });

  test('throws an error if metadata are missing.', async () => {
    assert.that(() => {
      getServices({ app, event });
    }).is.throwing('Metadata are missing.');
  });

  test('throws an error if read model is missing.', async () => {
    assert.that(() => {
      getServices({ app, event, metadata });
    }).is.throwing('Read model is missing.');
  });

  test('throws an error if model store is missing.', async () => {
    assert.that(() => {
      getServices({ app, event, metadata, readModel });
    }).is.throwing('Model store is missing.');
  });

  test('returns a services object.', async () => {
    const services = getServices({ app, event, metadata, readModel, modelStore });

    assert.that(services).is.ofType('object');
    assert.that(services.app).is.ofType('object');
    assert.that(services.client).is.ofType('object');
    assert.that(services.logger).is.ofType('object');
  });
});

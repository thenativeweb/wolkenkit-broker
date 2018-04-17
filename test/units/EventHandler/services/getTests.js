'use strict';

const path = require('path');

const assert = require('assertthat'),
      tailwind = require('tailwind'),
      WolkenkitApplication = require('wolkenkit-application');

const getServices = require('../../../../EventHandler/services/get'),
      ModelStore = require('../../../../modelStore/ModelStore');

const app = tailwind.createApp({
  keys: path.join(__dirname, '..', '..', '..', 'shared', 'keys'),
  identityProvider: {
    name: 'auth.wolkenkit.io',
    certificate: path.join(__dirname, '..', '..', '..', 'shared', 'keys', 'certificate.pem')
  }
});

const { readModel } = new WolkenkitApplication(path.join(__dirname, '..', '..', '..', '..', 'app'));

const modelStore = new ModelStore();
const modelType = 'lists';
const modelName = 'peerGroups';

suite('getServices', () => {
  test('is a function.', async () => {
    assert.that(getServices).is.ofType('function');
  });

  test('throws an error if app is missing.', async () => {
    assert.that(() => {
      getServices({});
    }).is.throwing('App is missing.');
  });

  test('throws an error if read model is missing.', async () => {
    assert.that(() => {
      getServices({ app });
    }).is.throwing('Read model is missing.');
  });

  test('throws an error if model store is missing.', async () => {
    assert.that(() => {
      getServices({ app, readModel });
    }).is.throwing('Model store is missing.');
  });

  test('throws an error if model type is missing.', async () => {
    assert.that(() => {
      getServices({ app, readModel, modelStore });
    }).is.throwing('Model type is missing.');
  });

  test('throws an error if model name is missing.', async () => {
    assert.that(() => {
      getServices({ app, readModel, modelStore, modelType });
    }).is.throwing('Model name is missing.');
  });

  test('returns a services object.', async () => {
    const services = getServices({ app, readModel, modelStore, modelType, modelName });

    assert.that(services).is.ofType('object');
    assert.that(services.app).is.ofType('object');
    assert.that(services.logger).is.ofType('object');
  });
});

'use strict';

const path = require('path');

const assert = require('assertthat'),
      tailwind = require('tailwind'),
      WolkenkitApplication = require('wolkenkit-application');

const ModelStore = require('../../../../../modelStore/ModelStore');

const App = require('../../../../../EventHandler/Services/app/App');

const tailwindApp = tailwind.createApp({
  keys: path.join(__dirname, '..', '..', '..', '..', 'keys'),
  identityProvider: {
    name: 'auth.wolkenkit.io',
    certificate: path.join(__dirname, '..', '..', '..', '..', 'keys', 'certificate.pem')
  }
});

const readModel = new WolkenkitApplication(path.join(__dirname, '..', '..', '..', '..', '..', 'app')).readModel;

const modelStore = new ModelStore();

suite('App', () => {
  test('is a function.', done => {
    assert.that(App).is.ofType('function');
    done();
  });

  test('throws an error if options are missing.', done => {
    assert.that(() => {
      /* eslint-disable no-new */
      new App();
      /* eslint-enable no-new */
    }).is.throwing('Options are missing.');
    done();
  });

  test('throws an error if the app is missing.', done => {
    assert.that(() => {
      /* eslint-disable no-new */
      new App({});
      /* eslint-enable no-new */
    }).is.throwing('App is missing.');
    done();
  });

  test('throws an error if the read model is missing.', done => {
    assert.that(() => {
      /* eslint-disable no-new */
      new App({ app: tailwindApp });
      /* eslint-enable no-new */
    }).is.throwing('Read model is missing.');
    done();
  });

  test('throws an error if the model store is missing.', done => {
    assert.that(() => {
      /* eslint-disable no-new */
      new App({ app: tailwindApp, readModel });
      /* eslint-enable no-new */
    }).is.throwing('Model store is missing.');
    done();
  });

  test('has lists.', done => {
    const instance = new App({ app: tailwindApp, modelStore, readModel });

    assert.that(instance.lists).is.ofType('object');
    done();
  });

  suite('lists', () => {
    let instance;

    setup(() => {
      instance = new App({ app: tailwindApp, modelStore, readModel });
    });

    test('contains the lists defined by the read model.', done => {
      assert.that(instance.lists.peerGroups).is.ofType('object');
      assert.that(instance.lists.tasteMakers).is.ofType('object');
      done();
    });

    test('connects the lists to the model store.', done => {
      const peerGroups = instance.lists.peerGroups;

      assert.that(peerGroups.read).is.ofType('function');
      assert.that(peerGroups.readOne).is.ofType('function');
      done();
    });
  });
});

'use strict';

const path = require('path');

const assert = require('assertthat'),
      WolkenkitApplication = require('wolkenkit-application');

const getApp = require('../../../../EventHandler/services/getApp'),
      ModelStore = require('../../../../modelStore/ModelStore');

const { readModel } = new WolkenkitApplication(path.join(__dirname, '..', '..', '..', '..', 'app'));

const modelStore = new ModelStore();

suite('getApp', () => {
  test('is a function.', async () => {
    assert.that(getApp).is.ofType('function');
  });

  test('throws an error if the read model is missing.', async () => {
    assert.that(() => {
      getApp({ });
    }).is.throwing('Read model is missing.');
  });

  test('throws an error if the model store is missing.', async () => {
    assert.that(() => {
      getApp({ readModel });
    }).is.throwing('Model store is missing.');
  });

  test('has lists.', async () => {
    const instance = getApp({ modelStore, readModel });

    assert.that(instance.lists).is.ofType('object');
  });

  suite('lists', () => {
    let instance;

    setup(() => {
      instance = getApp({ modelStore, readModel });
    });

    test('contains the lists defined by the read model.', async () => {
      assert.that(instance.lists.peerGroups).is.ofType('object');
      assert.that(instance.lists.tasteMakers).is.ofType('object');
    });

    test('connects the lists to the model store.', async () => {
      const peerGroups = instance.lists.peerGroups;

      assert.that(peerGroups.read).is.ofType('function');
      assert.that(peerGroups.readOne).is.ofType('function');
    });
  });
});

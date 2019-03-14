'use strict';

const path = require('path');

const applicationManager = require('wolkenkit-application'),
      assert = require('assertthat'),
      tailwind = require('tailwind'),
      uuid = require('uuidv4');

const buildEvent = require('../../shared/buildEvent'),
      env = require('../../shared/env'),
      EventHandler = require('../../../EventHandler'),
      EventSequencer = require('../../../eventSequencer/EventSequencer'),
      ListStore = require('../../../modelStoreMongoDb/ListStore'),
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

suite('EventHandler', () => {
  let eventSequencer,
      modelStore,
      readModel;

  suiteSetup(async () => {
    readModel = (await applicationManager.load({
      directory: path.join(__dirname, '..', '..', '..', 'app')
    })).readModel;
  });

  setup(async () => {
    eventSequencer = new EventSequencer();
    modelStore = new ModelStore();

    await modelStore.initialize({
      application: uuid().substr(0, 8),
      eventSequencer,
      readModel,
      stores: {
        lists: new ListStore({ url: env.MONGO_URL_UNITS, eventSequencer })
      }
    });
  });

  test('is a function.', async () => {
    assert.that(EventHandler).is.ofType('function');
  });

  test('throws an error if app is missing.', async () => {
    assert.that(() => {
      /* eslint-disable no-new */
      new EventHandler({});
      /* eslint-enable no-new */
    }).is.throwing('App is missing.');
  });

  test('throws an error if read model is missing.', async () => {
    assert.that(() => {
      /* eslint-disable no-new */
      new EventHandler({ app });
      /* eslint-enable no-new */
    }).is.throwing('Read model is missing.');
  });

  test('throws an error if model store is missing.', async () => {
    assert.that(() => {
      /* eslint-disable no-new */
      new EventHandler({ app, readModel });
      /* eslint-enable no-new */
    }).is.throwing('Model store is missing.');
  });

  suite('handle', () => {
    let eventHandler;

    setup(() => {
      eventHandler = new EventHandler({ app, readModel, modelStore });
    });

    test('turns a domain event into uncommitted read model events.', async () => {
      const peerGroupStartedEvent = buildEvent('planning', 'peerGroup', 'started', {
        initiator: 'Jane Doe',
        destination: 'Riva'
      });

      const uncommittedEvents = await eventHandler.handle(peerGroupStartedEvent);

      assert.that(uncommittedEvents.length).is.equalTo(2);
      assert.that(uncommittedEvents[0].context.name).is.equalTo('lists');
      assert.that(uncommittedEvents[0].aggregate.name).is.equalTo('peerGroups');
      assert.that(uncommittedEvents[0].name).is.equalTo('added');
      assert.that(uncommittedEvents[0].type).is.equalTo('readModel');
      assert.that(uncommittedEvents[0].data).is.equalTo({
        payload: {
          id: peerGroupStartedEvent.aggregate.id,
          initiator: peerGroupStartedEvent.data.initiator,
          destination: peerGroupStartedEvent.data.destination,
          participants: [],
          isAuthorized: peerGroupStartedEvent.metadata.isAuthorized
        }
      });

      assert.that(uncommittedEvents[1].context.name).is.equalTo('lists');
      assert.that(uncommittedEvents[1].aggregate.name).is.equalTo('tasteMakers');
      assert.that(uncommittedEvents[1].name).is.equalTo('added');
      assert.that(uncommittedEvents[1].type).is.equalTo('readModel');
      assert.that(uncommittedEvents[1].data).is.equalTo({
        payload: {
          id: peerGroupStartedEvent.aggregate.id,
          name: peerGroupStartedEvent.data.initiator,
          count: 0,
          isAuthorized: peerGroupStartedEvent.metadata.isAuthorized
        }
      });
    });

    test('provides services to event listeners.', async () => {
      modelStore.readOne = async function () {
        return { initiator: 'Jane Doe' };
      };

      const peerGroupJoinedEvent = buildEvent('planning', 'peerGroup', uuid(), 'joined', {
        participant: 'Jane Doe'
      });

      const uncommittedEvents = await eventHandler.handle(peerGroupJoinedEvent);

      assert.that(uncommittedEvents.length).is.equalTo(2);
      assert.that(uncommittedEvents[0].context.name).is.equalTo('lists');
      assert.that(uncommittedEvents[0].aggregate.name).is.equalTo('peerGroups');
      assert.that(uncommittedEvents[0].name).is.equalTo('updated');
      assert.that(uncommittedEvents[0].type).is.equalTo('readModel');
      assert.that(uncommittedEvents[0].data).is.equalTo({
        selector: { id: peerGroupJoinedEvent.aggregate.id },
        payload: { participants: { $add: 'Jane Doe' }}
      });
      assert.that(uncommittedEvents[1].context.name).is.equalTo('lists');
      assert.that(uncommittedEvents[1].aggregate.name).is.equalTo('tasteMakers');
      assert.that(uncommittedEvents[1].name).is.equalTo('updated');
      assert.that(uncommittedEvents[1].type).is.equalTo('readModel');
      assert.that(uncommittedEvents[1].data).is.equalTo({
        selector: { name: 'Jane Doe' },
        payload: { count: { $incrementBy: 1 }}
      });
    });

    test('returns an error if a listener fails.', async () => {
      modelStore.readOne = async function () {
        throw new Error('Error from readOne.');
      };

      const peerGroupJoinedEvent = buildEvent('planning', 'peerGroup', uuid(), 'joined', {
        participant: 'Jane Doe'
      });

      await assert.that(async () => {
        await eventHandler.handle(peerGroupJoinedEvent);
      }).is.throwingAsync('Error from readOne.');
    });
  });
});

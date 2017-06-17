'use strict';

const path = require('path');

const assert = require('assertthat'),
      tailwind = require('tailwind'),
      uuid = require('uuidv4'),
      WolkenkitApplication = require('wolkenkit-application');

const buildEvent = require('../../helpers/buildEvent'),
      env = require('../../helpers/env'),
      EventHandler = require('../../../EventHandler'),
      EventSequencer = require('../../../eventSequencer/EventSequencer'),
      ListStore = require('../../../modelStoreMongoDb/ListStore'),
      ModelStore = require('../../../modelStore/ModelStore');

const app = tailwind.createApp({
  keys: path.join(__dirname, '..', '..', 'keys'),
  identityProvider: {
    name: 'auth.wolkenkit.io',
    certificate: path.join(__dirname, '..', '..', 'keys', 'certificate.pem')
  }
});

const readModel = new WolkenkitApplication(path.join(__dirname, '..', '..', '..', 'app')).readModel;

suite('EventHandler', () => {
  let eventSequencer,
      modelStore;

  setup(done => {
    eventSequencer = new EventSequencer();
    modelStore = new ModelStore();

    modelStore.initialize({
      application: uuid().substr(0, 8),
      eventSequencer,
      readModel,
      stores: {
        lists: new ListStore({ url: env.MONGO_URL_UNITS, eventSequencer })
      }
    }, err => {
      if (err) {
        return done(err);
      }
      done();
    });
  });

  test('is a function.', done => {
    assert.that(EventHandler).is.ofType('function');
    done();
  });

  test('throws an error if options are missing.', done => {
    assert.that(() => {
      /* eslint-disable no-new */
      new EventHandler();
      /* eslint-enable no-new */
    }).is.throwing('Options are missing.');
    done();
  });

  test('throws an error if app is missing.', done => {
    assert.that(() => {
      /* eslint-disable no-new */
      new EventHandler({});
      /* eslint-enable no-new */
    }).is.throwing('App is missing.');
    done();
  });

  test('throws an error if read model is missing.', done => {
    assert.that(() => {
      /* eslint-disable no-new */
      new EventHandler({ app });
      /* eslint-enable no-new */
    }).is.throwing('Read model is missing.');
    done();
  });

  test('throws an error if model store is missing.', done => {
    assert.that(() => {
      /* eslint-disable no-new */
      new EventHandler({ app, readModel });
      /* eslint-enable no-new */
    }).is.throwing('Model store is missing.');
    done();
  });

  suite('handle', () => {
    let eventHandler;

    setup(() => {
      eventHandler = new EventHandler({ app, readModel, modelStore });
    });

    test('turns a domain event into uncommitted read model events.', done => {
      const peerGroupStartedEvent = buildEvent('planning', 'peerGroup', 'started', {
        initiator: 'Jane Doe',
        destination: 'Riva'
      });

      eventHandler.handle(peerGroupStartedEvent, (err, uncommittedEvents) => {
        assert.that(err).is.null();
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
        done();
      });
    });

    test('provides services to event listeners.', done => {
      modelStore.readOne = function (options, callback) {
        callback(null, { initiator: 'Jane Doe' });
      };

      const peerGroupJoinedEvent = buildEvent('planning', 'peerGroup', uuid(), 'joined', {
        participant: 'Jane Doe'
      });

      eventHandler.handle(peerGroupJoinedEvent, (err, uncommittedEvents) => {
        assert.that(err).is.null();
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
        done();
      });
    });

    test('returns an error if a listener fails.', done => {
      modelStore.readOne = function (options, callback) {
        callback(new Error('Error from readOne.'));
      };

      const peerGroupJoinedEvent = buildEvent('planning', 'peerGroup', uuid(), 'joined', {
        participant: 'Jane Doe'
      });

      eventHandler.handle(peerGroupJoinedEvent, err => {
        assert.that(err).is.not.null();
        assert.that(err.message).is.equalTo('Error from readOne.');
        done();
      });
    });
  });
});

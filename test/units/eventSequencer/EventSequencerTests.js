'use strict';

const assert = require('assertthat');

const buildEvent = require('../../helpers/buildEvent'),
      EventSequencer = require('../../../eventSequencer/EventSequencer');

suite('EventSequencer', () => {
  test('is a function.', done => {
    assert.that(EventSequencer).is.ofType('function');
    done();
  });

  test('initializes with empty models.', done => {
    const eventSequencer = new EventSequencer();

    assert.that(eventSequencer.models).is.equalTo({});
    done();
  });

  suite('registerModel', () => {
    let eventSequencer;

    setup(() => {
      eventSequencer = new EventSequencer();
    });

    test('is a function.', done => {
      assert.that(eventSequencer.registerModel).is.ofType('function');
      done();
    });

    test('throws an error if options are missing.', done => {
      assert.that(() => {
        eventSequencer.registerModel();
      }).is.throwing('Options are missing.');
      done();
    });

    test('throws an error if name is missing.', done => {
      assert.that(() => {
        eventSequencer.registerModel({
          type: 'lists',
          lastProcessedPosition: 23
        });
      }).is.throwing('Name is missing.');
      done();
    });

    test('throws an error if type is missing.', done => {
      assert.that(() => {
        eventSequencer.registerModel({
          name: 'peerGroups',
          lastProcessedPosition: 23
        });
      }).is.throwing('Type is missing.');
      done();
    });

    test('throws an error if last processed position is missing.', done => {
      assert.that(() => {
        eventSequencer.registerModel({
          name: 'peerGroups',
          type: 'lists'
        });
      }).is.throwing('Last processed position is missing.');
      done();
    });

    test('registers the given model.', done => {
      eventSequencer.registerModel({
        name: 'peerGroups',
        type: 'lists',
        lastProcessedPosition: 23
      });

      assert.that(eventSequencer.models).is.equalTo({
        lists: {
          peerGroups: { lastProcessedPosition: 23 }
        }
      });
      done();
    });

    test('registers the given model even with 0 as last processed position.', done => {
      eventSequencer.registerModel({
        name: 'peerGroups',
        type: 'lists',
        lastProcessedPosition: 0
      });

      assert.that(eventSequencer.models).is.equalTo({
        lists: {
          peerGroups: { lastProcessedPosition: 0 }
        }
      });
      done();
    });

    test('throws an error if a model is registered twice.', done => {
      eventSequencer.registerModel({
        name: 'peerGroups',
        type: 'lists',
        lastProcessedPosition: 23
      });

      assert.that(() => {
        eventSequencer.registerModel({
          name: 'peerGroups',
          type: 'lists',
          lastProcessedPosition: 42
        });
      }).is.throwing('Model had already been registered.');
      done();
    });
  });

  suite('updatePosition', () => {
    let eventSequencer;

    setup(() => {
      eventSequencer = new EventSequencer();
    });

    test('is a function.', done => {
      assert.that(eventSequencer.updatePosition).is.ofType('function');
      done();
    });

    test('throws an error if options are missing.', done => {
      assert.that(() => {
        eventSequencer.updatePosition();
      }).is.throwing('Options are missing.');
      done();
    });

    test('throws an error if name is missing.', done => {
      assert.that(() => {
        eventSequencer.updatePosition({
          type: 'lists',
          position: 23
        });
      }).is.throwing('Name is missing.');
      done();
    });

    test('throws an error if type is missing.', done => {
      assert.that(() => {
        eventSequencer.updatePosition({
          name: 'peerGroups',
          position: 23
        });
      }).is.throwing('Type is missing.');
      done();
    });

    test('throws an error if position is missing.', done => {
      assert.that(() => {
        eventSequencer.updatePosition({
          name: 'peerGroups',
          type: 'lists'
        });
      }).is.throwing('Position is missing.');
      done();
    });

    test('throws an error if the given model type does not exist.', done => {
      eventSequencer.registerModel({
        name: 'peerGroups',
        type: 'lists',
        lastProcessedPosition: 23
      });

      assert.that(() => {
        eventSequencer.updatePosition({
          name: 'peerGroups',
          type: 'trees',
          position: 23
        });
      }).is.throwing('Model type does not exist.');
      done();
    });

    test('throws an error if the given model name does not exist.', done => {
      eventSequencer.registerModel({
        name: 'peerGroups',
        type: 'lists',
        lastProcessedPosition: 23
      });

      assert.that(() => {
        eventSequencer.updatePosition({
          name: 'tasteMakers',
          type: 'lists',
          position: 23
        });
      }).is.throwing('Model name does not exist.');
      done();
    });

    test('updates the given model.', done => {
      eventSequencer.registerModel({
        name: 'peerGroups',
        type: 'lists',
        lastProcessedPosition: 23
      });

      eventSequencer.updatePosition({
        name: 'peerGroups',
        type: 'lists',
        position: 24
      });

      assert.that(eventSequencer.models).is.equalTo({
        lists: {
          peerGroups: { lastProcessedPosition: 24 }
        }
      });
      done();
    });

    test('throws an error if the given position is less than the last processed position.', done => {
      eventSequencer.registerModel({
        name: 'peerGroups',
        type: 'lists',
        lastProcessedPosition: 23
      });

      assert.that(() => {
        eventSequencer.updatePosition({
          name: 'peerGroups',
          type: 'lists',
          position: 22
        });
      }).is.throwing('Position is not greater than last processed position.');
      done();
    });

    test('throws an error if the given position is equal to the last processed position.', done => {
      eventSequencer.registerModel({
        name: 'peerGroups',
        type: 'lists',
        lastProcessedPosition: 23
      });

      assert.that(() => {
        eventSequencer.updatePosition({
          name: 'peerGroups',
          type: 'lists',
          position: 23
        });
      }).is.throwing('Position is not greater than last processed position.');
      done();
    });
  });

  suite('getStrategyFor', () => {
    let eventSequencer,
        eventStarted;

    setup(() => {
      eventSequencer = new EventSequencer();

      eventStarted = buildEvent('planning', 'peerGroups', 'started', {
        initiator: 'Jane Doe',
        destination: 'Riva'
      });
    });

    test('is a function.', done => {
      assert.that(eventSequencer.getStrategyFor).is.ofType('function');
      done();
    });

    test('throws an error if event is missing.', done => {
      assert.that(() => {
        eventSequencer.getStrategyFor();
      }).is.throwing('Event is missing.');
      done();
    });

    suite('returns forward strategy', () => {
      test('if position is missing.', done => {
        Reflect.deleteProperty(eventStarted.metadata, 'position');

        const strategy = eventSequencer.getStrategyFor(eventStarted);

        assert.that(strategy).is.equalTo({
          type: 'forward'
        });
        done();
      });
    });

    suite('returns replay strategy', () => {
      test('if events have been lost of the single model.', done => {
        eventSequencer.registerModel({
          name: 'peerGroups',
          type: 'lists',
          lastProcessedPosition: 23
        });

        eventStarted.metadata.position = 42;

        const strategy = eventSequencer.getStrategyFor(eventStarted);

        assert.that(strategy).is.equalTo({
          type: 'replay',
          fromPosition: 24,
          toPosition: 42
        });
        done();
      });

      test('if events have been lost of all models.', done => {
        eventSequencer.registerModel({
          name: 'peerGroups',
          type: 'lists',
          lastProcessedPosition: 23
        });
        eventSequencer.registerModel({
          name: 'tasteMakers',
          type: 'trees',
          lastProcessedPosition: 23
        });

        eventStarted.metadata.position = 42;

        const strategy = eventSequencer.getStrategyFor(eventStarted);

        assert.that(strategy).is.equalTo({
          type: 'replay',
          fromPosition: 24,
          toPosition: 42
        });
        done();
      });

      test('if different events have been lost of all models.', done => {
        eventSequencer.registerModel({
          name: 'peerGroups',
          type: 'lists',
          lastProcessedPosition: 23
        });
        eventSequencer.registerModel({
          name: 'tasteMakers',
          type: 'trees',
          lastProcessedPosition: 35
        });

        eventStarted.metadata.position = 42;

        const strategy = eventSequencer.getStrategyFor(eventStarted);

        assert.that(strategy).is.equalTo({
          type: 'replay',
          fromPosition: 24,
          toPosition: 42
        });
        done();
      });

      test('if events have been lost of some models.', done => {
        eventSequencer.registerModel({
          name: 'peerGroups',
          type: 'lists',
          lastProcessedPosition: 23
        });
        eventSequencer.registerModel({
          name: 'tasteMakers',
          type: 'trees',
          lastProcessedPosition: 41
        });

        eventStarted.metadata.position = 42;

        const strategy = eventSequencer.getStrategyFor(eventStarted);

        assert.that(strategy).is.equalTo({
          type: 'replay',
          fromPosition: 24,
          toPosition: 42
        });
        done();
      });

      test('for new models.', done => {
        eventSequencer.registerModel({
          name: 'peerGroups',
          type: 'lists',
          lastProcessedPosition: 0
        });

        eventStarted.metadata.position = 42;

        const strategy = eventSequencer.getStrategyFor(eventStarted);

        assert.that(strategy).is.equalTo({
          type: 'replay',
          fromPosition: 1,
          toPosition: 42
        });
        done();
      });
    });

    suite('returns skip strategy', () => {
      test('if the event is the last processed event of the single model.', done => {
        eventSequencer.registerModel({
          name: 'peerGroups',
          type: 'lists',
          lastProcessedPosition: 23
        });

        eventStarted.metadata.position = 23;

        const strategy = eventSequencer.getStrategyFor(eventStarted);

        assert.that(strategy).is.equalTo({ type: 'skip' });
        done();
      });

      test('if the event is a predecessor of the last processed event of the single model.', done => {
        eventSequencer.registerModel({
          name: 'peerGroups',
          type: 'lists',
          lastProcessedPosition: 23
        });

        eventStarted.metadata.position = 7;

        const strategy = eventSequencer.getStrategyFor(eventStarted);

        assert.that(strategy).is.equalTo({ type: 'skip' });
        done();
      });

      test('if the event is the last processed events of all models.', done => {
        eventSequencer.registerModel({
          name: 'peerGroups',
          type: 'lists',
          lastProcessedPosition: 23
        });
        eventSequencer.registerModel({
          name: 'tasteMakers',
          type: 'trees',
          lastProcessedPosition: 23
        });

        eventStarted.metadata.position = 23;

        const strategy = eventSequencer.getStrategyFor(eventStarted);

        assert.that(strategy).is.equalTo({ type: 'skip' });
        done();
      });

      test('if the event is a predecessor of the last processed events of all models.', done => {
        eventSequencer.registerModel({
          name: 'peerGroups',
          type: 'lists',
          lastProcessedPosition: 23
        });
        eventSequencer.registerModel({
          name: 'tasteMakers',
          type: 'trees',
          lastProcessedPosition: 23
        });

        eventStarted.metadata.position = 7;

        const strategy = eventSequencer.getStrategyFor(eventStarted);

        assert.that(strategy).is.equalTo({ type: 'skip' });
        done();
      });
    });

    suite('returns proceed strategy', () => {
      test('if the event is the successor of the last processed event of the single model.', done => {
        eventSequencer.registerModel({
          name: 'peerGroups',
          type: 'lists',
          lastProcessedPosition: 23
        });

        eventStarted.metadata.position = 24;

        const strategy = eventSequencer.getStrategyFor(eventStarted);

        assert.that(strategy).is.equalTo({ type: 'proceed' });
        done();
      });

      test('if the event is the successor of the last processed events of all models.', done => {
        eventSequencer.registerModel({
          name: 'peerGroups',
          type: 'lists',
          lastProcessedPosition: 23
        });
        eventSequencer.registerModel({
          name: 'tasteMakers',
          type: 'lists',
          lastProcessedPosition: 23
        });

        eventStarted.metadata.position = 24;

        const strategy = eventSequencer.getStrategyFor(eventStarted);

        assert.that(strategy).is.equalTo({ type: 'proceed' });
        done();
      });

      test('if the event is the successor of the last processed events of at least one model.', done => {
        eventSequencer.registerModel({
          name: 'peerGroups',
          type: 'lists',
          lastProcessedPosition: 23
        });
        eventSequencer.registerModel({
          name: 'tasteMakers',
          type: 'lists',
          lastProcessedPosition: 24
        });

        eventStarted.metadata.position = 24;

        const strategy = eventSequencer.getStrategyFor(eventStarted);

        assert.that(strategy).is.equalTo({ type: 'proceed' });
        done();
      });
    });
  });
});

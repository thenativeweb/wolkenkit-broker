'use strict';

const assert = require('assertthat');

const buildEvent = require('../../shared/buildEvent'),
      EventSequencer = require('../../../eventSequencer/EventSequencer');

suite('EventSequencer', () => {
  test('is a function.', async () => {
    assert.that(EventSequencer).is.ofType('function');
  });

  test('initializes with empty models.', async () => {
    const eventSequencer = new EventSequencer();

    assert.that(eventSequencer.models).is.equalTo({});
  });

  suite('registerModel', () => {
    let eventSequencer;

    setup(() => {
      eventSequencer = new EventSequencer();
    });

    test('is a function.', async () => {
      assert.that(eventSequencer.registerModel).is.ofType('function');
    });

    test('throws an error if name is missing.', async () => {
      assert.that(() => {
        eventSequencer.registerModel({
          type: 'lists',
          lastProcessedPosition: 23
        });
      }).is.throwing('Name is missing.');
    });

    test('throws an error if type is missing.', async () => {
      assert.that(() => {
        eventSequencer.registerModel({
          name: 'peerGroups',
          lastProcessedPosition: 23
        });
      }).is.throwing('Type is missing.');
    });

    test('throws an error if last processed position is missing.', async () => {
      assert.that(() => {
        eventSequencer.registerModel({
          name: 'peerGroups',
          type: 'lists'
        });
      }).is.throwing('Last processed position is missing.');
    });

    test('registers the given model.', async () => {
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
    });

    test('registers the given model even with 0 as last processed position.', async () => {
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
    });

    test('throws an error if a model is registered twice.', async () => {
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
    });
  });

  suite('updatePosition', () => {
    let eventSequencer;

    setup(() => {
      eventSequencer = new EventSequencer();
    });

    test('is a function.', async () => {
      assert.that(eventSequencer.updatePosition).is.ofType('function');
    });

    test('throws an error if name is missing.', async () => {
      assert.that(() => {
        eventSequencer.updatePosition({
          type: 'lists',
          position: 23
        });
      }).is.throwing('Name is missing.');
    });

    test('throws an error if type is missing.', async () => {
      assert.that(() => {
        eventSequencer.updatePosition({
          name: 'peerGroups',
          position: 23
        });
      }).is.throwing('Type is missing.');
    });

    test('throws an error if position is missing.', async () => {
      assert.that(() => {
        eventSequencer.updatePosition({
          name: 'peerGroups',
          type: 'lists'
        });
      }).is.throwing('Position is missing.');
    });

    test('throws an error if the given model type does not exist.', async () => {
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
    });

    test('throws an error if the given model name does not exist.', async () => {
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
    });

    test('updates the given model.', async () => {
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
    });

    test('throws an error if the given position is less than the last processed position.', async () => {
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
    });

    test('throws an error if the given position is equal to the last processed position.', async () => {
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

    test('is a function.', async () => {
      assert.that(eventSequencer.getStrategyFor).is.ofType('function');
    });

    test('throws an error if event is missing.', async () => {
      assert.that(() => {
        eventSequencer.getStrategyFor();
      }).is.throwing('Event is missing.');
    });

    suite('returns forward strategy', () => {
      test('if position is missing.', async () => {
        Reflect.deleteProperty(eventStarted.metadata, 'position');

        const strategy = eventSequencer.getStrategyFor(eventStarted);

        assert.that(strategy).is.equalTo({
          type: 'forward'
        });
      });
    });

    suite('returns replay strategy', () => {
      test('if events have been lost of the single model.', async () => {
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
      });

      test('if events have been lost of all models.', async () => {
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
      });

      test('if different events have been lost of all models.', async () => {
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
      });

      test('if events have been lost of some models.', async () => {
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
      });

      test('for new models.', async () => {
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
      });
    });

    suite('returns skip strategy', () => {
      test('if the event is the last processed event of the single model.', async () => {
        eventSequencer.registerModel({
          name: 'peerGroups',
          type: 'lists',
          lastProcessedPosition: 23
        });

        eventStarted.metadata.position = 23;

        const strategy = eventSequencer.getStrategyFor(eventStarted);

        assert.that(strategy).is.equalTo({ type: 'skip' });
      });

      test('if the event is a predecessor of the last processed event of the single model.', async () => {
        eventSequencer.registerModel({
          name: 'peerGroups',
          type: 'lists',
          lastProcessedPosition: 23
        });

        eventStarted.metadata.position = 7;

        const strategy = eventSequencer.getStrategyFor(eventStarted);

        assert.that(strategy).is.equalTo({ type: 'skip' });
      });

      test('if the event is the last processed events of all models.', async () => {
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
      });

      test('if the event is a predecessor of the last processed events of all models.', async () => {
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
      });
    });

    suite('returns proceed strategy', () => {
      test('if the event is the successor of the last processed event of the single model.', async () => {
        eventSequencer.registerModel({
          name: 'peerGroups',
          type: 'lists',
          lastProcessedPosition: 23
        });

        eventStarted.metadata.position = 24;

        const strategy = eventSequencer.getStrategyFor(eventStarted);

        assert.that(strategy).is.equalTo({ type: 'proceed' });
      });

      test('if the event is the successor of the last processed events of all models.', async () => {
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
      });

      test('if the event is the successor of the last processed events of at least one model.', async () => {
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
      });
    });
  });
});

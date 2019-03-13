'use strict';

const { EventEmitter } = require('events'),
      { PassThrough } = require('stream');

const assert = require('assertthat');

const buildDomainEvent = require('../../shared/buildEvent'),
      buildModelEvent = require('./buildModelEvent'),
      EventSequencer = require('../../../eventSequencer/EventSequencer'),
      ModelStore = require('../../../modelStore/ModelStore');

suite('ModelStore', () => {
  let domainEvent,
      eventSequencer;

  setup(() => {
    domainEvent = buildDomainEvent('planning', 'peerGroup', 'joined', { participant: 'Jane Doe' });
    eventSequencer = new EventSequencer();
  });

  test('is a function.', async () => {
    assert.that(ModelStore).is.ofType('function');
  });

  test('is an event emitter.', async () => {
    const modelStore = new ModelStore();

    assert.that(modelStore).is.instanceOf(EventEmitter);
  });

  suite('initialize', () => {
    let modelStore;

    setup(() => {
      modelStore = new ModelStore();
    });

    test('is a function.', async () => {
      assert.that(modelStore.initialize).is.ofType('function');
    });

    test('throws an error if application is missing.', async () => {
      await assert.that(async () => {
        await modelStore.initialize({});
      }).is.throwingAsync('Application is missing.');
    });

    test('throws an error if event sequencer is missing.', async () => {
      await assert.that(async () => {
        await modelStore.initialize({
          application: 'foo'
        });
      }).is.throwingAsync('Event sequencer is missing.');
    });

    test('throws an error if read model is missing.', async () => {
      await assert.that(async () => {
        await modelStore.initialize({
          application: 'foo',
          eventSequencer
        });
      }).is.throwingAsync('Read model is missing.');
    });

    test('throws an error if stores are missing.', async () => {
      await assert.that(async () => {
        await modelStore.initialize({
          application: 'foo',
          eventSequencer,
          readModel: {}
        });
      }).is.throwingAsync('Stores are missing.');
    });

    test('initializes the given stores.', async () => {
      const listStore = {
        application: undefined,
        readModel: undefined,
        async initialize (options) {
          this.application = options.application;
          this.readModel = options.readModel;
        },
        on () {}
      };
      const treeStore = {
        application: undefined,
        readModel: undefined,
        async initialize (options) {
          this.application = options.application;
          this.readModel = options.readModel;
        },
        on () {}
      };

      await modelStore.initialize({
        application: 'foo',
        eventSequencer,
        readModel: {
          lists: { foo: 'bar' },
          trees: { bar: 'baz' }
        },
        stores: {
          lists: listStore,
          trees: treeStore
        }
      });

      assert.that(modelStore.stores.lists.application).is.equalTo('foo');
      assert.that(modelStore.stores.lists.readModel).is.equalTo({ foo: 'bar' });
      assert.that(modelStore.stores.trees.application).is.equalTo('foo');
      assert.that(modelStore.stores.trees.readModel).is.equalTo({ bar: 'baz' });
    });

    test('subscribes to the stores\' disconnect event.', async () => {
      const listStore = new EventEmitter();

      listStore.application = undefined;
      listStore.readModel = undefined;
      listStore.initialize = async function (options) {
        this.application = options.application;
        this.readModel = options.readModel;
      };

      await modelStore.initialize({
        application: 'foo',
        eventSequencer,
        readModel: {
          lists: { foo: 'bar' }
        },
        stores: {
          lists: listStore
        }
      });

      await new Promise(resolve => {
        modelStore.once('disconnect', () => {
          resolve();
        });

        listStore.emit('disconnect');
      });
    });

    test('returns an error if a store can not be initialized.', async () => {
      const listStore = {
        async initialize () {
          throw new Error('Error from list store.');
        },
        on () {}
      };

      await assert.that(async () => {
        await modelStore.initialize({
          application: 'foo',
          eventSequencer,
          readModel: {
            lists: { foo: 'bar' }
          },
          stores: {
            lists: listStore
          }
        });
      }).is.throwingAsync('Error from list store.');
    });
  });

  suite('processEvents', () => {
    let modelStore;

    setup(() => {
      modelStore = new ModelStore();
    });

    test('is a function.', async () => {
      assert.that(modelStore.processEvents).is.ofType('function');
    });

    test('throws an error if domain event is missing.', async () => {
      await assert.that(async () => {
        await modelStore.processEvents();
      }).is.throwingAsync('Domain event is missing.');
    });

    test('throws an error if model events are missing.', async () => {
      await assert.that(async () => {
        await modelStore.processEvents(domainEvent);
      }).is.throwingAsync('Model events are missing.');
    });

    test('handles store specific events in each store.', async () => {
      const listStore = {
        items: [],
        async initialize () {
          eventSequencer.registerModel({ type: 'lists', name: 'peerGroups', lastProcessedPosition: 0 });
        },
        async added (options) {
          this.items.push(options.payload);
        },
        async updatePosition () {
          // Intentionally left blank.
        },
        on () {}
      };
      const treeStore = {
        items: [],
        async initialize () {
          eventSequencer.registerModel({ type: 'trees', name: 'peerGroups', lastProcessedPosition: 0 });
        },
        async added (options) {
          this.items.push(options.payload);
        },
        async updatePosition () {
          // Intentionally left blank.
        },
        on () {}
      };

      await modelStore.initialize({
        application: 'foo',
        eventSequencer,
        readModel: {},
        stores: {
          lists: listStore,
          trees: treeStore
        }
      });

      const modelEvents = [
        buildModelEvent('lists', 'peerGroups', 'added', { payload: { value: 1 }}),
        buildModelEvent('lists', 'peerGroups', 'added', { payload: { value: 2 }}),
        buildModelEvent('trees', 'peerGroups', 'added', { payload: { value: 3 }}),
        buildModelEvent('trees', 'peerGroups', 'added', { payload: { value: 4 }})
      ];

      await modelStore.processEvents(domainEvent, modelEvents);

      assert.that(listStore.items).is.equalTo([
        { value: 1 },
        { value: 2 }
      ]);
      assert.that(treeStore.items).is.equalTo([
        { value: 3 },
        { value: 4 }
      ]);
    });

    test('ignores events for non-existent stores.', async () => {
      const listStore = {
        items: [],
        async initialize () {
          eventSequencer.registerModel({ type: 'lists', name: 'peerGroups', lastProcessedPosition: 0 });
        },
        async added (options) {
          this.items.push(options.payload);
        },
        async updatePosition () {
          // Intentionally left blank.
        },
        on () {}
      };

      await modelStore.initialize({
        application: 'foo',
        eventSequencer,
        readModel: {},
        stores: {
          lists: listStore
        }
      });

      const modelEvents = [
        buildModelEvent('lists', 'peerGroups', 'added', { payload: { value: 1 }}),
        buildModelEvent('lists', 'peerGroups', 'added', { payload: { value: 2 }}),
        buildModelEvent('trees', 'peerGroups', 'added', { payload: { value: 3 }}),
        buildModelEvent('trees', 'peerGroups', 'added', { payload: { value: 4 }})
      ];

      await modelStore.processEvents(domainEvent, modelEvents);

      assert.that(listStore.items).is.equalTo([
        { value: 1 },
        { value: 2 }
      ]);
    });

    test('skips events for models that have already processed the event.', async () => {
      const listStore = {
        items: [],
        async initialize () {
          eventSequencer.registerModel({ type: 'lists', name: 'peerGroups', lastProcessedPosition: 0 });
          eventSequencer.registerModel({ type: 'lists', name: 'tasteMakers', lastProcessedPosition: 1 });
        },
        async added (options) {
          this.items.push(options.modelName);
        },
        async updatePosition () {
          // Intentionally left blank.
        },
        on () {}
      };

      await modelStore.initialize({
        application: 'foo',
        eventSequencer,
        readModel: {},
        stores: {
          lists: listStore
        }
      });

      const modelEvents = [
        buildModelEvent('lists', 'peerGroups', 'added', { payload: { value: 1 }}),
        buildModelEvent('lists', 'tasteMakers', 'added', { payload: { value: 1 }})
      ];

      await modelStore.processEvents(domainEvent, modelEvents);

      assert.that(listStore.items.length).is.equalTo(1);
      assert.that(listStore.items[0]).is.equalTo('peerGroups');
    });

    test('returns an error if a store fails.', async () => {
      const listStore = {
        items: [],
        async initialize () {
          eventSequencer.registerModel({ type: 'lists', name: 'peerGroups', lastProcessedPosition: 0 });
        },
        async added (options) {
          this.items.push(options.payload);
        },
        async updatePosition () {
          // Intentionally left blank.
        },
        on () {}
      };
      const treeStore = {
        async initialize () {
          eventSequencer.registerModel({ type: 'trees', name: 'peerGroups', lastProcessedPosition: 0 });
        },
        async added () {
          throw new Error('Error from tree store.');
        },
        async updatePosition () {
          // Intentionally left blank.
        },
        on () {}
      };

      await modelStore.initialize({
        application: 'foo',
        eventSequencer,
        readModel: {},
        stores: {
          lists: listStore,
          trees: treeStore
        }
      });

      const modelEvents = [
        buildModelEvent('lists', 'peerGroups', 'added', { payload: { value: 1 }}),
        buildModelEvent('lists', 'peerGroups', 'added', { payload: { value: 2 }}),
        buildModelEvent('trees', 'peerGroups', 'added', { payload: { value: 3 }}),
        buildModelEvent('trees', 'peerGroups', 'added', { payload: { value: 4 }})
      ];

      await assert.that(async () => {
        await modelStore.processEvents(domainEvent, modelEvents);
      }).is.throwingAsync('Error from tree store.');
    });
  });

  suite('read', () => {
    let modelStore;

    setup(() => {
      modelStore = new ModelStore();
    });

    test('is a function.', async () => {
      assert.that(modelStore.read).is.ofType('function');
    });

    test('throws an error if model type is missing.', async () => {
      await assert.that(async () => {
        await modelStore.read({});
      }).is.throwingAsync('Model type is missing.');
    });

    test('throws an error if model name is missing.', async () => {
      await assert.that(async () => {
        await modelStore.read({ modelType: 'lists' });
      }).is.throwingAsync('Model name is missing.');
    });

    test('calls read on the appropriate store.', async () => {
      const listStore = {
        options: undefined,
        async initialize () {
          // Intentionally left blank.
        },
        async read (options) {
          this.options = options;

          return 'this should be a stream';
        },
        on () {}
      };

      await modelStore.initialize({
        application: 'foo',
        eventSequencer,
        readModel: {},
        stores: {
          lists: listStore
        }
      });

      const peerGroups = await modelStore.read({
        modelType: 'lists',
        modelName: 'peerGroups',
        query: {
          where: { foo: 'bar' }
        }
      });

      assert.that(peerGroups).is.equalTo('this should be a stream');
      assert.that(listStore.options).is.equalTo({
        modelName: 'peerGroups',
        applyTransformations: false,
        user: undefined,
        query: {
          where: { foo: 'bar' }
        }
      });
    });

    test('sets a default query if no query is given.', async () => {
      const listStore = {
        options: undefined,
        async initialize () {
          // Intentionally left blank.
        },
        async read (options) {
          this.options = options;

          return 'this should be a stream';
        },
        on () {}
      };

      await modelStore.initialize({
        application: 'foo',
        eventSequencer,
        readModel: {},
        stores: {
          lists: listStore
        }
      });

      await modelStore.read({ modelType: 'lists', modelName: 'peerGroups' });

      assert.that(listStore.options.query).is.equalTo({});
    });

    test('forwards errors from the store.', async () => {
      const listStore = {
        async initialize () {
          // Intentionally left blank.
        },
        async read () {
          throw new Error('Error from list store.');
        },
        on () {}
      };

      await modelStore.initialize({
        application: 'foo',
        eventSequencer,
        readModel: {},
        stores: {
          lists: listStore
        }
      });

      await assert.that(async () => {
        await modelStore.read({ modelType: 'lists', modelName: 'peerGroups' });
      }).is.throwingAsync('Error from list store.');
    });
  });

  suite('readOne', () => {
    let modelStore;

    setup(() => {
      modelStore = new ModelStore();
    });

    test('is a function.', async () => {
      assert.that(modelStore.readOne).is.ofType('function');
    });

    test('throws an error if model type is missing.', async () => {
      await assert.that(async () => {
        await modelStore.readOne({});
      }).is.throwingAsync('Model type is missing.');
    });

    test('throws an error if model name is missing.', async () => {
      await assert.that(async () => {
        await modelStore.readOne({ modelType: 'lists' });
      }).is.throwingAsync('Model name is missing.');
    });

    test('throws an error if query is missing.', async () => {
      await assert.that(async () => {
        await modelStore.readOne({ modelType: 'lists', modelName: 'peerGroups' });
      }).is.throwingAsync('Query is missing.');
    });

    test('throws an error if where is missing.', async () => {
      await assert.that(async () => {
        await modelStore.readOne({ modelType: 'lists', modelName: 'peerGroups', query: {}});
      }).is.throwingAsync('Where is missing.');
    });

    test('returns the first found item.', async () => {
      const listStore = {
        options: undefined,
        async initialize () {
          eventSequencer.registerModel({ type: 'lists', name: 'peerGroups', lastProcessedPosition: 0 });
        },
        async read (options) {
          this.options = options;

          const passThrough = new PassThrough({ objectMode: true });

          passThrough.write('this should be an item');
          passThrough.write('this is another item');
          passThrough.end();

          return passThrough;
        },
        on () {}
      };

      await modelStore.initialize({
        application: 'foo',
        eventSequencer,
        readModel: {},
        stores: {
          lists: listStore
        }
      });

      const item = await modelStore.readOne({
        modelType: 'lists',
        modelName: 'peerGroups',
        query: { where: { foo: 'bar' }}
      });

      assert.that(item).is.equalTo('this should be an item');
      assert.that(listStore.options).is.equalTo({
        modelName: 'peerGroups',
        applyTransformations: false,
        user: undefined,
        query: {
          where: { foo: 'bar' },
          take: 1
        }
      });
    });

    test('returns an error if no item matches the query.', async () => {
      const listStore = {
        options: undefined,
        async initialize () {
          eventSequencer.registerModel({ type: 'lists', name: 'peerGroups', lastProcessedPosition: 0 });
        },
        async read (options) {
          this.options = options;

          const passThrough = new PassThrough();

          passThrough.end();

          return passThrough;
        },
        on () {}
      };

      await modelStore.initialize({
        application: 'foo',
        eventSequencer,
        readModel: {},
        stores: {
          lists: listStore
        }
      });

      await assert.that(async () => {
        await modelStore.readOne({
          modelType: 'lists',
          modelName: 'peerGroups',
          query: { where: { foo: 'bar' }}
        });
      }).is.throwingAsync('Item not found.');
    });

    test('forwards errors from the store.', async () => {
      const listStore = {
        async initialize () {
          eventSequencer.registerModel({ type: 'lists', name: 'peerGroups', lastProcessedPosition: 0 });
        },
        async read () {
          throw new Error('Error from list store.');
        },
        on () {}
      };

      await modelStore.initialize({
        application: 'foo',
        eventSequencer,
        readModel: {},
        stores: {
          lists: listStore
        }
      });

      await assert.that(async () => {
        await modelStore.readOne({
          modelType: 'lists',
          modelName: 'peerGroups',
          query: {
            where: { foo: 'bar' }
          }
        });
      }).is.throwingAsync('Error from list store.');
    });
  });
});

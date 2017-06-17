'use strict';

const EventEmitter = require('events').EventEmitter,
      stream = require('stream');

const assert = require('assertthat');

const buildDomainEvent = require('../../helpers/buildEvent'),
      buildModelEvent = require('./buildModelEvent'),
      EventSequencer = require('../../../eventSequencer/EventSequencer'),
      ModelStore = require('../../../modelStore/ModelStore');

const PassThrough = stream.PassThrough;

suite('ModelStore', () => {
  let domainEvent,
      eventSequencer;

  setup(() => {
    domainEvent = buildDomainEvent('planning', 'peerGroup', 'joined', { participant: 'Jane Doe' });
    eventSequencer = new EventSequencer();
  });

  test('is a function.', done => {
    assert.that(ModelStore).is.ofType('function');
    done();
  });

  test('is an event emitter.', done => {
    const modelStore = new ModelStore();

    assert.that(modelStore).is.instanceOf(EventEmitter);
    done();
  });

  suite('initialize', () => {
    let modelStore;

    setup(() => {
      modelStore = new ModelStore();
    });

    test('is a function.', done => {
      assert.that(modelStore.initialize).is.ofType('function');
      done();
    });

    test('throws an error if options are missing.', done => {
      assert.that(() => {
        modelStore.initialize();
      }).is.throwing('Options are missing.');
      done();
    });

    test('throws an error if application is missing.', done => {
      assert.that(() => {
        modelStore.initialize({});
      }).is.throwing('Application is missing.');
      done();
    });

    test('throws an error if event sequencer is missing.', done => {
      assert.that(() => {
        modelStore.initialize({
          application: 'foo'
        });
      }).is.throwing('Event sequencer is missing.');
      done();
    });

    test('throws an error if read model is missing.', done => {
      assert.that(() => {
        modelStore.initialize({
          application: 'foo',
          eventSequencer
        });
      }).is.throwing('Read model is missing.');
      done();
    });

    test('throws an error if stores are missing.', done => {
      assert.that(() => {
        modelStore.initialize({
          application: 'foo',
          eventSequencer,
          readModel: {}
        });
      }).is.throwing('Stores are missing.');
      done();
    });

    test('throws an error if callback is missing.', done => {
      assert.that(() => {
        modelStore.initialize({
          application: 'foo',
          eventSequencer,
          readModel: {},
          stores: {}
        });
      }).is.throwing('Callback is missing.');
      done();
    });

    test('initializes the given stores.', done => {
      const listStore = {
        application: undefined,
        readModel: undefined,
        initialize (options, callback) {
          this.application = options.application;
          this.readModel = options.readModel;
          callback(null);
        },
        on () {}
      };
      const treeStore = {
        application: undefined,
        readModel: undefined,
        initialize (options, callback) {
          this.application = options.application;
          this.readModel = options.readModel;
          callback(null);
        },
        on () {}
      };

      modelStore.initialize({
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
      }, err => {
        assert.that(err).is.null();
        assert.that(modelStore.stores.lists.application).is.equalTo('foo');
        assert.that(modelStore.stores.lists.readModel).is.equalTo({ foo: 'bar' });
        assert.that(modelStore.stores.trees.application).is.equalTo('foo');
        assert.that(modelStore.stores.trees.readModel).is.equalTo({ bar: 'baz' });
        done();
      });
    });

    test('subscribes to the stores\' disconnect event.', done => {
      const listStore = new EventEmitter();

      listStore.application = undefined;
      listStore.readModel = undefined;
      listStore.initialize = function (options, callback) {
        this.application = options.application;
        this.readModel = options.readModel;
        callback(null);
      };

      modelStore.initialize({
        application: 'foo',
        eventSequencer,
        readModel: {
          lists: { foo: 'bar' }
        },
        stores: {
          lists: listStore
        }
      }, err => {
        assert.that(err).is.null();

        modelStore.once('disconnect', () => {
          done(null);
        });

        listStore.emit('disconnect');
      });
    });

    test('returns an error if a store can not be initialized.', done => {
      const listStore = {
        initialize (options, callback) {
          callback(new Error('Error from list store.'));
        },
        on () {}
      };

      modelStore.initialize({
        application: 'foo',
        eventSequencer,
        readModel: {
          lists: { foo: 'bar' }
        },
        stores: {
          lists: listStore
        }
      }, err => {
        assert.that(err).is.not.null();
        assert.that(err.message).is.equalTo('Error from list store.');
        done();
      });
    });
  });

  suite('processEvents', () => {
    let modelStore;

    setup(() => {
      modelStore = new ModelStore();
    });

    test('is a function.', done => {
      assert.that(modelStore.processEvents).is.ofType('function');
      done();
    });

    test('throws an error if domain event is missing.', done => {
      assert.that(() => {
        modelStore.processEvents();
      }).is.throwing('Domain event is missing.');
      done();
    });

    test('throws an error if model events are missing.', done => {
      assert.that(() => {
        modelStore.processEvents(domainEvent);
      }).is.throwing('Model events are missing.');
      done();
    });

    test('throws an error if callback is missing.', done => {
      assert.that(() => {
        modelStore.processEvents(domainEvent, []);
      }).is.throwing('Callback is missing.');
      done();
    });

    test('handles store specific events in each store.', done => {
      const listStore = {
        items: [],
        initialize (options, callback) {
          eventSequencer.registerModel({ type: 'lists', name: 'peerGroups', lastProcessedPosition: 0 });
          callback(null);
        },
        added (options, callback) {
          this.items.push(options.payload);
          callback(null);
        },
        updatePosition (position, callback) {
          callback(null);
        },
        on () {}
      };
      const treeStore = {
        items: [],
        initialize (options, callback) {
          eventSequencer.registerModel({ type: 'trees', name: 'peerGroups', lastProcessedPosition: 0 });
          callback(null);
        },
        added (options, callback) {
          this.items.push(options.payload);
          callback(null);
        },
        updatePosition (position, callback) {
          callback(null);
        },
        on () {}
      };

      modelStore.initialize({
        application: 'foo',
        eventSequencer,
        readModel: {},
        stores: {
          lists: listStore,
          trees: treeStore
        }
      }, err => {
        assert.that(err).is.null();

        const modelEvents = [
          buildModelEvent('lists', 'peerGroups', 'added', { payload: { value: 1 }}),
          buildModelEvent('lists', 'peerGroups', 'added', { payload: { value: 2 }}),
          buildModelEvent('trees', 'peerGroups', 'added', { payload: { value: 3 }}),
          buildModelEvent('trees', 'peerGroups', 'added', { payload: { value: 4 }})
        ];

        modelStore.processEvents(domainEvent, modelEvents, errProcessEvents => {
          assert.that(errProcessEvents).is.null();
          assert.that(listStore.items).is.equalTo([
            { value: 1 },
            { value: 2 }
          ]);
          assert.that(treeStore.items).is.equalTo([
            { value: 3 },
            { value: 4 }
          ]);
          done();
        });
      });
    });

    test('ignores events for non-existent stores.', done => {
      const listStore = {
        items: [],
        initialize (options, callback) {
          eventSequencer.registerModel({ type: 'lists', name: 'peerGroups', lastProcessedPosition: 0 });
          callback(null);
        },
        added (options, callback) {
          this.items.push(options.payload);
          callback(null);
        },
        updatePosition (position, callback) {
          callback(null);
        },
        on () {}
      };

      modelStore.initialize({
        application: 'foo',
        eventSequencer,
        readModel: {},
        stores: {
          lists: listStore
        }
      }, err => {
        assert.that(err).is.null();

        const modelEvents = [
          buildModelEvent('lists', 'peerGroups', 'added', { payload: { value: 1 }}),
          buildModelEvent('lists', 'peerGroups', 'added', { payload: { value: 2 }}),
          buildModelEvent('trees', 'peerGroups', 'added', { payload: { value: 3 }}),
          buildModelEvent('trees', 'peerGroups', 'added', { payload: { value: 4 }})
        ];

        modelStore.processEvents(domainEvent, modelEvents, errProcessEvents => {
          assert.that(errProcessEvents).is.null();
          assert.that(listStore.items).is.equalTo([
            { value: 1 },
            { value: 2 }
          ]);
          done();
        });
      });
    });

    test('skips events for models that have already processed the event.', done => {
      const listStore = {
        items: [],
        initialize (options, callback) {
          eventSequencer.registerModel({ type: 'lists', name: 'peerGroups', lastProcessedPosition: 0 });
          eventSequencer.registerModel({ type: 'lists', name: 'tasteMakers', lastProcessedPosition: 1 });
          callback(null);
        },
        added (options, callback) {
          this.items.push(options.modelName);
          callback(null);
        },
        updatePosition (position, callback) {
          callback(null);
        },
        on () {}
      };

      modelStore.initialize({
        application: 'foo',
        eventSequencer,
        readModel: {},
        stores: {
          lists: listStore
        }
      }, err => {
        assert.that(err).is.null();

        const modelEvents = [
          buildModelEvent('lists', 'peerGroups', 'added', { payload: { value: 1 }}),
          buildModelEvent('lists', 'tasteMakers', 'added', { payload: { value: 1 }})
        ];

        modelStore.processEvents(domainEvent, modelEvents, errProcessEvents => {
          assert.that(errProcessEvents).is.null();
          assert.that(listStore.items.length).is.equalTo(1);
          assert.that(listStore.items[0]).is.equalTo('peerGroups');
          done();
        });
      });
    });

    test('returns an error if a store fails.', done => {
      const listStore = {
        items: [],
        initialize (options, callback) {
          eventSequencer.registerModel({ type: 'lists', name: 'peerGroups', lastProcessedPosition: 0 });
          callback(null);
        },
        added (options, callback) {
          this.items.push(options.payload);
          callback(null);
        },
        updatePosition (position, callback) {
          callback(null);
        },
        on () {}
      };
      const treeStore = {
        initialize (options, callback) {
          eventSequencer.registerModel({ type: 'trees', name: 'peerGroups', lastProcessedPosition: 0 });
          callback(null);
        },
        added (options, callback) {
          callback(new Error('Error from tree store.'));
        },
        updatePosition (position, callback) {
          callback(null);
        },
        on () {}
      };

      modelStore.initialize({
        application: 'foo',
        eventSequencer,
        readModel: {},
        stores: {
          lists: listStore,
          trees: treeStore
        }
      }, err => {
        assert.that(err).is.null();

        const modelEvents = [
          buildModelEvent('lists', 'peerGroups', 'added', { payload: { value: 1 }}),
          buildModelEvent('lists', 'peerGroups', 'added', { payload: { value: 2 }}),
          buildModelEvent('trees', 'peerGroups', 'added', { payload: { value: 3 }}),
          buildModelEvent('trees', 'peerGroups', 'added', { payload: { value: 4 }})
        ];

        modelStore.processEvents(domainEvent, modelEvents, errProcessEvents => {
          assert.that(errProcessEvents).is.not.null();
          assert.that(errProcessEvents.message).is.equalTo('Error from tree store.');
          done();
        });
      });
    });
  });

  suite('read', () => {
    let modelStore;

    setup(() => {
      modelStore = new ModelStore();
    });

    test('is a function.', done => {
      assert.that(modelStore.read).is.ofType('function');
      done();
    });

    test('throws an error if options are missing.', done => {
      assert.that(() => {
        modelStore.read();
      }).is.throwing('Options are missing.');
      done();
    });

    test('throws an error if model type is missing.', done => {
      assert.that(() => {
        modelStore.read({});
      }).is.throwing('Model type is missing.');
      done();
    });

    test('throws an error if model name is missing.', done => {
      assert.that(() => {
        modelStore.read({ modelType: 'lists' });
      }).is.throwing('Model name is missing.');
      done();
    });

    test('throws an error if callback is missing.', done => {
      assert.that(() => {
        modelStore.read({ modelType: 'lists', modelName: 'peerGroups' });
      }).is.throwing('Callback is missing.');
      done();
    });

    test('calls read on the appropriate store.', done => {
      const listStore = {
        options: undefined,
        initialize (options, callback) {
          callback(null);
        },
        read (options, callback) {
          this.options = options;
          callback(null, 'this should be a stream');
        },
        on () {}
      };

      modelStore.initialize({
        application: 'foo',
        eventSequencer,
        readModel: {},
        stores: {
          lists: listStore
        }
      }, errInitialize => {
        assert.that(errInitialize).is.null();

        modelStore.read({
          modelType: 'lists',
          modelName: 'peerGroups',
          query: {
            where: { foo: 'bar' }
          }
        }, (errRead, peerGroups) => {
          assert.that(errRead).is.null();
          assert.that(peerGroups).is.equalTo('this should be a stream');
          assert.that(listStore.options).is.equalTo({
            modelType: 'lists',
            modelName: 'peerGroups',
            query: {
              where: { foo: 'bar' }
            }
          });
          done();
        });
      });
    });

    test('sets a default query if no query is given.', done => {
      const listStore = {
        options: undefined,
        initialize (options, callback) {
          callback(null);
        },
        read (options, callback) {
          this.options = options;
          callback(null, 'this should be a stream');
        },
        on () {}
      };

      modelStore.initialize({
        application: 'foo',
        eventSequencer,
        readModel: {},
        stores: {
          lists: listStore
        }
      }, errInitialize => {
        assert.that(errInitialize).is.null();

        modelStore.read({ modelType: 'lists', modelName: 'peerGroups' }, errRead => {
          assert.that(errRead).is.null();
          assert.that(listStore.options.query).is.equalTo({});
          done();
        });
      });
    });

    test('forwards errors from the store.', done => {
      const listStore = {
        initialize (options, callback) {
          callback(null);
        },
        read (options, callback) {
          callback(new Error('Error from list store.'));
        },
        on () {}
      };

      modelStore.initialize({
        application: 'foo',
        eventSequencer,
        readModel: {},
        stores: {
          lists: listStore
        }
      }, errInitialize => {
        assert.that(errInitialize).is.null();

        modelStore.read({ modelType: 'lists', modelName: 'peerGroups' }, errRead => {
          assert.that(errRead).is.not.null();
          assert.that(errRead.message).is.equalTo('Error from list store.');
          done();
        });
      });
    });
  });

  suite('readOne', () => {
    let modelStore;

    setup(() => {
      modelStore = new ModelStore();
    });

    test('is a function.', done => {
      assert.that(modelStore.readOne).is.ofType('function');
      done();
    });

    test('throws an error if options are missing.', done => {
      assert.that(() => {
        modelStore.readOne();
      }).is.throwing('Options are missing.');
      done();
    });

    test('throws an error if model type is missing.', done => {
      assert.that(() => {
        modelStore.readOne({});
      }).is.throwing('Model type is missing.');
      done();
    });

    test('throws an error if model name is missing.', done => {
      assert.that(() => {
        modelStore.readOne({ modelType: 'lists' });
      }).is.throwing('Model name is missing.');
      done();
    });

    test('throws an error if query is missing.', done => {
      assert.that(() => {
        modelStore.readOne({ modelType: 'lists', modelName: 'peerGroups' });
      }).is.throwing('Query is missing.');
      done();
    });

    test('throws an error if where is missing.', done => {
      assert.that(() => {
        modelStore.readOne({ modelType: 'lists', modelName: 'peerGroups', query: {}});
      }).is.throwing('Where is missing.');
      done();
    });

    test('throws an error if callback is missing.', done => {
      assert.that(() => {
        modelStore.readOne({ modelType: 'lists', modelName: 'peerGroups', query: { where: {}}});
      }).is.throwing('Callback is missing.');
      done();
    });

    test('returns the first found item.', done => {
      const listStore = {
        options: undefined,
        initialize (options, callback) {
          eventSequencer.registerModel({ type: 'lists', name: 'peerGroups', lastProcessedPosition: 0 });
          callback(null);
        },
        read (options, callback) {
          this.options = options;

          const passThrough = new PassThrough({ objectMode: true });

          passThrough.write('this should be an item');
          passThrough.write('this is another item');
          passThrough.end();

          callback(null, passThrough);
        },
        on () {}
      };

      modelStore.initialize({
        application: 'foo',
        eventSequencer,
        readModel: {},
        stores: {
          lists: listStore
        }
      }, errInitialize => {
        assert.that(errInitialize).is.null();

        modelStore.readOne({
          modelType: 'lists',
          modelName: 'peerGroups',
          query: { where: { foo: 'bar' }}
        }, (errRead, item) => {
          assert.that(errRead).is.null();
          assert.that(item).is.equalTo('this should be an item');
          assert.that(listStore.options).is.equalTo({
            modelType: 'lists',
            modelName: 'peerGroups',
            query: {
              where: { foo: 'bar' },
              take: 1
            }
          });
          done();
        });
      });
    });

    test('returns an error if no item matches the query.', done => {
      const listStore = {
        options: undefined,
        initialize (options, callback) {
          eventSequencer.registerModel({ type: 'lists', name: 'peerGroups', lastProcessedPosition: 0 });
          callback(null);
        },
        read (options, callback) {
          this.options = options;

          const passThrough = new PassThrough();

          passThrough.end();

          callback(null, passThrough);
        },
        on () {}
      };

      modelStore.initialize({
        application: 'foo',
        eventSequencer,
        readModel: {},
        stores: {
          lists: listStore
        }
      }, errInitialize => {
        assert.that(errInitialize).is.null();

        modelStore.readOne({
          modelType: 'lists',
          modelName: 'peerGroups',
          query: { where: { foo: 'bar' }}
        }, errRead => {
          assert.that(errRead).is.not.null();
          assert.that(errRead.message).is.equalTo('Item not found.');
          done();
        });
      });
    });

    test('forwards errors from the store.', done => {
      const listStore = {
        initialize (options, callback) {
          eventSequencer.registerModel({ type: 'lists', name: 'peerGroups', lastProcessedPosition: 0 });
          callback(null);
        },
        read (options, callback) {
          callback(new Error('Error from list store.'));
        },
        on () {}
      };

      modelStore.initialize({
        application: 'foo',
        eventSequencer,
        readModel: {},
        stores: {
          lists: listStore
        }
      }, errInitialize => {
        assert.that(errInitialize).is.null();

        modelStore.readOne({
          modelType: 'lists',
          modelName: 'peerGroups',
          query: {
            where: { foo: 'bar' }
          }
        }, errRead => {
          assert.that(errRead).is.not.null();
          assert.that(errRead.message).is.equalTo('Error from list store.');
          done();
        });
      });
    });
  });
});

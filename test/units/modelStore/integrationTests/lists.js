'use strict';

const { EventEmitter } = require('events');

const assert = require('assertthat'),
      toArray = require('streamtoarray'),
      uuid = require('uuidv4');

const buildDomainEvent = require('../../../shared/buildEvent'),
      buildModelEvent = require('../buildModelEvent'),
      EventSequencer = require('../../../../eventSequencer/EventSequencer'),
      ModelStore = require('../../../../modelStore/ModelStore');

const lists = function (options) {
  const { ListStore, resetDatabase, url } = options;

  suite('integrationTests', () => {
    let eventSequencer,
        listStore,
        modelName,
        modelStore;

    const simulateRestart = async function () {
      const otherEventSequencer = new EventSequencer();
      const otherListStore = new ListStore({ url, eventSequencer: otherEventSequencer });
      const otherModelStore = new ModelStore();

      await otherModelStore.initialize({
        application: 'integrationTests',
        eventSequencer: otherEventSequencer,
        readModel: {
          lists: {
            [modelName]: {
              fields: {
                initiator: { initialState: '', fastLookup: true, isUnique: false },
                destination: { initialState: '', fastLookup: true },
                participants: { initialState: []},
                stars: { initialState: 0 }
              }
            }
          }
        },
        stores: {
          lists: otherListStore
        }
      });

      return {
        eventSequencer: otherEventSequencer,
        listStore: otherListStore,
        modelStore: otherModelStore
      };
    };

    suiteSetup(async function () {
      this.timeout(10 * 1000);

      await resetDatabase();
    });

    suiteTeardown(async function () {
      this.timeout(10 * 1000);

      await resetDatabase();
    });

    setup(async () => {
      modelName = `peerGroups${uuid().substr(0, 8)}`;

      const other = await simulateRestart();

      eventSequencer = other.eventSequencer;
      listStore = other.listStore;
      modelStore = other.modelStore;
    });

    suite('constructor', () => {
      test('is a function.', async () => {
        assert.that(ListStore).is.ofType('function');
      });

      test('throws an error if url is missing.', async () => {
        assert.that(() => {
          /* eslint-disable no-new */
          new ListStore({ eventSequencer: new EventSequencer() });
          /* eslint-enable no-new */
        }).is.throwing('Url is missing.');
      });

      test('throws an error if event sequencer is missing.', async () => {
        assert.that(() => {
          /* eslint-disable no-new */
          new ListStore({ url });
          /* eslint-enable no-new */
        }).is.throwing('Event sequencer is missing.');
      });
    });

    suite('events', () => {
      test('is an event emitter.', async () => {
        assert.that(listStore).is.instanceOf(EventEmitter);
      });

      test('emits a disconnect event when the connection to the database is lost.', async function () {
        this.timeout(15 * 1000);

        await Promise.all([
          new Promise(resolve => {
            listStore.once('disconnect', async () => {
              await options.startContainer();
              resolve();
            });
          }),
          options.stopContainer()
        ]);
      });
    });

    suite('initialize', () => {
      test('is a function.', async () => {
        assert.that(listStore.initialize).is.ofType('function');
      });

      test('throws an error if application is missing.', async () => {
        await assert.that(async () => {
          await listStore.initialize({});
        }).is.throwingAsync('Application is missing.');
      });

      test('throws an error if read model is missing.', async () => {
        await assert.that(async () => {
          await listStore.initialize({ application: 'foo' });
        }).is.throwingAsync('Read model is missing.');
      });

      test('registers all lists on the event sequencer.', async () => {
        // listStore.initialize() had already been called by the model store in
        // the setup function above.

        assert.that(eventSequencer.models).is.equalTo({
          lists: {
            [modelName]: { lastProcessedPosition: 0 }
          }
        });
      });

      test('does not fail if model store has been initialized before.', async () => {
        await assert.that(async () => {
          await simulateRestart();
        }).is.not.throwingAsync();
      });

      test('gets the correct positions for the event sequencer.', async () => {
        const domainEvent = buildDomainEvent('planning', 'peerGroup', 'joined', { participant: 'Jane Doe' });

        domainEvent.metadata.position = 1;

        await modelStore.processEvents(domainEvent, []);

        const other = await simulateRestart();

        assert.that(other.eventSequencer.models).is.equalTo({
          lists: {
            [modelName]: { lastProcessedPosition: 1 }
          }
        });
      });
    });

    suite('event handlers', () => {
      suite('added', () => {
        test('is a function.', async () => {
          assert.that(listStore.added).is.ofType('function');
        });

        test('throws an error if model name is missing.', async () => {
          await assert.that(async () => {
            await listStore.added({});
          }).is.throwingAsync('Model name is missing.');
        });

        test('throws an error if payload is missing.', async () => {
          await assert.that(async () => {
            await listStore.added({ modelName: 'foo' });
          }).is.throwingAsync('Payload is missing.');
        });

        test('adds the given item.', async () => {
          const payload = { id: uuid(), initiator: 'Jane Doe', destination: 'Riva', participants: []};

          await listStore.added({ modelName, payload });

          const stream = await listStore.read({ modelType: 'lists', modelName, query: {}});
          const peerGroups = await toArray(stream);

          assert.that(peerGroups.length).is.equalTo(1);
        });
      });

      suite('updated', () => {
        test('is a function.', async () => {
          assert.that(listStore.updated).is.ofType('function');
        });

        test('throws an error if model name is missing.', async () => {
          await assert.that(async () => {
            await listStore.updated({});
          }).is.throwingAsync('Model name is missing.');
        });

        test('throws an error if selector is missing.', async () => {
          await assert.that(async () => {
            await listStore.updated({ modelName: 'foo' });
          }).is.throwingAsync('Selector is missing.');
        });

        test('throws an error if payload is missing.', async () => {
          await assert.that(async () => {
            await listStore.updated({ modelName: 'foo', selector: 'bar' });
          }).is.throwingAsync('Payload is missing.');
        });

        test('throws an error if an invalid key is given.', async () => {
          const selector = { id: uuid() };
          const payloadUpdate = { $add: 'Jane Doe' };

          await assert.that(async () => {
            await listStore.updated({ modelName, selector, payload: payloadUpdate });
          }).is.throwingAsync('Keys must not begin with a $ sign.');
        });

        test('updates a single selected item using the update payload.', async () => {
          const payloadAdd = { id: uuid(), initiator: 'Jane Doe', destination: 'Riva', participants: []};

          await listStore.added({ modelName, payload: payloadAdd });

          const selector = { id: payloadAdd.id };
          const payloadUpdate = { destination: 'Sultan Saray', participants: { $add: 'Jane Doe' }};

          await listStore.updated({ modelName, selector, payload: payloadUpdate });

          const stream = await listStore.read({ modelType: 'lists', modelName, query: {}});
          const peerGroups = await toArray(stream);

          assert.that(peerGroups.length).is.equalTo(1);
          assert.that(peerGroups[0]).is.equalTo({
            id: payloadAdd.id,
            initiator: 'Jane Doe',
            destination: 'Sultan Saray',
            participants: [ 'Jane Doe' ]
          });
        });

        test('updates multiple selected items using the update payload.', async () => {
          const payloadAddFirst = { id: uuid(), initiator: 'Jane Doe', destination: 'Riva', participants: []},
                payloadAddSecond = { id: uuid(), initiator: 'John Doe', destination: 'Riva', participants: []};

          await listStore.added({ modelName, payload: payloadAddFirst });
          await listStore.added({ modelName, payload: payloadAddSecond });

          const selector = { destination: 'Riva' };
          const payloadUpdate = { destination: 'Sultan Saray' };

          await listStore.updated({ modelName, selector, payload: payloadUpdate });

          const stream = await listStore.read({ modelType: 'lists', modelName, query: {}});
          const peerGroups = await toArray(stream);

          assert.that(peerGroups.length).is.equalTo(2);
          assert.that(peerGroups[0]).is.equalTo({
            id: payloadAddFirst.id,
            initiator: 'Jane Doe',
            destination: 'Sultan Saray',
            participants: []
          });
          assert.that(peerGroups[1]).is.equalTo({
            id: payloadAddSecond.id,
            initiator: 'John Doe',
            destination: 'Sultan Saray',
            participants: []
          });
        });

        test('updates items selected by query using the update payload.', async () => {
          const payloadAddFirst = { id: uuid(), initiator: 'Jane Doe', destination: 'Riva', participants: []},
                payloadAddSecond = { id: uuid(), initiator: 'John Doe', destination: 'Riva', participants: [ 'John Doe', 'Jane Doe' ]};

          await listStore.added({ modelName, payload: payloadAddFirst });
          await listStore.added({ modelName, payload: payloadAddSecond });

          const selector = { initiator: { $greaterThan: 'Jessy Doe' }};
          const payloadUpdate = { destination: 'Sultan Saray' };

          await listStore.updated({ modelName, selector, payload: payloadUpdate });

          const stream = await listStore.read({ modelType: 'lists', modelName, query: {}});
          const peerGroups = await toArray(stream);

          assert.that(peerGroups.length).is.equalTo(2);
          assert.that(peerGroups[0]).is.equalTo({
            id: payloadAddFirst.id,
            initiator: 'Jane Doe',
            destination: 'Riva',
            participants: []
          });
          assert.that(peerGroups[1]).is.equalTo({
            id: payloadAddSecond.id,
            initiator: 'John Doe',
            destination: 'Sultan Saray',
            participants: [ 'John Doe', 'Jane Doe' ]
          });
        });
      });

      suite('removed', () => {
        test('is a function.', async () => {
          assert.that(listStore.removed).is.ofType('function');
        });

        test('throws an error if model name is missing.', async () => {
          await assert.that(async () => {
            await listStore.removed({});
          }).is.throwingAsync('Model name is missing.');
        });

        test('throws an error if selector is missing.', async () => {
          await assert.that(async () => {
            await listStore.removed({ modelName: 'foo' });
          }).is.throwingAsync('Selector is missing.');
        });

        test('removes a single selected item.', async () => {
          const payload = { id: uuid(), initiator: 'Jane Doe', destination: 'Riva', participants: []};

          await listStore.added({ modelName, payload });

          const selector = { id: payload.id };

          await listStore.removed({ modelName, selector });

          const stream = await listStore.read({ modelType: 'lists', modelName, query: {}});
          const peerGroups = await toArray(stream);

          assert.that(peerGroups.length).is.equalTo(0);
        });

        test('removes multiple selected items.', async () => {
          const payloadFirst = { id: uuid(), initiator: 'Jane Doe', destination: 'Riva', participants: []},
                payloadSecond = { id: uuid(), initiator: 'John Doe', destination: 'Riva', participants: []};

          await listStore.added({ modelName, payload: payloadFirst });
          await listStore.added({ modelName, payload: payloadSecond });

          const selector = { destination: 'Riva' };

          await listStore.removed({ modelName, selector });

          const stream = await listStore.read({ modelType: 'lists', modelName, query: {}});
          const peerGroups = await toArray(stream);

          assert.that(peerGroups.length).is.equalTo(0);
        });

        test('removes items selected by query.', async () => {
          const payloadFirst = { id: uuid(), initiator: 'Jane Doe', destination: 'Riva', participants: []},
                payloadSecond = { id: uuid(), initiator: 'John Doe', destination: 'Riva', participants: [ 'John Doe', 'Jane Doe' ]};

          await listStore.added({ modelName, payload: payloadFirst });
          await listStore.added({ modelName, payload: payloadSecond });

          const selector = { initiator: 'John Doe' };

          await listStore.removed({ modelName, selector });

          const stream = await listStore.read({ modelType: 'lists', modelName, query: {}});
          const peerGroups = await toArray(stream);

          assert.that(peerGroups.length).is.equalTo(1);
          assert.that(peerGroups[0]).is.equalTo({
            id: payloadFirst.id,
            initiator: 'Jane Doe',
            destination: 'Riva',
            participants: []
          });
        });
      });

      suite('read', () => {
        test('is a function.', async () => {
          assert.that(listStore.read).is.ofType('function');
        });

        test('throws an error if model name is missing.', async () => {
          await assert.that(async () => {
            await listStore.read({});
          }).is.throwingAsync('Model name is missing.');
        });

        test('throws an error if query is missing.', async () => {
          await assert.that(async () => {
            await listStore.read({ modelName: 'foo' });
          }).is.throwingAsync('Query is missing.');
        });

        test('reads items.', async () => {
          const payloadFirst = { id: uuid(), initiator: 'Jane Doe', destination: 'Riva', participants: []},
                payloadSecond = { id: uuid(), initiator: 'John Doe', destination: 'Riva', participants: [ 'John Doe', 'Jane Doe' ]};

          await listStore.added({ modelName, payload: payloadFirst });
          await listStore.added({ modelName, payload: payloadSecond });

          const query = {};

          const stream = await listStore.read({ modelName, query });
          const items = await toArray(stream);

          assert.that(items.length).is.equalTo(2);
          assert.that(items[0]).is.equalTo(payloadFirst);
          assert.that(items[1]).is.equalTo(payloadSecond);
        });

        test('reads items by query.', async () => {
          const payloadFirst = { id: uuid(), initiator: 'Jane Doe', destination: 'Riva', participants: []},
                payloadSecond = { id: uuid(), initiator: 'John Doe', destination: 'Riva', participants: [ 'John Doe', 'Jane Doe' ]};

          await listStore.added({ modelName, payload: payloadFirst });
          await listStore.added({ modelName, payload: payloadSecond });

          const query = {
            where: { initiator: 'Jane Doe' }
          };

          const stream = await listStore.read({ modelName, query });
          const items = await toArray(stream);

          assert.that(items.length).is.equalTo(1);
          assert.that(items[0]).is.equalTo(payloadFirst);
        });

        test('returns an empty list if no items are matched by query.', async () => {
          const payloadFirst = { id: uuid(), initiator: 'Jane Doe', destination: 'Riva', participants: []},
                payloadSecond = { id: uuid(), initiator: 'John Doe', destination: 'Riva', participants: [ 'John Doe', 'Jane Doe' ]};

          await listStore.added({ modelName, payload: payloadFirst });
          await listStore.added({ modelName, payload: payloadSecond });

          const query = {
            where: { initiator: 'Jessy Doe' }
          };

          const stream = await listStore.read({ modelName, query });
          const items = await toArray(stream);

          assert.that(items.length).is.equalTo(0);
        });
      });
    });

    suite('item manipulation', () => {
      let domainEvent;

      setup(() => {
        domainEvent = buildDomainEvent('planning', 'peerGroup', 'joined', { participant: 'Jane Doe' });
      });

      test('add and update single item.', async () => {
        const id = uuid();

        // Add and update.
        await modelStore.processEvents(domainEvent, [
          buildModelEvent('lists', modelName, 'added', { payload: { id, initiator: 'Jane Doe', destination: 'Riva', participants: [], stars: 0 }}),
          buildModelEvent('lists', modelName, 'updated', { selector: { id }, payload: { participants: { $add: 'Jane Doe' }}})
        ]);

        // Read.
        const stream = await modelStore.read({ modelType: 'lists', modelName });
        const peerGroups = await toArray(stream);

        assert.that(peerGroups).is.equalTo([
          { id, initiator: 'Jane Doe', destination: 'Riva', participants: [ 'Jane Doe' ], stars: 0 }
        ]);

        // Teardown.
        await modelStore.processEvents(domainEvent, [
          buildModelEvent('lists', modelName, 'removed', { selector: {}})
        ]);
      });

      test('add, update and remove multiple items.', async () => {
        const id = [ uuid(), uuid(), uuid(), uuid(), uuid() ];

        // Add, update and remove.
        await modelStore.processEvents(domainEvent, [
          buildModelEvent('lists', modelName, 'added', { payload: { id: id[0], initiator: 'Jane Doe', destination: 'Riva', participants: [], stars: 0 }}),
          buildModelEvent('lists', modelName, 'added', { payload: { id: id[1], initiator: 'John Doe', destination: 'Sultan Saray', participants: [], stars: 0 }}),
          buildModelEvent('lists', modelName, 'added', { payload: { id: id[2], initiator: 'Jessica Doe', destination: 'Moulou', participants: [], stars: 0 }}),
          buildModelEvent('lists', modelName, 'added', { payload: { id: id[3], initiator: 'James Doe', destination: 'Kurose', participants: [], stars: 0 }}),
          buildModelEvent('lists', modelName, 'added', { payload: { id: id[4], initiator: 'Jeanette Doe', destination: 'Riva', participants: [], stars: 0 }}),
          buildModelEvent('lists', modelName, 'updated', { selector: { destination: 'Riva' }, payload: { destination: 'Sultan Saray', stars: { $incrementBy: 2 }}}),
          buildModelEvent('lists', modelName, 'updated', { selector: { initiator: 'Jessica Doe' }, payload: { destination: 'Sans', participants: { $add: 'Jim Doe' }}}),
          buildModelEvent('lists', modelName, 'removed', { selector: { id: id[1] }})
        ]);

        // Read.
        const stream = await modelStore.read({ modelType: 'lists', modelName });
        const peerGroups = await toArray(stream);

        assert.that(peerGroups).is.equalTo([
          { id: id[0], initiator: 'Jane Doe', destination: 'Sultan Saray', participants: [], stars: 2 },
          { id: id[2], initiator: 'Jessica Doe', destination: 'Sans', participants: [ 'Jim Doe' ], stars: 0 },
          { id: id[3], initiator: 'James Doe', destination: 'Kurose', participants: [], stars: 0 },
          { id: id[4], initiator: 'Jeanette Doe', destination: 'Sultan Saray', participants: [], stars: 2 }
        ]);

        // Teardown.
        await modelStore.processEvents(domainEvent, [
          buildModelEvent('lists', modelName, 'removed', { selector: {}})
        ]);
      });

      test('add and remove items to and from arrays.', async () => {
        const id = [ uuid(), uuid(), uuid() ];

        // Add and update.
        await modelStore.processEvents(domainEvent, [
          buildModelEvent('lists', modelName, 'added', { payload: { id: id[0], participants: []}}),
          buildModelEvent('lists', modelName, 'added', { payload: { id: id[1], participants: [ 'John Doe' ]}}),
          buildModelEvent('lists', modelName, 'added', { payload: { id: id[2], participants: [ 'John Doe', 'Jennifer Doe' ]}}),
          buildModelEvent('lists', modelName, 'updated', { selector: { id: id[0] }, payload: { participants: { $add: 'Jane Doe' }}}),
          buildModelEvent('lists', modelName, 'updated', { selector: { id: id[1] }, payload: { participants: { $add: 'Jane Doe' }}}),
          buildModelEvent('lists', modelName, 'updated', { selector: { id: id[1] }, payload: { participants: { $remove: 'John Doe' }}}),
          buildModelEvent('lists', modelName, 'updated', { selector: { id: id[2] }, payload: { participants: { $remove: 'John Doe' }}})
        ]);

        // Read.
        const stream = await modelStore.read({
          modelType: 'lists',
          modelName
        });
        const peerGroups = await toArray(stream);

        assert.that(peerGroups).is.equalTo([
          { id: id[0], participants: [ 'Jane Doe' ]},
          { id: id[1], participants: [ 'Jane Doe' ]},
          { id: id[2], participants: [ 'Jennifer Doe' ]}
        ]);

        // Teardown.
        await modelStore.processEvents(domainEvent, [
          buildModelEvent('lists', modelName, 'removed', { selector: {}})
        ]);
      });
    });

    suite('reading', () => {
      let domainEvent;

      const id = [ uuid(), uuid(), uuid() ];

      const read = async function (query) {
        const stream = await modelStore.read({
          modelType: 'lists',
          modelName,
          query
        });

        const items = await toArray(stream);

        return items;
      };

      const readOne = async function (query) {
        const item = await modelStore.readOne({
          modelType: 'lists',
          modelName,
          query
        });

        return item;
      };

      setup(async () => {
        domainEvent = buildDomainEvent('planning', 'peerGroup', 'joined', { participant: 'Jane Doe' });

        await modelStore.processEvents(domainEvent, [
          buildModelEvent('lists', modelName, 'added', { payload: { id: id[0], initiator: 'Jane Doe', destination: 'Riva', participants: [ 'Jane Doe' ], stars: 2 }}),
          buildModelEvent('lists', modelName, 'added', { payload: { id: id[1], initiator: 'John Doe', destination: 'Riva', participants: [ 'John Doe' ], stars: 0 }}),
          buildModelEvent('lists', modelName, 'added', { payload: { id: id[2], initiator: 'Jennifer Doe', destination: 'Sultan Saray', participants: [ 'Jane Doe', 'Jennifer Doe' ], stars: 1 }})
        ]);
      });

      teardown(async () => {
        await modelStore.processEvents(domainEvent, [
          buildModelEvent('lists', modelName, 'removed', { selector: {}})
        ]);
      });

      suite('readOne', () => {
        suite('where', () => {
          test('equal to.', async () => {
            const peerGroup = await readOne({
              where: { stars: 0 }
            });

            assert.that(peerGroup.id).is.equalTo(id[1]);
          });

          test('not found.', async () => {
            await assert.that(async () => {
              await readOne({
                where: { stars: 4 }
              });
            }).is.throwingAsync('Item not found.');
          });
        });
      });

      suite('read', () => {
        suite('where', () => {
          test('equal to.', async () => {
            const peerGroups = await read({
              where: { stars: 1 }
            });

            assert.that(peerGroups.length).is.equalTo(1);
            assert.that(peerGroups[0].id).is.equalTo(id[2]);
          });

          test('greather than.', async () => {
            const peerGroups = await read({
              where: { stars: { $greaterThan: 1 }}
            });

            assert.that(peerGroups.length).is.equalTo(1);
            assert.that(peerGroups[0].id).is.equalTo(id[0]);
          });

          test('less than.', async () => {
            const peerGroups = await read({
              where: { stars: { $lessThan: 1 }}
            });

            assert.that(peerGroups.length).is.equalTo(1);
            assert.that(peerGroups[0].id).is.equalTo(id[1]);
          });

          test('greater than or equal to.', async () => {
            const peerGroups = await read({
              where: { stars: { $greaterThanOrEqualTo: 1 }}
            });

            assert.that(peerGroups.length).is.equalTo(2);
            assert.that(peerGroups[0].id).is.equalTo(id[0]);
            assert.that(peerGroups[1].id).is.equalTo(id[2]);
          });

          test('less than or equal to.', async () => {
            const peerGroups = await read({
              where: { stars: { $lessThanOrEqualTo: 1 }}
            });

            assert.that(peerGroups.length).is.equalTo(2);
            assert.that(peerGroups[0].id).is.equalTo(id[1]);
            assert.that(peerGroups[1].id).is.equalTo(id[2]);
          });

          test('not equal to.', async () => {
            const peerGroups = await read({
              where: { stars: { $notEqualTo: 1 }}
            });

            assert.that(peerGroups.length).is.equalTo(2);
            assert.that(peerGroups[0].id).is.equalTo(id[0]);
            assert.that(peerGroups[1].id).is.equalTo(id[1]);
          });

          test('contains.', async () => {
            const peerGroups = await read({
              where: { participants: { $contains: 'Jane Doe' }}
            });

            assert.that(peerGroups.length).is.equalTo(2);
            assert.that(peerGroups[0].id).is.equalTo(id[0]);
            assert.that(peerGroups[1].id).is.equalTo(id[2]);
          });

          test('does not contain.', async () => {
            const peerGroups = await read({
              where: { participants: { $doesNotContain: 'Jane Doe' }}
            });

            assert.that(peerGroups.length).is.equalTo(1);
            assert.that(peerGroups[0].id).is.equalTo(id[1]);
          });
        });

        suite('order by', () => {
          test('ascending.', async () => {
            const peerGroups = await read({
              orderBy: { stars: 'ascending' }
            });

            assert.that(peerGroups.length).is.equalTo(3);
            assert.that(peerGroups[0].id).is.equalTo(id[1]);
            assert.that(peerGroups[1].id).is.equalTo(id[2]);
            assert.that(peerGroups[2].id).is.equalTo(id[0]);
          });

          test('descending.', async () => {
            const peerGroups = await read({
              orderBy: { stars: 'descending' }
            });

            assert.that(peerGroups.length).is.equalTo(3);
            assert.that(peerGroups[0].id).is.equalTo(id[0]);
            assert.that(peerGroups[1].id).is.equalTo(id[2]);
            assert.that(peerGroups[2].id).is.equalTo(id[1]);
          });
        });

        suite('take', () => {
          test('limits items.', async () => {
            const peerGroups = await read({
              take: 1
            });

            assert.that(peerGroups.length).is.equalTo(1);
            assert.that(peerGroups[0].id).is.equalTo(id[0]);
          });
        });

        suite('skip', () => {
          test('skips items.', async () => {
            const peerGroups = await read({
              skip: 1,
              take: 1
            });

            assert.that(peerGroups.length).is.equalTo(1);
            assert.that(peerGroups[0].id).is.equalTo(id[1]);
          });
        });
      });
    });

    suite('updatePosition', () => {
      test('is a function.', async () => {
        assert.that(listStore.updatePosition).is.ofType('function');
      });

      test('throws an error if position is missing.', async () => {
        await assert.that(async () => {
          await listStore.updatePosition();
        }).is.throwingAsync('Position is missing.');
      });

      suite('database', () => {
        test('updates the event sequencer.', async () => {
          await listStore.updatePosition(23);

          const other = await simulateRestart();

          assert.that(other.eventSequencer.models).is.equalTo({
            lists: {
              [modelName]: { lastProcessedPosition: 23 }
            }
          });
        });

        test('does not update the event sequencer if the new position is less than the current one.', async () => {
          await listStore.updatePosition(23);
          await listStore.updatePosition(22);

          const other = await simulateRestart();

          assert.that(other.eventSequencer.models).is.equalTo({
            lists: {
              [modelName]: { lastProcessedPosition: 23 }
            }
          });
        });
      });

      suite('in-memory', () => {
        test('updates the event sequencer.', async () => {
          assert.that(eventSequencer.models).is.equalTo({
            lists: {
              [modelName]: { lastProcessedPosition: 0 }
            }
          });

          await listStore.updatePosition(23);

          assert.that(eventSequencer.models).is.equalTo({
            lists: {
              [modelName]: { lastProcessedPosition: 23 }
            }
          });
        });

        test('does not update the event sequencer if the new position is less than the current one.', async () => {
          await listStore.updatePosition(23);
          await listStore.updatePosition(22);

          assert.that(eventSequencer.models).is.equalTo({
            lists: {
              [modelName]: { lastProcessedPosition: 23 }
            }
          });
        });
      });
    });
  });
};

module.exports = lists;

'use strict';

const stream = require('stream');

const assert = require('assertthat'),
      uuid = require('uuidv4');

const buildEvent = require('../../../shared/buildEvent'),
      ListAggregate = require('../../../../EventHandler/readModelAggregates/ListAggregate');

const PassThrough = stream.PassThrough;

const readModel = {
  fields: {
    initiator: { initialState: '', fastLookup: true, isUnique: false },
    destination: { initialState: '', fastLookup: true },
    participants: { initialState: []}
  }
};

suite('ListAggregate', () => {
  let domainEvent,
      domainEventMetadata,
      tokens,
      users;

  setup(() => {
    tokens = {
      jane: { sub: uuid() }
    };
    users = {
      jane: { id: tokens.jane.sub, token: tokens.jane }
    };

    domainEvent = buildEvent('planning', 'peerGroup', uuid(), 'started', {
      initiator: 'Jane Doe',
      destination: 'Riva'
    });

    domainEvent.addInitiator(users.jane);

    domainEventMetadata = { state: {}, previousState: {}};
  });

  test('is an object.', async () => {
    assert.that(ListAggregate).is.ofType('object');
  });

  suite('Readable', () => {
    test('is a function.', async () => {
      assert.that(ListAggregate.Readable).is.ofType('function');
    });

    test('throws an error if read model is missing.', async () => {
      assert.that(() => {
        /* eslint-disable no-new */
        new ListAggregate.Readable({});
        /* eslint-enable no-new */
      }).is.throwing('Read model is missing.');
    });

    test('throws an error if model store is missing.', async () => {
      assert.that(() => {
        /* eslint-disable no-new */
        new ListAggregate.Readable({ readModel: {}});
        /* eslint-enable no-new */
      }).is.throwing('Model store is missing.');
    });

    test('throws an error if model name is missing.', async () => {
      assert.that(() => {
        /* eslint-disable no-new */
        new ListAggregate.Readable({ readModel: {}, modelStore: {}});
        /* eslint-enable no-new */
      }).is.throwing('Model name is missing.');
    });

    suite('read', () => {
      test('is a function.', async () => {
        const listAggregate = new ListAggregate.Readable({
          readModel,
          modelStore: {},
          modelName: 'peerGroups'
        });

        assert.that(listAggregate.read).is.ofType('function');
      });

      test('calls read on the model store.', async () => {
        const listAggregate = new ListAggregate.Readable({
          readModel,
          modelStore: {
            async read (options) {
              assert.that(options).is.ofType('object');
              assert.that(options.modelType).is.equalTo('lists');
              assert.that(options.modelName).is.equalTo('peerGroups');
              assert.that(options.query).is.equalTo({ foo: 'bar' });

              const fakeStream = new PassThrough({ objectMode: true });

              fakeStream.write('foo');
              fakeStream.end();

              return fakeStream;
            }
          },
          modelName: 'peerGroups'
        });

        const result = await listAggregate.read({ foo: 'bar' });

        assert.that(result).is.equalTo([ 'foo' ]);
      });

      test('calls read on the model store with an empty query if no query is given.', async () => {
        const listAggregate = new ListAggregate.Readable({
          readModel,
          modelStore: {
            async read (options) {
              assert.that(options.query).is.equalTo({});

              const fakeStream = new PassThrough({ objectMode: true });

              fakeStream.write('foo');
              fakeStream.end();

              return fakeStream;
            }
          },
          modelName: 'peerGroups'
        });

        await listAggregate.read();
      });
    });

    suite('readOne', () => {
      test('is a function.', async () => {
        const listAggregate = new ListAggregate.Readable({
          readModel,
          modelStore: {},
          modelName: 'peerGroups'
        });

        assert.that(listAggregate.readOne).is.ofType('function');
      });

      test('throws an error if query is missing.', async () => {
        const listAggregate = new ListAggregate.Readable({
          readModel,
          modelStore: {},
          modelName: 'peerGroups'
        });

        await assert.that(async () => {
          await listAggregate.readOne();
        }).is.throwingAsync('Query is missing.');
      });

      test('throws an error if where is missing.', async () => {
        const listAggregate = new ListAggregate.Readable({
          readModel,
          modelStore: {},
          modelName: 'peerGroups'
        });

        await assert.that(async () => {
          await listAggregate.readOne({});
        }).is.throwingAsync('Where is missing.');
      });

      test('calls readOne on the model store.', async () => {
        const listAggregate = new ListAggregate.Readable({
          readModel,
          modelStore: {
            async readOne (options) {
              assert.that(options).is.ofType('object');
              assert.that(options.modelType).is.equalTo('lists');
              assert.that(options.modelName).is.equalTo('peerGroups');
              assert.that(options.query).is.equalTo({ where: { foo: 'bar' }});

              return 'foo';
            }
          },
          modelName: 'peerGroups'
        });

        const result = await listAggregate.readOne({
          where: { foo: 'bar' }
        });

        assert.that(result).is.equalTo('foo');
      });
    });
  });

  suite('Writable', () => {
    test('is a function.', async () => {
      assert.that(ListAggregate.Writable).is.ofType('function');
    });

    test('throws an error if read model is missing.', async () => {
      assert.that(() => {
        /* eslint-disable no-new */
        new ListAggregate.Writable({});
        /* eslint-enable no-new */
      }).is.throwing('Read model is missing.');
    });

    test('throws an error if model store is missing.', async () => {
      assert.that(() => {
        /* eslint-disable no-new */
        new ListAggregate.Writable({ readModel: {}});
        /* eslint-enable no-new */
      }).is.throwing('Model store is missing.');
    });

    test('throws an error if model name is missing.', async () => {
      assert.that(() => {
        /* eslint-disable no-new */
        new ListAggregate.Writable({ readModel: {}, modelStore: {}});
        /* eslint-enable no-new */
      }).is.throwing('Model name is missing.');
    });

    test('throws an error if domain event is missing.', async () => {
      assert.that(() => {
        /* eslint-disable no-new */
        new ListAggregate.Writable({ readModel: {}, modelStore: {}, modelName: 'foo' });
        /* eslint-enable no-new */
      }).is.throwing('Domain event is missing.');
    });

    test('throws an error if domain event metadata are missing.', async () => {
      assert.that(() => {
        /* eslint-disable no-new */
        new ListAggregate.Writable({ readModel: {}, modelStore: {}, modelName: 'foo', domainEvent: {}});
        /* eslint-enable no-new */
      }).is.throwing('Domain event metadata are missing.');
    });

    test('throws an error if uncommitted events are missing.', async () => {
      assert.that(() => {
        /* eslint-disable no-new */
        new ListAggregate.Writable({ readModel: {}, modelStore: {}, modelName: 'foo', domainEvent: {}, domainEventMetadata: {}});
        /* eslint-enable no-new */
      }).is.throwing('Uncommitted events are missing.');
    });

    suite('add', () => {
      test('throws an error if payload is missing.', async () => {
        const listAggregate = new ListAggregate.Writable({
          readModel,
          modelStore: {},
          modelName: 'peerGroups',
          domainEvent,
          domainEventMetadata,
          uncommittedEvents: []
        });

        assert.that(() => {
          listAggregate.add();
        }).is.throwing('Payload is missing.');
      });

      test('adds a single added event to the list of uncommitted events.', async () => {
        const id = uuid();
        const listAggregate = new ListAggregate.Writable({
          readModel,
          modelStore: {},
          modelName: 'peerGroups',
          domainEvent,
          domainEventMetadata,
          uncommittedEvents: []
        });

        listAggregate.add({ id, initiator: 'Jane Doe', destination: 'Riva', participants: []});

        assert.that(listAggregate.uncommittedEvents.length).is.equalTo(1);
        assert.that(listAggregate.uncommittedEvents[0].event.context.name).is.equalTo('lists');
        assert.that(listAggregate.uncommittedEvents[0].event.aggregate.name).is.equalTo('peerGroups');
        assert.that(listAggregate.uncommittedEvents[0].event.name).is.equalTo('added');
        assert.that(listAggregate.uncommittedEvents[0].event.type).is.equalTo('readModel');
        assert.that(listAggregate.uncommittedEvents[0].event.data.payload.id).is.equalTo(id);
        assert.that(listAggregate.uncommittedEvents[0].event.data.payload.initiator).is.equalTo('Jane Doe');
        assert.that(listAggregate.uncommittedEvents[0].event.data.payload.destination).is.equalTo('Riva');
        assert.that(listAggregate.uncommittedEvents[0].event.data.payload.participants).is.equalTo([]);
      });

      test('adds multiple added events to the list of uncommitted events.', async () => {
        const id = uuid();
        const listAggregate = new ListAggregate.Writable({
          readModel,
          modelStore: {},
          modelName: 'peerGroups',
          domainEvent,
          domainEventMetadata,
          uncommittedEvents: []
        });

        listAggregate.add({ id, initiator: 'Jane Doe', destination: 'Riva', participants: []});
        listAggregate.add({ id, initiator: 'John Doe', destination: 'Sultan Saray', participants: []});

        assert.that(listAggregate.uncommittedEvents.length).is.equalTo(2);
        assert.that(listAggregate.uncommittedEvents[0].event.data.payload.id).is.equalTo(id);
        assert.that(listAggregate.uncommittedEvents[0].event.data.payload.initiator).is.equalTo('Jane Doe');
        assert.that(listAggregate.uncommittedEvents[0].event.data.payload.destination).is.equalTo('Riva');
        assert.that(listAggregate.uncommittedEvents[0].event.data.payload.participants).is.equalTo([]);

        assert.that(listAggregate.uncommittedEvents[1].event.data.payload.id).is.equalTo(id);
        assert.that(listAggregate.uncommittedEvents[1].event.data.payload.initiator).is.equalTo('John Doe');
        assert.that(listAggregate.uncommittedEvents[1].event.data.payload.destination).is.equalTo('Sultan Saray');
        assert.that(listAggregate.uncommittedEvents[1].event.data.payload.participants).is.equalTo([]);
      });

      test('applies the domain event initiator to the model event.', async () => {
        const listAggregate = new ListAggregate.Writable({
          readModel,
          modelStore: {},
          modelName: 'peerGroups',
          domainEvent,
          domainEventMetadata,
          uncommittedEvents: []
        });

        listAggregate.add({ id: uuid(), initiator: 'Jane Doe', destination: 'Riva', participants: []});

        assert.that(listAggregate.uncommittedEvents.length).is.equalTo(1);
        assert.that(listAggregate.uncommittedEvents[0].event.initiator.id).is.equalTo(users.jane.id);
      });

      test('adds an automatically created id if is is missing.', async () => {
        const listAggregate = new ListAggregate.Writable({
          readModel,
          modelStore: {},
          modelName: 'peerGroups',
          domainEvent,
          domainEventMetadata,
          uncommittedEvents: []
        });

        listAggregate.add({ initiator: 'Jane Doe' });

        assert.that(listAggregate.uncommittedEvents.length).is.equalTo(1);
        assert.that(listAggregate.uncommittedEvents[0].event.data.payload.id).is.equalTo(domainEvent.aggregate.id);
      });

      suite('orUpdate', () => {
        test('is a function.', async () => {
          const id = uuid();
          const listAggregate = new ListAggregate.Writable({
            readModel,
            modelStore: {},
            modelName: 'peerGroups',
            domainEvent,
            domainEventMetadata,
            uncommittedEvents: []
          });

          const result = listAggregate.add({ id, initiator: 'Jane Doe', destination: 'Riva', participants: []});

          assert.that(result).is.ofType('object');
          assert.that(result.orUpdate).is.ofType('function');
        });

        test('throws an error if where is missing.', async () => {
          const id = uuid();
          const listAggregate = new ListAggregate.Writable({
            readModel,
            modelStore: {},
            modelName: 'peerGroups',
            domainEvent,
            domainEventMetadata,
            uncommittedEvents: []
          });

          assert.that(() => {
            listAggregate.
              add({ id, initiator: 'Jane Doe', destination: 'Riva', participants: []}).
              orUpdate({});
          }).is.throwing('Where is missing.');
        });

        test('throws an error if set is missing.', async () => {
          const id = uuid();
          const listAggregate = new ListAggregate.Writable({
            readModel,
            modelStore: {},
            modelName: 'peerGroups',
            domainEvent,
            domainEventMetadata,
            uncommittedEvents: []
          });

          assert.that(() => {
            listAggregate.
              add({ id, initiator: 'Jane Doe', destination: 'Riva', participants: []}).
              orUpdate({
                where: { initiator: 'Jane Doe' }
              });
          }).is.throwing('Set is missing.');
        });

        test('throws an error if set is an empty object.', async () => {
          const id = uuid();
          const listAggregate = new ListAggregate.Writable({
            readModel,
            modelStore: {},
            modelName: 'peerGroups',
            domainEvent,
            domainEventMetadata,
            uncommittedEvents: []
          });

          assert.that(() => {
            listAggregate.
              add({ id, initiator: 'Jane Doe', destination: 'Riva', participants: []}).
              orUpdate({
                where: { initiator: 'Jane Doe' },
                set: {}
              });
          }).is.throwing('Set must not be empty.');
        });

        test('adds a single upserted event to the list of uncommitted events.', async () => {
          const id = uuid();
          const listAggregate = new ListAggregate.Writable({
            readModel,
            modelStore: {},
            modelName: 'peerGroups',
            domainEvent,
            domainEventMetadata,
            uncommittedEvents: []
          });

          listAggregate.
            add({ id, initiator: 'Jane Doe', destination: 'Riva', participants: []}).
            orUpdate({
              where: { initiator: 'Jane Doe' },
              set: { destination: 'Riva' }
            });

          assert.that(listAggregate.uncommittedEvents.length).is.equalTo(1);
          assert.that(listAggregate.uncommittedEvents[0].event.context.name).is.equalTo('lists');
          assert.that(listAggregate.uncommittedEvents[0].event.aggregate.name).is.equalTo('peerGroups');
          assert.that(listAggregate.uncommittedEvents[0].event.name).is.equalTo('upserted');
          assert.that(listAggregate.uncommittedEvents[0].event.type).is.equalTo('readModel');
          assert.that(listAggregate.uncommittedEvents[0].event.data.selector).is.equalTo({
            initiator: 'Jane Doe'
          });
          assert.that(listAggregate.uncommittedEvents[0].event.data.payload.add).is.ofType('object');
          assert.that(listAggregate.uncommittedEvents[0].event.data.payload.update).is.equalTo({
            destination: 'Riva'
          });
        });

        test('adds multiple upserted events to the list of uncommitted events.', async () => {
          const id1 = uuid();
          const id2 = uuid();
          const listAggregate = new ListAggregate.Writable({
            readModel,
            modelStore: {},
            modelName: 'peerGroups',
            domainEvent,
            domainEventMetadata,
            uncommittedEvents: []
          });

          listAggregate.
            add({ id: id1, initiator: 'Jane Doe', destination: 'Riva', participants: []}).
            orUpdate({
              where: { initiator: 'Jane Doe' },
              set: { destination: 'Riva' }
            });

          listAggregate.
            add({ id: id2, initiator: 'Jane Doe', destination: 'Sultan Saray', participants: []}).
            orUpdate({
              where: { initiator: 'Jane Doe' },
              set: { destination: 'Sultan Saray' }
            });

          assert.that(listAggregate.uncommittedEvents.length).is.equalTo(2);
          assert.that(listAggregate.uncommittedEvents[0].event.name).is.equalTo('upserted');
          assert.that(listAggregate.uncommittedEvents[0].event.data.selector).is.equalTo({
            initiator: 'Jane Doe'
          });
          assert.that(listAggregate.uncommittedEvents[0].event.data.payload.add).is.ofType('object');
          assert.that(listAggregate.uncommittedEvents[0].event.data.payload.update).is.equalTo({
            destination: 'Riva'
          });
          assert.that(listAggregate.uncommittedEvents[1].event.name).is.equalTo('upserted');
          assert.that(listAggregate.uncommittedEvents[1].event.data.selector).is.equalTo({
            initiator: 'Jane Doe'
          });
          assert.that(listAggregate.uncommittedEvents[1].event.data.payload.add).is.ofType('object');
          assert.that(listAggregate.uncommittedEvents[1].event.data.payload.update).is.equalTo({
            destination: 'Sultan Saray'
          });
        });

        test('applies the domain event initiator to the model event.', async () => {
          const id = uuid();
          const listAggregate = new ListAggregate.Writable({
            readModel,
            modelStore: {},
            modelName: 'peerGroups',
            domainEvent,
            domainEventMetadata,
            uncommittedEvents: []
          });

          listAggregate.
            add({ id, initiator: 'Jane Doe', destination: 'Riva', participants: []}).
            orUpdate({
              where: { initiator: 'Jane Doe' },
              set: { destination: 'Riva' }
            });

          assert.that(listAggregate.uncommittedEvents.length).is.equalTo(1);
          assert.that(listAggregate.uncommittedEvents[0].event.initiator.id).is.equalTo(users.jane.id);
        });
      });

      suite('orDiscard', () => {
        test('is a function.', async () => {
          const id = uuid();
          const listAggregate = new ListAggregate.Writable({
            readModel,
            modelStore: {},
            modelName: 'peerGroups',
            domainEvent,
            domainEventMetadata,
            uncommittedEvents: []
          });

          const result = listAggregate.add({ id, initiator: 'Jane Doe', destination: 'Riva', participants: []});

          assert.that(result).is.ofType('object');
          assert.that(result.orDiscard).is.ofType('function');
        });

        test('adds a single ensured event to the list of uncommitted events.', async () => {
          const id = uuid();
          const listAggregate = new ListAggregate.Writable({
            readModel,
            modelStore: {},
            modelName: 'peerGroups',
            domainEvent,
            domainEventMetadata,
            uncommittedEvents: []
          });

          listAggregate.
            add({ id, initiator: 'Jane Doe', destination: 'Riva', participants: []}).
            orDiscard();

          assert.that(listAggregate.uncommittedEvents.length).is.equalTo(1);
          assert.that(listAggregate.uncommittedEvents[0].event.context.name).is.equalTo('lists');
          assert.that(listAggregate.uncommittedEvents[0].event.aggregate.name).is.equalTo('peerGroups');
          assert.that(listAggregate.uncommittedEvents[0].event.name).is.equalTo('ensured');
          assert.that(listAggregate.uncommittedEvents[0].event.type).is.equalTo('readModel');
          assert.that(listAggregate.uncommittedEvents[0].event.data.payload.id).is.equalTo(id);
          assert.that(listAggregate.uncommittedEvents[0].event.data.payload.initiator).is.equalTo('Jane Doe');
          assert.that(listAggregate.uncommittedEvents[0].event.data.payload.destination).is.equalTo('Riva');
          assert.that(listAggregate.uncommittedEvents[0].event.data.payload.participants).is.equalTo([]);
        });

        test('adds multiple ensured events to the list of uncommitted events.', async () => {
          const id1 = uuid();
          const id2 = uuid();
          const listAggregate = new ListAggregate.Writable({
            readModel,
            modelStore: {},
            modelName: 'peerGroups',
            domainEvent,
            domainEventMetadata,
            uncommittedEvents: []
          });

          listAggregate.
            add({ id: id1, initiator: 'Jane Doe', destination: 'Riva', participants: []}).
            orDiscard();

          listAggregate.
            add({ id: id2, initiator: 'Jane Doe', destination: 'Sultan Saray', participants: []}).
            orDiscard();

          assert.that(listAggregate.uncommittedEvents.length).is.equalTo(2);
          assert.that(listAggregate.uncommittedEvents[0].event.name).is.equalTo('ensured');
          assert.that(listAggregate.uncommittedEvents[0].event.data.payload.id).is.equalTo(id1);
          assert.that(listAggregate.uncommittedEvents[0].event.data.payload.initiator).is.equalTo('Jane Doe');
          assert.that(listAggregate.uncommittedEvents[0].event.data.payload.destination).is.equalTo('Riva');
          assert.that(listAggregate.uncommittedEvents[0].event.data.payload.participants).is.equalTo([]);
          assert.that(listAggregate.uncommittedEvents[1].event.name).is.equalTo('ensured');
          assert.that(listAggregate.uncommittedEvents[1].event.data.payload.id).is.equalTo(id2);
          assert.that(listAggregate.uncommittedEvents[1].event.data.payload.initiator).is.equalTo('Jane Doe');
          assert.that(listAggregate.uncommittedEvents[1].event.data.payload.destination).is.equalTo('Sultan Saray');
          assert.that(listAggregate.uncommittedEvents[1].event.data.payload.participants).is.equalTo([]);
        });

        test('applies the domain event initiator to the model event.', async () => {
          const id = uuid();
          const listAggregate = new ListAggregate.Writable({
            readModel,
            modelStore: {},
            modelName: 'peerGroups',
            domainEvent,
            domainEventMetadata,
            uncommittedEvents: []
          });

          listAggregate.
            add({ id, initiator: 'Jane Doe', destination: 'Riva', participants: []}).
            orDiscard();

          assert.that(listAggregate.uncommittedEvents.length).is.equalTo(1);
          assert.that(listAggregate.uncommittedEvents[0].event.initiator.id).is.equalTo(users.jane.id);
        });
      });
    });

    suite('update', () => {
      test('throws an error if where is missing.', async () => {
        const listAggregate = new ListAggregate.Writable({
          readModel,
          modelStore: {},
          modelName: 'peerGroups',
          domainEvent,
          domainEventMetadata,
          uncommittedEvents: []
        });

        assert.that(() => {
          listAggregate.update({});
        }).is.throwing('Where is missing.');
      });

      test('throws an error if set is missing.', async () => {
        const listAggregate = new ListAggregate.Writable({
          readModel,
          modelStore: {},
          modelName: 'peerGroups',
          domainEvent,
          domainEventMetadata,
          uncommittedEvents: []
        });

        assert.that(() => {
          listAggregate.update({
            where: { initiator: 'Jane Doe' }
          });
        }).is.throwing('Set is missing.');
      });

      test('throws an error if set is an empty object.', async () => {
        const listAggregate = new ListAggregate.Writable({
          readModel,
          modelStore: {},
          modelName: 'peerGroups',
          domainEvent,
          domainEventMetadata,
          uncommittedEvents: []
        });

        assert.that(() => {
          listAggregate.update({
            where: { initiator: 'Jane Doe' },
            set: {}
          });
        }).is.throwing('Set must not be empty.');
      });

      test('adds a single updated event to the list of uncommitted events.', async () => {
        const listAggregate = new ListAggregate.Writable({
          readModel,
          modelStore: {},
          modelName: 'peerGroups',
          domainEvent,
          domainEventMetadata,
          uncommittedEvents: []
        });

        listAggregate.update({
          where: { initiator: 'Jane Doe' },
          set: { destination: 'Riva' }
        });

        assert.that(listAggregate.uncommittedEvents.length).is.equalTo(1);
        assert.that(listAggregate.uncommittedEvents[0].event.context.name).is.equalTo('lists');
        assert.that(listAggregate.uncommittedEvents[0].event.aggregate.name).is.equalTo('peerGroups');
        assert.that(listAggregate.uncommittedEvents[0].event.name).is.equalTo('updated');
        assert.that(listAggregate.uncommittedEvents[0].event.type).is.equalTo('readModel');
        assert.that(listAggregate.uncommittedEvents[0].event.data).is.equalTo({
          selector: { initiator: 'Jane Doe' },
          payload: { destination: 'Riva' }
        });
      });

      test('adds multiple updated events to the list of uncommitted events.', async () => {
        const listAggregate = new ListAggregate.Writable({
          readModel,
          modelStore: {},
          modelName: 'peerGroups',
          domainEvent,
          domainEventMetadata,
          uncommittedEvents: []
        });

        listAggregate.update({
          where: { initiator: 'Jane Doe' },
          set: { destination: 'Riva' }
        });
        listAggregate.update({
          where: { initiator: 'Jane Doe' },
          set: { destination: 'Sultan Saray' }
        });

        assert.that(listAggregate.uncommittedEvents.length).is.equalTo(2);
        assert.that(listAggregate.uncommittedEvents[0].event.data).is.equalTo({
          selector: { initiator: 'Jane Doe' },
          payload: { destination: 'Riva' }
        });
        assert.that(listAggregate.uncommittedEvents[1].event.data).is.equalTo({
          selector: { initiator: 'Jane Doe' },
          payload: { destination: 'Sultan Saray' }
        });
      });

      test('applies the domain event initiator to the model event.', async () => {
        const listAggregate = new ListAggregate.Writable({
          readModel,
          modelStore: {},
          modelName: 'peerGroups',
          domainEvent,
          domainEventMetadata,
          uncommittedEvents: []
        });

        listAggregate.update({
          where: { initiator: 'Jane Doe' },
          set: { destination: 'Riva' }
        });

        assert.that(listAggregate.uncommittedEvents.length).is.equalTo(1);
        assert.that(listAggregate.uncommittedEvents[0].event.initiator.id).is.equalTo(users.jane.id);
      });
    });

    suite('remove', () => {
      test('throws an error if where is missing.', async () => {
        const listAggregate = new ListAggregate.Writable({
          readModel,
          modelStore: {},
          modelName: 'peerGroups',
          domainEvent,
          domainEventMetadata,
          uncommittedEvents: []
        });

        assert.that(() => {
          listAggregate.remove({});
        }).is.throwing('Where is missing.');
      });

      test('adds a single removed event to the list of uncommitted events.', async () => {
        const listAggregate = new ListAggregate.Writable({
          readModel,
          modelStore: {},
          modelName: 'peerGroups',
          domainEvent,
          domainEventMetadata,
          uncommittedEvents: []
        });

        listAggregate.remove({
          where: { initiator: 'Jane Doe' }
        });

        assert.that(listAggregate.uncommittedEvents.length).is.equalTo(1);
        assert.that(listAggregate.uncommittedEvents[0].event.context.name).is.equalTo('lists');
        assert.that(listAggregate.uncommittedEvents[0].event.aggregate.name).is.equalTo('peerGroups');
        assert.that(listAggregate.uncommittedEvents[0].event.name).is.equalTo('removed');
        assert.that(listAggregate.uncommittedEvents[0].event.type).is.equalTo('readModel');
        assert.that(listAggregate.uncommittedEvents[0].event.data).is.equalTo({
          selector: { initiator: 'Jane Doe' }
        });
      });

      test('adds multiple removed events to the list of uncommitted events.', async () => {
        const listAggregate = new ListAggregate.Writable({
          readModel,
          modelStore: {},
          modelName: 'peerGroups',
          domainEvent,
          domainEventMetadata,
          uncommittedEvents: []
        });

        listAggregate.remove({
          where: { initiator: 'Jane Doe' }
        });
        listAggregate.remove({
          where: { initiator: 'Jane Doe' }
        });

        assert.that(listAggregate.uncommittedEvents.length).is.equalTo(2);
        assert.that(listAggregate.uncommittedEvents[0].event.data).is.equalTo({
          selector: { initiator: 'Jane Doe' }
        });
        assert.that(listAggregate.uncommittedEvents[1].event.data).is.equalTo({
          selector: { initiator: 'Jane Doe' }
        });
      });

      test('applies the domain event initiator to the model event.', async () => {
        const listAggregate = new ListAggregate.Writable({
          readModel,
          modelStore: {},
          modelName: 'peerGroups',
          domainEvent,
          domainEventMetadata,
          uncommittedEvents: []
        });

        listAggregate.remove({
          where: { initiator: 'Jane Doe' }
        });

        assert.that(listAggregate.uncommittedEvents.length).is.equalTo(1);
        assert.that(listAggregate.uncommittedEvents[0].event.initiator.id).is.equalTo(users.jane.id);
      });
    });
  });
});

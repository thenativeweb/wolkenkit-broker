'use strict';

const stream = require('stream');

const assert = require('assertthat'),
      uuid = require('uuidv4');

const buildEvent = require('../../../helpers/buildEvent'),
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
  let domainEvent;

  setup(() => {
    domainEvent = buildEvent('planning', 'peerGroup', uuid(), 'started', {
      initiator: 'Jane Doe',
      destination: 'Riva'
    });
  });

  test('is an object.', done => {
    assert.that(ListAggregate).is.ofType('object');
    done();
  });

  suite('Readable', () => {
    test('is a function.', done => {
      assert.that(ListAggregate.Readable).is.ofType('function');
      done();
    });

    test('throws an error if options are missing.', done => {
      assert.that(() => {
        /* eslint-disable no-new */
        new ListAggregate.Readable();
        /* eslint-enable no-new */
      }).is.throwing('Options are missing.');
      done();
    });

    test('throws an error if read model is missing.', done => {
      assert.that(() => {
        /* eslint-disable no-new */
        new ListAggregate.Readable({});
        /* eslint-enable no-new */
      }).is.throwing('Read model is missing.');
      done();
    });

    test('throws an error if model store is missing.', done => {
      assert.that(() => {
        /* eslint-disable no-new */
        new ListAggregate.Readable({ readModel: {}});
        /* eslint-enable no-new */
      }).is.throwing('Model store is missing.');
      done();
    });

    test('throws an error if model name is missing.', done => {
      assert.that(() => {
        /* eslint-disable no-new */
        new ListAggregate.Readable({ readModel: {}, modelStore: {}});
        /* eslint-enable no-new */
      }).is.throwing('Model name is missing.');
      done();
    });

    suite('read', () => {
      test('is a function.', done => {
        const listAggregate = new ListAggregate.Readable({
          readModel,
          modelStore: {},
          modelName: 'peerGroups'
        });

        assert.that(listAggregate.read).is.ofType('function');
        done();
      });

      test('calls read on the model store.', done => {
        const fakeStream = new PassThrough({ objectMode: true });

        fakeStream.write('foo');
        fakeStream.end();

        const listAggregate = new ListAggregate.Readable({
          readModel,
          modelStore: {
            read (options, callback) {
              assert.that(options).is.ofType('object');
              assert.that(options.modelType).is.equalTo('lists');
              assert.that(options.modelName).is.equalTo('peerGroups');
              assert.that(options.query).is.equalTo({ foo: 'bar' });
              callback(null, fakeStream);
            }
          },
          modelName: 'peerGroups'
        });

        listAggregate.read({ foo: 'bar' }).
          failed(done).
          finished(result => {
            assert.that(result).is.equalTo([ 'foo' ]);
            done();
          });
      });

      test('calls read on the model store with an empty query if no query is given.', done => {
        const fakeStream = new PassThrough({ objectMode: true });

        fakeStream.write('foo');
        fakeStream.end();

        const listAggregate = new ListAggregate.Readable({
          readModel,
          modelStore: {
            read (options, callback) {
              assert.that(options.query).is.equalTo({});
              callback(null, fakeStream);
            }
          },
          modelName: 'peerGroups'
        });

        listAggregate.read().
          failed(done).
          finished(() => done());
      });
    });

    suite('readOne', () => {
      test('is a function.', done => {
        const listAggregate = new ListAggregate.Readable({
          readModel,
          modelStore: {},
          modelName: 'peerGroups'
        });

        assert.that(listAggregate.readOne).is.ofType('function');
        done();
      });

      test('throws an error if query is missing.', done => {
        const listAggregate = new ListAggregate.Readable({
          readModel,
          modelStore: {},
          modelName: 'peerGroups'
        });

        assert.that(() => {
          listAggregate.readOne();
        }).is.throwing('Query is missing.');
        done();
      });

      test('throws an error if where is missing.', done => {
        const listAggregate = new ListAggregate.Readable({
          readModel,
          modelStore: {},
          modelName: 'peerGroups'
        });

        assert.that(() => {
          listAggregate.readOne({});
        }).is.throwing('Where is missing.');
        done();
      });

      test('calls readOne on the model store.', done => {
        const listAggregate = new ListAggregate.Readable({
          readModel,
          modelStore: {
            readOne (options, callback) {
              assert.that(options).is.ofType('object');
              assert.that(options.modelType).is.equalTo('lists');
              assert.that(options.modelName).is.equalTo('peerGroups');
              assert.that(options.query).is.equalTo({ where: { foo: 'bar' }});
              callback(null, 'foo');
            }
          },
          modelName: 'peerGroups'
        });

        listAggregate.readOne({
          where: { foo: 'bar' }
        }).
          failed(done).
          finished(result => {
            assert.that(result).is.equalTo('foo');
            done();
          });
      });
    });
  });

  suite('Writable', () => {
    test('is a function.', done => {
      assert.that(ListAggregate.Writable).is.ofType('function');
      done();
    });

    test('throws an error if options are missing.', done => {
      assert.that(() => {
        /* eslint-disable no-new */
        new ListAggregate.Writable();
        /* eslint-enable no-new */
      }).is.throwing('Options are missing.');
      done();
    });

    test('throws an error if read model is missing.', done => {
      assert.that(() => {
        /* eslint-disable no-new */
        new ListAggregate.Writable({});
        /* eslint-enable no-new */
      }).is.throwing('Read model is missing.');
      done();
    });

    test('throws an error if model store is missing.', done => {
      assert.that(() => {
        /* eslint-disable no-new */
        new ListAggregate.Writable({ readModel: {}});
        /* eslint-enable no-new */
      }).is.throwing('Model store is missing.');
      done();
    });

    test('throws an error if model name is missing.', done => {
      assert.that(() => {
        /* eslint-disable no-new */
        new ListAggregate.Writable({ readModel: {}, modelStore: {}});
        /* eslint-enable no-new */
      }).is.throwing('Model name is missing.');
      done();
    });

    test('throws an error if domain event is missing.', done => {
      assert.that(() => {
        /* eslint-disable no-new */
        new ListAggregate.Writable({ readModel: {}, modelStore: {}, modelName: 'foo' });
        /* eslint-enable no-new */
      }).is.throwing('Domain event is missing.');
      done();
    });

    test('throws an error if uncommitted events are missing.', done => {
      assert.that(() => {
        /* eslint-disable no-new */
        new ListAggregate.Writable({ readModel: {}, modelStore: {}, modelName: 'foo', domainEvent: {}});
        /* eslint-enable no-new */
      }).is.throwing('Uncommitted events are missing.');
      done();
    });

    suite('add', () => {
      test('throws an error if payload is missing.', done => {
        const listAggregate = new ListAggregate.Writable({
          readModel,
          modelStore: {},
          modelName: 'peerGroups',
          domainEvent,
          uncommittedEvents: []
        });

        assert.that(() => {
          listAggregate.add();
        }).is.throwing('Payload is missing.');
        done();
      });

      test('adds a single added event to the list of uncommitted events.', done => {
        const id = uuid();
        const listAggregate = new ListAggregate.Writable({
          readModel,
          modelStore: {},
          modelName: 'peerGroups',
          domainEvent,
          uncommittedEvents: []
        });

        listAggregate.add({ id, initiator: 'Jane Doe', destination: 'Riva', participants: []});

        assert.that(listAggregate.uncommittedEvents.length).is.equalTo(1);
        assert.that(listAggregate.uncommittedEvents[0].context.name).is.equalTo('lists');
        assert.that(listAggregate.uncommittedEvents[0].aggregate.name).is.equalTo('peerGroups');
        assert.that(listAggregate.uncommittedEvents[0].name).is.equalTo('added');
        assert.that(listAggregate.uncommittedEvents[0].type).is.equalTo('readModel');
        assert.that(listAggregate.uncommittedEvents[0].data.payload.id).is.equalTo(id);
        assert.that(listAggregate.uncommittedEvents[0].data.payload.initiator).is.equalTo('Jane Doe');
        assert.that(listAggregate.uncommittedEvents[0].data.payload.destination).is.equalTo('Riva');
        assert.that(listAggregate.uncommittedEvents[0].data.payload.participants).is.equalTo([]);
        done();
      });

      test('adds multiple added events to the list of uncommitted events.', done => {
        const id = uuid();
        const listAggregate = new ListAggregate.Writable({
          readModel,
          modelStore: {},
          modelName: 'peerGroups',
          domainEvent,
          uncommittedEvents: []
        });

        listAggregate.add({ id, initiator: 'Jane Doe', destination: 'Riva', participants: []});
        listAggregate.add({ id, initiator: 'John Doe', destination: 'Sultan Saray', participants: []});

        assert.that(listAggregate.uncommittedEvents.length).is.equalTo(2);
        assert.that(listAggregate.uncommittedEvents[0].data.payload.id).is.equalTo(id);
        assert.that(listAggregate.uncommittedEvents[0].data.payload.initiator).is.equalTo('Jane Doe');
        assert.that(listAggregate.uncommittedEvents[0].data.payload.destination).is.equalTo('Riva');
        assert.that(listAggregate.uncommittedEvents[0].data.payload.participants).is.equalTo([]);

        assert.that(listAggregate.uncommittedEvents[1].data.payload.id).is.equalTo(id);
        assert.that(listAggregate.uncommittedEvents[1].data.payload.initiator).is.equalTo('John Doe');
        assert.that(listAggregate.uncommittedEvents[1].data.payload.destination).is.equalTo('Sultan Saray');
        assert.that(listAggregate.uncommittedEvents[1].data.payload.participants).is.equalTo([]);
        done();
      });

      test('applies the domain event authorization information to the model event.', done => {
        const listAggregate = new ListAggregate.Writable({
          readModel,
          modelStore: {},
          modelName: 'peerGroups',
          domainEvent,
          uncommittedEvents: []
        });

        listAggregate.add({ id: uuid(), initiator: 'Jane Doe', destination: 'Riva', participants: []});

        assert.that(listAggregate.uncommittedEvents.length).is.equalTo(1);
        assert.that(listAggregate.uncommittedEvents[0].metadata.isAuthorized).is.equalTo(domainEvent.metadata.isAuthorized);
        done();
      });

      test('extends the payload using the domain event authorization information.', done => {
        const id = uuid();
        const listAggregate = new ListAggregate.Writable({
          readModel,
          modelStore: {},
          modelName: 'peerGroups',
          domainEvent,
          uncommittedEvents: []
        });

        listAggregate.add({ id, initiator: 'Jane Doe' });

        assert.that(listAggregate.uncommittedEvents.length).is.equalTo(1);
        assert.that(listAggregate.uncommittedEvents[0].data.payload.isAuthorized).is.equalTo(domainEvent.metadata.isAuthorized);
        done();
      });

      test('adds an automatically created id if is is missing.', done => {
        const listAggregate = new ListAggregate.Writable({
          readModel,
          modelStore: {},
          modelName: 'peerGroups',
          domainEvent,
          uncommittedEvents: []
        });

        listAggregate.add({ initiator: 'Jane Doe' });

        assert.that(listAggregate.uncommittedEvents.length).is.equalTo(1);
        assert.that(listAggregate.uncommittedEvents[0].data.payload.id).is.equalTo(domainEvent.aggregate.id);
        done();
      });

      test('adds authorization information and owner.', done => {
        const listAggregate = new ListAggregate.Writable({
          readModel,
          modelStore: {},
          modelName: 'peerGroups',
          domainEvent,
          uncommittedEvents: []
        });

        listAggregate.add({ initiator: 'Jane Doe' });

        assert.that(listAggregate.uncommittedEvents.length).is.equalTo(1);
        assert.that(listAggregate.uncommittedEvents[0].data.payload.isAuthorized.owner).is.equalTo(domainEvent.metadata.isAuthorized.owner);
        assert.that(listAggregate.uncommittedEvents[0].data.payload.isAuthorized.forAuthenticated).is.false();
        assert.that(listAggregate.uncommittedEvents[0].data.payload.isAuthorized.forPublic).is.true();
        done();
      });

      test('merges authorization information and keeps the owner.', done => {
        const listAggregate = new ListAggregate.Writable({
          readModel,
          modelStore: {},
          modelName: 'peerGroups',
          domainEvent,
          uncommittedEvents: []
        });

        listAggregate.add({ initiator: 'Jane Doe', isAuthorized: { forAuthenticated: true }});

        assert.that(listAggregate.uncommittedEvents.length).is.equalTo(1);
        assert.that(listAggregate.uncommittedEvents[0].data.payload.isAuthorized.owner).is.equalTo(domainEvent.metadata.isAuthorized.owner);
        assert.that(listAggregate.uncommittedEvents[0].data.payload.isAuthorized.forAuthenticated).is.true();
        assert.that(listAggregate.uncommittedEvents[0].data.payload.isAuthorized.forPublic).is.true();
        done();
      });
    });

    suite('update', () => {
      test('throws an error if options are missing.', done => {
        const listAggregate = new ListAggregate.Writable({
          readModel,
          modelStore: {},
          modelName: 'peerGroups',
          domainEvent,
          uncommittedEvents: []
        });

        assert.that(() => {
          listAggregate.update();
        }).is.throwing('Options are missing.');
        done();
      });

      test('throws an error if where is missing.', done => {
        const listAggregate = new ListAggregate.Writable({
          readModel,
          modelStore: {},
          modelName: 'peerGroups',
          domainEvent,
          uncommittedEvents: []
        });

        assert.that(() => {
          listAggregate.update({});
        }).is.throwing('Where is missing.');
        done();
      });

      test('throws an error if set is missing.', done => {
        const listAggregate = new ListAggregate.Writable({
          readModel,
          modelStore: {},
          modelName: 'peerGroups',
          domainEvent,
          uncommittedEvents: []
        });

        assert.that(() => {
          listAggregate.update({
            where: { initiator: 'Jane Doe' }
          });
        }).is.throwing('Set is missing.');
        done();
      });

      test('throws an error if set is an empty object.', done => {
        const listAggregate = new ListAggregate.Writable({
          readModel,
          modelStore: {},
          modelName: 'peerGroups',
          domainEvent,
          uncommittedEvents: []
        });

        assert.that(() => {
          listAggregate.update({
            where: { initiator: 'Jane Doe' },
            set: {}
          });
        }).is.throwing('Set must not be empty.');
        done();
      });

      test('adds a single updated event to the list of uncommitted events.', done => {
        const listAggregate = new ListAggregate.Writable({
          readModel,
          modelStore: {},
          modelName: 'peerGroups',
          domainEvent,
          uncommittedEvents: []
        });

        listAggregate.update({
          where: { initiator: 'Jane Doe' },
          set: { destination: 'Riva' }
        });

        assert.that(listAggregate.uncommittedEvents.length).is.equalTo(1);
        assert.that(listAggregate.uncommittedEvents[0].context.name).is.equalTo('lists');
        assert.that(listAggregate.uncommittedEvents[0].aggregate.name).is.equalTo('peerGroups');
        assert.that(listAggregate.uncommittedEvents[0].name).is.equalTo('updated');
        assert.that(listAggregate.uncommittedEvents[0].type).is.equalTo('readModel');
        assert.that(listAggregate.uncommittedEvents[0].data).is.equalTo({
          selector: { initiator: 'Jane Doe' },
          payload: { destination: 'Riva' }
        });
        done();
      });

      test('adds multiple updated events to the list of uncommitted events.', done => {
        const listAggregate = new ListAggregate.Writable({
          readModel,
          modelStore: {},
          modelName: 'peerGroups',
          domainEvent,
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
        assert.that(listAggregate.uncommittedEvents[0].data).is.equalTo({
          selector: { initiator: 'Jane Doe' },
          payload: { destination: 'Riva' }
        });
        assert.that(listAggregate.uncommittedEvents[1].data).is.equalTo({
          selector: { initiator: 'Jane Doe' },
          payload: { destination: 'Sultan Saray' }
        });
        done();
      });

      test('applies the domain event authorization information to the model event.', done => {
        const listAggregate = new ListAggregate.Writable({
          readModel,
          modelStore: {},
          modelName: 'peerGroups',
          domainEvent,
          uncommittedEvents: []
        });

        listAggregate.update({
          where: { initiator: 'Jane Doe' },
          set: { destination: 'Riva' }
        });

        assert.that(listAggregate.uncommittedEvents.length).is.equalTo(1);
        assert.that(listAggregate.uncommittedEvents[0].metadata.isAuthorized).is.equalTo({
          owner: domainEvent.metadata.isAuthorized.owner,
          forAuthenticated: false,
          forPublic: true
        });
        done();
      });
    });

    suite('authorize', () => {
      test('throws an error if options are missing.', done => {
        const listAggregate = new ListAggregate.Writable({
          readModel,
          modelStore: {},
          modelName: 'peerGroups',
          domainEvent,
          uncommittedEvents: []
        });

        assert.that(() => {
          listAggregate.authorize();
        }).is.throwing('Options are missing.');
        done();
      });

      test('throws an error if where is missing.', done => {
        const listAggregate = new ListAggregate.Writable({
          readModel,
          modelStore: {},
          modelName: 'peerGroups',
          domainEvent,
          uncommittedEvents: []
        });

        assert.that(() => {
          listAggregate.authorize({});
        }).is.throwing('Where is missing.');
        done();
      });

      test('throws an error if no authorization options are given.', done => {
        const listAggregate = new ListAggregate.Writable({
          readModel,
          modelStore: {},
          modelName: 'peerGroups',
          domainEvent,
          uncommittedEvents: []
        });

        assert.that(() => {
          listAggregate.authorize({
            where: { id: uuid() }
          });
        }).is.throwing('Invalid authorization options.');
        done();
      });

      test('throws an error if forAuthenticated is not a boolean.', done => {
        const listAggregate = new ListAggregate.Writable({
          readModel,
          modelStore: {},
          modelName: 'peerGroups',
          domainEvent,
          uncommittedEvents: []
        });

        assert.that(() => {
          listAggregate.authorize({
            where: { id: uuid() },
            forAuthenticated: 'true'
          });
        }).is.throwing('Invalid authorization options.');
        done();
      });

      test('adds an updated event to the list of uncommitted events when forAuthenticated is false.', done => {
        const aggregateIdToUpdate = uuid();

        const listAggregate = new ListAggregate.Writable({
          readModel,
          modelStore: {},
          modelName: 'peerGroups',
          domainEvent,
          uncommittedEvents: []
        });

        listAggregate.authorize({
          where: { id: aggregateIdToUpdate },
          forAuthenticated: false
        });

        assert.that(listAggregate.uncommittedEvents.length).is.equalTo(1);
        assert.that(listAggregate.uncommittedEvents[0].context.name).is.equalTo('lists');
        assert.that(listAggregate.uncommittedEvents[0].aggregate.name).is.equalTo('peerGroups');
        assert.that(listAggregate.uncommittedEvents[0].name).is.equalTo('updated');
        assert.that(listAggregate.uncommittedEvents[0].type).is.equalTo('readModel');
        assert.that(listAggregate.uncommittedEvents[0].data).is.equalTo({
          selector: { id: aggregateIdToUpdate },
          payload: { 'isAuthorized.forAuthenticated': false }
        });
        done();
      });

      test('adds an updated event to the list of uncommitted events when forAuthenticated is true.', done => {
        const aggregateIdToUpdate = uuid();

        const listAggregate = new ListAggregate.Writable({
          readModel,
          modelStore: {},
          modelName: 'peerGroups',
          domainEvent,
          uncommittedEvents: []
        });

        listAggregate.authorize({
          where: { id: aggregateIdToUpdate },
          forAuthenticated: true
        });

        assert.that(listAggregate.uncommittedEvents.length).is.equalTo(1);
        assert.that(listAggregate.uncommittedEvents[0].context.name).is.equalTo('lists');
        assert.that(listAggregate.uncommittedEvents[0].aggregate.name).is.equalTo('peerGroups');
        assert.that(listAggregate.uncommittedEvents[0].name).is.equalTo('updated');
        assert.that(listAggregate.uncommittedEvents[0].type).is.equalTo('readModel');
        assert.that(listAggregate.uncommittedEvents[0].data).is.equalTo({
          selector: { id: aggregateIdToUpdate },
          payload: { 'isAuthorized.forAuthenticated': true }
        });
        done();
      });

      test('throws an error if forPublic is not a boolean.', done => {
        const listAggregate = new ListAggregate.Writable({
          readModel,
          modelStore: {},
          modelName: 'peerGroups',
          domainEvent,
          uncommittedEvents: []
        });

        assert.that(() => {
          listAggregate.authorize({
            where: { id: uuid() },
            forPublic: 'true'
          });
        }).is.throwing('Invalid authorization options.');
        done();
      });

      test('adds an updated event to the list of uncommitted events when forPublic is false.', done => {
        const aggregateIdToUpdate = uuid();

        const listAggregate = new ListAggregate.Writable({
          readModel,
          modelStore: {},
          modelName: 'peerGroups',
          domainEvent,
          uncommittedEvents: []
        });

        listAggregate.authorize({
          where: { id: aggregateIdToUpdate },
          forPublic: false
        });

        assert.that(listAggregate.uncommittedEvents.length).is.equalTo(1);
        assert.that(listAggregate.uncommittedEvents[0].context.name).is.equalTo('lists');
        assert.that(listAggregate.uncommittedEvents[0].aggregate.name).is.equalTo('peerGroups');
        assert.that(listAggregate.uncommittedEvents[0].name).is.equalTo('updated');
        assert.that(listAggregate.uncommittedEvents[0].type).is.equalTo('readModel');
        assert.that(listAggregate.uncommittedEvents[0].data).is.equalTo({
          selector: { id: aggregateIdToUpdate },
          payload: { 'isAuthorized.forPublic': false }
        });
        done();
      });

      test('adds an updated event to the list of uncommitted events when forPublic is true.', done => {
        const aggregateIdToUpdate = uuid();

        const listAggregate = new ListAggregate.Writable({
          readModel,
          modelStore: {},
          modelName: 'peerGroups',
          domainEvent,
          uncommittedEvents: []
        });

        listAggregate.authorize({
          where: { id: aggregateIdToUpdate },
          forPublic: true
        });

        assert.that(listAggregate.uncommittedEvents.length).is.equalTo(1);
        assert.that(listAggregate.uncommittedEvents[0].context.name).is.equalTo('lists');
        assert.that(listAggregate.uncommittedEvents[0].aggregate.name).is.equalTo('peerGroups');
        assert.that(listAggregate.uncommittedEvents[0].name).is.equalTo('updated');
        assert.that(listAggregate.uncommittedEvents[0].type).is.equalTo('readModel');
        assert.that(listAggregate.uncommittedEvents[0].data).is.equalTo({
          selector: { id: aggregateIdToUpdate },
          payload: { 'isAuthorized.forPublic': true }
        });
        done();
      });

      test('does not set other any other properties.', done => {
        const aggregateIdToUpdate = uuid();

        const listAggregate = new ListAggregate.Writable({
          readModel,
          modelStore: {},
          modelName: 'peerGroups',
          domainEvent,
          uncommittedEvents: []
        });

        listAggregate.authorize({
          where: { id: aggregateIdToUpdate },
          forAuthenticated: false,
          forPublic: true,
          foo: 'bar'
        });

        assert.that(listAggregate.uncommittedEvents.length).is.equalTo(1);
        assert.that(listAggregate.uncommittedEvents[0].context.name).is.equalTo('lists');
        assert.that(listAggregate.uncommittedEvents[0].aggregate.name).is.equalTo('peerGroups');
        assert.that(listAggregate.uncommittedEvents[0].name).is.equalTo('updated');
        assert.that(listAggregate.uncommittedEvents[0].type).is.equalTo('readModel');
        assert.that(listAggregate.uncommittedEvents[0].data).is.equalTo({
          selector: { id: aggregateIdToUpdate },
          payload: {
            'isAuthorized.forAuthenticated': false,
            'isAuthorized.forPublic': true
          }
        });

        done();
      });
    });

    suite('transferOwnership', () => {
      test('throws an error if options are missing.', done => {
        const listAggregate = new ListAggregate.Writable({
          readModel,
          modelStore: {},
          modelName: 'peerGroups',
          domainEvent,
          uncommittedEvents: []
        });

        assert.that(() => {
          listAggregate.transferOwnership();
        }).is.throwing('Options are missing.');
        done();
      });

      test('throws an error if where is missing.', done => {
        const listAggregate = new ListAggregate.Writable({
          readModel,
          modelStore: {},
          modelName: 'peerGroups',
          domainEvent,
          uncommittedEvents: []
        });

        assert.that(() => {
          listAggregate.transferOwnership({});
        }).is.throwing('Where is missing.');
        done();
      });

      test('throws an error if no new owner is given.', done => {
        const listAggregate = new ListAggregate.Writable({
          readModel,
          modelStore: {},
          modelName: 'peerGroups',
          domainEvent,
          uncommittedEvents: []
        });

        assert.that(() => {
          listAggregate.transferOwnership({
            where: { id: uuid() }
          });
        }).is.throwing('Owner is missing.');
        done();
      });

      test('adds an updated event to the list of uncommitted events when owner is given.', done => {
        const aggregateIdToUpdate = uuid(),
              newOwnerId = uuid();

        const listAggregate = new ListAggregate.Writable({
          readModel,
          modelStore: {},
          modelName: 'peerGroups',
          domainEvent,
          uncommittedEvents: []
        });

        listAggregate.transferOwnership({
          where: { id: aggregateIdToUpdate },
          to: newOwnerId
        });

        assert.that(listAggregate.uncommittedEvents.length).is.equalTo(1);
        assert.that(listAggregate.uncommittedEvents[0].context.name).is.equalTo('lists');
        assert.that(listAggregate.uncommittedEvents[0].aggregate.name).is.equalTo('peerGroups');
        assert.that(listAggregate.uncommittedEvents[0].name).is.equalTo('updated');
        assert.that(listAggregate.uncommittedEvents[0].type).is.equalTo('readModel');
        assert.that(listAggregate.uncommittedEvents[0].data).is.equalTo({
          selector: { id: aggregateIdToUpdate },
          payload: { 'isAuthorized.owner': newOwnerId }
        });
        done();
      });

      test('does not set other any other properties.', done => {
        const aggregateIdToUpdate = uuid(),
              newOwnerId = uuid();

        const listAggregate = new ListAggregate.Writable({
          readModel,
          modelStore: {},
          modelName: 'peerGroups',
          domainEvent,
          uncommittedEvents: []
        });

        listAggregate.transferOwnership({
          where: { id: aggregateIdToUpdate },
          to: newOwnerId,
          foo: 'bar'
        });

        assert.that(listAggregate.uncommittedEvents.length).is.equalTo(1);
        assert.that(listAggregate.uncommittedEvents[0].context.name).is.equalTo('lists');
        assert.that(listAggregate.uncommittedEvents[0].aggregate.name).is.equalTo('peerGroups');
        assert.that(listAggregate.uncommittedEvents[0].name).is.equalTo('updated');
        assert.that(listAggregate.uncommittedEvents[0].type).is.equalTo('readModel');
        assert.that(listAggregate.uncommittedEvents[0].data).is.equalTo({
          selector: { id: aggregateIdToUpdate },
          payload: { 'isAuthorized.owner': newOwnerId }
        });
        done();
      });
    });

    suite('remove', () => {
      test('throws an error if options are missing.', done => {
        const listAggregate = new ListAggregate.Writable({
          readModel,
          modelStore: {},
          modelName: 'peerGroups',
          domainEvent,
          uncommittedEvents: []
        });

        assert.that(() => {
          listAggregate.remove();
        }).is.throwing('Options are missing.');
        done();
      });

      test('throws an error if where is missing.', done => {
        const listAggregate = new ListAggregate.Writable({
          readModel,
          modelStore: {},
          modelName: 'peerGroups',
          domainEvent,
          uncommittedEvents: []
        });

        assert.that(() => {
          listAggregate.remove({});
        }).is.throwing('Where is missing.');
        done();
      });

      test('adds a single removed event to the list of uncommitted events.', done => {
        const listAggregate = new ListAggregate.Writable({
          readModel,
          modelStore: {},
          modelName: 'peerGroups',
          domainEvent,
          uncommittedEvents: []
        });

        listAggregate.remove({
          where: { initiator: 'Jane Doe' }
        });

        assert.that(listAggregate.uncommittedEvents.length).is.equalTo(1);
        assert.that(listAggregate.uncommittedEvents[0].context.name).is.equalTo('lists');
        assert.that(listAggregate.uncommittedEvents[0].aggregate.name).is.equalTo('peerGroups');
        assert.that(listAggregate.uncommittedEvents[0].name).is.equalTo('removed');
        assert.that(listAggregate.uncommittedEvents[0].type).is.equalTo('readModel');
        assert.that(listAggregate.uncommittedEvents[0].data).is.equalTo({
          selector: { initiator: 'Jane Doe' }
        });
        done();
      });

      test('adds multiple removed events to the list of uncommitted events.', done => {
        const listAggregate = new ListAggregate.Writable({
          readModel,
          modelStore: {},
          modelName: 'peerGroups',
          domainEvent,
          uncommittedEvents: []
        });

        listAggregate.remove({
          where: { initiator: 'Jane Doe' }
        });
        listAggregate.remove({
          where: { initiator: 'Jane Doe' }
        });

        assert.that(listAggregate.uncommittedEvents.length).is.equalTo(2);
        assert.that(listAggregate.uncommittedEvents[0].data).is.equalTo({
          selector: { initiator: 'Jane Doe' }
        });
        assert.that(listAggregate.uncommittedEvents[1].data).is.equalTo({
          selector: { initiator: 'Jane Doe' }
        });
        done();
      });

      test('applies the domain event authorization information to the model event.', done => {
        const ownerId = uuid();

        domainEvent.metadata.isAuthorized = {
          owner: ownerId,
          forAuthenticated: true,
          forPublic: false
        };

        const listAggregate = new ListAggregate.Writable({
          readModel,
          modelStore: {},
          modelName: 'peerGroups',
          domainEvent,
          uncommittedEvents: []
        });

        listAggregate.remove({
          where: { initiator: 'Jane Doe' }
        });

        assert.that(listAggregate.uncommittedEvents.length).is.equalTo(1);
        assert.that(listAggregate.uncommittedEvents[0].metadata.isAuthorized).is.equalTo({
          owner: ownerId,
          forAuthenticated: true,
          forPublic: false
        });
        done();
      });
    });
  });
});

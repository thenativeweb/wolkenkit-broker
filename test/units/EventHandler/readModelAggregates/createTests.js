'use strict';

const assert = require('assertthat'),
      uuid = require('uuidv4');

const buildEvent = require('../../../helpers/buildEvent'),
      create = require('../../../../EventHandler/readModelAggregates/create'),
      ListAggregate = require('../../../../EventHandler/readModelAggregates/ListAggregate');

const readModel = {
  fields: {
    initiator: { initialState: '', fastLookup: true, isUnique: false },
    destination: { initialState: '', fastLookup: true },
    participants: { initialState: []}
  }
};

const modelStore = {};

suite('create', () => {
  let domainEvent;

  setup(() => {
    domainEvent = buildEvent('planning', 'peerGroup', uuid(), 'started', {
      initiator: 'Jane Doe',
      destination: 'Riva'
    });
  });

  test('is a function.', done => {
    assert.that(create).is.ofType('function');
    done();
  });

  test('throws an error if options are missing.', done => {
    assert.that(() => {
      create();
    }).is.throwing('Options are missing.');
    done();
  });

  test('throws an error if read model is missing.', done => {
    assert.that(() => {
      create({});
    }).is.throwing('Read model is missing.');
    done();
  });

  test('throws an error if model store is missing.', done => {
    assert.that(() => {
      create({ readModel });
    }).is.throwing('Model store is missing.');
    done();
  });

  test('throws an error if model type is missing.', done => {
    assert.that(() => {
      create({ readModel, modelStore });
    }).is.throwing('Model type is missing.');
    done();
  });

  test('throws an error if model name is missing.', done => {
    assert.that(() => {
      create({ readModel, modelStore, modelType: 'lists' });
    }).is.throwing('Model name is missing.');
    done();
  });

  suite('read model aggregate', () => {
    test('is an object.', done => {
      const readModelAggregate = create({
        readModel,
        modelStore,
        modelType: 'lists',
        modelName: 'peerGroups',
        domainEvent
      });

      assert.that(readModelAggregate).is.ofType('object');
      done();
    });

    test('has an empty list of uncommitted events.', done => {
      const readModelAggregate = create({
        readModel,
        modelStore,
        modelType: 'lists',
        modelName: 'peerGroups',
        domainEvent
      });

      assert.that(readModelAggregate.uncommittedEvents).is.equalTo([]);
      done();
    });

    test('is a list aggregate if the model type is set to list.', done => {
      const readModelAggregate = create({
        readModel,
        modelStore,
        modelType: 'lists',
        modelName: 'peerGroups',
        domainEvent
      });

      assert.that(readModelAggregate).is.instanceOf(ListAggregate.Writable);
      done();
    });

    test('is a writable aggregate if domain event is given.', done => {
      const readModelAggregate = create({
        readModel,
        modelStore,
        modelType: 'lists',
        modelName: 'peerGroups',
        domainEvent
      });

      assert.that(readModelAggregate).is.instanceOf(ListAggregate.Writable);
      done();
    });

    test('is a readable aggregate if no domain event is given.', done => {
      const readModelAggregate = create({
        readModel,
        modelStore,
        modelType: 'lists',
        modelName: 'peerGroups'
      });

      assert.that(readModelAggregate).is.instanceOf(ListAggregate.Readable);
      done();
    });

    test('fills uncommitted events using aggregates.', done => {
      const readModelAggregate = create({
        readModel,
        modelStore,
        modelType: 'lists',
        modelName: 'peerGroups',
        domainEvent
      });
      const id = uuid();

      readModelAggregate.add({ id, initiator: 'Jane Doe' });

      assert.that(readModelAggregate.uncommittedEvents.length).is.equalTo(1);
      assert.that(readModelAggregate.uncommittedEvents[0].data.payload).is.equalTo({
        id,
        initiator: 'Jane Doe',
        destination: '',
        participants: [],
        isAuthorized: domainEvent.metadata.isAuthorized
      });
      done();
    });
  });
});

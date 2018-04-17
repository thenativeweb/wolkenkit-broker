'use strict';

const assert = require('assertthat'),
      uuid = require('uuidv4');

const buildEvent = require('../../../shared/buildEvent'),
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

  test('is a function.', async () => {
    assert.that(create).is.ofType('function');
  });

  test('throws an error if read model is missing.', async () => {
    assert.that(() => {
      create({});
    }).is.throwing('Read model is missing.');
  });

  test('throws an error if model store is missing.', async () => {
    assert.that(() => {
      create({ readModel });
    }).is.throwing('Model store is missing.');
  });

  test('throws an error if model type is missing.', async () => {
    assert.that(() => {
      create({ readModel, modelStore });
    }).is.throwing('Model type is missing.');
  });

  test('throws an error if model name is missing.', async () => {
    assert.that(() => {
      create({ readModel, modelStore, modelType: 'lists' });
    }).is.throwing('Model name is missing.');
  });

  suite('read model aggregate', () => {
    test('is an object.', async () => {
      const readModelAggregate = create({
        readModel,
        modelStore,
        modelType: 'lists',
        modelName: 'peerGroups',
        domainEvent
      });

      assert.that(readModelAggregate).is.ofType('object');
    });

    test('has an empty list of uncommitted events.', async () => {
      const readModelAggregate = create({
        readModel,
        modelStore,
        modelType: 'lists',
        modelName: 'peerGroups',
        domainEvent
      });

      assert.that(readModelAggregate.uncommittedEvents).is.equalTo([]);
    });

    test('is a list aggregate if the model type is set to list.', async () => {
      const readModelAggregate = create({
        readModel,
        modelStore,
        modelType: 'lists',
        modelName: 'peerGroups',
        domainEvent
      });

      assert.that(readModelAggregate).is.instanceOf(ListAggregate.Writable);
    });

    test('is a writable aggregate if domain event is given.', async () => {
      const readModelAggregate = create({
        readModel,
        modelStore,
        modelType: 'lists',
        modelName: 'peerGroups',
        domainEvent
      });

      assert.that(readModelAggregate).is.instanceOf(ListAggregate.Writable);
    });

    test('is a readable aggregate if no domain event is given.', async () => {
      const readModelAggregate = create({
        readModel,
        modelStore,
        modelType: 'lists',
        modelName: 'peerGroups'
      });

      assert.that(readModelAggregate).is.instanceOf(ListAggregate.Readable);
    });

    test('fills uncommitted events using aggregates.', async () => {
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
    });
  });
});

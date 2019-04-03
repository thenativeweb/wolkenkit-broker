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

  test('throws an error if domain event is given, but domain event metadata are missing.', async () => {
    assert.that(() => {
      create({ readModel, modelStore, modelType: 'lists', modelName: 'peerGroups', domainEvent });
    }).is.throwing('Domain event metadata are missing.');
  });

  test('throws an error if domain event metadata are given, but domain event is missing.', async () => {
    assert.that(() => {
      create({ readModel, modelStore, modelType: 'lists', modelName: 'peerGroups', domainEventMetadata });
    }).is.throwing('Domain event is missing.');
  });

  suite('read model aggregate', () => {
    test('is an object.', async () => {
      const readModelAggregate = create({
        readModel,
        modelStore,
        modelType: 'lists',
        modelName: 'peerGroups',
        domainEvent,
        domainEventMetadata
      });

      assert.that(readModelAggregate).is.ofType('object');
    });

    test('has an empty list of uncommitted events.', async () => {
      const readModelAggregate = create({
        readModel,
        modelStore,
        modelType: 'lists',
        modelName: 'peerGroups',
        domainEvent,
        domainEventMetadata
      });

      assert.that(readModelAggregate.uncommittedEvents).is.equalTo([]);
    });

    test('is a list aggregate if the model type is set to list.', async () => {
      const readModelAggregate = create({
        readModel,
        modelStore,
        modelType: 'lists',
        modelName: 'peerGroups',
        domainEvent,
        domainEventMetadata
      });

      assert.that(readModelAggregate).is.instanceOf(ListAggregate.Writable);
    });

    test('is a writable aggregate if domain event is given.', async () => {
      const readModelAggregate = create({
        readModel,
        modelStore,
        modelType: 'lists',
        modelName: 'peerGroups',
        domainEvent,
        domainEventMetadata
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
        domainEvent,
        domainEventMetadata
      });
      const id = uuid();

      readModelAggregate.add({ id, initiator: 'Jane Doe' });

      assert.that(readModelAggregate.uncommittedEvents.length).is.equalTo(1);
      assert.that(readModelAggregate.uncommittedEvents[0].event.data.payload).is.equalTo({
        id,
        initiator: 'Jane Doe',
        destination: '',
        participants: []
      });
      assert.that(readModelAggregate.uncommittedEvents[0].event.initiator.id).is.equalTo(users.jane.id);
    });
  });
});

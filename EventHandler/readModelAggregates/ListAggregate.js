'use strict';

const { Event } = require('commands-events'),
      toArray = require('streamtoarray'),
      uuid = require('uuidv4');

class Readable {
  constructor ({ readModel, modelStore, modelName }) {
    if (!readModel) {
      throw new Error('Read model is missing.');
    }
    if (!modelStore) {
      throw new Error('Model store is missing.');
    }
    if (!modelName) {
      throw new Error('Model name is missing.');
    }

    this.readModel = readModel;
    this.modelStore = modelStore;
    this.modelType = 'lists';
    this.modelName = modelName;
  }

  async read (query = {}) {
    const stream = await this.modelStore.read({
      modelType: this.modelType,
      modelName: this.modelName,
      query
    });

    const items = await toArray(stream);

    return items;
  }

  async readOne (query) {
    if (!query) {
      throw new Error('Query is missing.');
    }
    if (!query.where) {
      throw new Error('Where is missing.');
    }

    const item = await this.modelStore.readOne({
      modelType: this.modelType,
      modelName: this.modelName,
      query
    });

    return item;
  }
}

class Writable extends Readable {
  constructor ({
    readModel,
    modelStore,
    modelName,
    domainEvent,
    domainEventMetadata,
    uncommittedEvents
  }) {
    super({ readModel, modelStore, modelName });

    if (!domainEvent) {
      throw new Error('Domain event is missing.');
    }
    if (!domainEventMetadata) {
      throw new Error('Domain event metadata are missing.');
    }
    if (!uncommittedEvents) {
      throw new Error('Uncommitted events are missing.');
    }

    this.domainEvent = domainEvent;
    this.domainEventMetadata = domainEventMetadata;
    this.uncommittedEvents = uncommittedEvents;
  }

  publishEvent (name, data, { replace = false } = {}) {
    if (!name) {
      throw new Error('Name is missing.');
    }
    if (!data) {
      throw new Error('Data is missing.');
    }

    if (replace) {
      this.uncommittedEvents.pop();
    }

    const modelEvent = new Event({
      context: { name: this.modelType },
      aggregate: { name: this.modelName, id: uuid.empty() },
      name,
      type: 'readModel',
      data,
      metadata: {
        correlationId: this.domainEvent.metadata.correlationId,
        causationId: this.domainEvent.id
      }
    });

    modelEvent.addInitiator({ id: this.domainEvent.initiator.id });

    this.uncommittedEvents.push({
      event: modelEvent,
      metadata: {
        domainEvent: this.domainEvent,
        domainEventMetadata: this.domainEventMetadata
      }
    });
  }

  add (payload) {
    if (!payload) {
      throw new Error('Payload is missing.');
    }

    for (const fieldName of Object.keys(this.readModel.fields)) {
      payload[fieldName] =
        payload[fieldName] || this.readModel.fields[fieldName].initialState;
    }

    payload.id = payload.id || this.domainEvent.aggregate.id;

    this.publishEvent('added', { payload });

    const orUpdate = ({ where, set }) => {
      if (!where) {
        throw new Error('Where is missing.');
      }
      if (!set) {
        throw new Error('Set is missing.');
      }
      if (Object.keys(set).length === 0) {
        throw new Error('Set must not be empty.');
      }

      this.publishEvent('upserted', {
        selector: where,
        payload: { add: payload, update: set }
      }, { replace: true });
    };

    const orDiscard = () => {
      this.publishEvent('ensured', { payload }, { replace: true });
    };

    return { orUpdate, orDiscard };
  }

  update ({ where, set }) {
    if (!where) {
      throw new Error('Where is missing.');
    }
    if (!set) {
      throw new Error('Set is missing.');
    }
    if (Object.keys(set).length === 0) {
      throw new Error('Set must not be empty.');
    }

    this.publishEvent('updated', { selector: where, payload: set });
  }

  remove ({ where }) {
    if (!where) {
      throw new Error('Where is missing.');
    }

    this.publishEvent('removed', { selector: where });
  }
}

module.exports = { Readable, Writable };

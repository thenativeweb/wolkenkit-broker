'use strict';

const { Event } = require('commands-events'),
      isBoolean = require('lodash/isBoolean'),
      merge = require('lodash/merge'),
      toArray = require('streamtoarray'),
      uuid = require('uuidv4');

class Readable {
  constructor ({ readModel, modelStore, modelType, modelName }) {
    if (!readModel) {
      throw new Error('Read model is missing.');
    }
    if (!modelStore) {
      throw new Error('Model store is missing.');
    }
    if (!modelType) {
      throw new Error('Model type is missing.');
    }
    if (!modelName) {
      throw new Error('Model name is missing.');
    }

    this.readModel = readModel;
    this.modelStore = modelStore;
    this.modelType = modelType;
    this.modelName = modelName;
  }

  async read (query) {
    query = query || {};

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
  constructor (options) {
    super(options);

    if (!options.domainEvent) {
      throw new Error('Domain event is missing.');
    }
    if (!options.uncommittedEvents) {
      throw new Error('Uncommitted events are missing.');
    }

    this.domainEvent = options.domainEvent;
    this.uncommittedEvents = options.uncommittedEvents;
  }

  publishEvent (name, data) {
    if (!name) {
      throw new Error('Name is missing.');
    }
    if (!data) {
      throw new Error('Data is missing.');
    }

    this.uncommittedEvents.push(new Event({
      context: { name: this.modelType },
      aggregate: { name: this.modelName, id: uuid.empty() },
      name,
      type: 'readModel',
      data,
      metadata: {
        correlationId: this.domainEvent.metadata.correlationId,
        causationId: this.domainEvent.id,
        isAuthorized: this.domainEvent.metadata.isAuthorized
      }
    }));
  }

  add (payload) {
    if (!payload) {
      throw new Error('Payload is missing.');
    }

    Object.keys(this.readModel.fields).forEach(fieldName => {
      if (!payload[fieldName]) {
        payload[fieldName] = this.readModel.fields[fieldName].initialState;
      }
    });

    payload.id = payload.id || this.domainEvent.aggregate.id;
    payload.isAuthorized = merge(
      {},
      this.domainEvent.metadata.isAuthorized,
      payload.isAuthorized || {}
    );

    this.publishEvent('added', { payload });
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

  authorize ({ where, forAuthenticated, forPublic }) {
    if (!where) {
      throw new Error('Where is missing.');
    }
    if (!isBoolean(forAuthenticated) && !isBoolean(forPublic)) {
      throw new Error('Invalid authorization options.');
    }

    const payload = {};

    if (isBoolean(forAuthenticated)) {
      payload['isAuthorized.forAuthenticated'] = forAuthenticated;
    }
    if (isBoolean(forPublic)) {
      payload['isAuthorized.forPublic'] = forPublic;
    }

    this.publishEvent('updated', { selector: where, payload });
  }

  transferOwnership ({ where, to }) {
    if (!where) {
      throw new Error('Where is missing.');
    }
    if (!to) {
      throw new Error('Owner is missing.');
    }

    this.publishEvent('updated', {
      selector: where,
      payload: { 'isAuthorized.owner': to }
    });
  }

  remove ({ where }) {
    if (!where) {
      throw new Error('Where is missing.');
    }

    this.publishEvent('removed', { selector: where });
  }
}

module.exports = { Readable, Writable };

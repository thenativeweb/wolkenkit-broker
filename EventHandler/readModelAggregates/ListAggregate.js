'use strict';

const util = require('util');

const _ = require('lodash'),
      Event = require('commands-events').Event,
      toArray = require('streamtoarray'),
      uuid = require('uuidv4');

const Readable = function (options) {
  if (!options) {
    throw new Error('Options are missing.');
  }
  if (!options.readModel) {
    throw new Error('Read model is missing.');
  }
  if (!options.modelStore) {
    throw new Error('Model store is missing.');
  }
  if (!options.modelName) {
    throw new Error('Model name is missing.');
  }

  this.readModel = options.readModel;
  this.modelStore = options.modelStore;

  this.modelType = 'lists';
  this.modelName = options.modelName;
};

Readable.prototype.read = function (query) {
  query = query || {};

  const callbacks = {
    failed (err) {
      throw err;
    },
    finished () {}
  };

  process.nextTick(() => {
    this.modelStore.read({
      modelType: this.modelType,
      modelName: this.modelName,
      query
    }, (err, stream) => {
      if (err) {
        return callbacks.failed(err);
      }
      toArray(stream, (errToArray, array) => {
        if (errToArray) {
          return callbacks.failed(errToArray);
        }
        callbacks.finished(array);
      });
    });
  });

  return {
    failed (callback) {
      callbacks.failed = callback;

      return this;
    },
    finished (callback) {
      callbacks.finished = callback;

      return this;
    }
  };
};

Readable.prototype.readOne = function (query) {
  if (!query) {
    throw new Error('Query is missing.');
  }
  if (!query.where) {
    throw new Error('Where is missing.');
  }

  const callbacks = {
    failed (err) {
      throw err;
    },
    finished () {}
  };

  process.nextTick(() => {
    this.modelStore.readOne({
      modelType: this.modelType,
      modelName: this.modelName,
      query
    }, (err, item) => {
      if (err) {
        return callbacks.failed(err);
      }
      callbacks.finished(item);
    });
  });

  return {
    failed (callback) {
      callbacks.failed = callback;

      return this;
    },
    finished (callback) {
      callbacks.finished = callback;

      return this;
    }
  };
};

const Writable = function (options) {
  Reflect.apply(Readable, this, [ options ]);

  if (!options.domainEvent) {
    throw new Error('Domain event is missing.');
  }
  if (!options.uncommittedEvents) {
    throw new Error('Uncommitted events are missing.');
  }

  this.domainEvent = options.domainEvent;
  this.uncommittedEvents = options.uncommittedEvents;
};

util.inherits(Writable, Readable);

Writable.prototype.publishEvent = function (name, data) {
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
};

Writable.prototype.add = function (payload) {
  if (!payload) {
    throw new Error('Payload is missing.');
  }

  Object.keys(this.readModel.fields).forEach(fieldName => {
    if (!payload[fieldName]) {
      payload[fieldName] = this.readModel.fields[fieldName].initialState;
    }
  });

  payload.id = payload.id || this.domainEvent.aggregate.id;
  payload.isAuthorized = _.merge(
    {},
    this.domainEvent.metadata.isAuthorized,
    payload.isAuthorized || {}
  );

  this.publishEvent('added', { payload });
};

Writable.prototype.update = function (options) {
  if (!options) {
    throw new Error('Options are missing.');
  }
  if (!options.where) {
    throw new Error('Where is missing.');
  }
  if (!options.set) {
    throw new Error('Set is missing.');
  }
  if (Object.keys(options.set).length === 0) {
    throw new Error('Set must not be empty.');
  }

  this.publishEvent('updated', { selector: options.where, payload: options.set });
};

Writable.prototype.authorize = function (options) {
  if (!options) {
    throw new Error('Options are missing.');
  }
  if (!options.where) {
    throw new Error('Where is missing.');
  }
  if (!_.isBoolean(options.forAuthenticated) && !_.isBoolean(options.forPublic)) {
    throw new Error('Invalid authorization options.');
  }

  const payload = {};

  if (_.isBoolean(options.forAuthenticated)) {
    payload['isAuthorized.forAuthenticated'] = options.forAuthenticated;
  }
  if (_.isBoolean(options.forPublic)) {
    payload['isAuthorized.forPublic'] = options.forPublic;
  }

  this.publishEvent('updated', { selector: options.where, payload });
};

Writable.prototype.transferOwnership = function (options) {
  if (!options) {
    throw new Error('Options are missing.');
  }
  if (!options.where) {
    throw new Error('Where is missing.');
  }
  if (!options.to) {
    throw new Error('Owner is missing.');
  }

  this.publishEvent('updated', {
    selector: options.where,
    payload: { 'isAuthorized.owner': options.to }
  });
};

Writable.prototype.remove = function (options) {
  if (!options) {
    throw new Error('Options are missing.');
  }
  if (!options.where) {
    throw new Error('Where is missing.');
  }

  this.publishEvent('removed', { selector: options.where });
};

module.exports = { Readable, Writable };

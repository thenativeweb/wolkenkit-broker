'use strict';

const EventEmitter = require('events').EventEmitter,
      util = require('util');

const async = require('async');

const ModelStore = function () {
  this.stores = {};
};

util.inherits(ModelStore, EventEmitter);

ModelStore.prototype.initialize = function (options, callback) {
  if (!options) {
    throw new Error('Options are missing.');
  }
  if (!options.application) {
    throw new Error('Application is missing.');
  }
  if (!options.eventSequencer) {
    throw new Error('Event sequencer is missing.');
  }
  if (!options.readModel) {
    throw new Error('Read model is missing.');
  }
  if (!options.stores) {
    throw new Error('Stores are missing.');
  }
  if (!callback) {
    throw new Error('Callback is missing.');
  }

  this.eventSequencer = options.eventSequencer;
  this.stores = options.stores;

  async.parallel(Object.keys(this.stores).map(storeType =>
    done => {
      this.stores[storeType].on('disconnect', () => {
        this.emit('disconnect');
      });

      this.stores[storeType].initialize({
        application: options.application,
        readModel: options.readModel[storeType]
      }, done);
    }
  ), err => {
    if (err) {
      return callback(err);
    }

    callback(null);
  });
};

ModelStore.prototype.processEvents = function (domainEvent, modelEvents, callback) {
  if (!domainEvent) {
    throw new Error('Domain event is missing.');
  }
  if (!modelEvents) {
    throw new Error('Model events are missing.');
  }
  if (!callback) {
    throw new Error('Callback is missing.');
  }

  const storeSpecificEvents = {};

  Object.keys(this.stores).forEach(storeType => {
    storeSpecificEvents[storeType] = [];
  });

  modelEvents.forEach(modelEvent => {
    const modelType = modelEvent.context.name;

    if (!storeSpecificEvents[modelType]) {
      return;
    }

    storeSpecificEvents[modelType].push(modelEvent);
  });

  async.parallel(Object.keys(this.stores).map(storeType =>
    done => this.processEventsInStore(this.stores[storeType], domainEvent, storeSpecificEvents[storeType], done)
  ), callback);
};

ModelStore.prototype.processEventsInStore = function (store, domainEvent, modelEvents, callback) {
  if (!store) {
    throw new Error('Store is missing.');
  }
  if (!domainEvent) {
    throw new Error('Domain event is missing.');
  }
  if (!modelEvents) {
    throw new Error('Model events are missing.');
  }
  if (!callback) {
    throw new Error('Callback is missing.');
  }

  async.eachSeries(modelEvents, (modelEvent, done) => {
    const lastProcessedPosition = this.eventSequencer.
      models[modelEvent.context.name][modelEvent.aggregate.name].
      lastProcessedPosition;

    if (domainEvent.metadata.position <= lastProcessedPosition) {
      return process.nextTick(() => done(null));
    }

    store[modelEvent.name]({
      modelName: modelEvent.aggregate.name,
      selector: modelEvent.data.selector,
      payload: modelEvent.data.payload
    }, done);
  }, err => {
    if (err) {
      return callback(err);
    }

    async.parallel(Object.keys(this.stores).map(storeType =>
      done => this.stores[storeType].updatePosition(domainEvent.metadata.position, done)
    ), callback);
  });
};

ModelStore.prototype.read = function (options, callback) {
  if (!options) {
    throw new Error('Options are missing.');
  }
  if (!options.modelType) {
    throw new Error('Model type is missing.');
  }
  if (!options.modelName) {
    throw new Error('Model name is missing.');
  }
  if (!callback) {
    throw new Error('Callback is missing.');
  }

  options.query = options.query || {};

  this.stores[options.modelType].read(options, callback);
};

ModelStore.prototype.readOne = function (options, callback) {
  if (!options) {
    throw new Error('Options are missing.');
  }
  if (!options.modelType) {
    throw new Error('Model type is missing.');
  }
  if (!options.modelName) {
    throw new Error('Model name is missing.');
  }
  if (!options.query) {
    throw new Error('Query is missing.');
  }
  if (!options.query.where) {
    throw new Error('Where is missing.');
  }
  if (!callback) {
    throw new Error('Callback is missing.');
  }

  this.read({
    modelType: options.modelType,
    modelName: options.modelName,
    query: {
      where: options.query.where,
      take: 1
    }
  }, (err, stream) => {
    if (err) {
      return callback(err);
    }

    const items = [];
    const onData = function (item) {
      items.push(item);
    };
    const onEnd = function () {
      stream.removeListener('data', onData);
      stream.removeListener('end', onEnd);

      const firstItem = items[0];

      if (!firstItem) {
        return callback(new Error('Item not found.'));
      }
      callback(null, firstItem);
    };

    stream.on('data', onData);
    stream.once('end', onEnd);
  });
};

module.exports = ModelStore;

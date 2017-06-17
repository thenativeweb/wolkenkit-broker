'use strict';

const async = require('async');

const createReadModelAggregate = require('./readModelAggregates/create'),
      Services = require('./Services');

const EventHandler = function (options) {
  if (!options) {
    throw new Error('Options are missing.');
  }
  if (!options.app) {
    throw new Error('App is missing.');
  }
  if (!options.readModel) {
    throw new Error('Read model is missing.');
  }
  if (!options.modelStore) {
    throw new Error('Model store is missing.');
  }

  this.app = options.app;
  this.readModel = options.readModel;
  this.modelStore = options.modelStore;

  this.services = new Services({
    app: options.app,
    readModel: options.readModel,
    modelStore: options.modelStore
  });

  this.eventListeners = {};
  Object.keys(options.readModel).forEach(modelType => {
    Object.keys(options.readModel[modelType]).forEach(modelName => {
      Object.keys(options.readModel[modelType][modelName].when).forEach(eventName => {
        const eventListener = options.readModel[modelType][modelName].when[eventName];

        eventListener.modelType = modelType;
        eventListener.modelName = modelName;

        this.eventListeners[eventName] = this.eventListeners[eventName] || [];
        this.eventListeners[eventName].push(eventListener);
      });
    });
  });
};

EventHandler.prototype.handle = function (domainEvent, callback) {
  const eventName = `${domainEvent.context.name}.${domainEvent.aggregate.name}.${domainEvent.name}`;
  const modelEvents = [];

  async.each(this.eventListeners[eventName], (eventListener, done) => {
    const readModelAggregate = createReadModelAggregate({
      readModel: this.readModel[eventListener.modelType][eventListener.modelName],
      modelStore: this.modelStore,
      modelType: eventListener.modelType,
      modelName: eventListener.modelName,
      domainEvent
    });

    const mark = {
      asDone () {
        modelEvents.push(...readModelAggregate.uncommittedEvents);
        process.nextTick(() => done(null));
      },
      asFailed (reason) {
        process.nextTick(() => done(new Error(reason)));
      }
    };

    try {
      if (eventListener.length === 4) {
        eventListener(readModelAggregate, domainEvent, this.services, mark);
      } else {
        eventListener(readModelAggregate, domainEvent, mark);
      }
    } catch (ex) {
      process.nextTick(() => done(ex));
    }
  }, err => {
    if (err) {
      return callback(err);
    }
    callback(null, modelEvents);
  });
};

module.exports = EventHandler;

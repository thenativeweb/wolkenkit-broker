'use strict';

const createReadModelAggregate = require('./readModelAggregates/create'),
      getServices = require('./services/get');

class EventHandler {
  constructor ({ app, readModel, modelStore }) {
    if (!app) {
      throw new Error('App is missing.');
    }
    if (!readModel) {
      throw new Error('Read model is missing.');
    }
    if (!modelStore) {
      throw new Error('Model store is missing.');
    }

    this.app = app;
    this.readModel = readModel;
    this.modelStore = modelStore;

    this.logger = app.services.getLogger();

    this.eventListeners = {};

    Object.keys(readModel).forEach(modelType => {
      Object.keys(readModel[modelType]).forEach(modelName => {
        Object.keys(readModel[modelType][modelName].when).forEach(eventName => {
          const eventListener = readModel[modelType][modelName].when[eventName];

          eventListener.modelType = modelType;
          eventListener.modelName = modelName;

          this.eventListeners[eventName] = this.eventListeners[eventName] || [];
          this.eventListeners[eventName].push(eventListener);
        });
      });
    });
  }

  async handle (domainEvent) {
    if (!domainEvent) {
      throw new Error('Domain event is missing.');
    }

    const eventName = `${domainEvent.context.name}.${domainEvent.aggregate.name}.${domainEvent.name}`;
    const modelEvents = [];

    // this check is new...before it was async.each(this.eventListeners[eventName]
    if (!this.eventListeners[eventName]) {
      return modelEvents;
    }

    domainEvent.fail = function (reason) {
      throw new Error(reason);
    };

    for (let i = 0; i < this.eventListeners[eventName].length; i++) {
      const eventListener = this.eventListeners[eventName][i];
      const { modelType, modelName } = eventListener;

      const { app, readModel, modelStore } = this;

      const readModelAggregate = createReadModelAggregate({
        readModel: readModel[eventListener.modelType][eventListener.modelName],
        modelStore,
        modelType,
        modelName,
        domainEvent
      });

      const services = getServices({ app, readModel, modelStore, modelType, modelName });

      try {
        await eventListener(readModelAggregate, domainEvent, services);
      } catch (ex) {
        this.logger.debug('Failed to handle event.', { err: ex });

        throw ex;
      }

      modelEvents.push(...readModelAggregate.uncommittedEvents);
    }

    return modelEvents;
  }
}

module.exports = EventHandler;

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

    for (let i = 0; i < this.eventListeners[eventName].length; i++) {
      const eventListener = this.eventListeners[eventName][i];
      const { modelType, modelName } = eventListener;

      const readModelAggregate = createReadModelAggregate({
        readModel: this.readModel[eventListener.modelType][eventListener.modelName],
        modelStore: this.modelStore,
        modelType,
        modelName,
        domainEvent
      });

      domainEvent.failed = function (reason) {
        // Should we use a custom Error here?
        throw new Error(reason);
      };

      const { app, readModel, modelStore } = this;
      const services = getServices({ app, readModel, modelStore, modelType, modelName });

      try {
        eventListener(readModelAggregate, domainEvent, services);
      } catch (ex) {
        // Should we check for specific errors?
        // and should we log this error with flaschenpost? (like wolkenkit-core does)
        throw ex;
      }

      modelEvents.push(...readModelAggregate.uncommittedEvents);
    }

    return modelEvents;
  }
}

module.exports = EventHandler;

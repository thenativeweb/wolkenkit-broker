'use strict';

const createReadModelAggregate = require('./readModelAggregates/create'),
      getServices = require('../services/getForReadModelEventHandler');

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
        Object.keys(readModel[modelType][modelName].projections).forEach(eventName => {
          const eventListener = readModel[modelType][modelName].projections[eventName];

          eventListener.modelType = modelType;
          eventListener.modelName = modelName;

          this.eventListeners[eventName] = this.eventListeners[eventName] || [];
          this.eventListeners[eventName].push(eventListener);
        });
      });
    });
  }

  async handle ({ event, metadata }) {
    if (!event) {
      throw new Error('Event is missing.');
    }
    if (!metadata) {
      throw new Error('Metadata are missing.');
    }

    const eventName = `${event.context.name}.${event.aggregate.name}.${event.name}`;
    const modelEvents = [];

    if (!this.eventListeners[eventName]) {
      return modelEvents;
    }

    event.fail = function (reason) {
      throw new Error(reason);
    };

    const { app, readModel, modelStore } = this;

    for (let i = 0; i < this.eventListeners[eventName].length; i++) {
      const eventListener = this.eventListeners[eventName][i];
      const { modelType, modelName } = eventListener;

      const readModelAggregate = createReadModelAggregate({
        readModel: readModel[eventListener.modelType][eventListener.modelName],
        modelStore,
        modelType,
        modelName,
        domainEvent: event,
        domainEventMetadata: metadata
      });

      const services = getServices({
        app,
        metadata,
        readModel,
        modelStore,
        modelType,
        modelName
      });

      try {
        await eventListener(readModelAggregate, event, services);
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

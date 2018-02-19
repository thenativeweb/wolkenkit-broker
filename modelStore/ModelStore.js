'use strict';

const { EventEmitter } = require('events');

class ModelStore extends EventEmitter {
  constructor () {
    super();

    this.stores = {};
  }

  async initialize ({ application, eventSequencer, readModel, stores }) {
    if (!application) {
      throw new Error('Application is missing.');
    }
    if (!eventSequencer) {
      throw new Error('Event sequencer is missing.');
    }
    if (!readModel) {
      throw new Error('Read model is missing.');
    }
    if (!stores) {
      throw new Error('Stores are missing.');
    }

    this.eventSequencer = eventSequencer;
    this.stores = stores;

    await Promise.all(Object.keys(this.stores).map(storeType =>
      new Promise(async (resolve, reject) => {
        this.stores[storeType].on('disconnect', () => {
          this.emit('disconnect');
        });

        try {
          await this.stores[storeType].initialize({
            application,
            readModel: readModel[storeType]
          });
        } catch (ex) {
          return reject(ex);
        }

        resolve();
      })));
  }

  async processEvents (domainEvent, modelEvents) {
    if (!domainEvent) {
      throw new Error('Domain event is missing.');
    }
    if (!modelEvents) {
      throw new Error('Model events are missing.');
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

    await Promise.all(Object.keys(this.stores).map(storeType =>
      new Promise(async (resolve, reject) => {
        try {
          await this.processEventsInStore(this.stores[storeType], domainEvent, storeSpecificEvents[storeType]);
        } catch (ex) {
          return reject(ex);
        }

        resolve();
      })));
  }

  async processEventsInStore (store, domainEvent, modelEvents) {
    if (!store) {
      throw new Error('Store is missing.');
    }
    if (!domainEvent) {
      throw new Error('Domain event is missing.');
    }
    if (!modelEvents) {
      throw new Error('Model events are missing.');
    }

    for (let i = 0; i < modelEvents.length; i++) {
      const modelEvent = modelEvents[i];

      const lastProcessedPosition = this.eventSequencer.
        models[modelEvent.context.name][modelEvent.aggregate.name].
        lastProcessedPosition;

      if (domainEvent.metadata.position <= lastProcessedPosition) {
        continue;
      }

      await store[modelEvent.name]({
        modelName: modelEvent.aggregate.name,
        selector: modelEvent.data.selector,
        payload: modelEvent.data.payload
      });
    }

    await Promise.all(Object.keys(this.stores).map(storeType => new Promise(async (resolve, reject) => {
      try {
        await this.stores[storeType].updatePosition(domainEvent.metadata.position);
      } catch (ex) {
        return reject(ex);
      }

      resolve();
    })));
  }

  async read ({ modelType, modelName, query = {}}) {
    if (!modelType) {
      throw new Error('Model type is missing.');
    }
    if (!modelName) {
      throw new Error('Model name is missing.');
    }

    const stream = await this.stores[modelType].read({ modelType, modelName, query });

    return stream;
  }

  async readOne ({ modelType, modelName, query }) {
    if (!modelType) {
      throw new Error('Model type is missing.');
    }
    if (!modelName) {
      throw new Error('Model name is missing.');
    }
    if (!query) {
      throw new Error('Query is missing.');
    }
    if (!query.where) {
      throw new Error('Where is missing.');
    }

    const stream = await this.read({
      modelType,
      modelName,
      query: {
        where: query.where,
        take: 1
      }
    });

    const result = await new Promise((resolve, reject) => {
      const items = [];

      const onData = function (item) {
        items.push(item);
      };
      const onEnd = function () {
        stream.removeListener('data', onData);
        stream.removeListener('end', onEnd);

        const firstItem = items[0];

        if (!firstItem) {
          return reject(new Error('Item not found.'));
        }
        resolve(firstItem);
      };

      stream.on('data', onData);
      stream.once('end', onEnd);
    });

    return result;
  }
}

module.exports = ModelStore;

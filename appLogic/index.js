'use strict';

const { PassThrough, pipeline } = require('stream');

const FilterStream = require('./FilterStream'),
      getEventHandlingStrategies = require('./getEventHandlingStrategies'),
      getServicesForReadModelQueries = require('../services/getForReadModelQueries'),
      getServicesForWriteModelEventPreparation = require('../services/getForWriteModelEventPreparation'),
      MapStream = require('./MapStream');

const appLogic = function ({
  app,
  eventSequencer,
  eventStore,
  modelStore,
  writeModel,
  readModel
}) {
  if (!app) {
    throw new Error('App is missing.');
  }
  if (!eventSequencer) {
    throw new Error('Event sequencer is missing.');
  }
  if (!eventStore) {
    throw new Error('Event store is missing.');
  }
  if (!modelStore) {
    throw new Error('Model store is missing.');
  }
  if (!writeModel) {
    throw new Error('Write model is missing.');
  }
  if (!readModel) {
    throw new Error('Read model is missing.');
  }

  const logger = app.services.getLogger();

  const eventHandlingStrategies = getEventHandlingStrategies({ app, eventStore, modelStore, readModel });

  [
    { connection: app.commandbus.outgoing, description: 'command bus' },
    { connection: app.eventbus.incoming, description: 'event bus' },
    { connection: modelStore, description: 'model store' },
    { connection: eventStore, description: 'event store' }
  ].forEach(wire => {
    wire.connection.on('error', err => {
      app.fail(err);
    });
    wire.connection.on('disconnect', err => {
      logger.error(err.message, { err });
      app.fail(new Error(`Lost connection to ${wire.description}.`));
    });
  });

  app.api.read = async function ({
    modelType,
    modelName,
    metadata,
    query: { where, orderBy, skip, take }
  }) {
    if (!modelType) {
      throw new Error('Model type is missing.');
    }
    if (!modelName) {
      throw new Error('Model name is missing.');
    }
    if (!metadata) {
      throw new Error('Metadata are missing.');
    }
    if (!where) {
      throw new Error('Where is missing.');
    }
    if (!orderBy) {
      throw new Error('Order by is missing.');
    }
    if (skip === undefined) {
      throw new Error('Skip is missing.');
    }
    if (take === undefined) {
      throw new Error('Take is missing.');
    }

    const query = { where, orderBy, skip, take };
    const { queries } = readModel[modelType][modelName];

    const services = getServicesForReadModelQueries({
      app,
      metadata,
      readModel,
      modelStore,
      modelType,
      modelName
    });

    const incomingStream = await modelStore.read({ modelType, modelName, query });
    const transformStreams = [];

    const { isAuthorized, filter, map } = queries.readItem;

    transformStreams.push(new FilterStream({
      app,
      filter: async item => await isAuthorized(item, query, services)
    }));

    if (filter) {
      transformStreams.push(new FilterStream({
        app,
        filter: async item => await filter(item, query, services)
      }));
    }

    if (map) {
      transformStreams.push(new MapStream({
        app,
        map: async item => await map(item, query, services)
      }));
    }

    const outgoingStream = new PassThrough({ objectMode: true });

    pipeline(incomingStream, ...transformStreams, outgoingStream, () => {
      // Ignore any errors here, since pipeline cleans up, and we can't deliver
      // any more data to the client anyway (since the outgoing stream has been
      // destroyed by pipeline, or it has been closed by the client).
    });

    return outgoingStream;
  };

  app.api.prepareEventForForwarding = async function ({ event, metadata }) {
    if (event.type === 'readModel') {
      const { domainEvent, domainEventMetadata } = metadata;
      const { isAuthorized } = writeModel[domainEvent.context.name][domainEvent.aggregate.name].events[domainEvent.name];

      const aggregateInstance = new app.ReadableAggregate({
        writeModel,
        context: { name: domainEvent.context.name },
        aggregate: { name: domainEvent.aggregate.name, id: domainEvent.aggregate.id }
      });

      aggregateInstance.applySnapshot({
        revision: domainEvent.metadata.revision,
        state: domainEventMetadata.state
      });

      // Additionally, attach the previous state, and do this in the same way as
      // applySnapshot works.
      aggregateInstance.api.forReadOnly.previousState = domainEventMetadata.previousState;
      aggregateInstance.api.forEvents.previousState = domainEventMetadata.previousState;

      const services = getServicesForWriteModelEventPreparation({
        app,
        event: domainEvent,
        metadata,
        readModel,
        modelStore
      });

      let isDomainEventAuthorized;

      try {
        isDomainEventAuthorized = await isAuthorized(aggregateInstance.api.forReadOnly, domainEvent, services);
      } catch (ex) {
        logger.error('Is authorized failed.', {
          event: domainEvent,
          metadata: domainEventMetadata,
          ex
        });
        isDomainEventAuthorized = false;
      }

      if (!isDomainEventAuthorized) {
        return;
      }

      // Create a new read model event from the existing one, without the data
      // section.
      const filteredReadModelEvent = new app.Event({
        context: { name: event.context.name },
        aggregate: { name: event.aggregate.name, id: event.aggregate.id },
        name: 'updated',
        type: event.type,
        metadata: {
          correlationId: event.metadata.correlationId,
          causationId: event.metadata.causationId
        }
      });

      filteredReadModelEvent.addInitiator({ id: event.initiator.id });

      return filteredReadModelEvent;
    }

    const {
      isAuthorized,
      filter,
      map
    } = writeModel[event.context.name][event.aggregate.name].events[event.name];

    const aggregateInstance = new app.ReadableAggregate({
      writeModel,
      context: { name: event.context.name },
      aggregate: { name: event.aggregate.name, id: event.aggregate.id }
    });

    aggregateInstance.applySnapshot({
      revision: event.metadata.revision,
      state: metadata.state
    });

    // Additionally, attach the previous state, and do this in the same way as
    // applySnapshot works.
    aggregateInstance.api.forReadOnly.previousState = metadata.previousState;
    aggregateInstance.api.forEvents.previousState = metadata.previousState;

    const services = getServicesForWriteModelEventPreparation({
      app,
      event,
      metadata,
      readModel,
      modelStore
    });

    let isDomainEventAuthorized;

    try {
      isDomainEventAuthorized = await isAuthorized(aggregateInstance.api.forReadOnly, event, services);
    } catch (ex) {
      logger.error('Is authorized failed.', { event, metadata, ex });
      isDomainEventAuthorized = false;
    }

    if (!isDomainEventAuthorized) {
      return;
    }

    if (filter) {
      let keepEvent;

      try {
        keepEvent = await filter(aggregateInstance.api.forReadOnly, event, services);
      } catch (ex) {
        logger.error('Filter failed.', { event, metadata, ex });
        keepEvent = false;
      }

      if (!keepEvent) {
        return;
      }
    }

    let mappedEvent = event;

    if (map) {
      try {
        mappedEvent = await map(aggregateInstance.api.forReadOnly, event, services);
      } catch (ex) {
        logger.error('Map failed.', { event, metadata, ex });

        return;
      }
    }

    return mappedEvent;
  };

  app.api.incoming.on('data', ({ command, metadata }) => {
    logger.info('Received command.', { command, metadata });
    app.commandbus.outgoing.write({ command, metadata });
    logger.info('Sent command.', { command, metadata });
  });

  app.eventbus.incoming.on('data', async ({ event, metadata, actions }) => {
    logger.info('Received event.', { event, metadata });

    const strategy = eventSequencer.getStrategyFor(event);

    try {
      await eventHandlingStrategies[strategy.type]({ event, metadata, strategy });
    } catch (ex) {
      logger.error('Failed to handle event.', { event, metadata, ex });

      return actions.discard();
    }

    logger.info('Successfully handled event.', { event, metadata });
    actions.next();
  });
};

module.exports = appLogic;

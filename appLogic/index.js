'use strict';

const { PassThrough } = require('stream');

const getEventHandlingStrategies = require('./getEventHandlingStrategies');

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
    wire.connection.on('disconnect', () => {
      app.fail(new Error(`Lost connection to ${wire.description}.`));
    });
  });

  app.api.read = async function ({ modelType, modelName, user, query: { where, orderBy, skip, take }}) {
    if (!modelType) {
      throw new Error('Model type is missing.');
    }
    if (!modelName) {
      throw new Error('Model name is missing.');
    }
    if (!user) {
      throw new Error('User is missing.');
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

    const incomingStream = await modelStore.read({
      modelType,
      modelName,
      user,
      applyTransformations: true,
      query: { where, orderBy, skip, take }
    });

    // The outgoingStream is the stream that is used to send data to the
    // client over some push mechanism such as SSE or web sockets.
    const outgoingStream = new PassThrough({ objectMode: true });

    // When the client disconnects actively, we need to stop sending
    // results, hence we unpipe. This pauses the incomingStream, which
    // still may have unread data in it. Hence we need to resume it
    // to make sure that there are no unread data left in memory that
    // keeps the GC from removing the stream. Additionally, if the
    // incomingStream is a live stream, there is no one that will ever
    // call end() on the stream, hence we need to do it here to avoid
    // the stream to stay open forever.
    outgoingStream.once('finish', () => {
      incomingStream.unpipe(outgoingStream);
      incomingStream.resume();
    });

    // Now, start the actual work and pipe the results to the client.
    incomingStream.pipe(outgoingStream);

    return outgoingStream;
  };

  app.api.willPublishEvent = async function ({ event, metadata: { state, previousState, client }}) {
    if (event.type === 'readModel') {
      // TODO: isAuthorized für Liste? => readList statt readItem
      return event;
    }

    const {
      isAuthorized,
      filter,
      map
    } = writeModel[event.context.name][event.aggregate.name].events[event.name];

    const aggregateInstance = new app.ReadableAggregate({
      writeModel,
      content: { name: event.context.name },
      aggregate: { name: event.aggregate.name, id: event.aggregate.id }
    });

    aggregateInstance.applySnapshot({
      revision: event.metadata.revision,
      state
    });

    // Additionally, attach the previous state, and do this in the same way as
    // applySnapshot works.
    aggregateInstance.api.forReadOnly.previousState = previousState;
    aggregateInstance.api.forEvents.previousState = previousState;

    try {
      // TODO: Inject services ...
      if (!await isAuthorized(aggregateInstance, event, { client })) {
        return;
      }
    } catch (ex) {
      // Ignore the exception and return.
      // TODO: Log
      return;
    }

    // TODO: filter
    // TODO: map

    return event;
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

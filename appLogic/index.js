'use strict';

const { PassThrough } = require('stream');

const getEventHandlingStrategies = require('./getEventHandlingStrategies');

const appLogic = function ({ app, eventSequencer, eventStore, modelStore, readModel }) {
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

  app.api.read = async function (modelType, modelName, { where, orderBy, skip, take, user }) {
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
    if (!user) {
      throw new Error('User is missing.');
    }

    const incomingStream = await modelStore.read({
      modelType,
      modelName,
      applyTransformations: true,
      user,
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

  app.api.incoming.on('data', command => {
    logger.info('Received command.', command);
    app.commandbus.outgoing.write(command);
    logger.info('Sent command.', command);
  });

  app.eventbus.incoming.on('data', async domainEvent => {
    logger.info('Received event.', { domainEvent });

    const strategy = eventSequencer.getStrategyFor(domainEvent);

    try {
      await eventHandlingStrategies[strategy.type](domainEvent, strategy);
    } catch (ex) {
      logger.error('Failed to handle event.', { domainEvent, ex });

      return domainEvent.discard();
    }

    logger.info('Successfully handled event.', { domainEvent });
    domainEvent.next();
  });
};

module.exports = appLogic;

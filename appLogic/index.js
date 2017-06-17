'use strict';

const stream = require('stream');

const getEventHandlingStrategies = require('./getEventHandlingStrategies');

const PassThrough = stream.PassThrough;

const appLogic = function (options) {
  if (!options) {
    throw new Error('Options are missing.');
  }
  if (!options.app) {
    throw new Error('App is missing.');
  }
  if (!options.eventSequencer) {
    throw new Error('Event sequencer is missing.');
  }
  if (!options.eventStore) {
    throw new Error('Event store is missing.');
  }
  if (!options.modelStore) {
    throw new Error('Model store is missing.');
  }
  if (!options.readModel) {
    throw new Error('Read model is missing.');
  }

  const { app, eventSequencer, eventStore, modelStore, readModel } = options;
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

  app.api.read = function (modelType, modelName, readOptions, callback) {
    modelStore.read({
      modelType,
      modelName,
      query: {
        where: readOptions.where,
        orderBy: readOptions.orderBy,
        skip: readOptions.skip,
        take: readOptions.take
      }
    }, (err, incomingStream) => {
      if (err) {
        return callback(err);
      }

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

      callback(null, outgoingStream);
    });
  };

  app.api.incoming.on('data', command => {
    logger.info('Received command.', command);
    app.commandbus.outgoing.write(command);
    logger.info('Sent command.', command);
  });

  app.eventbus.incoming.on('data', domainEvent => {
    logger.info('Received event.', { domainEvent });

    const strategy = eventSequencer.getStrategyFor(domainEvent);

    eventHandlingStrategies[strategy.type](domainEvent, strategy, err => {
      if (err) {
        logger.error('Failed to handle event.', { domainEvent, err });

        return domainEvent.discard();
      }

      logger.info('Successfully handled event.', { domainEvent });
      domainEvent.next();
    });
  });
};

module.exports = appLogic;

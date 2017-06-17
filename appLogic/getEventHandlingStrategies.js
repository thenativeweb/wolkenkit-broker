'use strict';

const EventHandler = require('../EventHandler'),
      performReplay = require('./performReplay');

const getEventHandlingStrategies = function (options) {
  if (!options) {
    throw new Error('Options are missing.');
  }
  if (!options.app) {
    throw new Error('App is missing.');
  }
  if (!options.eventStore) {
    throw new Error('Event store is missing.');
  }
  if (!options.modelStore) {
    throw new Error('Model store is missing.');
  }

  const { app, eventStore, modelStore } = options;

  const eventHandler = new EventHandler(options),
        logger = app.services.getLogger();

  const strategies = {
    skip (domainEvent, strategy, callback) {
      logger.info('Skipped event.', domainEvent);
      callback(null);
    },

    replay (domainEvent, strategy, callback) {
      const { fromPosition, toPosition } = strategy;

      logger.info('Replaying events...', { fromPosition, toPosition });

      performReplay({
        eventStore,
        fromPosition,
        toPosition,
        handleReplayedDomainEvent (replayedDomainEvent, done) {
          const isLastEvent = replayedDomainEvent.metadata.position === domainEvent.metadata.position;

          strategies.proceed(replayedDomainEvent, { type: 'proceed', forward: isLastEvent }, done);
        }
      }, callback);
    },

    forward (domainEvent, strategy, callback) {
      app.api.outgoing.write(domainEvent);

      callback(null);
    },

    proceed (domainEvent, strategy, callback) {
      eventHandler.handle(domainEvent, (errHandle, modelEvents) => {
        if (errHandle) {
          return callback(errHandle);
        }

        modelStore.processEvents(domainEvent, modelEvents, errProcessEvents => {
          if (errProcessEvents) {
            return callback(errProcessEvents);
          }

          if (strategy.forward === false) {
            return callback(null);
          }

          app.api.outgoing.write(domainEvent);

          modelEvents.forEach(modelEvent => {
            app.api.outgoing.write(modelEvent);
          });

          callback(null);
        });
      });
    }
  };

  return strategies;
};

module.exports = getEventHandlingStrategies;

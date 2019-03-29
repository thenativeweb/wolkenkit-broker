'use strict';

const EventHandler = require('../EventHandler'),
      performReplay = require('./performReplay');

const getEventHandlingStrategies = function ({ app, eventStore, modelStore, readModel }) {
  if (!app) {
    throw new Error('App is missing.');
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

  const eventHandler = new EventHandler({ app, readModel, modelStore }),
        logger = app.services.getLogger();

  const strategies = {
    async skip (domainEvent) {
      logger.info('Skipped event.', domainEvent);
    },

    async replay (domainEvent, strategy) {
      const { fromPosition, toPosition } = strategy;

      logger.info('Replaying events...', { fromPosition, toPosition });

      await performReplay({
        eventStore,
        fromPosition,
        toPosition,
        async handleReplayedDomainEvent (replayedDomainEvent) {
          const isLastEvent = replayedDomainEvent.metadata.position === domainEvent.metadata.position;

          await strategies.proceed(replayedDomainEvent, { type: 'proceed', forward: isLastEvent });
        }
      });
    },

    async forward ({ event, metadata }) {
      app.api.outgoing.write({ event, metadata });
    },

    async proceed ({ event, metadata, strategy }) {
      const domainEvent = event;
      const modelEvents = await eventHandler.handle(domainEvent);

      await modelStore.processEvents(domainEvent, modelEvents);

      if (!strategy.forward) {
        return;
      }

      app.api.outgoing.write({ event: domainEvent, metadata });

      modelEvents.forEach(modelEvent => {
        const previousState = {},
              state = {};

        app.api.outgoing.write({ event: modelEvent, metadata: { previousState, state }});
      });
    }
  };

  return strategies;
};

module.exports = getEventHandlingStrategies;

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

    async replay ({ event, metadata, strategy }) {
      const domainEvent = event;
      const { fromPosition, toPosition } = strategy;

      logger.info('Replaying events...', { fromPosition, toPosition });

      await performReplay({
        eventStore,
        fromPosition,
        toPosition,
        async handleReplayedDomainEvent (replayedDomainEvent) {
          const isLastEvent = replayedDomainEvent.metadata.position === domainEvent.metadata.position;

          await strategies.proceed({
            event: replayedDomainEvent,
            metadata,
            strategy: { type: 'proceed', forward: isLastEvent }
          });
        }
      });
    },

    async forward ({ event, metadata }) {
      app.api.outgoing.write({ event, metadata });
    },

    async proceed ({ event, metadata, strategy }) {
      const modelEvents = await eventHandler.handle({ event, metadata });

      await modelStore.processEvents(event, modelEvents);

      if (!strategy.forward) {
        return;
      }

      await this.forward({ event, metadata });

      for (const modelEvent of modelEvents) {
        await this.forward({
          event: modelEvent.event,
          metadata: modelEvent.metadata
        });
      }
    }
  };

  return strategies;
};

module.exports = getEventHandlingStrategies;

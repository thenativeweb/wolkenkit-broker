'use strict';

const path = require('path');

const applicationManager = require('wolkenkit-application'),
      flaschenpost = require('flaschenpost'),
      getCorsOrigin = require('get-cors-origin'),
      processenv = require('processenv'),
      tailwind = require('tailwind');

const eventStore = require(`wolkenkit-eventstore/${processenv('EVENTSTORE_TYPE')}`);

const eventSequencer = require('./eventSequencer'),
      getEventHandlingStrategies = require('./appLogic/getEventHandlingStrategies'),
      { ListStore } = require('./modelStoreMongoDb'),
      logic = require('./appLogic'),
      modelStore = require('./modelStore'),
      performReplay = require('./appLogic/performReplay');

const loggerSystem = flaschenpost.getLogger();

(async () => {
  try {
    const identityProviders = processenv('IDENTITYPROVIDERS', []).
      map(identityProvider => ({
        issuer: identityProvider.issuer,
        certificate: path.join(identityProvider.certificate, 'certificate.pem')
      }));

    const app = tailwind.createApp({
      identityProviders,
      profiling: {
        host: processenv('PROFILING_HOST'),
        port: processenv('PROFILING_PORT')
      }
    });

    const applicationDirectory = path.join(app.dirname, 'app');
    const application = await applicationManager.load({ directory: applicationDirectory });

    const logger = app.services.getLogger();

    await modelStore.initialize({
      application: app.env('APPLICATION'),
      eventSequencer,
      readModel: application.readModel,
      stores: {
        lists: new ListStore({ url: app.env('LISTSTORE_URL'), eventSequencer })
      }
    });

    await eventStore.initialize({
      url: app.env('EVENTSTORE_URL'),
      namespace: `${app.env('APPLICATION')}domain`
    });

    await app.commandbus.use(new app.wires.commandbus.amqp.Sender({
      url: app.env('COMMANDBUS_URL'),
      application: app.env('APPLICATION')
    }));

    let lowestProcessedPosition;

    try {
      lowestProcessedPosition = eventSequencer.getLowestProcessedPosition();
    } catch (ex) {
      if (ex.message !== 'Failed to get lowest processed position.') {
        throw ex;
      }

      // Ignore if no lowest processed position could be gotten. This typically
      // happens when no read model was defined.
    }

    if (lowestProcessedPosition === undefined) {
      logger.info('Skipped replaying events.');
    } else {
      const fromPosition = lowestProcessedPosition + 1,
            toPosition = undefined;

      logger.info('Initially replaying events...', { fromPosition });

      const eventHandlingStrategies = getEventHandlingStrategies({
        app,
        eventStore,
        modelStore,
        readModel: application.readModel
      });

      await performReplay({
        eventStore,
        fromPosition,
        toPosition,
        async handleReplayedDomainEvent (replayedDomainEvent) {
          await eventHandlingStrategies.proceed({
            event: replayedDomainEvent,
            metadata: { state: {}, previousState: {}},
            strategy: { type: 'proceed', forward: false }
          });
        }
      });

      logger.info('Successfully replayed events.');
    }

    await app.eventbus.use(new app.wires.eventbus.amqp.Receiver({
      url: app.env('EVENTBUS_URL'),
      application: app.env('APPLICATION')
    }));

    await app.api.use(new app.wires.api.http.Server({
      clientRegistry: 'wolkenkit',
      port: app.env('API_PORT'),
      corsOrigin: getCorsOrigin(app.env('API_CORS_ORIGIN')),
      writeModel: application.configuration.writeModel,
      readModel: application.configuration.readModel,
      serveStatic: path.join(__dirname, 'node_modules', 'wolkenkit-api-shell', 'build')
    }));

    await app.status.use(new app.wires.status.http.Server({
      port: app.env('STATUS_PORT'),
      corsOrigin: app.env('STATUS_CORS_ORIGIN')
    }));

    logic({
      app,
      eventSequencer,
      eventStore,
      modelStore,
      writeModel: application.writeModel,
      readModel: application.readModel
    });
  } catch (ex) {
    loggerSystem.fatal('An unexpected error occured.', { err: ex });

    /* eslint-disable no-process-exit */
    process.exit(1);
    /* eslint-enable no-process-exit */
  }
})();

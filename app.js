'use strict';

const path = require('path');

const flaschenpost = require('flaschenpost'),
      processEnv = require('processenv'),
      tailwind = require('tailwind'),
      WolkenkitApplication = require('wolkenkit-application');

const eventStore = require(`wolkenkit-eventstore/${processEnv('EVENTSTORE_TYPE')}`);

const eventSequencer = require('./eventSequencer'),
      getCorsOrigin = require('./getCorsOrigin'),
      getEventHandlingStrategies = require('./appLogic/getEventHandlingStrategies'),
      { ListStore } = require('./modelStoreMongoDb'),
      logic = require('./appLogic'),
      modelStore = require('./modelStore'),
      performReplay = require('./appLogic/performReplay');

const loggerSystem = flaschenpost.getLogger();

(async () => {
  try {
    const app = tailwind.createApp({
      identityProvider: {
        /* eslint-disable no-process-env */
        name: process.env.IDENTITYPROVIDER_NAME,
        certificate: path.join(process.env.IDENTITYPROVIDER_CERTIFICATE, 'certificate.pem')
        /* eslint-enable no-process-env */
      },
      profiling: {
        host: processEnv('PROFILING_HOST'),
        port: processEnv('PROFILING_PORT')
      }
    });

    const applicationDirectory = path.join(app.dirname, 'app');
    const application = new WolkenkitApplication(applicationDirectory);

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

    const eventHandlingStrategies = getEventHandlingStrategies({ app, eventStore, modelStore, readModel: application.readModel });

    const fromPosition = eventSequencer.getLowestProcessedPosition() + 1,
          toPosition = undefined;

    logger.info('Initially replaying events...', { fromPosition });

    await performReplay({
      eventStore,
      fromPosition,
      toPosition,
      async handleReplayedDomainEvent (replayedDomainEvent) {
        await eventHandlingStrategies.proceed(replayedDomainEvent, { type: 'proceed', forward: false });
      }
    });

    logger.info('Successfully replayed events.');

    await app.eventbus.use(new app.wires.eventbus.amqp.Receiver({
      url: app.env('EVENTBUS_URL'),
      application: app.env('APPLICATION')
    }));

    await app.api.use(new app.wires.api.http.Server({
      keys: app.env('API_KEYS'),
      clientRegistry: 'wolkenkit',
      host: app.env('API_HOST'),
      port: app.env('API_PORT'),
      corsOrigin: getCorsOrigin(app.env('API_CORS_ORIGIN')),
      writeModel: application.configuration.writeModel,
      readModel: application.configuration.readModel
    }));

    await app.status.use(new app.wires.status.http.Server({
      port: app.env('STATUS_PORT'),
      corsOrigin: app.env('STATUS_CORS_ORIGIN')
    }));

    logic({ app, eventSequencer, eventStore, modelStore, readModel: application.readModel });
  } catch (ex) {
    loggerSystem.fatal('An unexpected error occured.', { err: ex });

    /* eslint-disable no-process-exit */
    process.exit(1);
    /* eslint-enable no-process-exit */
  }
})();

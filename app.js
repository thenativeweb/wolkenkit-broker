'use strict';

const path = require('path');

const processEnv = require('processenv'),
      tailwind = require('tailwind'),
      WolkenkitApplication = require('wolkenkit-application');

const eventStore = require(`sparbuch/${processEnv('EVENTSTORE_TYPE')}`);

const eventSequencer = require('./eventSequencer'),
      getCorsOrigin = require('./getCorsOrigin'),
      getEventHandlingStrategies = require('./appLogic/getEventHandlingStrategies'),
      ListStore = require('./modelStoreMongoDb').ListStore,
      logic = require('./appLogic'),
      modelStore = require('./modelStore'),
      performReplay = require('./appLogic/performReplay');

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

app.run([
  done => {
    modelStore.initialize({
      application: app.env('APPLICATION'),
      eventSequencer,
      readModel: application.readModel,
      stores: {
        lists: new ListStore({ url: app.env('LISTSTORE_URL'), eventSequencer })
      }
    }, done);
  },
  done => {
    eventStore.initialize({
      url: app.env('EVENTSTORE_URL'),
      namespace: `${app.env('APPLICATION')}domain`
    }, done);
  },
  done => {
    app.commandbus.use(new app.wires.commandbus.amqp.Sender({
      url: app.env('COMMANDBUS_URL'),
      application: app.env('APPLICATION')
    }), done);
  },
  done => {
    const eventHandlingStrategies = getEventHandlingStrategies({ app, eventStore, modelStore, readModel: application.readModel });

    const fromPosition = eventSequencer.getLowestProcessedPosition() + 1,
          toPosition = undefined;

    logger.info('Initially replaying events...', { fromPosition });

    performReplay({
      eventStore,
      fromPosition,
      toPosition,
      handleReplayedDomainEvent (replayedDomainEvent, cb) {
        eventHandlingStrategies.proceed(replayedDomainEvent, { type: 'proceed', forward: false }, cb);
      }
    }, errPerformReplay => {
      if (errPerformReplay) {
        return done(errPerformReplay);
      }

      logger.info('Successfully replayed events.');
      done(null);
    });
  },
  done => {
    app.eventbus.use(new app.wires.eventbus.amqp.Receiver({
      url: app.env('EVENTBUS_URL'),
      application: app.env('APPLICATION')
    }), done);
  },
  done => {
    app.api.use(new app.wires.api.http.Server({
      keys: app.env('API_KEYS'),
      clientRegistry: 'wolkenkit',
      host: app.env('API_HOST'),
      port: app.env('API_PORT'),
      portPublic: app.env('API_PORT_PUBLIC') || app.env('API_PORT'),
      corsOrigin: getCorsOrigin(app.env('API_CORS_ORIGIN')),
      writeModel: application.configuration.writeModel,
      readModel: application.configuration.readModel
    }), done);
  },
  () => {
    logic({ app, eventSequencer, eventStore, modelStore, readModel: application.readModel });
  }
]);

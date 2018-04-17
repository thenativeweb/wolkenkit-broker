'use strict';

const path = require('path'),
      util = require('util');

const assert = require('assertthat'),
      EventStore = require('wolkenkit-eventstore/dist/postgres/Eventstore'),
      hase = require('hase'),
      jsonLinesClient = require('json-lines-client'),
      request = require('superagent'),
      runfork = require('runfork'),
      shell = require('shelljs'),
      uuid = require('uuidv4');

const buildCommand = require('../shared/buildCommand'),
      buildEvent = require('../shared/buildEvent'),
      env = require('../shared/env'),
      issueToken = require('../shared/issueToken'),
      waitForMongo = require('../shared/waitForMongo'),
      waitForPostgres = require('../shared/waitForPostgres'),
      waitForRabbitMq = require('../shared/waitForRabbitMq');

const sleep = util.promisify(setTimeout);

const api = {};

api.sendCommand = async function (command) {
  const res = await request.
    post('https://localhost:3000/v1/command').
    send(command);

  return res;
};

api.subscribeToEvents = async function (options) {
  const server = await jsonLinesClient({
    protocol: 'https',
    host: 'localhost',
    port: 3000,
    path: '/v1/events',
    body: {}
  });

  let onData,
      onError;

  const unsubscribe = async function () {
    server.stream.removeListener('error', onError);
    server.stream.removeListener('data', onData);
    server.disconnect();

    await sleep(0.5 * 1000);
  };

  onData = async function (data) {
    await options.onData(data, unsubscribe);
  };

  onError = async function (err) {
    await unsubscribe();

    if (options.onError) {
      await options.onError(err);
    }
  };

  server.stream.on('data', onData);
  server.stream.on('error', onError);

  if (options.onConnect) {
    await options.onConnect();
  }
};

api.readModel = async function (options) {
  const query = {};

  if (options.query) {
    if (options.query.where) {
      query.where = JSON.stringify(options.query.where);
    }
    if (options.query.orderBy) {
      query.orderBy = JSON.stringify(options.query.orderBy);
    }
    query.take = options.query.take;
    query.skip = options.query.skip;
  }

  const server = await jsonLinesClient({
    protocol: 'https',
    host: 'localhost',
    port: 3000,
    path: `/v1/read/${options.modelType}/${options.modelName}`,
    query,
    headers: options.headers || {}
  });

  const result = await new Promise(async (resolve, reject) => {
    let onData,
        onEnd,
        onError;

    const records = [];

    const unsubscribe = async function () {
      server.stream.removeListener('data', onData);
      server.stream.removeListener('end', onEnd);
      server.stream.removeListener('error', onError);
      server.disconnect();

      await sleep(0.5 * 1000);
    };

    onData = function (data) {
      records.push(data);
    };

    onEnd = async function () {
      await unsubscribe();
      resolve(records);
    };

    onError = async function (err) {
      await unsubscribe();
      reject(err);
    };

    server.stream.on('data', onData);
    server.stream.on('end', onEnd);
    server.stream.on('error', onError);
  });

  return result;
};

suite('integrationTests', function () {
  this.timeout(15 * 1000);

  const application = 'plcr',
        namespace = 'plcrdomain';

  let commandbus,
      eventbus,
      eventStore,
      mq,
      stopApp;

  setup(async () => {
    const app = path.join(__dirname, '..', '..', 'app.js');

    eventStore = new EventStore();
    await eventStore.initialize({ url: env.POSTGRES_URL_INTEGRATION, namespace });

    mq = await hase.connect(env.RABBITMQ_URL_INTEGRATION);
    commandbus = await mq.worker('plcr::commands').createReadStream();
    eventbus = await mq.publisher('plcr::events').createWriteStream();

    await new Promise((resolve, reject) => {
      runfork({
        path: path.join(__dirname, '..', 'shared', 'runResetMongo.js'),
        env: {
          URL: env.MONGO_URL_INTEGRATION
        },
        onExit (exitCode) {
          if (exitCode > 0) {
            return reject(new Error('Failed to reset MongoDB.'));
          }
          resolve();
        }
      });
    });

    await new Promise((resolve, reject) => {
      runfork({
        path: path.join(__dirname, '..', 'shared', 'runResetPostgres.js'),
        env: {
          NAMESPACE: namespace,
          URL: env.POSTGRES_URL_INTEGRATION
        },
        onExit (exitCode) {
          if (exitCode > 0) {
            return reject(new Error('Failed to reset PostgreSQL.'));
          }
          resolve();
        }
      });
    });

    stopApp = runfork({
      path: app,
      env: {
        API_KEYS: path.join(__dirname, '..', 'shared', 'keys'),
        API_HOST: 'localhost',
        API_PORT: 3000,
        API_CORS_ORIGIN: '*',
        APPLICATION: application,
        COMMANDBUS_URL: env.RABBITMQ_URL_INTEGRATION,
        EVENTBUS_URL: env.RABBITMQ_URL_INTEGRATION,
        EVENTSTORE_TYPE: 'postgres',
        EVENTSTORE_URL: env.POSTGRES_URL_INTEGRATION,
        IDENTITYPROVIDER_CERTIFICATE: path.join(__dirname, '..', 'shared', 'keys'),
        IDENTITYPROVIDER_NAME: 'auth.wolkenkit.io',
        LISTSTORE_URL: env.MONGO_URL_INTEGRATION,
        PROFILING_HOST: 'localhost',
        PROFILING_PORT: 8125
      }
    });

    await sleep(2 * 1000);
  });

  teardown(async () => {
    try {
      await mq.connection.close();
    } catch (ex) {
      if (ex.message !== 'Connection closed (Error: Unexpected close)') {
        throw ex;
      }
    }

    await eventStore.destroy();
    await stopApp();
  });

  suite('infrastructure recovery', () => {
    test('exits when the connection to the command bus / event bus is lost.', async () => {
      shell.exec('docker kill rabbitmq-integration');

      await sleep(1 * 1000);

      await assert.that(async () => {
        await request.get('https://localhost:3000/v1/ping');
      }).is.throwingAsync(ex => ex.code === 'ECONNREFUSED');

      shell.exec('docker start rabbitmq-integration');
      await waitForRabbitMq({ url: env.RABBITMQ_URL_INTEGRATION });
    });

    test('exits when the connection to the event store is lost.', async () => {
      shell.exec('docker kill postgres-integration');

      await sleep(1 * 1000);

      await assert.that(async () => {
        await request.get('https://localhost:3000/v1/ping');
      }).is.throwingAsync(ex => ex.code === 'ECONNREFUSED');

      shell.exec('docker start postgres-integration');
      await waitForPostgres({ url: env.POSTGRES_URL_INTEGRATION });

      // We need to wait for a few seconds after having started
      // PostgreSQL, as it (for whatever reason) takes a long time
      // to actually become available. If we don't do a sleep here,
      // we run into "the database system is starting up" errors.
      await sleep(5 * 1000);
    });

    test('exits when the connection to a list store is lost.', async () => {
      shell.exec('docker kill mongodb-integration');

      await sleep(1 * 1000);

      await assert.that(async () => {
        await request.get('https://localhost:3000/v1/ping');
      }).is.throwingAsync(ex => ex.code === 'ECONNREFUSED');

      shell.exec('docker start mongodb-integration');
      await waitForMongo({ url: env.MONGO_URL_INTEGRATION });
    });
  });

  suite('commands', () => {
    test('passes a command from API to commandbus.', async () => {
      const command = buildCommand('planning', 'peerGroup', 'start', {
        initiator: 'John Doe',
        destination: 'Somewhere over the rainbow'
      });

      await new Promise(async (resolve, reject) => {
        try {
          commandbus.once('data', message => {
            try {
              const receivedCommand = message.payload;

              assert.that(receivedCommand.name).is.equalTo('start');
              message.next();
            } catch (ex) {
              return reject(ex);
            }
            resolve();
          });

          const res = await api.sendCommand(command);

          assert.that(res.statusCode).is.equalTo(200);
        } catch (ex) {
          reject(ex);
        }
      });
    });
  });

  suite('events', () => {
    test('passes domain events from the eventbus to the API.', async () => {
      const event = buildEvent('planning', 'peerGroup', 'started', {
        initiator: 'John Doe',
        destination: 'Somewhere over the rainbow'
      });

      await new Promise(async (resolve, reject) => {
        try {
          await api.subscribeToEvents({
            async onConnect () {
              eventbus.write(event);
            },
            async onData (receivedEvent, unsubscribe) {
              try {
                await unsubscribe();
                assert.that(receivedEvent.name).is.equalTo('started');
              } catch (ex) {
                return reject(ex);
              }
              resolve();
            },
            async onError (err) {
              reject(err);
            }
          });
        } catch (ex) {
          reject(ex);
        }
      });
    });

    test('delivers model events to the API.', async () => {
      const event = buildEvent('planning', 'peerGroup', 'started', {
        initiator: 'John Doe',
        destination: 'Somewhere over the rainbow'
      });

      let counter = 0;

      await new Promise(async (resolve, reject) => {
        try {
          await api.subscribeToEvents({
            async onConnect () {
              eventbus.write(event);
            },
            async onData (receivedEvent, unsubscribe) {
              try {
                counter += 1;

                switch (counter) {
                  case 1: {
                    assert.that(receivedEvent.type).is.equalTo('domain');
                    break;
                  }
                  case 2: {
                    assert.that(receivedEvent.type).is.equalTo('readModel');
                    assert.that(receivedEvent.aggregate.name).is.equalTo('peerGroups');
                    break;
                  }
                  case 3: {
                    assert.that(receivedEvent.type).is.equalTo('readModel');
                    assert.that(receivedEvent.aggregate.name).is.equalTo('tasteMakers');
                    await unsubscribe();
                    resolve();
                    break;
                  }
                  default: {
                    reject(new Error('Invalid operation.'));
                  }
                }
              } catch (ex) {
                reject(ex);
              }
            },
            async onError (err) {
              reject(err);
            }
          });
        } catch (ex) {
          reject(ex);
        }
      });
    });

    test('proceeds ...Rejected events.', async () => {
      const eventStartRejected = buildEvent('planning', 'peerGroup', 'startRejected', {
        reason: 'Something went wrong...'
      });

      Reflect.deleteProperty(eventStartRejected.metadata, 'position');

      await new Promise(async (resolve, reject) => {
        try {
          await api.subscribeToEvents({
            async onConnect () {
              eventbus.write(eventStartRejected);
            },
            async onData (receivedEvent, unsubscribe) {
              try {
                assert.that(receivedEvent.name).is.equalTo('startRejected');
                await unsubscribe();
              } catch (ex) {
                return reject(ex);
              }
              resolve();
            },
            async onError (err) {
              reject(err);
            }
          });
        } catch (ex) {
          reject(ex);
        }
      });
    });

    test('proceeds ...Failed events.', async () => {
      const eventStartFailed = buildEvent('planning', 'peerGroup', 'startFailed', {
        reason: 'Something went wrong...'
      });

      Reflect.deleteProperty(eventStartFailed.metadata, 'position');

      await new Promise(async (resolve, reject) => {
        try {
          await api.subscribeToEvents({
            async onConnect () {
              eventbus.write(eventStartFailed);
            },
            async onData (receivedEvent, unsubscribe) {
              try {
                assert.that(receivedEvent.name).is.equalTo('startFailed');
                await unsubscribe();
              } catch (ex) {
                return reject(ex);
              }
              resolve();
            },
            async onError (err) {
              reject(err);
            }
          });
        } catch (ex) {
          reject(ex);
        }
      });
    });

    test('skips events that had already been processed.', async () => {
      const eventStarted = buildEvent('planning', 'peerGroup', 'started', {
        initiator: 'John Doe',
        destination: 'Somewhere over the rainbow'
      });
      const eventFinished = buildEvent('integration', 'test', 'finished');

      eventStarted.metadata.position = 1;
      eventFinished.metadata.position = 2;

      await new Promise(async (resolve, reject) => {
        try {
          let counter = 0;

          await api.subscribeToEvents({
            async onConnect () {
              eventbus.write(eventStarted);
              eventbus.write(eventStarted);
              eventbus.write(eventFinished);
            },
            async onData (receivedEvent, unsubscribe) {
              try {
                if (receivedEvent.type !== 'domain') {
                  return;
                }

                counter += 1;

                if (receivedEvent.name === 'finished') {
                  assert.that(counter).is.equalTo(2);
                  await unsubscribe();
                  resolve();
                }
              } catch (ex) {
                reject(ex);
              }
            },
            async onError (err) {
              reject(err);
            }
          });
        } catch (ex) {
          reject(ex);
        }
      });
    });

    test('does not forward replayed events.', async () => {
      const aggregateId = uuid();

      const eventStarted = buildEvent('planning', 'peerGroup', aggregateId, 'started', {
        initiator: 'John Doe',
        destination: 'Somewhere over the rainbow'
      });
      const eventJoined1 = buildEvent('planning', 'peerGroup', aggregateId, 'joined', {
        participant: 'Jane Doe'
      });
      const eventJoined2 = buildEvent('planning', 'peerGroup', aggregateId, 'joined', {
        participant: 'Jenny Doe'
      });

      eventStarted.metadata.revision = 1;
      eventJoined1.metadata.revision = 2;
      eventJoined2.metadata.revision = 3;

      const savedEvents = await eventStore.saveEvents({
        events: [ eventStarted, eventJoined1, eventJoined2 ]
      });

      const lastPosition = savedEvents[2].metadata.position;

      eventJoined2.metadata.position = lastPosition;

      await new Promise(async (resolve, reject) => {
        try {
          await api.subscribeToEvents({
            async onConnect () {
              eventbus.write(eventJoined2);
            },
            async onData (receivedEvent, unsubscribe) {
              try {
                assert.that(receivedEvent.data.participant).is.equalTo('Jenny Doe');
                await unsubscribe();
              } catch (ex) {
                return reject(ex);
              }
              resolve();
            },
            async onError (err) {
              reject(err);
            }
          });
        } catch (ex) {
          reject(ex);
        }
      });
    });

    test('replays events for a new model.', async () => {
      const aggregateId = uuid();

      const eventStarted = buildEvent('planning', 'peerGroup', aggregateId, 'started', {
        initiator: 'John Doe',
        destination: 'Somewhere over the rainbow'
      });
      const eventJoined1 = buildEvent('planning', 'peerGroup', aggregateId, 'joined', {
        participant: 'Jane Doe'
      });
      const eventJoined2 = buildEvent('planning', 'peerGroup', aggregateId, 'joined', {
        participant: 'Jenny Doe'
      });

      eventStarted.metadata.revision = 1;
      eventJoined1.metadata.revision = 2;
      eventJoined2.metadata.revision = 3;

      const savedEvents = await eventStore.saveEvents({
        events: [ eventStarted, eventJoined1, eventJoined2 ]
      });

      const lastPosition = savedEvents[2].metadata.position;

      eventJoined2.metadata.position = lastPosition;

      await new Promise(async (resolve, reject) => {
        try {
          api.subscribeToEvents({
            async onConnect () {
              eventbus.write(eventJoined2);
            },
            async onData (receivedEvent, unsubscribe) {
              await unsubscribe();
              resolve();
            },
            async onError (err) {
              reject(err);
            }
          });
        } catch (ex) {
          reject(ex);
        }
      });

      const model = await api.readModel({
        modelType: 'lists',
        modelName: 'peerGroups'
      });

      assert.that(model.length).is.equalTo(1);
      assert.that(model[0].initiator).is.equalTo('John Doe');
      assert.that(model[0].destination).is.equalTo('Somewhere over the rainbow');
      assert.that(model[0].participants).is.equalTo([ 'Jane Doe', 'Jenny Doe' ]);
    });

    test('replays events for an existing model.', async () => {
      const aggregateId = uuid();

      const eventStarted = buildEvent('planning', 'peerGroup', aggregateId, 'started', {
        initiator: 'John Doe',
        destination: 'Somewhere over the rainbow'
      });
      const eventJoined1 = buildEvent('planning', 'peerGroup', aggregateId, 'joined', {
        participant: 'Jane Doe'
      });
      const eventJoined2 = buildEvent('planning', 'peerGroup', aggregateId, 'joined', {
        participant: 'Jenny Doe'
      });
      const eventJoined3 = buildEvent('planning', 'peerGroup', aggregateId, 'joined', {
        participant: 'Jim Doe'
      });

      eventStarted.metadata.revision = 1;
      eventJoined1.metadata.revision = 2;
      eventJoined2.metadata.revision = 3;
      eventJoined3.metadata.revision = 4;

      let savedEvents = await eventStore.saveEvents({
        events: [ eventStarted, eventJoined1 ]
      });

      let lastPosition = savedEvents[1].metadata.position;

      eventJoined1.metadata.position = lastPosition;

      await new Promise(async (resolve, reject) => {
        try {
          await api.subscribeToEvents({
            async onConnect () {
              eventbus.write(eventJoined1);
            },
            async onData (receivedEvent, unsubscribe) {
              try {
                if (receivedEvent.metadata.correlatationId === eventJoined1.metadata.correlatationId) {
                  await unsubscribe();
                  resolve();
                }
              } catch (ex) {
                reject(ex);
              }
            },
            async onError (err) {
              reject(err);
            }
          });
        } catch (ex) {
          reject(ex);
        }
      });

      savedEvents = await eventStore.saveEvents({
        events: [ eventJoined2, eventJoined3 ]
      });

      lastPosition = savedEvents[1].metadata.position;

      eventJoined3.metadata.position = lastPosition;

      await new Promise(async (resolve, reject) => {
        try {
          await api.subscribeToEvents({
            async onConnect () {
              eventbus.write(eventJoined3);
            },
            async onData (receivedEvent, unsubscribe) {
              try {
                if (receivedEvent.metadata.correlatationId === eventJoined3.metadata.correlatationId) {
                  await unsubscribe();
                  resolve();
                }
              } catch (ex) {
                reject(ex);
              }
            },
            async onError (err) {
              reject(err);
            }
          });
        } catch (ex) {
          reject(ex);
        }
      });

      const model = await api.readModel({
        modelType: 'lists',
        modelName: 'peerGroups'
      });

      assert.that(model.length).is.equalTo(1);
      assert.that(model[0].initiator).is.equalTo('John Doe');
      assert.that(model[0].destination).is.equalTo('Somewhere over the rainbow');
      assert.that(model[0].participants).is.equalTo([ 'Jane Doe', 'Jenny Doe', 'Jim Doe' ]);
    });
  });

  suite('models', () => {
    suite('reading', () => {
      setup(async () => {
        const eventFirst = buildEvent('planning', 'peerGroup', 'started', {
          initiator: 'John Doe',
          destination: 'Somewhere over the rainbow'
        });
        const eventSecond = buildEvent('planning', 'peerGroup', 'started', {
          initiator: 'Jane Doe',
          destination: 'Land of Oz'
        });

        eventFirst.metadata.position = 1;
        eventSecond.metadata.position = 2;

        eventbus.write(eventFirst);
        eventbus.write(eventSecond);

        await sleep(0.1 * 1000);
      });

      test('throws an error when the model name does not exist.', async () => {
        await assert.that(async () => {
          await api.readModel({
            modelType: 'lists',
            modelName: 'foo'
          });
        }).is.throwingAsync();
      });

      test('returns a stream that the requested model\'s data is written to.', async () => {
        const model = await api.readModel({
          modelType: 'lists',
          modelName: 'peerGroups'
        });

        assert.that(model.length).is.equalTo(2);
      });

      test('returns a stream that the requested model\'s data is written to filtered by the given selector.', async () => {
        const model = await api.readModel({
          modelType: 'lists',
          modelName: 'peerGroups',
          query: {
            where: { initiator: 'Jane Doe' }
          }
        });

        assert.that(model.length).is.equalTo(1);
        assert.that(model[0].initiator).is.equalTo('Jane Doe');
      });

      test('returns a stream that is limited to the number of requested documents.', async () => {
        const model = await api.readModel({
          modelType: 'lists',
          modelName: 'peerGroups',
          query: {
            take: 1
          }
        });

        assert.that(model.length).is.equalTo(1);
        assert.that(model[0].initiator).is.equalTo('John Doe');
      });

      test('returns a stream that skips the specified number of documents.', async () => {
        const model = await api.readModel({
          modelType: 'lists',
          modelName: 'peerGroups',
          query: {
            skip: 1
          }
        });

        assert.that(model.length).is.equalTo(1);
        assert.that(model[0].initiator).is.equalTo('Jane Doe');
      });

      test('returns a stream that is sorted by the specified criteria.', async () => {
        const model = await api.readModel({
          modelType: 'lists',
          modelName: 'peerGroups',
          query: {
            orderBy: { initiator: 'asc' }
          }
        });

        assert.that(model.length).is.equalTo(2);
        assert.that(model[0].initiator).is.equalTo('Jane Doe');
        assert.that(model[1].initiator).is.equalTo('John Doe');
      });

      test('streams the data as JSON items.', async () => {
        const model = await api.readModel({
          modelType: 'lists',
          modelName: 'peerGroups',
          query: {
            where: { initiator: 'Jane Doe' }
          }
        });

        assert.that(model.length).is.equalTo(1);
        assert.that(model[0].initiator).is.equalTo('Jane Doe');
        assert.that(model[0].destination).is.equalTo('Land of Oz');
        assert.that(model[0].participants).is.equalTo([]);
      });

      test('closes the stream once all data have been sent.', async () => {
        const server = await jsonLinesClient({
          protocol: 'https',
          host: 'localhost',
          port: 3000,
          path: `/v1/read/lists/peerGroups`
        });

        await new Promise(resolve => {
          server.stream.once('end', () => {
            resolve();
          });

          server.stream.resume();
        });
      });

      test('handles external stream closing gracefully.', async () => {
        const server = await jsonLinesClient({
          protocol: 'https',
          host: 'localhost',
          port: 3000,
          path: `/v1/read/lists/peerGroups`
        });

        server.disconnect();

        // Now that we forced the stream to be closed, let's wait for some time
        // to make sure that the app is still running.
        await sleep(1 * 1000);

        const res = await request.get('https://localhost:3000/v1/ping');

        assert.that(res.statusCode).is.equalTo(200);
      });
    });

    suite('authorized reading', () => {
      let eventForAuthenticated,
          eventForOwner,
          eventForPublic;

      setup(async () => {
        eventForOwner = buildEvent('planning', 'peerGroup', 'started', {
          initiator: 'Jane Doe',
          destination: 'Somewhere over the rainbow'
        });
        eventForAuthenticated = buildEvent('planning', 'peerGroup', 'started', {
          initiator: 'John Doe',
          destination: 'Land of Oz'
        });
        eventForPublic = buildEvent('planning', 'peerGroup', 'started', {
          initiator: 'Jenny Doe',
          destination: 'Fantasia'
        });

        eventForOwner.metadata.isAuthorized.forAuthenticated = false;
        eventForOwner.metadata.isAuthorized.forPublic = false;
        eventForOwner.metadata.position = 1;
        eventForAuthenticated.metadata.isAuthorized.forAuthenticated = true;
        eventForAuthenticated.metadata.isAuthorized.forPublic = false;
        eventForAuthenticated.metadata.position = 2;
        eventForPublic.metadata.isAuthorized.forAuthenticated = true;
        eventForPublic.metadata.isAuthorized.forPublic = true;
        eventForPublic.metadata.position = 3;

        eventbus.write(eventForOwner);
        eventbus.write(eventForAuthenticated);
        eventbus.write(eventForPublic);

        await sleep(0.1 * 1000);
      });

      test('reads items for public users.', async () => {
        const model = await api.readModel({
          modelType: 'lists',
          modelName: 'peerGroups'
        });

        assert.that(model.length).is.equalTo(1);
        assert.that(model[0].initiator).is.equalTo('Jenny Doe');
      });

      test('reads items for authenticated users.', async () => {
        const model = await api.readModel({
          modelType: 'lists',
          modelName: 'peerGroups',
          headers: {
            authorization: `Bearer ${issueToken(uuid())}`
          }
        });

        assert.that(model.length).is.equalTo(2);
        assert.that(model[0].initiator).is.equalTo('John Doe');
        assert.that(model[1].initiator).is.equalTo('Jenny Doe');
      });

      test('reads items for owners.', async () => {
        const model = await api.readModel({
          modelType: 'lists',
          modelName: 'peerGroups',
          headers: {
            authorization: `Bearer ${issueToken(eventForOwner.metadata.isAuthorized.owner)}`
          }
        });

        assert.that(model.length).is.equalTo(3);
        assert.that(model[0].initiator).is.equalTo('Jane Doe');
        assert.that(model[1].initiator).is.equalTo('John Doe');
        assert.that(model[2].initiator).is.equalTo('Jenny Doe');
      });
    });
  });
});

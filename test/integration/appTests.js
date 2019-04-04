'use strict';

const path = require('path'),
      util = require('util');

const assert = require('assertthat'),
      EventStore = require('wolkenkit-eventstore/lib/postgres/Eventstore'),
      hase = require('hase'),
      jsonLinesClient = require('json-lines-client'),
      noop = require('lodash/noop'),
      request = require('superagent'),
      runfork = require('runfork'),
      shell = require('shelljs'),
      toArray = require('streamtoarray'),
      uuid = require('uuidv4');

const buildCommand = require('../shared/buildCommand'),
      buildEvent = require('../shared/buildEvent'),
      env = require('../shared/env'),
      issueToken = require('../shared/issueToken'),
      waitForMongo = require('../shared/waitForMongo'),
      waitForPostgres = require('../shared/waitForPostgres'),
      waitForRabbitMq = require('../shared/waitForRabbitMq');

const sleep = util.promisify(setTimeout);

const isDebugMode = true;

const api = {};

api.sendCommand = async function (command) {
  const res = await request.
    post('http://localhost:3000/v1/command').
    send(command);

  return res;
};

api.subscribeToEvents = async function ({
  user,
  onConnect = noop,
  onData,
  onError = noop
}) {
  const headers = {};

  if (user) {
    headers.authorization = `Bearer ${issueToken(user.id)}`;
  }

  const server = await jsonLinesClient({
    protocol: 'http',
    host: 'localhost',
    port: 3000,
    path: '/v1/events',
    body: {},
    headers
  });

  process.nextTick(async () => await onConnect());

  let keepReceivingEvents = true;

  try {
    for await (const data of server.stream) {
      /* eslint-disable no-loop-func */
      await onData(data, () => {
        keepReceivingEvents = false;
      });
      /* eslint-enable no-loop-func */

      if (!keepReceivingEvents) {
        server.disconnect();
        break;
      }
    }
  } catch (ex) {
    server.disconnect();
    await onError(ex);
  } finally {
    await sleep(0.5 * 1000);
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
    protocol: 'http',
    host: 'localhost',
    port: 3000,
    path: `/v1/read/${options.modelType}/${options.modelName}`,
    query,
    headers: options.headers || {}
  });

  const result = await toArray(server.stream);

  server.disconnect();
  await sleep(0.5 * 1000);

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
      stopApp,
      tokens,
      users;

  setup(async () => {
    const app = path.join(__dirname, '..', '..', 'app.js');

    eventStore = new EventStore();
    await eventStore.initialize({ url: env.POSTGRES_URL_INTEGRATION, namespace });

    mq = await hase.connect({ url: env.RABBITMQ_URL_INTEGRATION });
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
        API_PORT: 3000,
        API_CORS_ORIGIN: '*',
        APPLICATION: application,
        COMMANDBUS_URL: env.RABBITMQ_URL_INTEGRATION,
        EVENTBUS_URL: env.RABBITMQ_URL_INTEGRATION,
        EVENTSTORE_TYPE: 'postgres',
        EVENTSTORE_URL: env.POSTGRES_URL_INTEGRATION,
        IDENTITYPROVIDERS: `[{"issuer":"https://auth.thenativeweb.io","certificate":"${path.join(__dirname, '..', 'shared', 'keys')}"}]`,
        LISTSTORE_URL: env.MONGO_URL_INTEGRATION,
        PROFILING_HOST: 'localhost',
        PROFILING_PORT: 8125,
        STATUS_PORT: 3001,
        STATUS_CORS_ORIGIN: '*'
      },
      silent: !isDebugMode
    });

    tokens = {
      jane: { sub: uuid() },
      public: { sub: 'anonymous' }
    };
    users = {
      jane: { id: tokens.jane.sub, token: tokens.jane },
      public: { id: tokens.public.sub, token: tokens.public }
    };

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
              const receivedCommand = message.payload.command,
                    receivedMetadata = message.payload.metadata;

              assert.that(receivedCommand.name).is.equalTo('start');
              assert.that(receivedMetadata).is.atLeast({
                client: {
                  user: {
                    id: 'anonymous',
                    token: { sub: 'anonymous' }
                  }
                }
              });
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

      event.addInitiator(users.jane);

      await new Promise(async (resolve, reject) => {
        try {
          await api.subscribeToEvents({
            async onConnect () {
              eventbus.write({ event, metadata: { state: {}, previousState: {}}});
            },
            async onData (receivedEvent, unsubscribe) {
              unsubscribe();
              assert.that(receivedEvent.name).is.equalTo('started');
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

      event.addInitiator(users.jane);

      let counter = 0;

      await new Promise(async (resolve, reject) => {
        try {
          await api.subscribeToEvents({
            async onConnect () {
              eventbus.write({ event, metadata: { state: {}, previousState: {}}});
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
                    break;
                  }
                  case 3: {
                    assert.that(receivedEvent.type).is.equalTo('readModel');
                    break;
                  }
                  case 4: {
                    assert.that(receivedEvent.type).is.equalTo('readModel');
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

    test(`downplays read model events by removing their data and marking them as 'updated'.`, async () => {
      const event = buildEvent('planning', 'peerGroup', 'started', {
        initiator: 'John Doe',
        destination: 'Somewhere over the rainbow'
      });

      event.addInitiator(users.jane);

      let counter = 0;

      await new Promise(async (resolve, reject) => {
        try {
          await api.subscribeToEvents({
            async onConnect () {
              eventbus.write({ event, metadata: { state: {}, previousState: {}}});
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
                    assert.that(receivedEvent).is.atLeast({
                      context: { name: 'lists' },
                      aggregate: { name: 'peerGroups', id: '00000000-0000-0000-0000-000000000000' },
                      name: 'updated',
                      type: 'readModel',
                      initiator: { id: users.jane.id }
                    });
                    assert.that(receivedEvent.data).is.equalTo({});
                    break;
                  }
                  case 3: {
                    assert.that(receivedEvent).is.atLeast({
                      context: { name: 'lists' },
                      aggregate: { name: 'peerGroupsForAuthenticated', id: '00000000-0000-0000-0000-000000000000' },
                      name: 'updated',
                      type: 'readModel',
                      initiator: { id: users.jane.id }
                    });
                    assert.that(receivedEvent.data).is.equalTo({});
                    break;
                  }
                  case 4: {
                    assert.that(receivedEvent).is.atLeast({
                      context: { name: 'lists' },
                      aggregate: { name: 'peerGroupsWithFilter', id: '00000000-0000-0000-0000-000000000000' },
                      name: 'updated',
                      type: 'readModel',
                      initiator: { id: users.jane.id }
                    });
                    assert.that(receivedEvent.data).is.equalTo({});
                    break;
                  }
                  case 5: {
                    assert.that(receivedEvent).is.atLeast({
                      context: { name: 'lists' },
                      aggregate: { name: 'peerGroupsWithMap', id: '00000000-0000-0000-0000-000000000000' },
                      name: 'updated',
                      type: 'readModel',
                      initiator: { id: users.jane.id }
                    });
                    assert.that(receivedEvent.data).is.equalTo({});
                    break;
                  }
                  case 6: {
                    assert.that(receivedEvent).is.atLeast({
                      context: { name: 'lists' },
                      aggregate: { name: 'tasteMakers', id: '00000000-0000-0000-0000-000000000000' },
                      name: 'updated',
                      type: 'readModel',
                      initiator: { id: users.jane.id }
                    });
                    assert.that(receivedEvent.data).is.equalTo({});
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

      eventStartRejected.addInitiator(users.public);

      Reflect.deleteProperty(eventStartRejected.metadata, 'position');

      await new Promise(async (resolve, reject) => {
        try {
          await api.subscribeToEvents({
            async onConnect () {
              eventbus.write({
                event: eventStartRejected,
                metadata: { state: {}, previousState: {}}
              });
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

      eventStartFailed.addInitiator(users.public);

      Reflect.deleteProperty(eventStartFailed.metadata, 'position');

      await new Promise(async (resolve, reject) => {
        try {
          await api.subscribeToEvents({
            async onConnect () {
              eventbus.write({
                event: eventStartFailed,
                metadata: { state: {}, previousState: {}}
              });
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
      const aggregateId = uuid();

      const eventStarted = buildEvent('planning', 'peerGroup', aggregateId, 'started', {
        initiator: 'John Doe',
        destination: 'Somewhere over the rainbow'
      });
      const eventJoined = buildEvent('planning', 'peerGroup', aggregateId, 'joined', {
        participant: 'Jane Doe'
      });

      eventStarted.metadata.position = 1;
      eventJoined.metadata.position = 2;

      eventStarted.addInitiator(users.jane);
      eventJoined.addInitiator(users.jane);

      await new Promise(async (resolve, reject) => {
        try {
          let counter = 0;

          await api.subscribeToEvents({
            async onConnect () {
              eventbus.write({
                event: eventStarted,
                metadata: { state: {}, previousState: {}}
              });
              eventbus.write({
                event: eventStarted,
                metadata: { state: {}, previousState: {}}
              });
              eventbus.write({
                event: eventJoined,
                metadata: { state: {}, previousState: {}}
              });
            },
            async onData (receivedEvent, unsubscribe) {
              try {
                if (receivedEvent.type !== 'domain') {
                  return;
                }

                counter += 1;

                if (receivedEvent.name === 'joined') {
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

      eventStarted.addInitiator(users.jane);
      eventJoined1.addInitiator(users.jane);
      eventJoined2.addInitiator(users.jane);

      const savedEvents = await eventStore.saveEvents({
        uncommittedEvents: [
          { event: eventStarted, state: {}},
          { event: eventJoined1, state: {}},
          { event: eventJoined2, state: {}}
        ]
      });

      const lastPosition = savedEvents[2].event.metadata.position;

      eventJoined2.metadata.position = lastPosition;

      await new Promise(async (resolve, reject) => {
        try {
          await api.subscribeToEvents({
            async onConnect () {
              eventbus.write({
                event: eventJoined2,
                metadata: { state: {}, previousState: {}}
              });
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

      eventStarted.addInitiator(users.jane);
      eventJoined1.addInitiator(users.jane);
      eventJoined2.addInitiator(users.jane);

      const savedEvents = await eventStore.saveEvents({
        uncommittedEvents: [
          { event: eventStarted, state: {}},
          { event: eventJoined1, state: {}},
          { event: eventJoined2, state: {}}
        ]
      });

      const lastPosition = savedEvents[2].event.metadata.position;

      eventJoined2.metadata.position = lastPosition;

      await new Promise(async (resolve, reject) => {
        try {
          api.subscribeToEvents({
            async onConnect () {
              eventbus.write({
                event: eventJoined2,
                metadata: { state: {}, previousState: {}}
              });
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

      eventStarted.addInitiator(users.jane);
      eventJoined1.addInitiator(users.jane);
      eventJoined2.addInitiator(users.jane);
      eventJoined3.addInitiator(users.jane);

      let savedEvents = await eventStore.saveEvents({
        uncommittedEvents: [
          { event: eventStarted, state: {}},
          { event: eventJoined1, state: {}}
        ]
      });

      let lastPosition = savedEvents[1].event.metadata.position;

      eventJoined1.metadata.position = lastPosition;

      await new Promise(async (resolve, reject) => {
        try {
          await api.subscribeToEvents({
            async onConnect () {
              eventbus.write({
                event: eventJoined1,
                metadata: { state: {}, previousState: {}}
              });
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
        uncommittedEvents: [
          { event: eventJoined2, state: {}},
          { event: eventJoined3, state: {}}
        ]
      });

      lastPosition = savedEvents[1].event.metadata.position;

      eventJoined3.metadata.position = lastPosition;

      await new Promise(async (resolve, reject) => {
        try {
          await api.subscribeToEvents({
            async onConnect () {
              eventbus.write({
                event: eventJoined3,
                metadata: { state: {}, previousState: {}}
              });
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

    suite('map', () => {
      test('maps events (in this example, for anonymous users).', async () => {
        const event = buildEvent('planning', 'peerGroup', 'startedWithMap', {
          initiator: 'John Doe',
          destination: 'Somewhere over the rainbow'
        });

        event.addInitiator(users.jane);

        await new Promise(async (resolve, reject) => {
          try {
            await api.subscribeToEvents({
              async onConnect () {
                eventbus.write({ event, metadata: { state: {}, previousState: {}}});
              },
              async onData (receivedEvent, unsubscribe) {
                unsubscribe();
                assert.that(receivedEvent.name).is.equalTo('startedWithMap');
                assert.that(receivedEvent.data.initiator).is.undefined();
                assert.that(receivedEvent.data.destination).is.equalTo('Somewhere over the rainbow');
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

      test('does not map events (in this example, for authenticated users).', async () => {
        const event = buildEvent('planning', 'peerGroup', 'startedWithMap', {
          initiator: 'John Doe',
          destination: 'Somewhere over the rainbow'
        });

        event.addInitiator(users.jane);

        await new Promise(async (resolve, reject) => {
          try {
            await api.subscribeToEvents({
              user: users.jane,
              async onConnect () {
                eventbus.write({ event, metadata: { state: {}, previousState: {}}});
              },
              async onData (receivedEvent, unsubscribe) {
                unsubscribe();
                assert.that(receivedEvent.name).is.equalTo('startedWithMap');
                assert.that(receivedEvent.data.initiator).is.equalTo('John Doe');
                assert.that(receivedEvent.data.destination).is.equalTo('Somewhere over the rainbow');
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
    });

    suite('filter', () => {
      test('filters events (in this example, for anonymous users).', async () => {
        const eventWithBadWord = buildEvent('planning', 'peerGroup', 'startedWithFilter', {
          initiator: 'John Doe',
          destination: 'This destination contains a bad-word.'
        });
        const eventWithoutBadWord = buildEvent('planning', 'peerGroup', 'startedWithFilter', {
          initiator: 'John Doe',
          destination: 'This destination contains only happy words.'
        });

        eventWithBadWord.metadata.position = 1;
        eventWithoutBadWord.metadata.position = 2;

        eventWithBadWord.addInitiator(users.jane);
        eventWithoutBadWord.addInitiator(users.jane);

        await new Promise(async (resolve, reject) => {
          try {
            await api.subscribeToEvents({
              async onConnect () {
                eventbus.write({ event: eventWithBadWord, metadata: { state: {}, previousState: {}}});
                eventbus.write({ event: eventWithoutBadWord, metadata: { state: {}, previousState: {}}});
              },
              async onData (receivedEvent, unsubscribe) {
                unsubscribe();
                assert.that(receivedEvent.name).is.equalTo('startedWithFilter');
                assert.that(receivedEvent.data.initiator).is.equalTo('John Doe');
                assert.that(receivedEvent.data.destination).is.equalTo('This destination contains only happy words.');
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

      test('does not filter events (in this example, for authenticated users).', async () => {
        const event = buildEvent('planning', 'peerGroup', 'startedWithFilter', {
          initiator: 'John Doe',
          destination: 'This destination contains a bad-word.'
        });

        event.addInitiator(users.jane);

        await new Promise(async (resolve, reject) => {
          try {
            await api.subscribeToEvents({
              user: users.jane,
              async onConnect () {
                eventbus.write({ event, metadata: { state: {}, previousState: {}}});
              },
              async onData (receivedEvent, unsubscribe) {
                unsubscribe();
                assert.that(receivedEvent.name).is.equalTo('startedWithFilter');
                assert.that(receivedEvent.data.initiator).is.equalTo('John Doe');
                assert.that(receivedEvent.data.destination).is.equalTo('This destination contains a bad-word.');
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

        eventFirst.addInitiator(users.jane);
        eventSecond.addInitiator(users.jane);

        eventbus.write({
          event: eventFirst,
          metadata: { state: {}, previousState: {}}
        });
        eventbus.write({
          event: eventSecond,
          metadata: { state: {}, previousState: {}}
        });

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
          protocol: 'http',
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
          protocol: 'http',
          host: 'localhost',
          port: 3000,
          path: `/v1/read/lists/peerGroups`
        });

        server.disconnect();

        // Now that we forced the stream to be closed, let's wait for some time
        // to make sure that the app is still running.
        await sleep(1 * 1000);

        const res = await request.get('http://localhost:3000/v1/ping');

        assert.that(res.statusCode).is.equalTo(200);
      });

      suite('map', () => {
        test('maps items (in this example, for anonymous users).', async () => {
          const model = await api.readModel({
            modelType: 'lists',
            modelName: 'peerGroupsWithMap'
          });

          assert.that(model.length).is.equalTo(2);
          assert.that(model[0].initiator).is.undefined();
          assert.that(model[0].destination).is.equalTo('Somewhere over the rainbow');
          assert.that(model[0].participants).is.undefined();
          assert.that(model[1].initiator).is.undefined();
          assert.that(model[1].destination).is.equalTo('Land of Oz');
          assert.that(model[1].participants).is.undefined();
        });

        test('does not map items (in this example, for authenticated users).', async () => {
          const model = await api.readModel({
            modelType: 'lists',
            modelName: 'peerGroupsWithMap',
            headers: {
              authorization: `Bearer ${issueToken('jane.doe')}`
            }
          });

          assert.that(model.length).is.equalTo(2);
          assert.that(model[0].initiator).is.equalTo('John Doe');
          assert.that(model[0].destination).is.equalTo('Somewhere over the rainbow');
          assert.that(model[0].participants).is.equalTo([]);
          assert.that(model[1].initiator).is.equalTo('Jane Doe');
          assert.that(model[1].destination).is.equalTo('Land of Oz');
          assert.that(model[1].participants).is.equalTo([]);
        });
      });

      suite('filter', () => {
        setup(async () => {
          const startedWithBadWord = buildEvent('planning', 'peerGroup', 'started', {
            initiator: 'Jane Doe',
            destination: 'This destination contains a bad-word.'
          });

          startedWithBadWord.metadata.position = 3;

          startedWithBadWord.addInitiator(users.jane);

          eventbus.write({
            event: startedWithBadWord,
            metadata: { state: {}, previousState: {}}
          });

          await sleep(0.1 * 1000);
        });

        test('filters items (in this example, for anonymous users).', async () => {
          const model = await api.readModel({
            modelType: 'lists',
            modelName: 'peerGroupsWithFilter'
          });

          assert.that(model.length).is.equalTo(2);
          assert.that(model[0].initiator).is.equalTo('John Doe');
          assert.that(model[0].destination).is.equalTo('Somewhere over the rainbow');
          assert.that(model[0].participants).is.equalTo([]);
          assert.that(model[1].initiator).is.equalTo('Jane Doe');
          assert.that(model[1].destination).is.equalTo('Land of Oz');
          assert.that(model[1].participants).is.equalTo([]);
        });

        test('does not filter items (in this example, for authenticated users).', async () => {
          const model = await api.readModel({
            modelType: 'lists',
            modelName: 'peerGroupsWithFilter',
            headers: {
              authorization: `Bearer ${issueToken('jane.doe')}`
            }
          });

          assert.that(model.length).is.equalTo(3);
          assert.that(model[0].initiator).is.equalTo('John Doe');
          assert.that(model[0].destination).is.equalTo('Somewhere over the rainbow');
          assert.that(model[0].participants).is.equalTo([]);
          assert.that(model[1].initiator).is.equalTo('Jane Doe');
          assert.that(model[1].destination).is.equalTo('Land of Oz');
          assert.that(model[1].participants).is.equalTo([]);
          assert.that(model[2].initiator).is.equalTo('Jane Doe');
          assert.that(model[2].destination).is.equalTo('This destination contains a bad-word.');
          assert.that(model[2].participants).is.equalTo([]);
        });
      });
    });

    suite('authorized reading', () => {
      let started;

      setup(async () => {
        started = buildEvent('planning', 'peerGroup', 'started', {
          initiator: 'Jane Doe',
          destination: 'Somewhere over the rainbow'
        });

        started.metadata.position = 1;

        started.addInitiator(users.jane);

        eventbus.write({
          event: started,
          metadata: { state: {}, previousState: {}}
        });

        await sleep(0.1 * 1000);
      });

      test('reads items if access is granted.', async () => {
        const model = await api.readModel({
          modelType: 'lists',
          modelName: 'peerGroupsForAuthenticated',
          headers: {
            authorization: `Bearer ${issueToken('jane.doe')}`
          }
        });

        assert.that(model.length).is.equalTo(1);
        assert.that(model[0]).is.equalTo({
          id: started.aggregate.id,
          initiator: 'Jane Doe',
          destination: 'Somewhere over the rainbow',
          participants: []
        });
      });

      test('does not read items if access is denied.', async () => {
        const model = await api.readModel({
          modelType: 'lists',
          modelName: 'peerGroupsForAuthenticated'
        });

        assert.that(model.length).is.equalTo(0);
      });
    });

    suite('status api', () => {
      test('answers with api version v1.', async () => {
        const res = await request.get('http://localhost:3001/v1/status');

        assert.that(res.body).is.equalTo({ api: 'v1' });
      });
    });
  });

  suite('api-shell', () => {
    test('is displayed at root level.', async () => {
      const res = await request.get('http://localhost:3000/');

      assert.that(res.status).is.equalTo(200);
      assert.that(res.text.startsWith('<!doctype html>\n<html>')).is.true();
      assert.that(res.text).is.containing('<title>wolkenkit</title>');
      assert.that(res.text.endsWith('</html>\n')).is.true();
    });
  });

  suite('infrastructure recovery', () => {
    test('exits when the connection to the command bus / event bus is lost.', async function () {
      this.timeout(25 * 1000);

      shell.exec('docker kill rabbitmq-integration');

      await sleep(1 * 1000);

      await assert.that(async () => {
        await request.get('http://localhost:3000/v1/ping');
      }).is.throwingAsync(ex => ex.code === 'ECONNREFUSED');

      shell.exec('docker start rabbitmq-integration');
      await waitForRabbitMq({ url: env.RABBITMQ_URL_INTEGRATION });
    });

    test('exits when the connection to the event store is lost.', async () => {
      shell.exec('docker kill postgres-integration');

      await sleep(1 * 1000);

      await assert.that(async () => {
        await request.get('http://localhost:3000/v1/ping');
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
        await request.get('http://localhost:3000/v1/ping');
      }).is.throwingAsync(ex => ex.code === 'ECONNREFUSED');

      shell.exec('docker start mongodb-integration');
      await waitForMongo({ url: env.MONGO_URL_INTEGRATION });
    });
  });
});

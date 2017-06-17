'use strict';

const path = require('path');

const assert = require('assertthat'),
      async = require('async'),
      EventStore = require('sparbuch/lib/postgres/Sparbuch'),
      hase = require('hase'),
      jsonLinesClient = require('json-lines-client'),
      request = require('superagent'),
      runfork = require('runfork'),
      shell = require('shelljs'),
      uuid = require('uuidv4');

const buildCommand = require('../helpers/buildCommand'),
      buildEvent = require('../helpers/buildEvent'),
      env = require('../helpers/env'),
      issueToken = require('../helpers/issueToken'),
      waitForMongo = require('../helpers/waitForMongo'),
      waitForPostgres = require('../helpers/waitForPostgres'),
      waitForRabbitMq = require('../helpers/waitForRabbitMq');

const api = {};

api.sendCommand = function (command, callback) {
  request.
    post('https://localhost:3000/v1/command').
    send(command).
    end(callback);
};

api.subscribeToEvents = function (options) {
  jsonLinesClient({
    protocol: 'https',
    host: 'localhost',
    port: 3000,
    path: '/v1/events',
    body: {}
  }, server => {
    let onData,
        onError;

    const unsubscribe = function (callbackUnsubscribe) {
      server.stream.removeListener('error', onError);
      server.stream.removeListener('data', onData);
      server.disconnect();
      setTimeout(() => {
        callbackUnsubscribe();
      }, 0.5 * 1000);
    };

    onData = function (data) {
      options.onData(data, unsubscribe);
    };

    onError = function (err) {
      unsubscribe(() => {
        if (options.onError) {
          options.onError(err);
        }
      });
    };

    server.stream.on('data', onData);
    server.stream.on('error', onError);

    if (options.onConnect) {
      options.onConnect();
    }
  });
};

api.readModel = function (options, callback) {
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

  jsonLinesClient({
    protocol: 'https',
    host: 'localhost',
    port: 3000,
    path: `/v1/read/${options.modelType}/${options.modelName}`,
    query,
    headers: options.headers || {}
  }, server => {
    let onData,
        onEnd,
        onError;

    const result = [];

    const unsubscribe = function (callbackUnsubscribe) {
      server.stream.removeListener('data', onData);
      server.stream.removeListener('end', onEnd);
      server.stream.removeListener('error', onError);
      server.disconnect();
      setTimeout(() => {
        callbackUnsubscribe();
      }, 0.5 * 1000);
    };

    onData = function (data) {
      result.push(data);
    };

    onEnd = function () {
      unsubscribe(() => {
        callback(null, result);
      });
    };

    onError = function (err) {
      unsubscribe(() => {
        callback(err);
      });
    };

    server.stream.on('data', onData);
    server.stream.on('end', onEnd);
    server.stream.on('error', onError);
  });
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

  setup(done => {
    const app = path.join(__dirname, '..', '..', 'app.js');

    async.series([
      callback => {
        eventStore = new EventStore();
        eventStore.initialize({ url: env.POSTGRES_URL_INTEGRATION, namespace }, callback);
      },
      callback => {
        hase.connect(env.RABBITMQ_URL_INTEGRATION, (err, messageQueue) => {
          if (err) {
            return callback(err);
          }
          mq = messageQueue;
          callback();
        });
      },
      callback => {
        mq.worker('plcr::commands').createReadStream((err, commandStream) => {
          if (err) {
            return callback(err);
          }
          commandbus = commandStream;
          callback(null);
        });
      },
      callback => {
        mq.publisher('plcr::events').createWriteStream((err, eventStream) => {
          if (err) {
            return callback(err);
          }
          eventbus = eventStream;
          callback(null);
        });
      },
      callback => {
        runfork({
          path: path.join(__dirname, '..', 'helpers', 'runResetMongo.js'),
          env: {
            URL: env.MONGO_URL_INTEGRATION
          },
          onExit (exitCode) {
            if (exitCode > 0) {
              return callback(new Error('Failed to reset MongoDB.'));
            }
            callback(null);
          }
        }, errfork => {
          if (errfork) {
            return callback(errfork);
          }
        });
      },
      callback => {
        runfork({
          path: path.join(__dirname, '..', 'helpers', 'runResetPostgres.js'),
          env: {
            NAMESPACE: namespace,
            URL: env.POSTGRES_URL_INTEGRATION
          },
          onExit (exitCode) {
            if (exitCode > 0) {
              return callback(new Error('Failed to reset PostgreSQL.'));
            }
            callback(null);
          }
        }, errfork => {
          if (errfork) {
            return callback(errfork);
          }
        });
      },
      callback => {
        runfork({
          path: app,
          env: {
            API_KEYS: path.join(__dirname, '..', 'keys'),
            API_HOST: 'localhost',
            API_PORT: 3000,
            API_PORT_PUBLIC: 3000,
            API_CORS_ORIGIN: '*',
            APPLICATION: application,
            COMMANDBUS_URL: env.RABBITMQ_URL_INTEGRATION,
            EVENTBUS_URL: env.RABBITMQ_URL_INTEGRATION,
            EVENTSTORE_TYPE: 'postgres',
            EVENTSTORE_URL: env.POSTGRES_URL_INTEGRATION,
            IDENTITYPROVIDER_CERTIFICATE: path.join(__dirname, '..', 'keys'),
            IDENTITYPROVIDER_NAME: 'auth.wolkenkit.io',
            LISTSTORE_URL: env.MONGO_URL_INTEGRATION,
            PROFILING_HOST: 'localhost',
            PROFILING_PORT: 8125
          }
        }, (err, stop) => {
          if (err) {
            return callback(err);
          }

          stopApp = stop;
          setTimeout(() => {
            callback(null);
          }, 2 * 1000);
        });
      }
    ], done);
  });

  teardown(done => {
    mq.connection.close(errMq => {
      if (errMq && errMq.message !== 'Connection closed (Error: Unexpected close)') {
        return done(errMq);
      }

      // We don't explicitly run eventStore.destroy() here, because it caused
      // strange problems on CircleCI. The tests hang in the teardown function.
      // This can be tracked down to disposing and destroying the internal pool
      // of knex, which is provided by pool2. We don't have an idea WHY it works
      // this way, but apparently it does.

      stopApp();
      done(null);
    });
  });

  suite('infrastructure recovery', () => {
    test('exits when the connection to the command bus / event bus is lost.', done => {
      shell.exec('docker kill rabbitmq-integration', exitCode => {
        assert.that(exitCode).is.equalTo(0);

        setTimeout(() => {
          request.
            get('https://localhost:3000/v1/ping').
            end(err => {
              assert.that(err).is.not.null();
              assert.that(err.code).is.equalTo('ECONNREFUSED');

              shell.exec('docker start rabbitmq-integration');
              waitForRabbitMq({ url: env.RABBITMQ_URL_INTEGRATION }, done);
            });
        }, 1 * 1000);
      });
    });

    test('exits when the connection to the event store is lost.', done => {
      shell.exec('docker kill postgres-integration', exitCode => {
        assert.that(exitCode).is.equalTo(0);

        setTimeout(() => {
          request.
            get('https://localhost:3000/v1/ping').
            end(err => {
              assert.that(err).is.not.null();
              assert.that(err.code).is.equalTo('ECONNREFUSED');

              shell.exec('docker start postgres-integration');
              waitForPostgres({ url: env.POSTGRES_URL_INTEGRATION }, errWaitForHost => {
                assert.that(errWaitForHost).is.null();

                // We need to wait for a few seconds after having started
                // PostgreSQL, as it (for whatever reason) takes a long time
                // to actually become available. If we don't do a sleep here,
                // we run into "the database system is starting up" errors.
                setTimeout(() => {
                  done();
                }, 5 * 1000);
              });
            });
        }, 1 * 1000);
      });
    });

    test('exits when the connection to a list store is lost.', done => {
      shell.exec('docker kill mongodb-integration', exitCode => {
        assert.that(exitCode).is.equalTo(0);

        setTimeout(() => {
          request.
            get('https://localhost:3000/v1/ping').
            end(err => {
              assert.that(err).is.not.null();
              assert.that(err.code).is.equalTo('ECONNREFUSED');

              shell.exec('docker start mongodb-integration');
              waitForMongo({ url: env.MONGO_URL_INTEGRATION }, done);
            });
        }, 1 * 1000);
      });
    });
  });

  suite('commands', () => {
    test('passes a command from API to commandbus.', done => {
      const command = buildCommand('planning', 'peerGroup', 'start', {
        initiator: 'John Doe',
        destination: 'Somewhere over the rainbow'
      });

      commandbus.once('data', message => {
        const receivedCommand = message.payload;

        assert.that(receivedCommand.name).is.equalTo('start');
        message.next();
        done();
      });

      api.sendCommand(command, (err, res) => {
        assert.that(err).is.null();
        assert.that(res.statusCode).is.equalTo(200);
      });
    });
  });

  suite('events', () => {
    test('passes domain events from the eventbus to the API.', done => {
      const event = buildEvent('planning', 'peerGroup', 'started', {
        initiator: 'John Doe',
        destination: 'Somewhere over the rainbow'
      });

      api.subscribeToEvents({
        onConnect () {
          eventbus.write(event);
        },
        onData (receivedEvent, unsubscribe) {
          unsubscribe(() => {
            assert.that(receivedEvent.name).is.equalTo('started');
            done();
          });
        },
        onError (err) {
          done(err);
        }
      });
    });

    test('delivers model events to the API.', done => {
      const event = buildEvent('planning', 'peerGroup', 'started', {
        initiator: 'John Doe',
        destination: 'Somewhere over the rainbow'
      });

      let counter = 0;

      api.subscribeToEvents({
        onConnect () {
          eventbus.write(event);
        },
        onData (receivedEvent, unsubscribe) {
          counter += 1;

          switch (counter) {
            case 1:
              assert.that(receivedEvent.type).is.equalTo('domain');
              break;
            case 2:
              assert.that(receivedEvent.type).is.equalTo('readModel');
              assert.that(receivedEvent.aggregate.name).is.equalTo('peerGroups');
              break;
            case 3:
              assert.that(receivedEvent.type).is.equalTo('readModel');
              assert.that(receivedEvent.aggregate.name).is.equalTo('tasteMakers');
              unsubscribe(() => {
                done();
              });
              break;
            default:
              throw new Error('Invalid operation.');
          }
        },
        onError (err) {
          done(err);
        }
      });
    });

    test('proceeds ...Rejected events.', done => {
      const eventStartRejected = buildEvent('planning', 'peerGroup', 'startRejected', {
        reason: 'Something went wrong...'
      });

      Reflect.deleteProperty(eventStartRejected.metadata, 'position');

      api.subscribeToEvents({
        onConnect () {
          eventbus.write(eventStartRejected);
        },
        onData (receivedEvent, unsubscribe) {
          assert.that(receivedEvent.name).is.equalTo('startRejected');
          unsubscribe(() => {
            done();
          });
        },
        onError (err) {
          done(err);
        }
      });
    });

    test('proceeds ...Failed events.', done => {
      const eventStartFailed = buildEvent('planning', 'peerGroup', 'startFailed', {
        reason: 'Something went wrong...'
      });

      Reflect.deleteProperty(eventStartFailed.metadata, 'position');

      api.subscribeToEvents({
        onConnect () {
          eventbus.write(eventStartFailed);
        },
        onData (receivedEvent, unsubscribe) {
          assert.that(receivedEvent.name).is.equalTo('startFailed');
          unsubscribe(() => {
            done();
          });
        },
        onError (err) {
          done(err);
        }
      });
    });

    test('skips events that had already been processed.', done => {
      const eventStarted = buildEvent('planning', 'peerGroup', 'started', {
        initiator: 'John Doe',
        destination: 'Somewhere over the rainbow'
      });
      const eventFinished = buildEvent('integration', 'test', 'finished');

      eventStarted.metadata.position = 1;
      eventFinished.metadata.position = 2;

      let counter = 0;

      api.subscribeToEvents({
        onConnect () {
          eventbus.write(eventStarted);
          eventbus.write(eventStarted);
          eventbus.write(eventFinished);
        },
        onData (receivedEvent, unsubscribe) {
          if (receivedEvent.type !== 'domain') {
            return;
          }

          counter += 1;

          if (receivedEvent.name === 'finished') {
            assert.that(counter).is.equalTo(2);
            unsubscribe(() => {
              done();
            });
          }
        },
        onError (err) {
          done(err);
        }
      });
    });

    test('does not forward replayed events.', done => {
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

      let lastPosition;

      async.series({
        prefillEventStore (doneSeries) {
          eventStore.saveEvents({ events: [ eventStarted, eventJoined1, eventJoined2 ]}, (err, savedEvents) => {
            if (err) {
              doneSeries(err);
            }
            lastPosition = savedEvents[2].metadata.position;
            doneSeries(null);
          });
        },
        sendEventToApi (doneSeries) {
          eventJoined2.metadata.position = lastPosition;

          api.subscribeToEvents({
            onConnect () {
              eventbus.write(eventJoined2);
            },
            onData (receivedEvent, unsubscribe) {
              assert.that(receivedEvent.data.participant).is.equalTo('Jenny Doe');
              unsubscribe(() => {
                doneSeries(null);
              });
            },
            onError (err) {
              done(err);
            }
          });
        }
      }, done);
    });

    test('replays events for a new model.', done => {
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

      let lastPosition;

      async.series({
        prefillEventStore (doneSeries) {
          eventStore.saveEvents({ events: [ eventStarted, eventJoined1, eventJoined2 ]}, (err, savedEvents) => {
            if (err) {
              doneSeries(err);
            }
            lastPosition = savedEvents[2].metadata.position;
            doneSeries(null);
          });
        },
        sendEventToApi (doneSeries) {
          eventJoined2.metadata.position = lastPosition;

          api.subscribeToEvents({
            onConnect () {
              eventbus.write(eventJoined2);
            },
            onData (receivedEvent, unsubscribe) {
              unsubscribe(() => {
                doneSeries(null);
              });
            },
            onError (err) {
              done(err);
            }
          });
        },
        readModel (doneSeries) {
          api.readModel({
            modelType: 'lists',
            modelName: 'peerGroups'
          }, (err, model) => {
            assert.that(err).is.null();
            assert.that(model.length).is.equalTo(1);
            assert.that(model[0].initiator).is.equalTo('John Doe');
            assert.that(model[0].destination).is.equalTo('Somewhere over the rainbow');
            assert.that(model[0].participants).is.equalTo([ 'Jane Doe', 'Jenny Doe' ]);
            doneSeries();
          });
        }
      }, done);
    });

    test('replays events for an existing model.', done => {
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

      let lastPosition;

      async.series({
        prefillEventStorePart1 (doneSeries) {
          eventStore.saveEvents({ events: [ eventStarted, eventJoined1 ]}, (err, savedEvents) => {
            if (err) {
              doneSeries(err);
            }
            lastPosition = savedEvents[1].metadata.position;
            done(null);
          });
        },
        sendEventToApiPart1 (doneSeries) {
          eventJoined1.metadata.position = lastPosition;

          api.subscribeToEvents({
            onConnect () {
              eventbus.write(eventJoined1);
            },
            onData (receivedEvent, unsubscribe) {
              if (receivedEvent.metadata.correlatationId === eventJoined1.metadata.correlatationId) {
                unsubscribe(() => {
                  doneSeries(null);
                });
              }
            },
            onError (err) {
              done(err);
            }
          });
        },
        prefillEventStorePart2 (doneSeries) {
          eventStore.saveEvents({ events: [ eventJoined2, eventJoined3 ]}, (err, savedEvents) => {
            if (err) {
              doneSeries(err);
            }
            lastPosition = savedEvents[1].metadata.position;
            done(null);
          });
        },
        sendEventToApiPart2 (doneSeries) {
          eventJoined3.metadata.position = lastPosition;

          api.subscribeToEvents({
            onConnect () {
              eventbus.write(eventJoined3);
            },
            onData (receivedEvent, unsubscribe) {
              if (receivedEvent.metadata.correlatationId === eventJoined3.metadata.correlatationId) {
                unsubscribe(() => {
                  doneSeries(null);
                });
              }
            },
            onError (err) {
              done(err);
            }
          });
        },
        readModel (doneSeries) {
          api.readModel({
            modelType: 'lists',
            modelName: 'peerGroups'
          }, (err, model) => {
            assert.that(err).is.null();
            assert.that(model.length).is.equalTo(1);
            assert.that(model[0]).is.equalTo({
              id: aggregateId,
              initiator: 'John Doe',
              destination: 'Somewhere over the rainbow',
              participants: [ 'John Doe', 'Jane Doe', 'Jenny Doe', 'Jim Doe' ]
            });
            doneSeries();
          });
        }
      }, done);
    });
  });

  suite('models', () => {
    suite('reading', () => {
      setup(done => {
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

        setTimeout(() => done(), 0.1 * 1000);
      });

      test('returns an error when the model name does not exist.', done => {
        api.readModel({
          modelType: 'lists',
          modelName: 'foo'
        }, err => {
          assert.that(err).is.not.null();
          done();
        });
      });

      test('returns a stream that the requested model\'s data is written to.', done => {
        api.readModel({
          modelType: 'lists',
          modelName: 'peerGroups'
        }, (err, model) => {
          assert.that(err).is.null();
          assert.that(model.length).is.equalTo(2);
          done();
        });
      });

      test('returns a stream that the requested model\'s data is written to filtered by the given selector.', done => {
        api.readModel({
          modelType: 'lists',
          modelName: 'peerGroups',
          query: {
            where: { initiator: 'Jane Doe' }
          }
        }, (err, model) => {
          assert.that(err).is.null();
          assert.that(model.length).is.equalTo(1);
          assert.that(model[0].initiator).is.equalTo('Jane Doe');
          done();
        });
      });

      test('returns a stream that is limited to the number of requested documents.', done => {
        api.readModel({
          modelType: 'lists',
          modelName: 'peerGroups',
          query: {
            take: 1
          }
        }, (err, model) => {
          assert.that(err).is.null();
          assert.that(model.length).is.equalTo(1);
          assert.that(model[0].initiator).is.equalTo('John Doe');
          done();
        });
      });

      test('returns a stream that skips the specified number of documents.', done => {
        api.readModel({
          modelType: 'lists',
          modelName: 'peerGroups',
          query: {
            skip: 1
          }
        }, (err, model) => {
          assert.that(err).is.null();
          assert.that(model.length).is.equalTo(1);
          assert.that(model[0].initiator).is.equalTo('Jane Doe');
          done();
        });
      });

      test('returns a stream that is sorted by the specified criteria.', done => {
        api.readModel({
          modelType: 'lists',
          modelName: 'peerGroups',
          query: {
            orderBy: { initiator: 'asc' }
          }
        }, (err, model) => {
          assert.that(err).is.null();
          assert.that(model.length).is.equalTo(2);
          assert.that(model[0].initiator).is.equalTo('Jane Doe');
          assert.that(model[1].initiator).is.equalTo('John Doe');
          done();
        });
      });

      test('streams the data as JSON items.', done => {
        api.readModel({
          modelType: 'lists',
          modelName: 'peerGroups',
          query: {
            where: { initiator: 'Jane Doe' }
          }
        }, (err, model) => {
          assert.that(err).is.null();
          assert.that(model.length).is.equalTo(1);
          assert.that(model[0].initiator).is.equalTo('Jane Doe');
          assert.that(model[0].destination).is.equalTo('Land of Oz');
          assert.that(model[0].participants).is.equalTo([]);
          done();
        });
      });

      test('closes the stream once all data have been sent.', done => {
        jsonLinesClient({
          protocol: 'https',
          host: 'localhost',
          port: 3000,
          path: `/v1/read/lists/peerGroups`
        }, server => {
          server.stream.resume();
          server.stream.once('end', () => {
            done();
          });
        });
      });

      test('handles external stream closing gracefully.', done => {
        jsonLinesClient({
          protocol: 'https',
          host: 'localhost',
          port: 3000,
          path: `/v1/read/lists/peerGroups`
        }, server => {
          server.disconnect();

          // Now that we forced the stream to be closed, let's wait for some time
          // to make sure that the app is still running.
          setTimeout(() => {
            request.
              get('https://localhost:3000/v1/ping').
              end((err, res) => {
                assert.that(err).is.null();
                assert.that(res.statusCode).is.equalTo(200);
                done();
              });
          }, 1 * 1000);
        });
      });
    });

    suite('authorized reading', () => {
      let eventForAuthenticated,
          eventForOwner,
          eventForPublic;

      setup(done => {
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

        setTimeout(() => done(), 0.1 * 1000);
      });

      test('reads items for public users.', done => {
        api.readModel({
          modelType: 'lists',
          modelName: 'peerGroups'
        }, (err, model) => {
          assert.that(err).is.null();
          assert.that(model.length).is.equalTo(1);
          assert.that(model[0].initiator).is.equalTo('Jenny Doe');
          done();
        });
      });

      test('reads items for authenticated users.', done => {
        api.readModel({
          modelType: 'lists',
          modelName: 'peerGroups',
          headers: {
            authorization: `Bearer ${issueToken(uuid())}`
          }
        }, (err, model) => {
          assert.that(err).is.null();
          assert.that(model.length).is.equalTo(2);
          assert.that(model[0].initiator).is.equalTo('John Doe');
          assert.that(model[1].initiator).is.equalTo('Jenny Doe');
          done();
        });
      });

      test('reads items for owners.', done => {
        api.readModel({
          modelType: 'lists',
          modelName: 'peerGroups',
          headers: {
            authorization: `Bearer ${issueToken(eventForOwner.metadata.isAuthorized.owner)}`
          }
        }, (err, model) => {
          assert.that(err).is.null();
          assert.that(model.length).is.equalTo(3);
          assert.that(model[0].initiator).is.equalTo('Jane Doe');
          assert.that(model[1].initiator).is.equalTo('John Doe');
          assert.that(model[2].initiator).is.equalTo('Jenny Doe');
          done();
        });
      });
    });
  });
});

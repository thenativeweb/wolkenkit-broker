'use strict';

const EventEmitter = require('events').EventEmitter;

const assert = require('assertthat'),
      async = require('async'),
      toArray = require('streamtoarray'),
      uuid = require('uuidv4');

const buildDomainEvent = require('../../../helpers/buildEvent'),
      buildModelEvent = require('../buildModelEvent'),
      EventSequencer = require('../../../../eventSequencer/EventSequencer'),
      ModelStore = require('../../../../modelStore/ModelStore');

const lists = function (options) {
  const { ListStore, resetDatabase, url } = options;

  suite('integrationTests', () => {
    let eventSequencer,
        listStore,
        modelName,
        modelStore;

    const simulateRestart = function (callback) {
      const otherEventSequencer = new EventSequencer();
      const otherListStore = new ListStore({ url, eventSequencer: otherEventSequencer });
      const otherModelStore = new ModelStore();

      otherModelStore.initialize({
        application: 'integrationTests',
        eventSequencer: otherEventSequencer,
        readModel: {
          lists: {
            [modelName]: {
              fields: {
                initiator: { initialState: '', fastLookup: true, isUnique: false },
                destination: { initialState: '', fastLookup: true },
                participants: { initialState: []},
                stars: { initialState: 0 }
              }
            }
          }
        },
        stores: {
          lists: otherListStore
        }
      }, err => {
        if (err) {
          return callback(err);
        }

        callback(null, {
          eventSequencer: otherEventSequencer,
          listStore: otherListStore,
          modelStore: otherModelStore
        });
      });
    };

    suiteSetup(function (done) {
      this.timeout(10 * 1000);

      resetDatabase(done);
    });

    suiteTeardown(function (done) {
      this.timeout(10 * 1000);

      resetDatabase(done);
    });

    setup(done => {
      modelName = `peerGroups${uuid().substr(0, 8)}`;

      simulateRestart((err, other) => {
        if (err) {
          return done(err);
        }

        eventSequencer = other.eventSequencer;
        listStore = other.listStore;
        modelStore = other.modelStore;

        done(null);
      });
    });

    suite('constructor', () => {
      test('is a function.', done => {
        assert.that(ListStore).is.ofType('function');
        done();
      });

      test('throws an error if options are missing.', done => {
        assert.that(() => {
          /* eslint-disable no-new */
          new ListStore();
          /* eslint-enable no-new */
        }).is.throwing('Options are missing.');
        done();
      });

      test('throws an error if url is missing.', done => {
        assert.that(() => {
          /* eslint-disable no-new */
          new ListStore({ eventSequencer: new EventSequencer() });
          /* eslint-enable no-new */
        }).is.throwing('Url is missing.');
        done();
      });

      test('throws an error if event sequencer is missing.', done => {
        assert.that(() => {
          /* eslint-disable no-new */
          new ListStore({ url });
          /* eslint-enable no-new */
        }).is.throwing('Event sequencer is missing.');
        done();
      });
    });

    suite('events', () => {
      test('is an event emitter.', done => {
        assert.that(listStore).is.instanceOf(EventEmitter);
        done();
      });

      test('emits a disconnect event when the connection to the database is lost.', function (done) {
        this.timeout(15 * 1000);

        listStore.once('disconnect', () => {
          options.startContainer(done);
        });

        options.stopContainer();
      });
    });

    suite('initialize', () => {
      test('is a function.', done => {
        assert.that(listStore.initialize).is.ofType('function');
        done();
      });

      test('throws an error if options are missing.', done => {
        assert.that(() => {
          listStore.initialize();
        }).is.throwing('Options are missing.');
        done();
      });

      test('throws an error if application is missing.', done => {
        assert.that(() => {
          listStore.initialize({});
        }).is.throwing('Application is missing.');
        done();
      });

      test('throws an error if read model is missing.', done => {
        assert.that(() => {
          listStore.initialize({ application: 'foo' });
        }).is.throwing('Read model is missing.');
        done();
      });

      test('throws an error if callback is missing.', done => {
        assert.that(() => {
          listStore.initialize({ application: 'foo', readModel: {}});
        }).is.throwing('Callback is missing.');
        done();
      });

      test('registers all lists on the event sequencer.', done => {
        // listStore.initialize() had already been called by the model store in
        // the setup function above.

        assert.that(eventSequencer.models).is.equalTo({
          lists: {
            [modelName]: { lastProcessedPosition: 0 }
          }
        });
        done();
      });

      test('does not fail if model store has been initialized before.', done => {
        simulateRestart(err => {
          assert.that(err).is.null();
          done();
        });
      });

      test('gets the correct positions for the event sequencer.', done => {
        const domainEvent = buildDomainEvent('planning', 'peerGroup', 'joined', { participant: 'Jane Doe' });

        domainEvent.metadata.position = 1;

        modelStore.processEvents(domainEvent, [], errAdded => {
          assert.that(errAdded).is.null();

          simulateRestart((err, other) => {
            assert.that(err).is.null();
            assert.that(other.eventSequencer.models).is.equalTo({
              lists: {
                [modelName]: { lastProcessedPosition: 1 }
              }
            });
            done();
          });
        });
      });
    });

    suite('event handlers', () => {
      suite('added', () => {
        test('is a function.', done => {
          assert.that(listStore.added).is.ofType('function');
          done();
        });

        test('throws an error if options are missing.', done => {
          assert.that(() => {
            listStore.added();
          }).is.throwing('Options are missing.');
          done();
        });

        test('throws an error if model name is missing.', done => {
          assert.that(() => {
            listStore.added({});
          }).is.throwing('Model name is missing.');
          done();
        });

        test('throws an error if payload is missing.', done => {
          assert.that(() => {
            listStore.added({ modelName: 'foo' });
          }).is.throwing('Payload is missing.');
          done();
        });

        test('throws an error if callback is missing.', done => {
          assert.that(() => {
            listStore.added({ modelName: 'foo', payload: 'bar' });
          }).is.throwing('Callback is missing.');
          done();
        });

        test('adds the given item.', done => {
          const payload = { id: uuid(), initiator: 'Jane Doe', destination: 'Riva', participants: []};

          listStore.added({ modelName, payload }, errAdded => {
            assert.that(errAdded).is.null();

            listStore.read({ modelType: 'lists', modelName, query: {}}, (err, stream) => {
              assert.that(err).is.null();

              toArray(stream, (errToArray, peerGroups) => {
                assert.that(errToArray).is.null();
                assert.that(peerGroups.length).is.equalTo(1);
                done();
              });
            });
          });
        });
      });

      suite('updated', () => {
        test('is a function.', done => {
          assert.that(listStore.updated).is.ofType('function');
          done();
        });

        test('throws an error if options are missing.', done => {
          assert.that(() => {
            listStore.updated();
          }).is.throwing('Options are missing.');
          done();
        });

        test('throws an error if model name is missing.', done => {
          assert.that(() => {
            listStore.updated({});
          }).is.throwing('Model name is missing.');
          done();
        });

        test('throws an error if selector is missing.', done => {
          assert.that(() => {
            listStore.updated({ modelName: 'foo' });
          }).is.throwing('Selector is missing.');
          done();
        });

        test('throws an error if payload is missing.', done => {
          assert.that(() => {
            listStore.updated({ modelName: 'foo', selector: 'bar' });
          }).is.throwing('Payload is missing.');
          done();
        });

        test('throws an error if callback is missing.', done => {
          assert.that(() => {
            listStore.updated({ modelName: 'foo', selector: 'bar', payload: 'baz' });
          }).is.throwing('Callback is missing.');
          done();
        });

        test('returns an error if an invalid key is given.', done => {
          const selector = { id: uuid() };
          const payloadUpdate = { $add: 'Jane Doe' };

          listStore.updated({ modelName, selector, payload: payloadUpdate }, err => {
            assert.that(err).is.not.null();
            done();
          });
        });

        test('updates a single selected item using the update payload.', done => {
          const payloadAdd = { id: uuid(), initiator: 'Jane Doe', destination: 'Riva', participants: []};

          listStore.added({ modelName, payload: payloadAdd }, errAdded => {
            assert.that(errAdded).is.null();

            const selector = { id: payloadAdd.id };
            const payloadUpdate = { destination: 'Sultan Saray', participants: { $add: 'Jane Doe' }};

            listStore.updated({ modelName, selector, payload: payloadUpdate }, errUpdated => {
              assert.that(errUpdated).is.null();

              listStore.read({ modelType: 'lists', modelName, query: {}}, (err, stream) => {
                assert.that(err).is.null();

                toArray(stream, (errToArray, peerGroups) => {
                  assert.that(errToArray).is.null();
                  assert.that(peerGroups.length).is.equalTo(1);
                  assert.that(peerGroups[0]).is.equalTo({
                    id: payloadAdd.id,
                    initiator: 'Jane Doe',
                    destination: 'Sultan Saray',
                    participants: [ 'Jane Doe' ]
                  });
                  done();
                });
              });
            });
          });
        });

        test('updates multiple selected items using the update payload.', done => {
          const payloadAddFirst = { id: uuid(), initiator: 'Jane Doe', destination: 'Riva', participants: []},
                payloadAddSecond = { id: uuid(), initiator: 'John Doe', destination: 'Riva', participants: []};

          listStore.added({ modelName, payload: payloadAddFirst }, errAddedFirst => {
            assert.that(errAddedFirst).is.null();

            listStore.added({ modelName, payload: payloadAddSecond }, errAddedSecond => {
              assert.that(errAddedSecond).is.null();

              const selector = { destination: 'Riva' };
              const payloadUpdate = { destination: 'Sultan Saray' };

              listStore.updated({ modelName, selector, payload: payloadUpdate }, errUpdated => {
                assert.that(errUpdated).is.null();

                listStore.read({ modelType: 'lists', modelName, query: {}}, (err, stream) => {
                  assert.that(err).is.null();

                  toArray(stream, (errToArray, peerGroups) => {
                    assert.that(errToArray).is.null();
                    assert.that(peerGroups.length).is.equalTo(2);
                    assert.that(peerGroups[0]).is.equalTo({
                      id: payloadAddFirst.id,
                      initiator: 'Jane Doe',
                      destination: 'Sultan Saray',
                      participants: []
                    });
                    assert.that(peerGroups[1]).is.equalTo({
                      id: payloadAddSecond.id,
                      initiator: 'John Doe',
                      destination: 'Sultan Saray',
                      participants: []
                    });
                    done();
                  });
                });
              });
            });
          });
        });

        test('updates items selected by query using the update payload.', done => {
          const payloadAddFirst = { id: uuid(), initiator: 'Jane Doe', destination: 'Riva', participants: []},
                payloadAddSecond = { id: uuid(), initiator: 'John Doe', destination: 'Riva', participants: [ 'John Doe', 'Jane Doe' ]};

          listStore.added({ modelName, payload: payloadAddFirst }, errAddedFirst => {
            assert.that(errAddedFirst).is.null();

            listStore.added({ modelName, payload: payloadAddSecond }, errAddedSecond => {
              assert.that(errAddedSecond).is.null();

              const selector = { initiator: { $greaterThan: 'Jessy Doe' }};
              const payloadUpdate = { destination: 'Sultan Saray' };

              listStore.updated({ modelName, selector, payload: payloadUpdate }, errUpdated => {
                assert.that(errUpdated).is.null();

                listStore.read({ modelType: 'lists', modelName, query: {}}, (err, stream) => {
                  assert.that(err).is.null();

                  toArray(stream, (errToArray, peerGroups) => {
                    assert.that(errToArray).is.null();
                    assert.that(peerGroups.length).is.equalTo(2);
                    assert.that(peerGroups[0]).is.equalTo({
                      id: payloadAddFirst.id,
                      initiator: 'Jane Doe',
                      destination: 'Riva',
                      participants: []
                    });
                    assert.that(peerGroups[1]).is.equalTo({
                      id: payloadAddSecond.id,
                      initiator: 'John Doe',
                      destination: 'Sultan Saray',
                      participants: [ 'John Doe', 'Jane Doe' ]
                    });
                    done();
                  });
                });
              });
            });
          });
        });
      });

      suite('removed', () => {
        test('is a function.', done => {
          assert.that(listStore.removed).is.ofType('function');
          done();
        });

        test('throws an error if options are missing.', done => {
          assert.that(() => {
            listStore.removed();
          }).is.throwing('Options are missing.');
          done();
        });

        test('throws an error if model name is missing.', done => {
          assert.that(() => {
            listStore.removed({});
          }).is.throwing('Model name is missing.');
          done();
        });

        test('throws an error if selector is missing.', done => {
          assert.that(() => {
            listStore.removed({ modelName: 'foo' });
          }).is.throwing('Selector is missing.');
          done();
        });

        test('throws an error if callback is missing.', done => {
          assert.that(() => {
            listStore.removed({ modelName: 'foo', selector: 'bar' });
          }).is.throwing('Callback is missing.');
          done();
        });

        test('removes a single selected item.', done => {
          const payload = { id: uuid(), initiator: 'Jane Doe', destination: 'Riva', participants: []};

          listStore.added({ modelName, payload }, errAdded => {
            assert.that(errAdded).is.null();

            const selector = { id: payload.id };

            listStore.removed({ modelName, selector }, errRemoved => {
              assert.that(errRemoved).is.null();

              listStore.read({ modelType: 'lists', modelName, query: {}}, (err, stream) => {
                assert.that(err).is.null();

                toArray(stream, (errToArray, peerGroups) => {
                  assert.that(errToArray).is.null();
                  assert.that(peerGroups.length).is.equalTo(0);
                  done();
                });
              });
            });
          });
        });

        test('removes multiple selected items.', done => {
          const payloadFirst = { id: uuid(), initiator: 'Jane Doe', destination: 'Riva', participants: []},
                payloadSecond = { id: uuid(), initiator: 'John Doe', destination: 'Riva', participants: []};

          listStore.added({ modelName, payload: payloadFirst }, errAddedFirst => {
            assert.that(errAddedFirst).is.null();

            listStore.added({ modelName, payload: payloadSecond }, errAddedSecond => {
              assert.that(errAddedSecond).is.null();

              const selector = { destination: 'Riva' };

              listStore.removed({ modelName, selector }, errRemoved => {
                assert.that(errRemoved).is.null();

                listStore.read({ modelType: 'lists', modelName, query: {}}, (err, stream) => {
                  assert.that(err).is.null();

                  toArray(stream, (errToArray, peerGroups) => {
                    assert.that(errToArray).is.null();
                    assert.that(peerGroups.length).is.equalTo(0);
                    done();
                  });
                });
              });
            });
          });
        });

        test('removes items selected by query.', done => {
          const payloadFirst = { id: uuid(), initiator: 'Jane Doe', destination: 'Riva', participants: []},
                payloadSecond = { id: uuid(), initiator: 'John Doe', destination: 'Riva', participants: [ 'John Doe', 'Jane Doe' ]};

          listStore.added({ modelName, payload: payloadFirst }, errAddedFirst => {
            assert.that(errAddedFirst).is.null();

            listStore.added({ modelName, payload: payloadSecond }, errAddedSecond => {
              assert.that(errAddedSecond).is.null();

              const selector = { initiator: 'John Doe' };

              listStore.removed({ modelName, selector }, errRemoved => {
                assert.that(errRemoved).is.null();

                listStore.read({ modelType: 'lists', modelName, query: {}}, (err, stream) => {
                  assert.that(err).is.null();

                  toArray(stream, (errToArray, peerGroups) => {
                    assert.that(errToArray).is.null();
                    assert.that(peerGroups.length).is.equalTo(1);
                    assert.that(peerGroups[0]).is.equalTo({
                      id: payloadFirst.id,
                      initiator: 'Jane Doe',
                      destination: 'Riva',
                      participants: []
                    });
                    done();
                  });
                });
              });
            });
          });
        });
      });

      suite('read', () => {
        test('is a function.', done => {
          assert.that(listStore.read).is.ofType('function');
          done();
        });

        test('throws an error if options are missing.', done => {
          assert.that(() => {
            listStore.read();
          }).is.throwing('Options are missing.');
          done();
        });

        test('throws an error if model name is missing.', done => {
          assert.that(() => {
            listStore.read({});
          }).is.throwing('Model name is missing.');
          done();
        });

        test('throws an error if query is missing.', done => {
          assert.that(() => {
            listStore.read({ modelName: 'foo' });
          }).is.throwing('Query is missing.');
          done();
        });

        test('throws an error if callback is missing.', done => {
          assert.that(() => {
            listStore.read({ modelName: 'foo', query: {}});
          }).is.throwing('Callback is missing.');
          done();
        });

        test('reads items.', done => {
          const payloadFirst = { id: uuid(), initiator: 'Jane Doe', destination: 'Riva', participants: []},
                payloadSecond = { id: uuid(), initiator: 'John Doe', destination: 'Riva', participants: [ 'John Doe', 'Jane Doe' ]};

          listStore.added({ modelName, payload: payloadFirst }, errAddedFirst => {
            assert.that(errAddedFirst).is.null();

            listStore.added({ modelName, payload: payloadSecond }, errAddedSecond => {
              assert.that(errAddedSecond).is.null();

              const query = {};

              listStore.read({ modelName, query }, (errRead, stream) => {
                assert.that(errRead).is.null();

                toArray(stream, (errToArray, items) => {
                  assert.that(items.length).is.equalTo(2);
                  assert.that(items[0]).is.equalTo(payloadFirst);
                  assert.that(items[1]).is.equalTo(payloadSecond);
                  done();
                });
              });
            });
          });
        });

        test('reads items by query.', done => {
          const payloadFirst = { id: uuid(), initiator: 'Jane Doe', destination: 'Riva', participants: []},
                payloadSecond = { id: uuid(), initiator: 'John Doe', destination: 'Riva', participants: [ 'John Doe', 'Jane Doe' ]};

          listStore.added({ modelName, payload: payloadFirst }, errAddedFirst => {
            assert.that(errAddedFirst).is.null();

            listStore.added({ modelName, payload: payloadSecond }, errAddedSecond => {
              assert.that(errAddedSecond).is.null();

              const query = {
                where: { initiator: 'Jane Doe' }
              };

              listStore.read({ modelName, query }, (errRead, stream) => {
                assert.that(errRead).is.null();

                toArray(stream, (errToArray, items) => {
                  assert.that(items.length).is.equalTo(1);
                  assert.that(items[0]).is.equalTo(payloadFirst);
                  done();
                });
              });
            });
          });
        });

        test('returns an empty list if no items are matched by query.', done => {
          const payloadFirst = { id: uuid(), initiator: 'Jane Doe', destination: 'Riva', participants: []},
                payloadSecond = { id: uuid(), initiator: 'John Doe', destination: 'Riva', participants: [ 'John Doe', 'Jane Doe' ]};

          listStore.added({ modelName, payload: payloadFirst }, errAddedFirst => {
            assert.that(errAddedFirst).is.null();

            listStore.added({ modelName, payload: payloadSecond }, errAddedSecond => {
              assert.that(errAddedSecond).is.null();

              const query = {
                where: { initiator: 'Jessy Doe' }
              };

              listStore.read({ modelName, query }, (errRead, stream) => {
                assert.that(errRead).is.null();

                toArray(stream, (errToArray, items) => {
                  assert.that(items.length).is.equalTo(0);
                  done();
                });
              });
            });
          });
        });
      });
    });

    suite('item manipulation', () => {
      let domainEvent;

      setup(() => {
        domainEvent = buildDomainEvent('planning', 'peerGroup', 'joined', { participant: 'Jane Doe' });
      });

      test('add and update single item.', done => {
        const id = uuid();

        async.series({
          addAndUpdate (callback) {
            modelStore.processEvents(domainEvent, [
              buildModelEvent('lists', modelName, 'added', { payload: { id, initiator: 'Jane Doe', destination: 'Riva', participants: [], stars: 0 }}),
              buildModelEvent('lists', modelName, 'updated', { selector: { id }, payload: { participants: { $add: 'Jane Doe' }}})
            ], callback);
          },
          read (callback) {
            modelStore.read({ modelType: 'lists', modelName }, (err, stream) => {
              assert.that(err).is.null();
              toArray(stream, (errToArray, peerGroups) => {
                assert.that(errToArray).is.null();
                assert.that(peerGroups).is.equalTo([
                  { id, initiator: 'Jane Doe', destination: 'Riva', participants: [ 'Jane Doe' ], stars: 0 }
                ]);
                callback(null);
              });
            });
          },
          teardown (callback) {
            modelStore.processEvents(domainEvent, [
              buildModelEvent('lists', modelName, 'removed', { selector: {}})
            ], callback);
          }
        }, done);
      });

      test('add, update and remove multiple items.', done => {
        const id = [ uuid(), uuid(), uuid(), uuid(), uuid() ];

        async.series({
          addUpdateAndRemove (callback) {
            modelStore.processEvents(domainEvent, [
              buildModelEvent('lists', modelName, 'added', { payload: { id: id[0], initiator: 'Jane Doe', destination: 'Riva', participants: [], stars: 0 }}),
              buildModelEvent('lists', modelName, 'added', { payload: { id: id[1], initiator: 'John Doe', destination: 'Sultan Saray', participants: [], stars: 0 }}),
              buildModelEvent('lists', modelName, 'added', { payload: { id: id[2], initiator: 'Jessica Doe', destination: 'Moulou', participants: [], stars: 0 }}),
              buildModelEvent('lists', modelName, 'added', { payload: { id: id[3], initiator: 'James Doe', destination: 'Kurose', participants: [], stars: 0 }}),
              buildModelEvent('lists', modelName, 'added', { payload: { id: id[4], initiator: 'Jeanette Doe', destination: 'Riva', participants: [], stars: 0 }}),
              buildModelEvent('lists', modelName, 'updated', { selector: { destination: 'Riva' }, payload: { destination: 'Sultan Saray', stars: { $incrementBy: 2 }}}),
              buildModelEvent('lists', modelName, 'updated', { selector: { initiator: 'Jessica Doe' }, payload: { destination: 'Sans', participants: { $add: 'Jim Doe' }}}),
              buildModelEvent('lists', modelName, 'removed', { selector: { id: id[1] }})
            ], callback);
          },
          read (callback) {
            modelStore.read({ modelType: 'lists', modelName }, (err, stream) => {
              assert.that(err).is.null();
              toArray(stream, (errToArray, peerGroups) => {
                assert.that(errToArray).is.null();
                assert.that(peerGroups).is.equalTo([
                  { id: id[0], initiator: 'Jane Doe', destination: 'Sultan Saray', participants: [], stars: 2 },
                  { id: id[2], initiator: 'Jessica Doe', destination: 'Sans', participants: [ 'Jim Doe' ], stars: 0 },
                  { id: id[3], initiator: 'James Doe', destination: 'Kurose', participants: [], stars: 0 },
                  { id: id[4], initiator: 'Jeanette Doe', destination: 'Sultan Saray', participants: [], stars: 2 }
                ]);
                callback(null);
              });
            });
          },
          teardown (callback) {
            modelStore.processEvents(domainEvent, [
              buildModelEvent('lists', modelName, 'removed', { selector: {}})
            ], callback);
          }
        }, done);
      });

      test('add and remove items to and from arrays.', done => {
        const id = [ uuid(), uuid(), uuid() ];

        async.series({
          addAndUpdate (callback) {
            modelStore.processEvents(domainEvent, [
              buildModelEvent('lists', modelName, 'added', { payload: { id: id[0], participants: []}}),
              buildModelEvent('lists', modelName, 'added', { payload: { id: id[1], participants: [ 'John Doe' ]}}),
              buildModelEvent('lists', modelName, 'added', { payload: { id: id[2], participants: [ 'John Doe', 'Jennifer Doe' ]}}),
              buildModelEvent('lists', modelName, 'updated', { selector: { id: id[0] }, payload: { participants: { $add: 'Jane Doe' }}}),
              buildModelEvent('lists', modelName, 'updated', { selector: { id: id[1] }, payload: { participants: { $add: 'Jane Doe' }}}),
              buildModelEvent('lists', modelName, 'updated', { selector: { id: id[1] }, payload: { participants: { $remove: 'John Doe' }}}),
              buildModelEvent('lists', modelName, 'updated', { selector: { id: id[2] }, payload: { participants: { $remove: 'John Doe' }}})
            ], callback);
          },
          read (callback) {
            modelStore.read({
              modelType: 'lists',
              modelName
            }, (err, stream) => {
              assert.that(err).is.null();

              toArray(stream, (errToArray, peerGroups) => {
                assert.that(errToArray).is.null();
                assert.that(peerGroups).is.equalTo([
                  { id: id[0], participants: [ 'Jane Doe' ]},
                  { id: id[1], participants: [ 'Jane Doe' ]},
                  { id: id[2], participants: [ 'Jennifer Doe' ]}
                ]);
                callback(null);
              });
            });
          },
          teardown (callback) {
            modelStore.processEvents(domainEvent, [
              buildModelEvent('lists', modelName, 'removed', { selector: {}})
            ], callback);
          }
        }, done);
      });
    });

    suite('reading', () => {
      let domainEvent;

      const id = [ uuid(), uuid(), uuid() ];

      const read = function (query, callback) {
        modelStore.read({
          modelType: 'lists',
          modelName,
          query
        }, (err, stream) => {
          assert.that(err).is.null();
          toArray(stream, (errToArray, peerGroups) => {
            if (errToArray) {
              return callback(errToArray);
            }
            callback(peerGroups);
          });
        });
      };

      const readOne = function (query, callback) {
        modelStore.readOne({
          modelType: 'lists',
          modelName,
          query
        }, callback);
      };

      setup(done => {
        domainEvent = buildDomainEvent('planning', 'peerGroup', 'joined', { participant: 'Jane Doe' });

        modelStore.processEvents(domainEvent, [
          buildModelEvent('lists', modelName, 'added', { payload: { id: id[0], initiator: 'Jane Doe', destination: 'Riva', participants: [ 'Jane Doe' ], stars: 2 }}),
          buildModelEvent('lists', modelName, 'added', { payload: { id: id[1], initiator: 'John Doe', destination: 'Riva', participants: [ 'John Doe' ], stars: 0 }}),
          buildModelEvent('lists', modelName, 'added', { payload: { id: id[2], initiator: 'Jennifer Doe', destination: 'Sultan Saray', participants: [ 'Jane Doe', 'Jennifer Doe' ], stars: 1 }})
        ], done);
      });

      teardown(done => {
        modelStore.processEvents(domainEvent, [
          buildModelEvent('lists', modelName, 'removed', { selector: {}})
        ], done);
      });

      suite('readOne', () => {
        suite('where', () => {
          test('equal to.', done => {
            readOne({
              where: { stars: 0 }
            }, (err, peerGroup) => {
              assert.that(err).is.null();
              assert.that(peerGroup.id).is.equalTo(id[1]);
              done();
            });
          });

          test('not found.', done => {
            readOne({
              where: { stars: 4 }
            }, (err, item) => {
              assert.that(err).is.not.null();
              assert.that(err.message).is.equalTo('Item not found.');
              assert.that(item).is.undefined();
              done();
            });
          });
        });
      });

      suite('read', () => {
        suite('where', () => {
          test('equal to.', done => {
            read({
              where: { stars: 1 }
            }, peerGroups => {
              assert.that(peerGroups.length).is.equalTo(1);
              assert.that(peerGroups[0].id).is.equalTo(id[2]);
              done();
            });
          });

          test('greather than.', done => {
            read({
              where: { stars: { $greaterThan: 1 }}
            }, peerGroups => {
              assert.that(peerGroups.length).is.equalTo(1);
              assert.that(peerGroups[0].id).is.equalTo(id[0]);
              done();
            });
          });

          test('less than.', done => {
            read({
              where: { stars: { $lessThan: 1 }}
            }, peerGroups => {
              assert.that(peerGroups.length).is.equalTo(1);
              assert.that(peerGroups[0].id).is.equalTo(id[1]);
              done();
            });
          });

          test('greater than or equal to.', done => {
            read({
              where: { stars: { $greaterThanOrEqualTo: 1 }}
            }, peerGroups => {
              assert.that(peerGroups.length).is.equalTo(2);
              assert.that(peerGroups[0].id).is.equalTo(id[0]);
              assert.that(peerGroups[1].id).is.equalTo(id[2]);
              done();
            });
          });

          test('less than or equal to.', done => {
            read({
              where: { stars: { $lessThanOrEqualTo: 1 }}
            }, peerGroups => {
              assert.that(peerGroups.length).is.equalTo(2);
              assert.that(peerGroups[0].id).is.equalTo(id[1]);
              assert.that(peerGroups[1].id).is.equalTo(id[2]);
              done();
            });
          });

          test('not equal to.', done => {
            read({
              where: { stars: { $notEqualTo: 1 }}
            }, peerGroups => {
              assert.that(peerGroups.length).is.equalTo(2);
              assert.that(peerGroups[0].id).is.equalTo(id[0]);
              assert.that(peerGroups[1].id).is.equalTo(id[1]);
              done();
            });
          });

          test('contains.', done => {
            read({
              where: { participants: { $contains: 'Jane Doe' }}
            }, peerGroups => {
              assert.that(peerGroups.length).is.equalTo(2);
              assert.that(peerGroups[0].id).is.equalTo(id[0]);
              assert.that(peerGroups[1].id).is.equalTo(id[2]);
              done();
            });
          });

          test('does not contain.', done => {
            read({
              where: { participants: { $doesNotContain: 'Jane Doe' }}
            }, peerGroups => {
              assert.that(peerGroups.length).is.equalTo(1);
              assert.that(peerGroups[0].id).is.equalTo(id[1]);
              done();
            });
          });
        });

        suite('order by', () => {
          test('ascending.', done => {
            read({
              orderBy: { stars: 'ascending' }
            }, peerGroups => {
              assert.that(peerGroups.length).is.equalTo(3);
              assert.that(peerGroups[0].id).is.equalTo(id[1]);
              assert.that(peerGroups[1].id).is.equalTo(id[2]);
              assert.that(peerGroups[2].id).is.equalTo(id[0]);
              done();
            });
          });

          test('descending.', done => {
            read({
              orderBy: { stars: 'descending' }
            }, peerGroups => {
              assert.that(peerGroups.length).is.equalTo(3);
              assert.that(peerGroups[0].id).is.equalTo(id[0]);
              assert.that(peerGroups[1].id).is.equalTo(id[2]);
              assert.that(peerGroups[2].id).is.equalTo(id[1]);
              done();
            });
          });
        });

        suite('take', () => {
          test('limits items.', done => {
            read({
              take: 1
            }, peerGroups => {
              assert.that(peerGroups.length).is.equalTo(1);
              assert.that(peerGroups[0].id).is.equalTo(id[0]);
              done();
            });
          });
        });

        suite('skip', () => {
          test('skips items.', done => {
            read({
              skip: 1,
              take: 1
            }, peerGroups => {
              assert.that(peerGroups.length).is.equalTo(1);
              assert.that(peerGroups[0].id).is.equalTo(id[1]);
              done();
            });
          });
        });
      });
    });

    suite('updatePosition', () => {
      test('is a function.', done => {
        assert.that(listStore.updatePosition).is.ofType('function');
        done();
      });

      test('throws an error if position is missing.', done => {
        assert.that(() => {
          listStore.updatePosition();
        }).is.throwing('Position is missing.');
        done();
      });

      test('throws an error if callback is missing.', done => {
        assert.that(() => {
          listStore.updatePosition(23);
        }).is.throwing('Callback is missing.');
        done();
      });

      suite('database', () => {
        test('updates the event sequencer.', done => {
          listStore.updatePosition(23, errUpdatePosition => {
            assert.that(errUpdatePosition).is.null();

            simulateRestart((errSimulateRestart, other) => {
              assert.that(errSimulateRestart).is.null();

              assert.that(other.eventSequencer.models).is.equalTo({
                lists: {
                  [modelName]: { lastProcessedPosition: 23 }
                }
              });
              done();
            });
          });
        });

        test('does not update the event sequencer if the new position is less than the current one.', done => {
          listStore.updatePosition(23, errUpdatePosition1 => {
            assert.that(errUpdatePosition1).is.null();

            listStore.updatePosition(22, errUpdatePosition2 => {
              assert.that(errUpdatePosition2).is.null();

              simulateRestart((errSimulateRestart, other) => {
                assert.that(errSimulateRestart).is.null();

                assert.that(other.eventSequencer.models).is.equalTo({
                  lists: {
                    [modelName]: { lastProcessedPosition: 23 }
                  }
                });
                done();
              });
            });
          });
        });
      });

      suite('in-memory', () => {
        test('updates the event sequencer.', done => {
          assert.that(eventSequencer.models).is.equalTo({
            lists: {
              [modelName]: { lastProcessedPosition: 0 }
            }
          });

          listStore.updatePosition(23, err => {
            assert.that(err).is.null();
            assert.that(eventSequencer.models).is.equalTo({
              lists: {
                [modelName]: { lastProcessedPosition: 23 }
              }
            });
            done();
          });
        });

        test('does not update the event sequencer if the new position is less than the current one.', done => {
          listStore.updatePosition(23, errUpdatePosition1 => {
            assert.that(errUpdatePosition1).is.null();

            listStore.updatePosition(22, errUpdatePosition2 => {
              assert.that(errUpdatePosition2).is.null();

              assert.that(eventSequencer.models).is.equalTo({
                lists: {
                  [modelName]: { lastProcessedPosition: 23 }
                }
              });
              done();
            });
          });
        });
      });
    });
  });
};

module.exports = lists;

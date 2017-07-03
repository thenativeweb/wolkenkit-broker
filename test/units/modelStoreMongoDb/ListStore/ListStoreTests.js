'use strict';

const path = require('path');

const _ = require('lodash'),
      assert = require('assertthat'),
      MongoClient = require('mongodb').MongoClient,
      runfork = require('runfork'),
      sha1 = require('sha1'),
      uuid = require('uuidv4');

const env = require('../../../helpers/env'),
      EventSequencer = require('../../../../eventSequencer/EventSequencer'),
      ListStore = require('../../../../modelStoreMongoDb/ListStore');

const url = env.MONGO_URL_UNITS;

const getStoreOptions = () => {
  const modelName = uuid().substr(0, 8);

  return {
    modelName,
    initializeOptions: {
      application: 'foo',
      readModel: {
        [modelName]: {
          fields: {
            initiator: { initialState: '', fastLookup: true, isUnique: false },
            destination: { initialState: '', fastLookup: true },
            participants: { initialState: []}
          }
        }
      }
    }
  };
};

suite('ListStore', () => {
  let mongoClient;

  const resetMongoDb = function (done) {
    runfork({
      path: path.join(__dirname, '..', '..', '..', 'helpers', 'runResetMongo.js'),
      env: {
        URL: env.MONGO_URL_UNITS
      },
      onExit (exitCode) {
        if (exitCode > 0) {
          return done(new Error('Failed to reset MongoDB.'));
        }
        done(null);
      }
    }, errfork => {
      if (errfork) {
        return done(errfork);
      }
    });
  };

  suiteSetup(function (done) {
    this.timeout(10 * 1000);

    resetMongoDb(done);
  });

  suiteTeardown(function (done) {
    this.timeout(10 * 1000);

    resetMongoDb(done);
  });

  setup(done => {
    /* eslint-disable id-length */
    MongoClient.connect(url, { w: 1 }, (err, db) => {
      /* eslint-enable id-length */
      if (err) {
        return done(err);
      }
      mongoClient = db;
      done(null);
    });
  });

  teardown(done => {
    mongoClient.close(done);
  });

  suite('initialize', () => {
    test('creates collections and indexes.', done => {
      const listStore = new ListStore({ url, eventSequencer: new EventSequencer() }),
            storeOptions = getStoreOptions();

      listStore.initialize(storeOptions.initializeOptions, errInitialize => {
        assert.that(errInitialize).is.null();

        mongoClient.collection(`foo_model_list_${storeOptions.modelName}`, (errCollection, collection) => {
          assert.that(errCollection).is.null();
          collection.indexes((errIndexes, indexes) => {
            // Why do we expect 4 indexes here, not 2?
            //
            // 1. initiator (defined above)
            // 2. destination (defined above)
            // 3. id (defined by the ListStore internally)
            // 4. _id (defined by MongoDB internally)

            assert.that(errIndexes).is.null();
            assert.that(indexes.length).is.equalTo(4);

            assert.that(_.find(indexes, { name: sha1(`foo_model_list_${storeOptions.modelName}_id`).substr(0, 10) }).unique).is.true();
            assert.that(_.find(indexes, { name: sha1(`foo_model_list_${storeOptions.modelName}_initiator`).substr(0, 10) }).unique).is.undefined();
            assert.that(_.find(indexes, { name: sha1(`foo_model_list_${storeOptions.modelName}_destination`).substr(0, 10) }).unique).is.undefined();

            done();
          });
        });
      });
    });
  });

  suite('read', () => {
    test('returns an error if an invalid where clause is given.', done => {
      const listStore = new ListStore({ url, eventSequencer: new EventSequencer() }),
            storeOptions = getStoreOptions();

      listStore.initialize(storeOptions.initializeOptions, errInitialize => {
        assert.that(errInitialize).is.null();

        listStore.read({
          modelName: storeOptions.modelName,
          query: {
            where: {
              $invalid: 'foo'
            }
          }
        }, errRead => {
          assert.that(errRead).is.not.null();
          assert.that(errRead.message).is.equalTo('Keys must not begin with a $ sign.');

          done();
        });
      });
    });

    test('returns an error if invalid orderBy criteria is given.', done => {
      const listStore = new ListStore({ url, eventSequencer: new EventSequencer() }),
            storeOptions = getStoreOptions();

      listStore.initialize(storeOptions.initializeOptions, errInitialize => {
        assert.that(errInitialize).is.null();

        listStore.read({
          modelName: storeOptions.modelName,
          query: {
            orderBy: {
              timestamp: 'invalidOrderCriteria'
            }
          }
        }, errRead => {
          assert.that(errRead).is.not.null();
          assert.that(errRead.message).is.equalTo('Invalid order criteria.');

          done();
        });
      });
    });
  });
});

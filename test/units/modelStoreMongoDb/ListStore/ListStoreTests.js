'use strict';

const path = require('path');

const _ = require('lodash'),
      assert = require('assertthat'),
      { MongoClient } = require('mongodb'),
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

  const resetMongoDb = async function () {
    await new Promise((resolve, reject) => {
      try {
        runfork({
          path: path.join(__dirname, '..', '..', '..', 'helpers', 'runResetMongo.js'),
          env: {
            URL: env.MONGO_URL_UNITS
          },
          onExit (exitCode) {
            if (exitCode > 0) {
              return reject(new Error('Failed to reset MongoDB.'));
            }
            resolve(null);
          }
        });
      } catch (ex) {
        reject(ex);
      }
    });
  };

  suiteSetup(async function () {
    this.timeout(10 * 1000);

    await resetMongoDb();
  });

  suiteTeardown(async function () {
    this.timeout(10 * 1000);

    await resetMongoDb();
  });

  setup(async () => {
    /* eslint-disable id-length */
    mongoClient = await MongoClient.connect(url, { w: 1 });
    /* eslint-enable id-length */
  });

  teardown(async () => {
    await mongoClient.close();
  });

  suite('initialize', () => {
    test('creates collections and indexes.', async () => {
      const listStore = new ListStore({ url, eventSequencer: new EventSequencer() }),
            storeOptions = getStoreOptions();

      await listStore.initialize(storeOptions.initializeOptions);

      const collection = await mongoClient.collection(`foo_model_list_${storeOptions.modelName}`);

      const indexes = await collection.indexes();

      // Why do we expect 4 indexes here, not 2?
      //
      // 1. initiator (defined above)
      // 2. destination (defined above)
      // 3. id (defined by the ListStore internally)
      // 4. _id (defined by MongoDB internally)
      assert.that(indexes.length).is.equalTo(4);

      assert.that(_.find(indexes, { name: sha1(`foo_model_list_${storeOptions.modelName}_id`).substr(0, 10) }).unique).is.true();
      assert.that(_.find(indexes, { name: sha1(`foo_model_list_${storeOptions.modelName}_initiator`).substr(0, 10) }).unique).is.undefined();
      assert.that(_.find(indexes, { name: sha1(`foo_model_list_${storeOptions.modelName}_destination`).substr(0, 10) }).unique).is.undefined();
    });
  });

  suite('read', () => {
    test('returns an error if an invalid where clause is given.', async () => {
      const listStore = new ListStore({ url, eventSequencer: new EventSequencer() }),
            storeOptions = getStoreOptions();

      await listStore.initialize(storeOptions.initializeOptions);

      await assert.that(async () => {
        await listStore.read({
          modelName: storeOptions.modelName,
          query: {
            where: {
              $invalid: 'foo'
            }
          }
        });
      }).is.throwingAsync('Keys must not begin with a $ sign.');
    });

    test('returns an error if invalid orderBy criteria is given.', async () => {
      const listStore = new ListStore({ url, eventSequencer: new EventSequencer() }),
            storeOptions = getStoreOptions();

      await listStore.initialize(storeOptions.initializeOptions);

      await assert.that(async () => {
        await listStore.read({
          modelName: storeOptions.modelName,
          query: {
            orderBy: {
              timestamp: 'invalidOrderCriteria'
            }
          }
        });
      }).is.throwingAsync('Invalid order criteria.');
    });
  });
});

'use strict';

const path = require('path');

const assert = require('assertthat'),
      find = require('lodash/find'),
      { MongoClient } = require('mongodb'),
      { parse } = require('mongodb-uri'),
      runfork = require('runfork'),
      sha1 = require('sha1'),
      uuid = require('uuidv4');

const env = require('../../../shared/env'),
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
  const resetMongoDb = async function () {
    await new Promise((resolve, reject) => {
      try {
        runfork({
          path: path.join(__dirname, '..', '..', '..', 'shared', 'runResetMongo.js'),
          env: {
            URL: env.MONGO_URL_UNITS
          },
          onExit (exitCode) {
            if (exitCode > 0) {
              return reject(new Error('Failed to reset MongoDB.'));
            }
            resolve();
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

  suite('initialize', () => {
    test('creates collections and indexes.', async () => {
      /* eslint-disable id-length */
      const client = await MongoClient.connect(url, { w: 1, useNewUrlParser: true });
      const db = await client.db(parse(url).database);
      /* eslint-enable id-length */

      const listStore = new ListStore({ url, eventSequencer: new EventSequencer() }),
            storeOptions = getStoreOptions();

      await listStore.initialize(storeOptions.initializeOptions);

      const collection = await db.collection(`foo_model_list_${storeOptions.modelName}`);

      const indexes = await collection.indexes();

      // Why do we expect 4 indexes here, not 2?
      //
      // 1. initiator (defined above)
      // 2. destination (defined above)
      // 3. id (defined by the ListStore internally)
      // 4. _id (defined by MongoDB internally)
      assert.that(indexes.length).is.equalTo(4);

      assert.that(find(indexes, { name: sha1(`foo_model_list_${storeOptions.modelName}_id`).substr(0, 10) }).unique).is.true();
      assert.that(find(indexes, { name: sha1(`foo_model_list_${storeOptions.modelName}_initiator`).substr(0, 10) }).unique).is.undefined();
      assert.that(find(indexes, { name: sha1(`foo_model_list_${storeOptions.modelName}_destination`).substr(0, 10) }).unique).is.undefined();

      await client.close();
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
          applyTransformations: false,
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
          applyTransformations: false,
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

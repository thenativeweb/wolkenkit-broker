'use strict';

const { MongoClient } = require('mongodb'),
      { parse } = require('mongodb-uri'),
      processenv = require('processenv');

const url = processenv('URL');

(async () => {
  /* eslint-disable id-length */
  const client = await MongoClient.connect(url, { w: 1, useNewUrlParser: true });
  /* eslint-enable id-length */

  const db = await client.db(parse(url).database);
  const collections = await db.collections();

  for (let i = 0; i < collections.length; i++) {
    const collection = collections[i];

    if (collection.collectionName.startsWith('system')) {
      continue;
    }

    await collection.drop();
  }

  await client.close();
})();

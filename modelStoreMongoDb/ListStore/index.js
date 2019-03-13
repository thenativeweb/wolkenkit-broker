'use strict';

const { EventEmitter } = require('events'),
      { PassThrough, pipeline, Transform } = require('stream');

const cloneDeep = require('lodash/cloneDeep'),
      find = require('lodash/find'),
      flatten = require('flat'),
      mongodbUri = require('mongodb-uri'),
      { MongoClient } = require('mongodb'),
      omit = require('lodash/omit'),
      retry = require('async-retry'),
      sha1 = require('sha1');

const translate = require('./translate');

class ListStore extends EventEmitter {
  constructor ({ url, eventSequencer }) {
    if (!url) {
      throw new Error('Url is missing.');
    }
    if (!eventSequencer) {
      throw new Error('Event sequencer is missing.');
    }

    super();

    this.url = url;
    this.eventSequencer = eventSequencer;

    this.collections = {};
    this.collectionsInternal = {};
  }

  async initialize ({ application, readModel }) {
    if (!application) {
      throw new Error('Application is missing.');
    }
    if (!readModel) {
      throw new Error('Read model is missing.');
    }

    this.application = application;
    this.readModel = readModel;
    this.modelNames = Object.keys(readModel);

    /* eslint-disable id-length */
    const client = await retry(async () => {
      const connection = await MongoClient.connect(this.url, { w: 1, useNewUrlParser: true });

      return connection;
    });
    /* eslint-enable id-length */

    client.on('close', () => {
      this.emit('disconnect');
    });

    const uri = mongodbUri.parse(this.url);
    const db = client.db(uri.database);

    for (let i = 0; i < this.modelNames.length; i++) {
      const modelName = this.modelNames[i];
      const collection = await db.collection(`${application}_model_list_${modelName}`);

      this.collections[modelName] = collection;

      const fields = cloneDeep(readModel[modelName].fields);

      fields.id = { fastLookup: true, isUnique: true };

      const indexes = [];
      const fieldNames = Object.keys(fields);

      for (let j = 0; j < fieldNames.length; j++) {
        const fieldName = fieldNames[j];

        if (!fields[fieldName].fastLookup && !fields[fieldName].isUnique) {
          continue;
        }

        indexes.push({
          key: { [fieldName]: 1 },
          name: sha1(`${application}_model_list_${modelName}_${fieldName}`).substr(0, 10),
          unique: Boolean(fields[fieldName].isUnique)
        });
      }

      await this.collections[modelName].createIndexes(indexes);
    }

    this.collectionsInternal.positions = await db.collection(`${application}_model_positions`);

    await this.collectionsInternal.positions.createIndex(
      { type: 1, name: 1 },
      { name: sha1(`${application}_model_positions`).substr(0, 10), unique: true }
    );

    for (let i = 0; i < this.modelNames.length; i++) {
      const modelName = this.modelNames[i];

      try {
        await this.collectionsInternal.positions.insertOne({
          type: 'lists',
          name: modelName,
          lastProcessedPosition: 0
        });
      } catch (ex) {
        // Ignore duplicate key exceptions, because the position had already
        // been persisted and we do not need to create it now.
        if (ex.code !== 11000) {
          throw ex;
        }
      }
    }

    const positions = await this.collectionsInternal.positions.find({ type: 'lists' }).toArray();

    this.modelNames.forEach(modelName => {
      this.eventSequencer.registerModel({
        type: 'lists',
        name: modelName,
        lastProcessedPosition: find(positions, { name: modelName }).lastProcessedPosition
      });
    });
  }

  async added ({ modelName, payload }) {
    if (!modelName) {
      throw new Error('Model name is missing.');
    }
    if (!payload) {
      throw new Error('Payload is missing.');
    }

    await this.collections[modelName].insertOne(payload);

    Reflect.deleteProperty(payload, '_id');
  }

  async upserted ({ modelName, selector, payload }) {
    if (!modelName) {
      throw new Error('Model name is missing.');
    }
    if (!selector) {
      throw new Error('Selector is missing.');
    }
    if (!payload) {
      throw new Error('Payload is missing.');
    }
    if (!payload.add) {
      throw new Error('Add is missing.');
    }
    if (!payload.update) {
      throw new Error('Update is missing.');
    }

    const { add, update } = payload;

    const result = await this.updated({ modelName, selector, payload: update });

    if (result.modifiedCount > 0) {
      return;
    }

    try {
      await this.added({ modelName, payload: add });
    } catch (ex) {
      // Ignore duplicate key exceptions, because this means the entry was
      // already added in the meantime (which could be a race condition). In
      // case of any other exception, we need to throw.
      if (ex.code !== 11000) {
        throw ex;
      }

      // Perform the update again to workaround the race condition.
      await this.updated({ modelName, selector, payload: update });
    }
  }

  async ensured ({ modelName, payload }) {
    if (!modelName) {
      throw new Error('Model name is missing.');
    }
    if (!payload) {
      throw new Error('Payload is missing.');
    }

    try {
      await this.added({ modelName, payload });
    } catch (ex) {
      // Ignore duplicate key exceptions, because this means that the entry
      // already exists and everything is fine in this case.
      if (ex.code === 11000) {
        return;
      }

      throw ex;
    }
  }

  async updated ({ modelName, selector, payload }) {
    if (!modelName) {
      throw new Error('Model name is missing.');
    }
    if (!selector) {
      throw new Error('Selector is missing.');
    }
    if (!payload) {
      throw new Error('Payload is missing.');
    }

    let clonedPayload = cloneDeep(payload);

    // For isAuthorized we don't want to replace the existing one with the
    // updates in the database, but merge it. For this, we need to provide the
    // flattened path to MongoDB instead of the isAuthorized object.
    if (clonedPayload.isAuthorized) {
      const flattenedIsAuthorized = flatten({ isAuthorized: clonedPayload.isAuthorized });

      clonedPayload = omit(clonedPayload, 'isAuthorized');
      clonedPayload = { ...clonedPayload, ...flattenedIsAuthorized };
    }

    const translatedPayload = translate.payload(clonedPayload),
          translatedSelector = translate.selector(selector);

    const result = await this.collections[modelName].updateMany(translatedSelector, translatedPayload);

    return result;
  }

  async removed ({ modelName, selector }) {
    if (!modelName) {
      throw new Error('Model name is missing.');
    }
    if (!selector) {
      throw new Error('Selector is missing.');
    }
    const translatedSelector = translate.selector(selector);

    await this.collections[modelName].deleteMany(translatedSelector);
  }

  async read ({ modelName, applyTransformations, user, query }) {
    if (!modelName) {
      throw new Error('Model name is missing.');
    }
    if (applyTransformations === undefined) {
      throw new Error('Apply transformations is missing.');
    }
    if (applyTransformations && !user) {
      throw new Error('User is missing.');
    }
    if (!query) {
      throw new Error('Query is missing.');
    }

    if (!this.collections[modelName]) {
      throw new Error('Unknown model name.');
    }

    let translatedSelector;

    if (query.where) {
      translatedSelector = translate.selector(query.where);
    }

    let cursor = this.collections[modelName].find(translatedSelector);

    if (query.orderBy) {
      cursor = cursor.sort(translate.orderBy(query.orderBy));
    } else {
      // If no query is given, MongoDB returns the result in an arbitrary (?)
      // order. To restore the natural order, sort by its internal key, which
      // is ascending.
      cursor = cursor.sort({ _id: 1 });
    }

    if (query.skip) {
      cursor = cursor.skip(query.skip);
    }
    cursor = cursor.limit(query.take || 100);

    const databaseResult = cursor.stream({
      transform: item => omit(item, '_id')
    });

    if (!applyTransformations) {
      return databaseResult;
    }

    const { readModel } = this;

    const transformedResult = new Transform({
      objectMode: true,
      transform (item, encoding, callback) {
        const { transformations } = readModel[modelName];

        if (!transformations) {
          this.push(item);

          return callback(null);
        }

        const { filter, map } = transformations;

        if (filter) {
          let keepItem;

          try {
            keepItem = filter(item, { ...query, user });
          } catch (ex) {
            return callback(ex);
          }

          if (!keepItem) {
            return callback(null);
          }
        }

        let transformedItem = item;

        if (map) {
          try {
            transformedItem = map(item, { ...query, user });
          } catch (ex) {
            return callback(ex);
          }
        }

        callback(null, transformedItem);
      }
    });

    const result = new PassThrough({ objectMode: true });

    pipeline(databaseResult, transformedResult, result, err => {
      if (err) {
        result.emit('error', err);
      }
    });

    return result;
  }

  async updatePosition (position) {
    if (typeof position !== 'number') {
      throw new Error('Position is missing.');
    }

    await this.collectionsInternal.positions.updateMany(
      { type: 'lists', lastProcessedPosition: { $lt: position }},
      { $set: { lastProcessedPosition: position }}
    );

    this.modelNames.forEach(modelName => {
      if (position <= this.eventSequencer.models.lists[modelName].lastProcessedPosition) {
        return;
      }

      this.eventSequencer.updatePosition({
        type: 'lists',
        name: modelName,
        position
      });
    });
  }
}

module.exports = ListStore;

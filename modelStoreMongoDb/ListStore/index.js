'use strict';

const EventEmitter = require('events').EventEmitter,
      util = require('util');

const _ = require('lodash'),
      async = require('async'),
      MongoClient = require('mongodb').MongoClient,
      sha1 = require('sha1');

const translate = require('./translate');

const ListStore = function (options) {
  if (!options) {
    throw new Error('Options are missing.');
  }
  if (!options.url) {
    throw new Error('Url is missing.');
  }
  if (!options.eventSequencer) {
    throw new Error('Event sequencer is missing.');
  }

  this.url = options.url;
  this.eventSequencer = options.eventSequencer;

  this.collections = {};
  this.collectionsInternal = {};
};

util.inherits(ListStore, EventEmitter);

ListStore.prototype.initialize = function (options, callback) {
  if (!options) {
    throw new Error('Options are missing.');
  }
  if (!options.application) {
    throw new Error('Application is missing.');
  }
  if (!options.readModel) {
    throw new Error('Read model is missing.');
  }
  if (!callback) {
    throw new Error('Callback is missing.');
  }

  // Required for async.waterfall, unfortunately.
  const that = this;

  that.application = options.application;
  that.modelNames = Object.keys(options.readModel);
  that.db = undefined;

  async.series({
    connectToDatabase (done) {
      /* eslint-disable id-length */
      MongoClient.connect(that.url, { w: 1 }, (err, db) => {
        /* eslint-enable id-length */
        if (err) {
          return done(err);
        }
        that.db = db;
        done(null);
      });
    },
    watchForDisconnects (done) {
      that.db.on('close', () => {
        that.emit('disconnect');
      });
      done(null);
    },
    createModelCollections (done) {
      async.each(that.modelNames, (modelName, doneEach) => {
        that.db.collection(`${options.application}_model_list_${modelName}`, (err, collection) => {
          if (err) {
            return doneEach(err);
          }

          that.collections[modelName] = collection;
          doneEach(null);
        });
      }, done);
    },
    createIndexesForModels (done) {
      async.each(that.modelNames, (modelName, doneEach) => {
        const fields = _.cloneDeep(options.readModel[modelName].fields);

        fields.id = { fastLookup: true, isUnique: true };

        const indexes = [];

        Object.keys(fields).forEach(fieldName => {
          if (!fields[fieldName].fastLookup && !fields[fieldName].isUnique) {
            return;
          }

          indexes.push({
            key: { [fieldName]: 1 },
            name: sha1(`${options.application}_model_list_${modelName}_${fieldName}`).substr(0, 10),
            unique: Boolean(fields[fieldName].isUnique)
          });
        });

        that.collections[modelName].createIndexes(indexes, doneEach);
      }, done);
    },
    createPositionsCollection (done) {
      that.db.collection(`${options.application}_model_positions`, (err, collection) => {
        if (err) {
          return done(err);
        }

        that.collectionsInternal.positions = collection;
        done(null);
      });
    },
    createIndexesForPositions (done) {
      that.collectionsInternal.positions.createIndex({
        type: 1, name: 1
      }, {
        name: sha1(`${options.application}_model_positions`).substr(0, 10),
        unique: true
      }, done);
    },
    initializePositions (done) {
      async.each(that.modelNames, (modelName, doneEach) => {
        that.collectionsInternal.positions.insertOne({
          type: 'lists',
          name: modelName,
          lastProcessedPosition: 0
        }, err => {
          // Ignore duplicate key exceptions, because the position had already
          // been persisted and we do not need to create it now.
          if (err && err.code !== 11000) {
            return doneEach(err);
          }
          doneEach(null);
        });
      }, done);
    },
    registerModelsOnEventSequencer (done) {
      that.collectionsInternal.positions.find({ type: 'lists' }).toArray((err, positions) => {
        if (err) {
          return done(err);
        }

        that.modelNames.forEach(modelName => {
          that.eventSequencer.registerModel({
            type: 'lists',
            name: modelName,
            lastProcessedPosition: _.find(positions, { name: modelName }).lastProcessedPosition
          });
        });
        done(null);
      });
    }
  }, err => {
    if (err) {
      return callback(err);
    }

    callback(null);
  });
};

ListStore.prototype.added = function (options, callback) {
  if (!options) {
    throw new Error('Options are missing.');
  }
  if (!options.modelName) {
    throw new Error('Model name is missing.');
  }
  if (!options.payload) {
    throw new Error('Payload is missing.');
  }
  if (!callback) {
    throw new Error('Callback is missing.');
  }

  this.collections[options.modelName].insertOne(options.payload, err => {
    Reflect.deleteProperty(options.payload, '_id');

    if (err) {
      return callback(err);
    }
    callback(null);
  });
};

ListStore.prototype.updated = function (options, callback) {
  if (!options) {
    throw new Error('Options are missing.');
  }
  if (!options.modelName) {
    throw new Error('Model name is missing.');
  }
  if (!options.selector) {
    throw new Error('Selector is missing.');
  }
  if (!options.payload) {
    throw new Error('Payload is missing.');
  }
  if (!callback) {
    throw new Error('Callback is missing.');
  }

  let payload,
      selector;

  try {
    payload = translate.payload(options.payload);
    selector = translate.selector(options.selector);
  } catch (ex) {
    return callback(ex);
  }

  this.collections[options.modelName].updateMany(selector, payload, err => {
    if (err) {
      return callback(err);
    }
    callback(null);
  });
};

ListStore.prototype.removed = function (options, callback) {
  if (!options) {
    throw new Error('Options are missing.');
  }
  if (!options.modelName) {
    throw new Error('Model name is missing.');
  }
  if (!options.selector) {
    throw new Error('Selector is missing.');
  }
  if (!callback) {
    throw new Error('Callback is missing.');
  }

  let selector;

  try {
    selector = translate.selector(options.selector);
  } catch (ex) {
    return callback(ex);
  }

  this.collections[options.modelName].deleteMany(selector, err => {
    if (err) {
      return callback(err);
    }
    callback(null);
  });
};

ListStore.prototype.read = function (options, callback) {
  if (!options) {
    throw new Error('Options are missing.');
  }
  if (!options.modelName) {
    throw new Error('Model name is missing.');
  }
  if (!options.query) {
    throw new Error('Query is missing.');
  }
  if (!callback) {
    throw new Error('Callback is missing.');
  }

  if (!this.collections[options.modelName]) {
    return process.nextTick(() => callback(new Error('Unknown model name.')));
  }

  let selector;

  if (options.query.where) {
    selector = translate.selector(options.query.where);
  }

  let cursor = this.collections[options.modelName].find(selector);

  if (options.query.orderBy) {
    try {
      cursor = cursor.sort(translate.orderBy(options.query.orderBy));
    } catch (err) {
      return process.nextTick(() => callback(err));
    }
  } else {
    // If no query is given, MongoDB returns the result in an arbitrary (?)
    // order. To restore the natural order, sort by its internal key, which
    // is ascending.
    cursor = cursor.sort({ _id: 1 });
  }

  if (options.query.skip) {
    cursor = cursor.skip(options.query.skip);
  }
  cursor = cursor.limit(options.query.take || 100);

  const result = cursor.stream({
    transform: item => _.omit(item, '_id')
  });

  process.nextTick(() => callback(null, result));
};

ListStore.prototype.updatePosition = function (position, callback) {
  if (typeof position !== 'number') {
    throw new Error('Position is missing.');
  }
  if (!callback) {
    throw new Error('Callback is missing.');
  }

  this.collectionsInternal.positions.updateMany({
    type: 'lists',
    lastProcessedPosition: { $lt: position }
  }, { $set: { lastProcessedPosition: position }}, err => {
    if (err) {
      return callback(err);
    }

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

    callback(null);
  });
};

module.exports = ListStore;

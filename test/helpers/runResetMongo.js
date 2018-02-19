'use strict';

const async = require('async'),
      { MongoClient } = require('mongodb'),
      processenv = require('processenv');

const url = processenv('URL');

/* eslint-disable no-process-exit */
/* eslint-disable id-length */
MongoClient.connect(url, { w: 1 }, (errConnect, db) => {
  /* eslint-enable id-length */
  db.collections((errCollections, collections) => {
    if (errCollections) {
      process.exit(1);
    }

    async.each(collections, (collection, done) => {
      if (collection.collectionName.startsWith('system')) {
        return done(null);
      }
      collection.drop(done);
    }, err => {
      if (err) {
        process.exit(1);
      }

      db.close(errClose => {
        if (errClose) {
          process.exit(1);
        }

        process.exit(0);
      });
    });
  });
});
/* eslint-enable no-process-exit */

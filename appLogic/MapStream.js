'use strict';

const { Transform } = require('stream');

class MapStream extends Transform {
  constructor ({ app, map }) {
    if (!app) {
      throw new Error('App is missing.');
    }
    if (!map) {
      throw new Error('Map is missing.');
    }

    super({ objectMode: true });

    this.logger = app.services.getLogger();
    this.map = map;
  }

  async _transform (item, encoding, callback) {
    const { map } = this;

    let transformedItem;

    try {
      transformedItem = await map(item);
    } catch (ex) {
      this.logger.error('Map failed.', { item, ex });

      return callback(null);
    }

    callback(null, transformedItem);
  }
}

module.exports = MapStream;

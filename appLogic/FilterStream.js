'use strict';

const { Transform } = require('stream');

class FilterStream extends Transform {
  constructor ({ app, filter }) {
    if (!app) {
      throw new Error('App is missing.');
    }
    if (!filter) {
      throw new Error('Filter is missing.');
    }

    super({ objectMode: true });

    this.logger = app.services.getLogger();
    this.filter = filter;
  }

  async _transform (item, encoding, callback) {
    const { filter } = this;

    let keepItem;

    try {
      keepItem = await filter(item);
    } catch (ex) {
      this.logger.error('Filter failed.', { item, ex });

      keepItem = false;
    }

    if (!keepItem) {
      return callback(null);
    }

    callback(null, item);
  }
}

module.exports = FilterStream;

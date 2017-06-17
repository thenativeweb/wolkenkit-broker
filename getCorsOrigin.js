'use strict';

const _ = require('lodash');

const looksLikeARegex = function (value) {
  return value.startsWith('/') && value.endsWith('/');
};

const getCorsOrigin = function (value) {
  if (!value) {
    throw new Error('Value is missing.');
  }

  if (value === '*') {
    return value;
  }

  const origins = _.flatten([ value ]).map(origin => {
    origin = origin.trim();

    if (looksLikeARegex(origin)) {
      return new RegExp(origin.slice(1, -1));
    }

    return origin;
  });

  return origins;
};

module.exports = getCorsOrigin;

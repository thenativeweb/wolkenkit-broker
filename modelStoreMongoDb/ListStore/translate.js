'use strict';

const forEach = require('lodash/forEach'),
      merge = require('lodash/merge');

const translations = {
  selector: {
    $greaterThan (field, value) {
      return { [field]: { $gt: value }};
    },
    $greaterThanOrEqualTo (field, value) {
      return { [field]: { $gte: value }};
    },
    $lessThan (field, value) {
      return { [field]: { $lt: value }};
    },
    $lessThanOrEqualTo (field, value) {
      return { [field]: { $lte: value }};
    },
    $notEqualTo (field, value) {
      return { [field]: { $ne: value }};
    },
    $contains (field, value) {
      return { [field]: { $in: [ value ]}};
    },
    $doesNotContain (field, value) {
      return { [field]: { $nin: [ value ]}};
    },
    default (field, value) {
      return { [field]: { $eq: value }};
    }
  },

  payload: {
    $add (field, value) {
      return { $push: { [field]: value }};
    },
    $decrementBy (field, value) {
      return { $inc: { [field]: -value }};
    },
    $divideBy (field, value) {
      return { $mul: { [field]: 1 / value }};
    },
    $incrementBy (field, value) {
      return { $inc: { [field]: value }};
    },
    $multiplyBy (field, value) {
      return { $mul: { [field]: value }};
    },
    $remove (field, value) {
      return { $pull: { [field]: value }};
    },
    default (field, value) {
      return { $set: { [field]: value }};
    }
  }
};

const translate = function (source, translationType) {
  if (!source) {
    throw new Error('Source is missing.');
  }

  const target = {};

  Object.keys(source).forEach(fieldName => {
    const fieldValue = source[fieldName];

    if (fieldName === '$or' || fieldName === '$and') {
      return merge(target, {
        [fieldName]: fieldValue.map(nonTranslatedFieldValue => translate.selector(nonTranslatedFieldValue))
      });
    }

    if (fieldName.startsWith('$')) {
      throw new Error('Keys must not begin with a $ sign.');
    }

    if (typeof fieldValue === 'object') {
      const fieldValueKeys = Object.keys(fieldValue);
      const firstFieldValueKey = fieldValueKeys[0];

      if (fieldValueKeys.length === 1) {
        const translation = translations[translationType][firstFieldValueKey];

        if (translation) {
          return merge(target, translation(fieldName, fieldValue[firstFieldValueKey]));
        }
      }
    }

    merge(target, translations[translationType].default(fieldName, fieldValue));
  });

  return target;
};

translate.payload = function (payload) {
  if (!payload) {
    throw new Error('Payload is missing.');
  }

  return translate(payload, 'payload');
};

translate.selector = function (selector) {
  if (!selector) {
    throw new Error('Selector is missing.');
  }

  return translate(selector, 'selector');
};

translate.orderBy = function (orderBy) {
  if (!orderBy) {
    throw new Error('Order by is missing.');
  }

  const mapping = {
    asc: 1,
    ascending: 1,
    desc: -1,
    descending: -1
  };

  const target = {};

  forEach(orderBy, (value, key) => {
    if (!mapping[value]) {
      throw new Error('Invalid order criteria.');
    }

    target[key] = mapping[value];
  });

  return target;
};

module.exports = translate;

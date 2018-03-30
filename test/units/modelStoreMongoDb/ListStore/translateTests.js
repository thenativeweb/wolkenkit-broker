'use strict';

const assert = require('assertthat');

const translate = require('../../../../modelStoreMongoDb/ListStore/translate');

suite('translate', () => {
  test('is a function.', async () => {
    assert.that(translate).is.ofType('function');
  });

  suite('selector', () => {
    test('is a function.', async () => {
      assert.that(translate.selector).is.ofType('function');
    });

    test('throws an error if selector is missing.', async () => {
      assert.that(() => {
        translate.selector();
      }).is.throwing('Selector is missing.');
    });

    suite('equality', () => {
      test('compares a single value to a property.', async () => {
        assert.that(translate.selector({
          foo: 'bar'
        })).is.equalTo({
          foo: { $eq: 'bar' }
        });
      });

      test('compares multiple values to properties.', async () => {
        assert.that(translate.selector({
          foo: 'bar',
          bar: 'baz'
        })).is.equalTo({
          foo: { $eq: 'bar' },
          bar: { $eq: 'baz' }
        });
      });

      test('supports empty objects.', async () => {
        assert.that(translate.selector({
          foo: {}
        })).is.equalTo({
          foo: { $eq: {}}
        });
      });

      test('supports objects with one property.', async () => {
        assert.that(translate.selector({
          foo: { bar: 'baz' }
        })).is.equalTo({
          foo: { $eq: { bar: 'baz' }}
        });
      });

      test('supports objects with multiple properties.', async () => {
        assert.that(translate.selector({
          foo: { bar: 'baz', ding: 'dong' }
        })).is.equalTo({
          foo: { $eq: { bar: 'baz', ding: 'dong' }}
        });
      });

      test('supports nested keys.', async () => {
        assert.that(translate.selector({
          'foo.bar': 42
        })).is.equalTo({
          'foo.bar': { $eq: 42 }
        });
      });

      test('does not allow keys to begin with a $ sign.', async () => {
        assert.that(() => {
          translate.selector({
            $eq: 'foo'
          });
        }).is.throwing('Keys must not begin with a $ sign.');
      });
    });

    suite('$greaterThan', () => {
      test('compares a single value to a property.', async () => {
        assert.that(translate.selector({
          foo: { $greaterThan: 'bar' }
        })).is.equalTo({
          foo: { $gt: 'bar' }
        });
      });

      test('compares multiple values to properties.', async () => {
        assert.that(translate.selector({
          foo: { $greaterThan: 'bar' },
          bar: { $greaterThan: 'baz' }
        })).is.equalTo({
          foo: { $gt: 'bar' },
          bar: { $gt: 'baz' }
        });
      });

      test('supports nested keys.', async () => {
        assert.that(translate.selector({
          'foo.bar': { $greaterThan: 42 }
        })).is.equalTo({
          'foo.bar': { $gt: 42 }
        });
      });
    });

    suite('$lessThan', () => {
      test('compares a single value to a property.', async () => {
        assert.that(translate.selector({
          foo: { $lessThan: 'bar' }
        })).is.equalTo({
          foo: { $lt: 'bar' }
        });
      });

      test('compares multiple values to properties.', async () => {
        assert.that(translate.selector({
          foo: { $lessThan: 'bar' },
          bar: { $lessThan: 'baz' }
        })).is.equalTo({
          foo: { $lt: 'bar' },
          bar: { $lt: 'baz' }
        });
      });

      test('supports nested keys.', async () => {
        assert.that(translate.selector({
          'foo.bar': { $lessThan: 42 }
        })).is.equalTo({
          'foo.bar': { $lt: 42 }
        });
      });
    });

    suite('$greaterThanOrEqualTo', () => {
      test('compares a single value to a property.', async () => {
        assert.that(translate.selector({
          foo: { $greaterThanOrEqualTo: 'bar' }
        })).is.equalTo({
          foo: { $gte: 'bar' }
        });
      });

      test('compares multiple values to properties.', async () => {
        assert.that(translate.selector({
          foo: { $greaterThanOrEqualTo: 'bar' },
          bar: { $greaterThanOrEqualTo: 'baz' }
        })).is.equalTo({
          foo: { $gte: 'bar' },
          bar: { $gte: 'baz' }
        });
      });

      test('supports nested keys.', async () => {
        assert.that(translate.selector({
          'foo.bar': { $greaterThanOrEqualTo: 42 }
        })).is.equalTo({
          'foo.bar': { $gte: 42 }
        });
      });
    });

    suite('$lessThanOrEqualTo', () => {
      test('compares a single value to a property.', async () => {
        assert.that(translate.selector({
          foo: { $lessThanOrEqualTo: 'bar' }
        })).is.equalTo({
          foo: { $lte: 'bar' }
        });
      });

      test('compares multiple values to properties.', async () => {
        assert.that(translate.selector({
          foo: { $lessThanOrEqualTo: 'bar' },
          bar: { $lessThanOrEqualTo: 'baz' }
        })).is.equalTo({
          foo: { $lte: 'bar' },
          bar: { $lte: 'baz' }
        });
      });

      test('supports nested keys.', async () => {
        assert.that(translate.selector({
          'foo.bar': { $lessThanOrEqualTo: 42 }
        })).is.equalTo({
          'foo.bar': { $lte: 42 }
        });
      });
    });

    suite('$notEqualTo', () => {
      test('compares a single value to a property.', async () => {
        assert.that(translate.selector({
          foo: { $notEqualTo: 'bar' }
        })).is.equalTo({
          foo: { $ne: 'bar' }
        });
      });

      test('compares multiple values to properties.', async () => {
        assert.that(translate.selector({
          foo: { $notEqualTo: 'bar' },
          bar: { $notEqualTo: 'baz' }
        })).is.equalTo({
          foo: { $ne: 'bar' },
          bar: { $ne: 'baz' }
        });
      });

      test('supports nested keys.', async () => {
        assert.that(translate.selector({
          'foo.bar': { $notEqualTo: 42 }
        })).is.equalTo({
          'foo.bar': { $ne: 42 }
        });
      });
    });

    suite('$contains', () => {
      test('compares a single value to a property.', async () => {
        assert.that(translate.selector({
          foo: { $contains: 'bar' }
        })).is.equalTo({
          foo: { $in: [ 'bar' ]}
        });
      });

      test('compares multiple values to properties.', async () => {
        assert.that(translate.selector({
          foo: { $contains: 'bar' },
          bar: { $contains: 'baz' }
        })).is.equalTo({
          foo: { $in: [ 'bar' ]},
          bar: { $in: [ 'baz' ]}
        });
      });

      test('supports nested keys.', async () => {
        assert.that(translate.selector({
          'foo.bar': { $contains: 42 }
        })).is.equalTo({
          'foo.bar': { $in: [ 42 ]}
        });
      });
    });

    suite('$doesNotContain', () => {
      test('compares a single value to a property.', async () => {
        assert.that(translate.selector({
          foo: { $doesNotContain: 'bar' }
        })).is.equalTo({
          foo: { $nin: [ 'bar' ]}
        });
      });

      test('compares multiple values to properties.', async () => {
        assert.that(translate.selector({
          foo: { $doesNotContain: 'bar' },
          bar: { $doesNotContain: 'baz' }
        })).is.equalTo({
          foo: { $nin: [ 'bar' ]},
          bar: { $nin: [ 'baz' ]}
        });
      });

      test('supports nested keys.', async () => {
        assert.that(translate.selector({
          'foo.bar': { $doesNotContain: 42 }
        })).is.equalTo({
          'foo.bar': { $nin: [ 42 ]}
        });
      });
    });

    suite('$and', () => {
      test('combines multiple values using $and.', async () => {
        assert.that(translate.selector({
          $and: [
            { foo: 'baz' },
            { bar: 'bas' }
          ]
        })).is.equalTo({
          $and: [
            { foo: { $eq: 'baz' }},
            { bar: { $eq: 'bas' }}
          ]
        });
      });

      test('recursively applies translate.', async () => {
        assert.that(translate.selector({
          $and: [
            { foo: { $doesNotContain: 'baz' }},
            { bar: 'bas' }
          ]
        })).is.equalTo({
          $and: [
            { foo: { $nin: [ 'baz' ]}},
            { bar: { $eq: 'bas' }}
          ]
        });
      });

      test('supports $and within $and.', async () => {
        assert.that(translate.selector({
          $and: [
            { foo: 'baz' },
            { $and: [
              { bar: 'bas' },
              { bax: 'bay' }
            ]}
          ]
        })).is.equalTo({
          $and: [
            { foo: { $eq: 'baz' }},
            { $and: [
              { bar: { $eq: 'bas' }},
              { bax: { $eq: 'bay' }}
            ]}
          ]
        });
      });
    });

    suite('$or', () => {
      test('combines multiple values using $or.', async () => {
        assert.that(translate.selector({
          $or: [
            { foo: 'baz' },
            { bar: 'bas' }
          ]
        })).is.equalTo({
          $or: [
            { foo: { $eq: 'baz' }},
            { bar: { $eq: 'bas' }}
          ]
        });
      });

      test('recursively applies translate.', async () => {
        assert.that(translate.selector({
          $or: [
            { foo: { $doesNotContain: 'baz' }},
            { bar: 'bas' }
          ]
        })).is.equalTo({
          $or: [
            { foo: { $nin: [ 'baz' ]}},
            { bar: { $eq: 'bas' }}
          ]
        });
      });

      test('supports $or within $or.', async () => {
        assert.that(translate.selector({
          $or: [
            { foo: 'baz' },
            { $or: [
              { bar: 'bas' },
              { bax: 'bay' }
            ]}
          ]
        })).is.equalTo({
          $or: [
            { foo: { $eq: 'baz' }},
            { $or: [
              { bar: { $eq: 'bas' }},
              { bax: { $eq: 'bay' }}
            ]}
          ]
        });
      });
    });

    suite('invalid operator', () => {
      test('passes selector through without affecting it.', async () => {
        assert.that(translate.selector({
          foo: { $baz: 'bar' }
        })).is.equalTo({
          foo: { $eq: { $baz: 'bar' }}
        });
      });
    });
  });

  suite('payload', () => {
    test('is a function.', async () => {
      assert.that(translate.payload).is.ofType('function');
    });

    test('throws an error if payload is missing.', async () => {
      assert.that(() => {
        translate.payload();
      }).is.throwing('Payload is missing.');
    });

    suite('assignment', () => {
      test('assigns a single value to a property.', async () => {
        assert.that(translate.payload({
          foo: 'bar'
        })).is.equalTo({
          $set: { foo: 'bar' }
        });
      });

      test('assigns multiple values to properties.', async () => {
        assert.that(translate.payload({
          foo: 'bar',
          bar: 'baz'
        })).is.equalTo({
          $set: { foo: 'bar', bar: 'baz' }
        });
      });

      test('supports empty objects.', async () => {
        assert.that(translate.payload({
          foo: {}
        })).is.equalTo({
          $set: { foo: {}}
        });
      });

      test('supports objects with one property.', async () => {
        assert.that(translate.payload({
          foo: { bar: 'baz' }
        })).is.equalTo({
          $set: { foo: { bar: 'baz' }}
        });
      });

      test('supports objects with multiple properties.', async () => {
        assert.that(translate.payload({
          foo: { bar: 'baz', ding: 'dong' }
        })).is.equalTo({
          $set: { foo: { bar: 'baz', ding: 'dong' }}
        });
      });

      test('supports nested keys.', async () => {
        assert.that(translate.payload({
          'foo.bar': 42
        })).is.equalTo({
          $set: { 'foo.bar': 42 }
        });
      });

      test('does not allow keys to begin with a $ sign.', async () => {
        assert.that(() => {
          translate.payload({
            $set: 'foo'
          });
        }).is.throwing('Keys must not begin with a $ sign.');
      });
    });

    suite('$add', () => {
      test('pushes a single value to an array.', async () => {
        assert.that(translate.payload({
          foo: { $add: 'bar' }
        })).is.equalTo({
          $push: { foo: 'bar' }
        });
      });

      test('pushes multiple values to an array.', async () => {
        assert.that(translate.payload({
          foo: { $add: 'bar' },
          bar: { $add: 'baz' }
        })).is.equalTo({
          $push: { foo: 'bar', bar: 'baz' }
        });
      });

      test('supports nested keys.', async () => {
        assert.that(translate.payload({
          'foo.bar': { $add: 42 }
        })).is.equalTo({
          $push: { 'foo.bar': 42 }
        });
      });
    });

    suite('$remove', () => {
      test('pulls a single value from an array.', async () => {
        assert.that(translate.payload({
          foo: { $remove: 'bar' }
        })).is.equalTo({
          $pull: { foo: 'bar' }
        });
      });

      test('pulls multiple values from an array.', async () => {
        assert.that(translate.payload({
          foo: { $remove: 'bar' },
          bar: { $remove: 'baz' }
        })).is.equalTo({
          $pull: { foo: 'bar', bar: 'baz' }
        });
      });

      test('supports nested keys.', async () => {
        assert.that(translate.payload({
          'foo.bar': { $remove: 42 }
        })).is.equalTo({
          $pull: { 'foo.bar': 42 }
        });
      });
    });

    suite('$incrementBy', () => {
      test('increments a single value by the given amount.', async () => {
        assert.that(translate.payload({
          foo: { $incrementBy: 7 }
        })).is.equalTo({
          $inc: { foo: 7 }
        });
      });

      test('increments multiple values by the given amounts.', async () => {
        assert.that(translate.payload({
          foo: { $incrementBy: 7 },
          bar: { $incrementBy: 5 }
        })).is.equalTo({
          $inc: { foo: 7, bar: 5 }
        });
      });

      test('supports nested keys.', async () => {
        assert.that(translate.payload({
          'foo.bar': { $incrementBy: 7 }
        })).is.equalTo({
          $inc: { 'foo.bar': 7 }
        });
      });
    });

    suite('$decrementBy', () => {
      test('decrements a single value by the given amount.', async () => {
        assert.that(translate.payload({
          foo: { $decrementBy: 7 }
        })).is.equalTo({
          $inc: { foo: -7 }
        });
      });

      test('decrements multiple values by the given amounts.', async () => {
        assert.that(translate.payload({
          foo: { $decrementBy: 7 },
          bar: { $decrementBy: 5 }
        })).is.equalTo({
          $inc: { foo: -7, bar: -5 }
        });
      });

      test('supports nested keys.', async () => {
        assert.that(translate.payload({
          'foo.bar': { $decrementBy: 7 }
        })).is.equalTo({
          $inc: { 'foo.bar': -7 }
        });
      });
    });

    suite('$multiplyBy', () => {
      test('multiplies a single value by the given factor.', async () => {
        assert.that(translate.payload({
          foo: { $multiplyBy: 7 }
        })).is.equalTo({
          $mul: { foo: 7 }
        });
      });

      test('multiplies multiple values by the given factors.', async () => {
        assert.that(translate.payload({
          foo: { $multiplyBy: 7 },
          bar: { $multiplyBy: 5 }
        })).is.equalTo({
          $mul: { foo: 7, bar: 5 }
        });
      });

      test('supports nested keys.', async () => {
        assert.that(translate.payload({
          'foo.bar': { $multiplyBy: 7 }
        })).is.equalTo({
          $mul: { 'foo.bar': 7 }
        });
      });
    });

    suite('$divideBy', () => {
      test('divides a single value by the given divisor.', async () => {
        assert.that(translate.payload({
          foo: { $divideBy: 2 }
        })).is.equalTo({
          $mul: { foo: 0.5 }
        });
      });

      test('divides multiple values by the given divisors.', async () => {
        assert.that(translate.payload({
          foo: { $divideBy: 2 },
          bar: { $divideBy: 4 }
        })).is.equalTo({
          $mul: { foo: 0.5, bar: 0.25 }
        });
      });

      test('supports nested keys.', async () => {
        assert.that(translate.payload({
          'foo.bar': { $divideBy: 2 }
        })).is.equalTo({
          $mul: { 'foo.bar': 0.5 }
        });
      });
    });

    suite('invalid operator', () => {
      test('passes payload through without affecting it.', async () => {
        assert.that(translate.payload({
          foo: { $baz: 'bar' }
        })).is.equalTo({
          $set: { foo: { $baz: 'bar' }}
        });
      });
    });
  });

  suite('orderBy', () => {
    test('is a function.', async () => {
      assert.that(translate.orderBy).is.ofType('function');
    });

    test('throws an error if order by is missing.', async () => {
      assert.that(() => {
        translate.orderBy();
      }).is.throwing('Order by is missing.');
    });

    test('translates ascending and descending.', async () => {
      assert.that(translate.orderBy({
        lastName: 'ascending',
        firstName: 'descending'
      })).is.equalTo({
        lastName: 1,
        firstName: -1
      });
    });

    test('translates asc and desc.', async () => {
      assert.that(translate.orderBy({
        lastName: 'asc',
        firstName: 'desc'
      })).is.equalTo({
        lastName: 1,
        firstName: -1
      });
    });

    test('throws an error if an invalid order criteria is specified.', async () => {
      assert.that(() => {
        translate.orderBy({
          lastName: 'ascending',
          firstName: 'foo'
        });
      }).is.throwing('Invalid order criteria.');
    });
  });
});

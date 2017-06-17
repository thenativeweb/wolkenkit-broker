'use strict';

const assert = require('assertthat');

const translate = require('../../../../modelStoreMongoDb/ListStore/translate');

suite('translate', () => {
  test('is a function.', done => {
    assert.that(translate).is.ofType('function');
    done();
  });

  suite('selector', () => {
    test('is a function.', done => {
      assert.that(translate.selector).is.ofType('function');
      done();
    });

    test('throws an error if selector is missing.', done => {
      assert.that(() => {
        translate.selector();
      }).is.throwing('Selector is missing.');
      done();
    });

    suite('equality', () => {
      test('compares a single value to a property.', done => {
        assert.that(translate.selector({
          foo: 'bar'
        })).is.equalTo({
          foo: { $eq: 'bar' }
        });
        done();
      });

      test('compares multiple values to properties.', done => {
        assert.that(translate.selector({
          foo: 'bar',
          bar: 'baz'
        })).is.equalTo({
          foo: { $eq: 'bar' },
          bar: { $eq: 'baz' }
        });
        done();
      });

      test('supports empty objects.', done => {
        assert.that(translate.selector({
          foo: {}
        })).is.equalTo({
          foo: { $eq: {}}
        });
        done();
      });

      test('supports objects with one property.', done => {
        assert.that(translate.selector({
          foo: { bar: 'baz' }
        })).is.equalTo({
          foo: { $eq: { bar: 'baz' }}
        });
        done();
      });

      test('supports objects with multiple properties.', done => {
        assert.that(translate.selector({
          foo: { bar: 'baz', ding: 'dong' }
        })).is.equalTo({
          foo: { $eq: { bar: 'baz', ding: 'dong' }}
        });
        done();
      });

      test('supports nested keys.', done => {
        assert.that(translate.selector({
          'foo.bar': 42
        })).is.equalTo({
          'foo.bar': { $eq: 42 }
        });
        done();
      });

      test('does not allow keys to begin with a $ sign.', done => {
        assert.that(() => {
          translate.selector({
            $eq: 'foo'
          });
        }).is.throwing('Keys must not begin with a $ sign.');
        done();
      });
    });

    suite('$greaterThan', () => {
      test('compares a single value to a property.', done => {
        assert.that(translate.selector({
          foo: { $greaterThan: 'bar' }
        })).is.equalTo({
          foo: { $gt: 'bar' }
        });
        done();
      });

      test('compares multiple values to properties.', done => {
        assert.that(translate.selector({
          foo: { $greaterThan: 'bar' },
          bar: { $greaterThan: 'baz' }
        })).is.equalTo({
          foo: { $gt: 'bar' },
          bar: { $gt: 'baz' }
        });
        done();
      });

      test('supports nested keys.', done => {
        assert.that(translate.selector({
          'foo.bar': { $greaterThan: 42 }
        })).is.equalTo({
          'foo.bar': { $gt: 42 }
        });
        done();
      });
    });

    suite('$lessThan', () => {
      test('compares a single value to a property.', done => {
        assert.that(translate.selector({
          foo: { $lessThan: 'bar' }
        })).is.equalTo({
          foo: { $lt: 'bar' }
        });
        done();
      });

      test('compares multiple values to properties.', done => {
        assert.that(translate.selector({
          foo: { $lessThan: 'bar' },
          bar: { $lessThan: 'baz' }
        })).is.equalTo({
          foo: { $lt: 'bar' },
          bar: { $lt: 'baz' }
        });
        done();
      });

      test('supports nested keys.', done => {
        assert.that(translate.selector({
          'foo.bar': { $lessThan: 42 }
        })).is.equalTo({
          'foo.bar': { $lt: 42 }
        });
        done();
      });
    });

    suite('$greaterThanOrEqualTo', () => {
      test('compares a single value to a property.', done => {
        assert.that(translate.selector({
          foo: { $greaterThanOrEqualTo: 'bar' }
        })).is.equalTo({
          foo: { $gte: 'bar' }
        });
        done();
      });

      test('compares multiple values to properties.', done => {
        assert.that(translate.selector({
          foo: { $greaterThanOrEqualTo: 'bar' },
          bar: { $greaterThanOrEqualTo: 'baz' }
        })).is.equalTo({
          foo: { $gte: 'bar' },
          bar: { $gte: 'baz' }
        });
        done();
      });

      test('supports nested keys.', done => {
        assert.that(translate.selector({
          'foo.bar': { $greaterThanOrEqualTo: 42 }
        })).is.equalTo({
          'foo.bar': { $gte: 42 }
        });
        done();
      });
    });

    suite('$lessThanOrEqualTo', () => {
      test('compares a single value to a property.', done => {
        assert.that(translate.selector({
          foo: { $lessThanOrEqualTo: 'bar' }
        })).is.equalTo({
          foo: { $lte: 'bar' }
        });
        done();
      });

      test('compares multiple values to properties.', done => {
        assert.that(translate.selector({
          foo: { $lessThanOrEqualTo: 'bar' },
          bar: { $lessThanOrEqualTo: 'baz' }
        })).is.equalTo({
          foo: { $lte: 'bar' },
          bar: { $lte: 'baz' }
        });
        done();
      });

      test('supports nested keys.', done => {
        assert.that(translate.selector({
          'foo.bar': { $lessThanOrEqualTo: 42 }
        })).is.equalTo({
          'foo.bar': { $lte: 42 }
        });
        done();
      });
    });

    suite('$notEqualTo', () => {
      test('compares a single value to a property.', done => {
        assert.that(translate.selector({
          foo: { $notEqualTo: 'bar' }
        })).is.equalTo({
          foo: { $ne: 'bar' }
        });
        done();
      });

      test('compares multiple values to properties.', done => {
        assert.that(translate.selector({
          foo: { $notEqualTo: 'bar' },
          bar: { $notEqualTo: 'baz' }
        })).is.equalTo({
          foo: { $ne: 'bar' },
          bar: { $ne: 'baz' }
        });
        done();
      });

      test('supports nested keys.', done => {
        assert.that(translate.selector({
          'foo.bar': { $notEqualTo: 42 }
        })).is.equalTo({
          'foo.bar': { $ne: 42 }
        });
        done();
      });
    });

    suite('$contains', () => {
      test('compares a single value to a property.', done => {
        assert.that(translate.selector({
          foo: { $contains: 'bar' }
        })).is.equalTo({
          foo: { $in: [ 'bar' ]}
        });
        done();
      });

      test('compares multiple values to properties.', done => {
        assert.that(translate.selector({
          foo: { $contains: 'bar' },
          bar: { $contains: 'baz' }
        })).is.equalTo({
          foo: { $in: [ 'bar' ]},
          bar: { $in: [ 'baz' ]}
        });
        done();
      });

      test('supports nested keys.', done => {
        assert.that(translate.selector({
          'foo.bar': { $contains: 42 }
        })).is.equalTo({
          'foo.bar': { $in: [ 42 ]}
        });
        done();
      });
    });

    suite('$doesNotContain', () => {
      test('compares a single value to a property.', done => {
        assert.that(translate.selector({
          foo: { $doesNotContain: 'bar' }
        })).is.equalTo({
          foo: { $nin: [ 'bar' ]}
        });
        done();
      });

      test('compares multiple values to properties.', done => {
        assert.that(translate.selector({
          foo: { $doesNotContain: 'bar' },
          bar: { $doesNotContain: 'baz' }
        })).is.equalTo({
          foo: { $nin: [ 'bar' ]},
          bar: { $nin: [ 'baz' ]}
        });
        done();
      });

      test('supports nested keys.', done => {
        assert.that(translate.selector({
          'foo.bar': { $doesNotContain: 42 }
        })).is.equalTo({
          'foo.bar': { $nin: [ 42 ]}
        });
        done();
      });
    });

    suite('$and', () => {
      test('combines multiple values using $and.', done => {
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
        done();
      });

      test('recursively applies translate.', done => {
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
        done();
      });

      test('supports $and within $and.', done => {
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
        done();
      });
    });

    suite('$or', () => {
      test('combines multiple values using $or.', done => {
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
        done();
      });

      test('recursively applies translate.', done => {
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
        done();
      });

      test('supports $or within $or.', done => {
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
        done();
      });
    });

    suite('invalid operator', () => {
      test('passes selector through without affecting it.', done => {
        assert.that(translate.selector({
          foo: { $baz: 'bar' }
        })).is.equalTo({
          foo: { $eq: { $baz: 'bar' }}
        });
        done();
      });
    });
  });

  suite('payload', () => {
    test('is a function.', done => {
      assert.that(translate.payload).is.ofType('function');
      done();
    });

    test('throws an error if payload is missing.', done => {
      assert.that(() => {
        translate.payload();
      }).is.throwing('Payload is missing.');
      done();
    });

    suite('assignment', () => {
      test('assigns a single value to a property.', done => {
        assert.that(translate.payload({
          foo: 'bar'
        })).is.equalTo({
          $set: { foo: 'bar' }
        });
        done();
      });

      test('assigns multiple values to properties.', done => {
        assert.that(translate.payload({
          foo: 'bar',
          bar: 'baz'
        })).is.equalTo({
          $set: { foo: 'bar', bar: 'baz' }
        });
        done();
      });

      test('supports empty objects.', done => {
        assert.that(translate.payload({
          foo: {}
        })).is.equalTo({
          $set: { foo: {}}
        });
        done();
      });

      test('supports objects with one property.', done => {
        assert.that(translate.payload({
          foo: { bar: 'baz' }
        })).is.equalTo({
          $set: { foo: { bar: 'baz' }}
        });
        done();
      });

      test('supports objects with multiple properties.', done => {
        assert.that(translate.payload({
          foo: { bar: 'baz', ding: 'dong' }
        })).is.equalTo({
          $set: { foo: { bar: 'baz', ding: 'dong' }}
        });
        done();
      });

      test('supports nested keys.', done => {
        assert.that(translate.payload({
          'foo.bar': 42
        })).is.equalTo({
          $set: { 'foo.bar': 42 }
        });
        done();
      });

      test('does not allow keys to begin with a $ sign.', done => {
        assert.that(() => {
          translate.payload({
            $set: 'foo'
          });
        }).is.throwing('Keys must not begin with a $ sign.');
        done();
      });
    });

    suite('$add', () => {
      test('pushes a single value to an array.', done => {
        assert.that(translate.payload({
          foo: { $add: 'bar' }
        })).is.equalTo({
          $push: { foo: 'bar' }
        });
        done();
      });

      test('pushes multiple values to an array.', done => {
        assert.that(translate.payload({
          foo: { $add: 'bar' },
          bar: { $add: 'baz' }
        })).is.equalTo({
          $push: { foo: 'bar', bar: 'baz' }
        });
        done();
      });

      test('supports nested keys.', done => {
        assert.that(translate.payload({
          'foo.bar': { $add: 42 }
        })).is.equalTo({
          $push: { 'foo.bar': 42 }
        });
        done();
      });
    });

    suite('$remove', () => {
      test('pulls a single value from an array.', done => {
        assert.that(translate.payload({
          foo: { $remove: 'bar' }
        })).is.equalTo({
          $pull: { foo: 'bar' }
        });
        done();
      });

      test('pulls multiple values from an array.', done => {
        assert.that(translate.payload({
          foo: { $remove: 'bar' },
          bar: { $remove: 'baz' }
        })).is.equalTo({
          $pull: { foo: 'bar', bar: 'baz' }
        });
        done();
      });

      test('supports nested keys.', done => {
        assert.that(translate.payload({
          'foo.bar': { $remove: 42 }
        })).is.equalTo({
          $pull: { 'foo.bar': 42 }
        });
        done();
      });
    });

    suite('$incrementBy', () => {
      test('increments a single value by the given amount.', done => {
        assert.that(translate.payload({
          foo: { $incrementBy: 7 }
        })).is.equalTo({
          $inc: { foo: 7 }
        });
        done();
      });

      test('increments multiple values by the given amounts.', done => {
        assert.that(translate.payload({
          foo: { $incrementBy: 7 },
          bar: { $incrementBy: 5 }
        })).is.equalTo({
          $inc: { foo: 7, bar: 5 }
        });
        done();
      });

      test('supports nested keys.', done => {
        assert.that(translate.payload({
          'foo.bar': { $incrementBy: 7 }
        })).is.equalTo({
          $inc: { 'foo.bar': 7 }
        });
        done();
      });
    });

    suite('$decrementBy', () => {
      test('decrements a single value by the given amount.', done => {
        assert.that(translate.payload({
          foo: { $decrementBy: 7 }
        })).is.equalTo({
          $inc: { foo: -7 }
        });
        done();
      });

      test('decrements multiple values by the given amounts.', done => {
        assert.that(translate.payload({
          foo: { $decrementBy: 7 },
          bar: { $decrementBy: 5 }
        })).is.equalTo({
          $inc: { foo: -7, bar: -5 }
        });
        done();
      });

      test('supports nested keys.', done => {
        assert.that(translate.payload({
          'foo.bar': { $decrementBy: 7 }
        })).is.equalTo({
          $inc: { 'foo.bar': -7 }
        });
        done();
      });
    });

    suite('$multiplyBy', () => {
      test('multiplies a single value by the given factor.', done => {
        assert.that(translate.payload({
          foo: { $multiplyBy: 7 }
        })).is.equalTo({
          $mul: { foo: 7 }
        });
        done();
      });

      test('multiplies multiple values by the given factors.', done => {
        assert.that(translate.payload({
          foo: { $multiplyBy: 7 },
          bar: { $multiplyBy: 5 }
        })).is.equalTo({
          $mul: { foo: 7, bar: 5 }
        });
        done();
      });

      test('supports nested keys.', done => {
        assert.that(translate.payload({
          'foo.bar': { $multiplyBy: 7 }
        })).is.equalTo({
          $mul: { 'foo.bar': 7 }
        });
        done();
      });
    });

    suite('$divideBy', () => {
      test('divides a single value by the given divisor.', done => {
        assert.that(translate.payload({
          foo: { $divideBy: 2 }
        })).is.equalTo({
          $mul: { foo: 0.5 }
        });
        done();
      });

      test('divides multiple values by the given divisors.', done => {
        assert.that(translate.payload({
          foo: { $divideBy: 2 },
          bar: { $divideBy: 4 }
        })).is.equalTo({
          $mul: { foo: 0.5, bar: 0.25 }
        });
        done();
      });

      test('supports nested keys.', done => {
        assert.that(translate.payload({
          'foo.bar': { $divideBy: 2 }
        })).is.equalTo({
          $mul: { 'foo.bar': 0.5 }
        });
        done();
      });
    });

    suite('invalid operator', () => {
      test('passes payload through without affecting it.', done => {
        assert.that(translate.payload({
          foo: { $baz: 'bar' }
        })).is.equalTo({
          $set: { foo: { $baz: 'bar' }}
        });
        done();
      });
    });
  });

  suite('orderBy', () => {
    test('is a function.', done => {
      assert.that(translate.orderBy).is.ofType('function');
      done();
    });

    test('throws an error if order by is missing.', done => {
      assert.that(() => {
        translate.orderBy();
      }).is.throwing('Order by is missing.');
      done();
    });

    test('translates ascending and descending.', done => {
      assert.that(translate.orderBy({
        lastName: 'ascending',
        firstName: 'descending'
      })).is.equalTo({
        lastName: 1,
        firstName: -1
      });
      done();
    });

    test('translates asc and desc.', done => {
      assert.that(translate.orderBy({
        lastName: 'asc',
        firstName: 'desc'
      })).is.equalTo({
        lastName: 1,
        firstName: -1
      });
      done();
    });

    test('throws an error if an invalid order criteria is specified.', done => {
      assert.that(() => {
        translate.orderBy({
          lastName: 'ascending',
          firstName: 'foo'
        });
      }).is.throwing('Invalid order criteria.');
      done();
    });
  });
});

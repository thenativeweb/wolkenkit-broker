'use strict';

const assert = require('assertthat');

const getCorsOrigin = require('../../getCorsOrigin');

suite('getCorsOrigin', () => {
  test('is a function.', async () => {
    assert.that(getCorsOrigin).is.ofType('function');
  });

  test('throws an error if value is missing.', async () => {
    assert.that(() => {
      getCorsOrigin();
    }).is.throwing('Value is missing.');
  });

  test('returns * if * is given.', async () => {
    assert.that(getCorsOrigin('*')).is.equalTo('*');
  });

  test('returns an array with one item if a single value is given.', async () => {
    assert.that(getCorsOrigin('http://www.thenativeweb.io')).is.equalTo([
      'http://www.thenativeweb.io'
    ]);
  });

  test('returns an array with multiple items if multiple values are given.', async () => {
    assert.that(getCorsOrigin([ 'http://www.thenativeweb.io', 'http://www.example.com' ])).is.equalTo([
      'http://www.thenativeweb.io',
      'http://www.example.com'
    ]);
  });

  test('supports regular expressions.', async () => {
    assert.that(getCorsOrigin([ 'http://www.thenativeweb.io', '/\\.thenativeweb\\.io$/' ])).is.equalTo([
      'http://www.thenativeweb.io',
      /\.thenativeweb\.io$/
    ]);
  });

  test('trims whitespace.', async () => {
    assert.that(getCorsOrigin([ ' http://www.thenativeweb.io   ', '  /\\.thenativeweb\\.io$/  ' ])).is.equalTo([
      'http://www.thenativeweb.io',
      /\.thenativeweb\.io$/
    ]);
  });
});

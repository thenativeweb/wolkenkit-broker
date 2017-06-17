'use strict';

const assert = require('assertthat');

const getCorsOrigin = require('../../getCorsOrigin');

suite('getCorsOrigin', () => {
  test('is a function.', done => {
    assert.that(getCorsOrigin).is.ofType('function');
    done();
  });

  test('throws an error if value is missing.', done => {
    assert.that(() => {
      getCorsOrigin();
    }).is.throwing('Value is missing.');
    done();
  });

  test('returns * if * is given.', done => {
    assert.that(getCorsOrigin('*')).is.equalTo('*');
    done();
  });

  test('returns an array with one item if a single value is given.', done => {
    assert.that(getCorsOrigin('http://www.thenativeweb.io')).is.equalTo([
      'http://www.thenativeweb.io'
    ]);
    done();
  });

  test('returns an array with multiple items if multiple values are given.', done => {
    assert.that(getCorsOrigin([ 'http://www.thenativeweb.io', 'http://www.example.com' ])).is.equalTo([
      'http://www.thenativeweb.io',
      'http://www.example.com'
    ]);
    done();
  });

  test('supports regular expressions.', done => {
    assert.that(getCorsOrigin([ 'http://www.thenativeweb.io', '/\\.thenativeweb\\.io$/' ])).is.equalTo([
      'http://www.thenativeweb.io',
      /\.thenativeweb\.io$/
    ]);
    done();
  });

  test('trims whitespace.', done => {
    assert.that(getCorsOrigin([ ' http://www.thenativeweb.io   ', '  /\\.thenativeweb\\.io$/  ' ])).is.equalTo([
      'http://www.thenativeweb.io',
      /\.thenativeweb\.io$/
    ]);
    done();
  });
});

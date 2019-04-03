'use strict';

const path = require('path');

const assert = require('assertthat'),
      tailwind = require('tailwind'),
      toArray = require('streamtoarray');

const FilterStream = require('../../../appLogic/FilterStream');

const app = tailwind.createApp({
  keys: path.join(__dirname, '..', '..', 'shared', 'keys'),
  identityProviders: [
    {
      issuer: 'https://auth.thenativeweb.io',
      certificate: path.join(__dirname, '..', '..', 'shared', 'keys', 'certificate.pem')
    }
  ]
});

suite('FilterStream', () => {
  test('is a function.', async () => {
    assert.that(FilterStream).is.ofType('function');
  });

  test('throws an error if app is missing.', async () => {
    assert.that(() => {
      /* eslint-disable no-new */
      new FilterStream({});
      /* eslint-enable no-new */
    }).is.throwing('App is missing.');
  });

  test('throws an error if filter is missing.', async () => {
    assert.that(() => {
      /* eslint-disable no-new */
      new FilterStream({ app });
      /* eslint-enable no-new */
    }).is.throwing('Filter is missing.');
  });

  test('forwards items if the filter returns true.', async () => {
    const filterStream = new FilterStream({
      app,
      filter () {
        return true;
      }
    });

    filterStream.write({ firstName: 'Jane', lastName: 'Doe' });
    filterStream.write({ firstName: 'Jenny', lastName: 'Doe' });
    filterStream.end();

    const items = await toArray(filterStream);

    assert.that(items).is.equalTo([
      { firstName: 'Jane', lastName: 'Doe' },
      { firstName: 'Jenny', lastName: 'Doe' }
    ]);
  });

  test('does not forward items if the filter returns false.', async () => {
    const filterStream = new FilterStream({
      app,
      filter (item) {
        return item.firstName === 'Jenny';
      }
    });

    filterStream.write({ firstName: 'Jane', lastName: 'Doe' });
    filterStream.write({ firstName: 'Jenny', lastName: 'Doe' });
    filterStream.end();

    const items = await toArray(filterStream);

    assert.that(items).is.equalTo([
      { firstName: 'Jenny', lastName: 'Doe' }
    ]);
  });

  test('does not forward items if the filter throws an error.', async () => {
    const filterStream = new FilterStream({
      app,
      filter () {
        throw new Error('Filter failed.');
      }
    });

    filterStream.write({ firstName: 'Jane', lastName: 'Doe' });
    filterStream.end();

    const items = await toArray(filterStream);

    assert.that(items).is.equalTo([]);
  });
});

'use strict';

const path = require('path');

const assert = require('assertthat'),
      tailwind = require('tailwind'),
      toArray = require('streamtoarray');

const MapStream = require('../../../appLogic/MapStream');

const app = tailwind.createApp({
  keys: path.join(__dirname, '..', '..', 'shared', 'keys'),
  identityProviders: [
    {
      issuer: 'https://auth.thenativeweb.io',
      certificate: path.join(__dirname, '..', '..', 'shared', 'keys', 'certificate.pem')
    }
  ]
});

suite('MapStream', () => {
  test('is a function.', async () => {
    assert.that(MapStream).is.ofType('function');
  });

  test('throws an error if app is missing.', async () => {
    assert.that(() => {
      /* eslint-disable no-new */
      new MapStream({});
      /* eslint-enable no-new */
    }).is.throwing('App is missing.');
  });

  test('throws an error if map is missing.', async () => {
    assert.that(() => {
      /* eslint-disable no-new */
      new MapStream({ app });
      /* eslint-enable no-new */
    }).is.throwing('Map is missing.');
  });

  test('maps items.', async () => {
    const mapStream = new MapStream({
      app,
      map (item) {
        return { fullName: `${item.firstName} ${item.lastName}` };
      }
    });

    mapStream.write({ firstName: 'Jane', lastName: 'Doe' });
    mapStream.write({ firstName: 'Jenny', lastName: 'Doe' });
    mapStream.end();

    const items = await toArray(mapStream);

    assert.that(items).is.equalTo([
      { fullName: 'Jane Doe' },
      { fullName: 'Jenny Doe' }
    ]);
  });

  test('skips items if map throws an error.', async () => {
    const mapStream = new MapStream({
      app,
      map () {
        throw new Error('Map failed.');
      }
    });

    mapStream.write({ firstName: 'Jane', lastName: 'Doe' });
    mapStream.end();

    const items = await toArray(mapStream);

    assert.that(items).is.equalTo([]);
  });
});

'use strict';

const { parse } = require('pg-connection-string'),
      pg = require('pg'),
      processenv = require('processenv');

const namespace = processenv('NAMESPACE'),
      url = processenv('URL');

(async () => {
  const pool = new pg.Pool(parse(url));

  const db = await pool.connect();

  await db.query(`TRUNCATE store_${namespace}_events, store_${namespace}_snapshots;`);

  db.release();
  pool.end();
})();

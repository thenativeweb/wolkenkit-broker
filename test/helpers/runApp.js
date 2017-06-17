'use strict';

const fork = require('child_process').fork;

let appProcess;

const cleanUpAndExit = function () {
  if (appProcess) {
    appProcess.kill('SIGINT');
  }

  /* eslint-disable no-process-exit */
  process.exit();
  /* eslint-enable no-process-exit */
};

const stop = function () {
  process.removeListener('SIGINT', cleanUpAndExit);
  process.removeListener('SIGTERM', cleanUpAndExit);

  appProcess.kill('SIGINT');
  appProcess = undefined;
};

const runApp = function (options, callback) {
  if (!options) {
    throw new Error('Options are missing.');
  }
  if (!options.app) {
    throw new Error('App is missing.');
  }
  if (!callback) {
    throw new Error('Callback is missing.');
  }

  options.env = options.env || {};

  if (appProcess) {
    return callback(new Error('App has already been started.'));
  }

  appProcess = fork(options.app, {
    env: options.env
  });

  process.on('SIGINT', cleanUpAndExit);
  process.on('SIGTERM', cleanUpAndExit);

  setTimeout(() => {
    callback(null, stop);
  }, 2 * 1000);
};

module.exports = runApp;

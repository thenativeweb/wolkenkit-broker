'use strict';

const async = require('async');

const performReplay = function (options, callback) {
  const { eventStore, fromPosition, toPosition, handleReplayedDomainEvent } = options;

  eventStore.getReplay({ fromPosition, toPosition }, (err, replayStream) => {
    if (err) {
      return callback(err);
    }

    let onData,
        onEnd,
        onError;

    const unsubscribe = function () {
      replayStream.removeListener('data', onData);
      replayStream.removeListener('end', onEnd);
      replayStream.removeListener('error', onError);
    };

    let isOnDataProcessing = false;

    onData = function (replayedDomainEvent) {
      isOnDataProcessing = true;
      replayStream.pause();

      handleReplayedDomainEvent(replayedDomainEvent, errHandleReplayedDomainEvent => {
        isOnDataProcessing = false;

        if (errHandleReplayedDomainEvent) {
          return onError(errHandleReplayedDomainEvent);
        }
        replayStream.resume();
      });
    };

    onEnd = function () {
      unsubscribe();
      async.whilst(
        () => isOnDataProcessing,
        done => setTimeout(done, 100),
        () => {
          callback(null);
        }
      );
    };

    onError = function (errStream) {
      unsubscribe();
      replayStream.resume();
      callback(errStream);
    };

    replayStream.on('data', onData);
    replayStream.on('end', onEnd);
    replayStream.on('error', onError);
  });
};

module.exports = performReplay;

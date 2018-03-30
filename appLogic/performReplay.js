'use strict';

const performReplay = async function ({ eventStore, fromPosition, toPosition, handleReplayedDomainEvent }) {
  if (!eventStore) {
    throw new Error('Event store is missing.');
  }
  if (!handleReplayedDomainEvent) {
    throw new Error('Handle replayed domain event is missing.');
  }

  const replayStream = await eventStore.getReplay({ fromPosition, toPosition });

  await new Promise((resolve, reject) => {
    let onData,
        onEnd,
        onError;

    const unsubscribe = function () {
      replayStream.removeListener('data', onData);
      replayStream.removeListener('end', onEnd);
      replayStream.removeListener('error', onError);
    };

    let isOnDataProcessing = false;

    onData = async function (replayedDomainEvent) {
      isOnDataProcessing = true;
      replayStream.pause();

      try {
        await handleReplayedDomainEvent(replayedDomainEvent);
      } catch (ex) {
        return onError(ex);
      } finally {
        isOnDataProcessing = false;
      }

      replayStream.resume();
    };

    onEnd = async function () {
      unsubscribe();

      /* eslint-disable no-unmodified-loop-condition */
      while (isOnDataProcessing) {
        await new Promise(resolveTimeout => setTimeout(resolveTimeout, 100));
      }
      /* eslint-enable no-unmodified-loop-condition */

      resolve();
    };

    onError = function (err) {
      unsubscribe();
      replayStream.resume();
      reject(err);
    };

    replayStream.on('data', onData);
    replayStream.on('end', onEnd);
    replayStream.on('error', onError);
  });
};

module.exports = performReplay;

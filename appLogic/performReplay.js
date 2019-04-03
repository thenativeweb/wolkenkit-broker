'use strict';

const performReplay = async function ({ eventStore, fromPosition, toPosition, handleReplayedDomainEvent }) {
  if (!eventStore) {
    throw new Error('Event store is missing.');
  }
  if (!handleReplayedDomainEvent) {
    throw new Error('Handle replayed domain event is missing.');
  }

  const replayStream = await eventStore.getReplay({ fromPosition, toPosition });

  for await (const replayedDomainEvent of replayStream) {
    await handleReplayedDomainEvent(replayedDomainEvent);
  }
};

module.exports = performReplay;

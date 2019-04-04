'use strict';

const { forPublic } = require('wolkenkit-application-tools');

const fields = {
  initiator: { initialState: '', fastLookup: true, isUnique: false },
  destination: { initialState: '', fastLookup: true },
  participants: { initialState: []}
};

const projections = {
  'planning.peerGroup.started' (peerGroups, event) {
    peerGroups.add({
      initiator: event.data.initiator,
      destination: event.data.destination,
      participants: fields.participants.initialState
    });
  }
};

const queries = {
  readItem: {
    isAuthorized: forPublic(),

    filter (peerGroup, query, { client }) {
      if (client.user.id !== 'anonymous') {
        return true;
      }

      return !peerGroup.destination.includes('bad-word');
    }
  }
};

module.exports = { fields, projections, queries };

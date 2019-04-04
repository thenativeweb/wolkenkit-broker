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

    map (peerGroup, query, { client }) {
      if (client.user.id !== 'anonymous') {
        return peerGroup;
      }

      // Hide person-related data due to privacy reasons for anonymous users.
      return { destination: peerGroup.destination };
    }
  }
};

module.exports = { fields, projections, queries };

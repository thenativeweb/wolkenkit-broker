'use strict';

const { forAuthenticated } = require('wolkenkit-application-tools');

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
    isAuthorized: forAuthenticated()
  }
};

module.exports = { fields, projections, queries };

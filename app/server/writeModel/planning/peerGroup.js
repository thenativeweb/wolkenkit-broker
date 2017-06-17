'use strict';

const initialState = {
  initiator: undefined,
  destination: undefined,
  participants: [],
  isAuthorized: {
    commands: {
      start: { forPublic: true },
      join: { forPublic: true }
    },
    events: {
      started: { forPublic: true },
      joined: { forPublic: true }
    }
  }
};

const commands = {
  start () {
    // ...
  },

  join () {
    // ...
  }
};

const events = {
  started () {
    // ...
  },

  joined () {
    // ...
  }
};

module.exports = { initialState, commands, events };

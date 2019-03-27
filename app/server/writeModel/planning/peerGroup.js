'use strict';

const initialState = {
  initiator: undefined,
  destination: undefined,
  participants: [],
  isAuthorized: {
    events: {
      started: { forPublic: true },
      joined: { forPublic: true }
    }
  }
};

const commands = {
  start: {
    isAuthorized () {
      return true;
    },

    handle () {
      // ...
    }
  },

  join: {
    schema: {
      type: 'object',
      properties: {},
      required: [],
      additionalProperties: true
    },

    isAuthorized () {
      return true;
    },

    handle () {
      // ...
    }
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

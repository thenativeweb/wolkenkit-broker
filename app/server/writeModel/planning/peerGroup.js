'use strict';

const initialState = {
  initiator: undefined,
  destination: undefined,
  participants: []
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
  started: {
    handle () {
      // ...
    },

    isAuthorized () {
      return true;
    }
  },

  joined: {
    handle () {
      // ...
    },

    isAuthorized () {
      return true;
    }
  }
};

module.exports = { initialState, commands, events };

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

  startedWithFilter: {
    handle () {
      // ...
    },

    isAuthorized () {
      return true;
    },

    filter (peerGroup, event, { client }) {
      if (client.user.id !== 'anonymous') {
        return true;
      }

      return !event.data.destination.includes('bad-word');
    }
  },

  startedWithMap: {
    handle () {
      // ...
    },

    isAuthorized () {
      return true;
    },

    map (peerGroup, event, { client }) {
      if (client.user.id !== 'anonymous') {
        return event;
      }

      // Hide person-related data due to privacy reasons for anonymous users.
      return { ...event, data: { destination: event.data.destination }};
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

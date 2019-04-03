'use strict';

class EventSequencer {
  constructor () {
    this.models = {};
  }

  registerModel ({ name, type, lastProcessedPosition }) {
    if (!name) {
      throw new Error('Name is missing.');
    }
    if (!type) {
      throw new Error('Type is missing.');
    }
    if (typeof lastProcessedPosition !== 'number') {
      throw new Error('Last processed position is missing.');
    }

    this.models[type] = this.models[type] || {};

    if (this.models[type][name]) {
      throw new Error('Model had already been registered.');
    }

    this.models[type][name] = {
      lastProcessedPosition
    };
  }

  updatePosition ({ name, type, position }) {
    if (!name) {
      throw new Error('Name is missing.');
    }
    if (!type) {
      throw new Error('Type is missing.');
    }
    if (typeof position !== 'number') {
      throw new Error('Position is missing.');
    }

    if (!this.models[type]) {
      throw new Error('Model type does not exist.');
    }
    if (!this.models[type][name]) {
      throw new Error('Model name does not exist.');
    }

    const model = this.models[type][name];

    if (position <= model.lastProcessedPosition) {
      throw new Error('Position is not greater than last processed position.');
    }

    model.lastProcessedPosition = position;
  }

  getLowestProcessedPosition () {
    let lowestProcessedPosition;

    Object.keys(this.models).forEach(type => {
      Object.keys(this.models[type]).forEach(name => {
        const currentPosition = this.models[type][name].lastProcessedPosition;

        if (!lowestProcessedPosition || currentPosition < lowestProcessedPosition) {
          lowestProcessedPosition = currentPosition;
        }
      });
    });

    if (lowestProcessedPosition === undefined) {
      throw new Error('Failed to get lowest processed position.');
    }

    return lowestProcessedPosition;
  }

  getStrategyFor (domainEvent) {
    if (!domainEvent) {
      throw new Error('Event is missing.');
    }

    if (!domainEvent.metadata.position) {
      return { type: 'forward' };
    }

    let lastProcessedPosition;

    try {
      lastProcessedPosition = this.getLowestProcessedPosition();
    } catch (ex) {
      return { type: 'forward' };
    }

    const missingEvents = domainEvent.metadata.position - (lastProcessedPosition + 1);

    if (missingEvents === 0) {
      return { type: 'proceed', forward: true };
    } else if (missingEvents < 0) {
      return { type: 'skip' };
    } else if (missingEvents > 0) {
      return {
        type: 'replay',
        fromPosition: lastProcessedPosition + 1,
        toPosition: domainEvent.metadata.position
      };
    }
  }
}

module.exports = EventSequencer;

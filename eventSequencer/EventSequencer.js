'use strict';

const EventSequencer = function () {
  this.models = {};
};

EventSequencer.prototype.registerModel = function (options) {
  if (!options) {
    throw new Error('Options are missing.');
  }
  if (!options.name) {
    throw new Error('Name is missing.');
  }
  if (!options.type) {
    throw new Error('Type is missing.');
  }
  if (typeof options.lastProcessedPosition !== 'number') {
    throw new Error('Last processed position is missing.');
  }

  this.models[options.type] = this.models[options.type] || {};

  if (this.models[options.type][options.name]) {
    throw new Error('Model had already been registered.');
  }

  this.models[options.type][options.name] = {
    lastProcessedPosition: options.lastProcessedPosition
  };
};

EventSequencer.prototype.updatePosition = function (options) {
  if (!options) {
    throw new Error('Options are missing.');
  }
  if (!options.name) {
    throw new Error('Name is missing.');
  }
  if (!options.type) {
    throw new Error('Type is missing.');
  }
  if (typeof options.position !== 'number') {
    throw new Error('Position is missing.');
  }

  if (!this.models[options.type]) {
    throw new Error('Model type does not exist.');
  }
  if (!this.models[options.type][options.name]) {
    throw new Error('Model name does not exist.');
  }

  const model = this.models[options.type][options.name];

  if (options.position <= model.lastProcessedPosition) {
    throw new Error('Position is not greater than last processed position.');
  }

  model.lastProcessedPosition = options.position;
};

EventSequencer.prototype.getLowestProcessedPosition = function () {
  let lowestProcessedPosition;

  Object.keys(this.models).forEach(type => {
    Object.keys(this.models[type]).forEach(name => {
      const currentPosition = this.models[type][name].lastProcessedPosition;

      if (!lowestProcessedPosition || currentPosition < lowestProcessedPosition) {
        lowestProcessedPosition = currentPosition;
      }
    });
  });

  return lowestProcessedPosition;
};

EventSequencer.prototype.getStrategyFor = function (domainEvent) {
  if (!domainEvent) {
    throw new Error('Event is missing.');
  }
  if (!domainEvent.metadata.position) {
    return { type: 'forward' };
  }

  const lastProcessedPosition = this.getLowestProcessedPosition(),
        missingEvents = domainEvent.metadata.position - (lastProcessedPosition + 1);

  if (missingEvents === 0) {
    return { type: 'proceed' };
  } else if (missingEvents < 0) {
    return { type: 'skip' };
  } else if (missingEvents > 0) {
    return {
      type: 'replay',
      fromPosition: lastProcessedPosition + 1,
      toPosition: domainEvent.metadata.position
    };
  }
};

module.exports = EventSequencer;

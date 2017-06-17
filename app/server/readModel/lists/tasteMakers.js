'use strict';

const fields = {
  name: { initialState: '', fastLookup: true, isUnique: true },
  count: { initialState: 0 }
};

const when = {
  'planning.peerGroup.started': (tasteMakers, event, mark) => {
    tasteMakers.readOne({
      where: { name: event.data.initiator }
    }).
      failed(() => {
        // If this fails, the initiator is not yet a tastemaker, so it can not
        // be found. This means that we need to add him or her.
        tasteMakers.add({
          name: event.data.initiator,
          count: 0
        });
        mark.asDone();
      }).
      finished(() => {
        mark.asDone();
      });
  },

  'planning.peerGroup.joined': (tasteMakers, event, services, mark) => {
    services.get('app').lists.peerGroups.readOne({
      where: { id: event.aggregate.id }
    }).
      failed(err => mark.asFailed(err.message)).
      finished(peerGroup => {
        tasteMakers.update({
          where: { name: peerGroup.initiator },
          set: { count: { $incrementBy: 1 }}
        });
        mark.asDone();
      });
  }
};

module.exports = { fields, when };

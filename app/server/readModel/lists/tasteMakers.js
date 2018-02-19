'use strict';

const fields = {
  name: { initialState: '', fastLookup: true, isUnique: true },
  count: { initialState: 0 }
};

const when = {
  async 'planning.peerGroup.started' (tasteMakers, event) {
    try {
      await tasteMakers.readOne({
        where: { name: event.data.initiator }
      });
    } catch (ex) {
      // If this fails, the initiator is not yet a tastemaker, so it can not
      // be found. This means that we need to add him or her.
      tasteMakers.add({
        name: event.data.initiator,
        count: 0
      });
    }
  },

  async 'planning.peerGroup.joined' (tasteMakers, event, { app }) {
    let peerGroup;

    try {
      peerGroup = await app.lists.peerGroups.readOne({
        where: { id: event.aggregate.id }
      });
    } catch (ex) {
      return event.fail(ex.message);
    }

    tasteMakers.update({
      where: { name: peerGroup.initiator },
      set: { count: { $incrementBy: 1 }}
    });
  }
};

module.exports = { fields, when };

import { defineStore } from 'pinia';

const useNowStore = defineStore('now', {
  state: () => {
    return {
      now: new Date(),
    };
  },
  actions: {
    update() {
      this.now = new Date();
    },
  },
});

setInterval(() => {
  useNowStore().update();
}, 1000);

export default useNowStore;

import Vue from 'vue'
import Vuex from 'vuex'
import storage from '@/utils/store'

Vue.use(Vuex)

export default new Vuex.Store({
  state: {
    rawDeviceInfo: storage.getDeviceInfo()
  },
  getters: {},
  mutations: {
    setDefaultDeviceInfo(state, data) {
      storage.setDeviceInfo(data);
      state.rawDeviceInfo = data
    },
    removeDefaultDeviceInfo(state) {
      storage.removeDeviceInfo()
      state.rawDeviceInfo = null
    },
    createDefaultDeviceInfo() { }
  },
  actions: {}
})
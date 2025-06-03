const DEVICE_INFO_KEY = 'deviceInfo'
export default {
  getDeviceInfo() {
    return wx.getStorageSync(DEVICE_INFO_KEY) || {}
  },
  setDeviceInfo(value) {
    wx.setStorageSync(DEVICE_INFO_KEY, value)
  },
  removeDeviceInfo() {
    wx.removeStorageSync(DEVICE_INFO_KEY)
  }
}
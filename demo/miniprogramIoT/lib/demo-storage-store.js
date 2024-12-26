/**
 * ## Demo 设备功能配置
 * @typedef {Object} StorageDeviceItemOptions
 * @property {boolean} playback
 * @property {number[]} useChannelIds
 * @property {'standard' | 'high' | 'super'} liveQuality
 * @property {'voice' | 'video'} intercomType
 * @property {'Pusher' | 'Recorder'} voiceType
 * @property {boolean} cloudStorage
 * @property {boolean} p2pCall
 * @property {boolean} twecall
 * @property {boolean} ptz
 * @property {boolean} userCommand
 * @property {boolean} rtcMode
 * @property {boolean} isMuted
 * @property {boolean} showPlayerLog
 * @property {boolean} showIntercomLog
 * @property {boolean} onlyFlv
 */

/**
 * ## Demo 本地化数据
 * @typedef {Object} StorageDeviceItem
 * @property {string} deviceId
 * @property {string} productId
 * @property {string} deviceName
 * @property {boolean} isMjpgDevice
 * @property {string} xp2pInfo
 * @property {'ipc' | 'server'} p2pMode
 * @property {'live' | 'playback'} sceneType
 * TODO  需要初始化信令的设备加入支持，信令调用成功才会去尝试连接设备
 * @property {string} initCommand
 * TODO  添加 liveStreamDomain 支持 1vn
 * @property {string} liveStreamDomain
 * @property {string} wxappid
 * @property {string} openid
 * @property {StorageDeviceItemOptions} options
 */

/** @type {StorageDeviceItem} */
export const localStore = {
  deviceId: '',
  productId: '',
  deviceName: '',
  isMjpgDevice: false,
  xp2pInfo: '',
  p2pMode: 'ipc',
  sceneType: 'live',
  options: {
    useChannelIds: [0],
  },
};

/**
 * @typedef {Object} LocalStore
 * @property {StorageDeviceItem[]} storageDeviceList
 * @property {StorageDeviceItemOptions} defaultOptions
 * @property {(device: StorageDeviceItem) => void} addDevice
 * @property {(device: StorageDeviceItem) => void} updateRecentDevice
 * @property {(device: StorageDeviceItem) => StorageDeviceItem} initDevice
 * @property {(deviceId: string) => StorageDeviceItem} getDeviceById
 */

/** @type {LocalStore} */
export const STORE = {
  /**
   * ## 存储中的设备列表
   * @type {StorageDeviceItem[]}
   */
  storageDeviceList: wx.getStorageSync('storageDeviceList') || [],
  /** ## 添加设备到缓存中 */
  addDevice(device) {
    const tmp = initDevice(device);
    const existIdx = this.storageDeviceList.findIndex(item => item.deviceId === tmp.deviceId);
    if (existIdx > -1) this.storageDeviceList.splice(existIdx, 1);
    this.storageDeviceList.unshift(tmp);
    // 更新到本地存储
    wx.setStorageSync('storageDeviceList', this.storageDeviceList);
  },
  /** ## 把选择的设备置顶 */
  updateRecentDevice(device) {
    // TODO 数据清洗，去掉历史重复数据
    // ..
    this.addDevice(device);
  },
  /**
   * ## 初始化一部分默认或者可选参数
   * @returns {StorageDeviceItem}
   */
  initDevice: (device) => initDevice(device),

  /**
   * ## 根据设备id获取设备信息
   * @returns {StorageDeviceItem}
   */
  getDeviceById(deviceId) {
    const device = this.storageDeviceList.find(item => item.deviceId === deviceId);
    if (!device) {
      console.error('[demo] [STORE] [getDeviceById] device not found!');
      return null;
    }
    return device;
  },

  defaultOptions: {
    useChannelIds: [0],
    liveQuality: 'standard',
    intercomType: 'video',
    voiceType: 'Pusher',
    playback: true,
    cloudStorage: false,
    p2pCall: true,
    twecall: true,
    ptz: false,
    userCommand: false,
    rtcMode: true,
    isMuted: false,
    showPlayerLog: true,
    showIntercomLog: true,
    onlyFlv: false,
  },
};

const initMiniProgramInfo = () => {
  return {
    wxappid: '',
    openid: '',
  };
};

const initDevice = (device) => {
  let { deviceId = '', productId, deviceName, xp2pInfo } = device;
  deviceId = deviceId.trim();
  if (deviceId && (!productId || !deviceName)) {
    [productId, deviceName] = deviceId.split('/');
  }

  if (!productId) {
    console.error('[demo] [STORE] [initDevice] productId is required!');
    return;
  }
  productId = productId.trim();

  if (!deviceName) {
    console.error('[demo] [STORE] [initDevice] deviceName is required!');
    return;
  }
  deviceName = deviceName.trim();

  if (!xp2pInfo) {
    console.error('[demo] [STORE] [initDevice] xp2pInfo is required!');
    return;
  }
  xp2pInfo = xp2pInfo.trim();

  return {
    productId,
    deviceName,
    xp2pInfo,
    deviceId: device.deviceId || `${productId}/${deviceName}`,
    isMjpgDevice: xp2pInfo.endsWith('m'),
    p2pMode: device.p2pMode || 'ipc',
    sceneType: device.sceneType || 'live',
    ...initMiniProgramInfo(),
    options: {
      ...STORE.defaultOptions,
      ...device.options,
    },
  };
};

/**
 * ## 数据去重
 * @param {*} list
 * @returns
 */
// const dataClear = () => {
//   const list = wx.getStorageSync('storageDeviceList') || [];
//   const key = 'deviceId';
//   const newList = [];
//   const keyMap = {};
//   for (let item of list) {
//     let id = item[key];
//     if (!id) id = `${item.productId}/${item.deviceName}`;
//     if (!keyMap[id]) {
//       keyMap[id] = true;
//       newList.push(item);
//     } else {
//       continue;
//     }
//   }
//   wx.setStorageSync('storageDeviceList', newList);
// }

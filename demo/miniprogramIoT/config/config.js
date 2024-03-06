/* eslint-disable */
import { presetDevices, isDeviceCfgValid } from './devices';
import { presetServerStreams } from './streams';

export const defaultShareInfo = {
  title: 'XP2P Demo',
  path: '/pages/index/index',
  imageUrl: 'https://main.qcloudimg.com/raw/3db4899f798ea30179ab6d99263c7c30.png',
}

// 方便测试用的预置数据
export { presetDevices, isDeviceCfgValid } from './devices';
export { presetServerStreams } from './streams';

export const totalData = {};

// 最近查看的ipc设备
const recentIPC = wx.getStorageSync('recentIPC');
if (recentIPC && isDeviceCfgValid(recentIPC)) {
  console.log('get recentIPC', recentIPC);
  totalData.recentIPC = recentIPC;
}

// ipc设备都加进去
for (const key in presetDevices) {
  totalData[key] = {
    p2pMode: 'ipc',
    targetId: key,
    ...presetDevices[key],
  };
}

// server流都加进去
for (const key in presetServerStreams) {
  totalData[key] = {
    p2pMode: 'server',
    targetId: key,
    ...presetServerStreams[key],
  };
}

console.log('totalData', totalData);

export const updateRecentIPC = (cfg) => {
  if (!isDeviceCfgValid(cfg)) {
    return;
  }
  // 注意字段和totalData的里一致
  const recentIPC = {
    p2pMode: 'ipc',
    targetId: 'recentIPC',
    isMjpgDevice: cfg.isMjpgDevice,
    productId: cfg.productId,
    deviceName: cfg.deviceName,
    xp2pInfo: cfg.xp2pInfo,
    liveStreamDomain: cfg.liveStreamDomain,
    initCommand: cfg.initCommand,
    options: cfg.options,
  };
  console.log('set recentIPC', recentIPC);
  totalData.recentIPC = recentIPC;
  wx.setStorageSync('recentIPC', recentIPC);
};

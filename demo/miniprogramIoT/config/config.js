/* eslint-disable */
import { presetDevices, isDeviceCfgValid } from './devices';
import { presetServerStreams } from './streams';

// 方便测试用的预置数据
export { presetDevices } from './devices';
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

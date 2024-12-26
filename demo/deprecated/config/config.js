/* eslint-disable camelcase, @typescript-eslint/naming-convention */
import { presetDevices, isDeviceCfgValid } from './devices';
import { presetServerStreams } from './streams';

// 这些是和设备无关的配置
const config = {
  appParams: {
    appid: 123,
    appOauthId: 'xxx',
    appKey: 'xxx',
    appSecretKey: 'xxx',
    appPackage: 'ios.test.com',
  },
  presetDevices,
  presetServerStreams,
};

// 方便测试用的预置数据
const totalData = {};

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
config.totalData = totalData;

export default config;

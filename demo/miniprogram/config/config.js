/* eslint-disable camelcase, @typescript-eslint/naming-convention */
import devices from './devices';
import serverStreams from './streams';

// 这些是和设备无关的配置
const config = {
  appParams: {
    appid: 1253131157,
    appOauthId: '600a4206062556e21befdc98',
    appKey: 'pMqRNpU3M4wOA2BY',
    appSecretKey: 'b62XcOoDcvJOgnibM8iKFVgVsXcdxNda',
    appPackage: 'ios.test.com',
  },
};

// 方便测试用的预置数据
const totalData = {};

// ipc设备都加进去
for (const key in devices) {
  totalData[key] = {
    p2pMode: 'ipc',
    targetId: key,
    ...devices[key],
  };
}
// 最近查看的ipc设备
const recentIPC = wx.getStorageSync('recentIPC');
if (recentIPC) {
  totalData.recentIPC = recentIPC;
}

// server流都加进去
for (const key in serverStreams) {
  totalData[key] = {
    p2pMode: 'server',
    targetId: key,
    ...serverStreams[key],
  };
}

console.log('totalData', totalData);
config.totalData = totalData;

export default config;

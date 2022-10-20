/**
 * device属性说明：
 * showInHomePageBtn: boolean 是否显示在首页大按钮
 *
 * 下面的必填
 * isMjpgDevice: boolean 是否图片流设备
 *
 * 下面这些会自动填到player组件的输入框里，也可以手动修改
 * productId: string 摄像头的 productId
 * deviceName: string 摄像头的 deviceName
 * xp2pInfo: string 摄像头的 xp2pInfo
 * liveStreamDomain: string 1v1连接过多时自动转到1v多模式的server域名
 * liveQuality: string 直播清晰度，非必填，standard | high | super，视频流设备默认 standard
 * options:
 *   needCheckStream: boolean 播放前先检查能否拉流，默认 false
 *   intercomType: 'Recorder' | 'Pusher' 对讲类型，默认 Recorder
 */

// 这些是预置的ipc设备
const devices = {
  test_ipc: {
    showInHomePageBtn: true,
    productName: 'IPC',
    productId: 'SO1Z9Y787A',
    deviceName: 'cannon_85317409_1',
    xp2pInfo: 'XP2PkNm8QUONDYGpwc2kuNhIRQ==%2.4.32',
    options: {
      intercomType: 'Pusher',
    },
  },
  test_mjpglock: {
    showInHomePageBtn: true,
    isMjpgDevice: true,
    productName: 'MjpgLock',
    productId: '65HUY1C739',
    deviceName: 'yzlock_84641797_1',
    xp2pInfo: 'XP2PfLGXhL7HQJszsfxiO6Y5eA==%2.4.33m',
    options: {
      intercomType: 'Pusher',
    },
  },
};

// 补充默认值
Object.values(devices).forEach((device) => {
  device.isMjpgDevice = typeof device.isMjpgDevice === 'boolean' ? device.isMjpgDevice : false;
  device.liveQuality = device.liveQuality || 'standard';
});

export const presetDevices = devices;

export const isDeviceCfgValid = cfgInfo => (
  cfgInfo && typeof cfgInfo.isMjpgDevice === 'boolean'
    && cfgInfo.productId
    && cfgInfo.deviceName
    && cfgInfo.xp2pInfo
);

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
 * liveQuality: string 直播清晰度，非必填，standard | high | super，视频流设备默认 high
 * options:
 *   needCheckStream: boolean 播放前先检查能否拉流，默认 false
 *   playerRTC: boolean 播放使用RTC模式，需要设备出流采样率16k以上，默认 false
 *   voiceType: 'Recorder' | 'Pusher' 对讲类型，默认 Recorder
 *   supportPTZ: boolean 是否支持PTZ，默认 false
 */

// 这些是预置的ipc设备
const devices = {
  test_ipc: {
    showInHomePageBtn: true,
    productName: 'IPC',
    productId: 'SO1Z9Y787A',
    deviceName: 'HS_88959786_1',
    xp2pInfo: 'XP2P2EMi89Xld2IWsLr9r4J7Rw==%2.4.35',
    options: {
      playerRTC: true,
      voiceType: 'Pusher',
    },
  },
  test_mjpglock: {
    showInHomePageBtn: true,
    isMjpgDevice: true,
    productName: 'MjpgLock',
    productId: '65HUY1C739',
    deviceName: 'yzlock_84641797_1',
    xp2pInfo: 'XP2PfLGXhL7HQ5stwvs8OtAxDw==%2.4.34m',
    options: {
      playerRTC: true,
      voiceType: 'Pusher',
    },
  },
};

// 补充默认值
Object.values(devices).forEach((device) => {
  device.isMjpgDevice = typeof device.isMjpgDevice === 'boolean' ? device.isMjpgDevice : false;
  device.liveQuality = device.liveQuality || 'high';
});

export const presetDevices = devices;

export const isDeviceCfgValid = cfgInfo => (
  cfgInfo && typeof cfgInfo.isMjpgDevice === 'boolean'
    && cfgInfo.productId
    && cfgInfo.deviceName
    && cfgInfo.xp2pInfo
);

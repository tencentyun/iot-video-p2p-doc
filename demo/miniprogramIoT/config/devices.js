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
 * initCommand: string 拉流前要发送的初始化信令，非必填
 * options:
 *   needCheckStream: boolean 播放前先检查能否拉流，默认 false
 *   supportPTZ: boolean 是否支持PTZ，默认 false
 *   playerRTC: boolean 播放使用RTC模式，需要设备出流采样率16k以上，默认 true
 *   playerMuted: boolean 播放时默认静音，默认 false
 *   playerLog: boolean 播放log，默认 false
 *   voiceType: 'Recorder' | 'Pusher' 语音采集类型，默认 Recorder
 *   intercomType: 'voice' | 'video' 对讲类型，默认 voice
 *   intercomLog: boolean 对讲log，默认 false
 */

const defaultOptions = {
  // 设备属性
  needCheckStream: false,
  supportPTZ: false,
  // 小程序播放组件
  playerRTC: true,
  playerMuted: false,
  playerLog: false,
  // 小程序对讲组件
  voiceType: 'Recorder',
  intercomType: 'voice',
  intercomLog: false,
};

// 这些是预置的ipc设备
const devices = {
  test_ipc: {
    showInHomePageBtn: true,
    productName: 'IPC',
    productId: 'SO1Z9Y787A',
    deviceName: 'cannon_85317409_4',
    xp2pInfo: 'XP2P4ZbW1lPiM5Jf6W1AipzB+g==%2.4.32',
    options: {
      playerRTC: true,
      voiceType: 'Pusher',
    },
  },
  test_ac7916_duplexVideo: {
    showInHomePageBtn: true,
    isMjpgDevice: false,
    productName: 'ac7916',
    productId: 'SO1Z9Y787A',
    deviceName: 'cannon_85317409_3',
    xp2pInfo: 'XP2PHuYWm+pTHW54qlcsPM4gQQ==%2.4.38',
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
    xp2pInfo: 'XP2PfLGXhL7HQ5spx71xJdZ+HA==%2.4.34m',
    options: {
      playerRTC: true,
      voiceType: 'Pusher',
    },
    cloudRecords: [
      {
        startTime: 1674009852,
        endTime: 1674009861,
        // mjpgSrc: 'https://video-cv-1258344699.cos.ap-guangzhou.myqcloud.com/%2F100017589425/68MMP0SV0R/lockdemo_89398890_1/events/1674009852.mjpg?q-sign-algorithm=sha1&q-ak=AKIDvmfeZN2j7MQJCxQksrjRwQ1hE5lFbrme&q-sign-time=1674027091%3B1674030691&q-key-time=1674027091%3B1674030691&q-header-list=host&q-url-param-list=&q-signature=2dc7a7c4f31d33f2213b680555a0b673b7e4d6c2',
        // audioSrc: 'https://video-cv-1258344699.cos.ap-guangzhou.myqcloud.com/%2F100017589425/68MMP0SV0R/lockdemo_89398890_1/events/1674009852.aac?q-sign-algorithm=sha1&q-ak=AKIDvmfeZN2j7MQJCxQksrjRwQ1hE5lFbrme&q-sign-time=1674027091%3B1674030691&q-key-time=1674027091%3B1674030691&q-header-list=host&q-url-param-list=&q-signature=52b2eddd93cf26799fb1e15bed995081004dca5e',
        mjpgSrc: 'https://iot.gtimg.com/cdn/ad/xuanwang/1674009852.mjpg',
        audioSrc: 'https://iot.gtimg.com/cdn/ad/xuanwang/1674009852.aac',
      },
      {
        startTime: 1674009880,
        endTime: 1674009889,
        mjpgSrc: 'https://video-cv-1258344699.cos.ap-guangzhou.myqcloud.com/%2F100017589425/68MMP0SV0R/lockdemo_89398890_1/events/1674009880.mjpg?q-sign-algorithm=sha1&q-ak=AKIDvmfeZN2j7MQJCxQksrjRwQ1hE5lFbrme&q-sign-time=1674026978%3B1674030578&q-key-time=1674026978%3B1674030578&q-header-list=host&q-url-param-list=&q-signature=3d6ad82736f8badb0e6d21028b0dec87c34f77bc',
        audioSrc: 'https://video-cv-1258344699.cos.ap-guangzhou.myqcloud.com/%2F100017589425/68MMP0SV0R/lockdemo_89398890_1/events/1674009880.aac?q-sign-algorithm=sha1&q-ak=AKIDvmfeZN2j7MQJCxQksrjRwQ1hE5lFbrme&q-sign-time=1674026978%3B1674030578&q-key-time=1674026978%3B1674030578&q-header-list=host&q-url-param-list=&q-signature=6fbc29e401fd93897527ba9aa45c6400594ae7c7',
      },
    ],
  },
};

// 补充默认值
Object.values(devices).forEach((device) => {
  device.isMjpgDevice = typeof device.isMjpgDevice === 'boolean' ? device.isMjpgDevice : false;
  device.liveQuality = device.liveQuality || 'high';
  device.options = {
    ...defaultOptions,
    ...device.options,
  };
});

export const presetDevices = devices;

export const isDeviceCfgValid = cfgInfo => (
  cfgInfo && typeof cfgInfo.isMjpgDevice === 'boolean'
    && cfgInfo.productId
    && cfgInfo.deviceName
    && cfgInfo.xp2pInfo
);

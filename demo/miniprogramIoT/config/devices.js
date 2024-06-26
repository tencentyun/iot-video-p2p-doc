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
 * initCommand: string 拉流前要发送的初始化信令，非必填
 * options:
 *   liveQuality: string 直播清晰度，非必填，standard | high | super，视频流设备默认 high
 *   needCheckStream: boolean 播放前先检查能否拉流，默认 false
 *   supportPTZ: boolean 是否支持PTZ，默认 false
 *   supportCustomCommand: boolean 是否支持自定义信令，默认 false
 *   playerRTC: boolean 播放使用RTC模式，需要设备出流采样率16k以上，默认 true
 *   playerMuted: boolean 播放时默认静音，默认 false
 *   playerLog: boolean 播放log，默认 false
 *   voiceType: 'Recorder' | 'Pusher' 语音采集类型，默认 Recorder
 *   intercomType: 'voice' | 'video' 对讲类型，默认 voice
 *   intercomLog: boolean 对讲log，默认 false
 */

export const defaultOptions = {
  // 设备属性
  liveQuality: 'high',
  needCheckStream: false,
  supportPTZ: false,
  supportCustomCommand: false,
  // 小程序播放组件
  playerRTC: true,
  playerMuted: false,
  playerLog: false,
  // 小程序对讲组件
  voiceType: 'Pusher',
  intercomType: 'voice',
  intercomLog: false,
};

// 这些是预置的ipc设备
const devices = {
  debug_device: {
    showInHomePageBtn: true,
    productId: 'J5YLI0DSZZ',
    deviceName: 'lianlian_93028156_1',
    xp2pInfo: 'XP2P9294QVs4JAgCItdWnyoQOg==%2.4.43',
    options: {
      liveQuality: 'high',
      playerRTC: true,
      playerMuted: true,
      voiceType: 'Pusher',
      intercomType: 'video',
    },
  },
  debug_x86_udp: {
    showInHomePageBtn: true,
    productName: 'x86-udp',
    productId: 'SO1Z9Y787A',
    deviceName: 'youzi_79972790_1',
    xp2pInfo: 'XP2P4dDpbX8kO6ho4yx4I7oEMQ==%2.4.43',
    options: {
      playerRTC: true,
      playerMuted: true,
      voiceType: 'Pusher',
      intercomType: 'video',
    },
  },
  debug_x86_tcp: {
    showInHomePageBtn: true,
    productName: 'x86-tcp',
    productId: 'SO1Z9Y787A',
    deviceName: 'youzi_79972790_2',
    xp2pInfo: 'XP2PlmS3tg+xnZTYcTFTsVTlQRoP%2.4.43',
    options: {
      supportPTZ: true,
      supportCustomCommand: true,
      playerRTC: true,
      playerMuted: true,
      voiceType: 'Pusher',
      intercomType: 'voice',
    },
  },
  debug_cloud_m3u8: {
    showInHomePageBtn: true,
    productId: '7QB2A6WM6O',
    deviceName: 'dev_06',
    xp2pInfo: 'XP2Pfu8MqN+TbaObQNZyxbcDMw==%2.4.40',
    cloudRecords: [
      {
        startTime: 1717171200,
        endTime: 1717171262,
        videoSrc: 'https://1500005692.vod2.myqcloud.com/43843706vodtranscq1500005692/62656d94387702300542496289/v.f100240.m3u8',
      },
      {
        startTime: 1717646648,
        endTime: 1717646679,
        videoSrc: 'https://1259367869.vod2.myqcloud.com/timeshift/live/b4d5af98-31d7-4026-833e-559e2043f4fb/timeshift.m3u8?starttime_epoch=1717646648&endtime_epoch=1717646679&t=66818100&us=287da2af95c0664fcdcda83e5f16d163&sign=52f0588ab29e8fd6299aae63984be6c6',
      },
    ],
  },
  debug_mjpglock: {
    showInHomePageBtn: true,
    isMjpgDevice: true,
    productId: 'I0E5RWGK66',
    deviceName: 'lock_89736739_1',
    xp2pInfo: 'XP2PS1UByaXy00kf2NnwV7lAtw==%2.4.29m',
    options: {
      playerRTC: true,
      playerMuted: true,
      voiceType: 'Pusher',
    },
  },
  debug_cloud_mjpg: {
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
        mjpgSrc: 'https://iot.gtimg.com/cdn/ad/xuanwang/1674009852.mjpg',
        audioSrc: 'https://iot.gtimg.com/cdn/ad/xuanwang/1674009852.aac',
      },
      {
        startTime: 1674009880,
        endTime: 1674009889,
        mjpgSrc: 'https://video-cv-1258344699.cos.ap-guangzhou.myqcloud.com/%2F100017589425/68MMP0SV0R/lockdemo_89398890_1/events/1674009880.mjpg?sign=xxx',
        audioSrc: 'https://video-cv-1258344699.cos.ap-guangzhou.myqcloud.com/%2F100017589425/68MMP0SV0R/lockdemo_89398890_1/events/1674009880.aac?sign=xxx',
      },
    ],
  },
};

// 补充默认值
Object.values(devices).forEach((device) => {
  device.isMjpgDevice = typeof device.isMjpgDevice === 'boolean' ? device.isMjpgDevice : false;
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

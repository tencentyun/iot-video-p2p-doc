/**
 * device属性说明：
 * showInHomePageBtn: boolean 是否显示在首页大按钮
 * showInHomePageNav: boolean 是否显示在首页导航
 *
 * 下面这些会自动填到player组件的输入框里，也可以手动修改
 * productId: string 摄像头的 productId
 * deviceName: string 摄像头的 deviceName
 * xp2pInfo: string 摄像头的 xp2pInfo
 * liveParams: string 摄像头的直播参数，默认 action=live&channel=0&quality=standard
 * playbackParams: string 摄像头的回放参数，默认 action=playback&channel=0
 * liveStreamDomain: string 1v1连接过多时自动转到1v多模式的server域名
 * options:
 *   needMjpg: boolean 需要图片流，默认false
 *   needCheckStream: boolean 播放前先检查能否拉流，默认false
 *   intercomType: string 对讲类型，Recorder/Pusher/DuplexVideo，默认Recorder
 */

// 这些是预置的ipc设备
const devices = {
  test_mjpg: {
    showInHomePageBtn: true,
    productName: 'Mjpg',
    productId: 'AQTV2839QJ',
    deviceName: 'sp02_33925210_16',
    xp2pInfo: 'XP2PDhFRfd+PLWpEndXBeTPv9g==%2.4.29',
    liveParams: 'action=live-audio&channel=0',
    liveMjpgParams: 'action=live-mjpg&channel=0',
    playbackParams: 'action=playback-audio&channel=0',
    playbackMjpgParams: 'action=playback-mjpg&channel=0',
    options: {
      needMjpg: true,
    },
  },
  test_kds: {
    showInHomePageBtn: true,
    productName: 'KDS',
    productId: 'LWY363KD9E',
    deviceName: 'K20_76758069_60',
    xp2pInfo: 'XP2Pfwv20xj36l70+nW2pVyqJA==%2.4.29',
    liveParams: 'action=live&channel=0',
    playbackParams: 'action=playback&channel=0',
  },
  test_lock: {
    showInHomePageBtn: true,
    productName: 'Lock',
    productId: 'WJPEXAPK6Y',
    deviceName: 'M7L1_75239714_2',
    xp2pInfo: 'XP2PSJvxFsCQ8HtDkq3mUJpuYi+v%2.3.15',
    liveParams: 'action=live&channel=0',
    playbackParams: 'action=playback&channel=0',
    options: {
      intercomType: 'Pusher',
    },
  },
  test_android: {
    showInHomePageBtn: true,
    productName: 'Android',
    productId: '9L1S66FZ3Q',
    deviceName: 'test_34683636_1',
    xp2pInfo: 'XP2PK6vh01xsBCJ2/by7Dawe9w==%2.4.0',
    liveParams: 'action=live&channel=0&quality=high',
    options: {
      intercomType: 'Pusher',
    },
  },
  'of-2': {
    showInHomePageBtn: true,
    productId: '9L1S66FZ3Q',
    deviceName: 'test_34683636_1',
    xp2pInfo: 'XP2PK6vh01xsBCJM9aXYOKgu9A==%2.4.0',
    liveParams: 'action=live&channel=0&quality=high',
  },
  'of-1': {
    showInHomePageBtn: true,
    productId: 'WJPEXAPK6Y',
    deviceName: 'M7L1_75239714_2',
    xp2pInfo: 'XP2PSJvxFsCQ8Htdkv/ZVqYPQiOb%2.3.15',
  },
  'ipc-2': {
    showInHomePageBtn: false,
    productId: 'AQTV2839QJ',
    deviceName: 'sp02_33925210_13',
    xp2pInfo: 'XP2PYYAldyTto1rnaA3tJSl++g==%2.4.x',
  },
  'ipc-1': {
    showInHomePageBtn: false,
    productId: 'AQTV2839QJ',
    deviceName: 'sp02_33925210_13',
    xp2pInfo: 'XP2PJsQdaV/urH33eTioM3BTiWzI%2.3.x',
  },
  wuxing2_4: {
    showInHomePageBtn: false,
    productId: 'H0O409AOUL',
    deviceName: 'HH_67772521_23',
    xp2pInfo: 'XP2PT/SH8iZ0+kK9FZi8mYU2hg==%2.4.28',
  },
  wuxing2_3: {
    showInHomePageBtn: false,
    productId: 'H0O409AOUL',
    deviceName: 'HH_67772521_8',
    xp2pInfo: 'XP2P7PMO9hA6z5TEUyVRmbBVb08B%2.3.15',
  },
};

Object.values(devices).forEach((device) => {
  device.liveParams = device.liveParams || 'action=live&channel=0&quality=standard';
  device.playbackParams = device.playbackParams || 'action=playback&channel=0';
});

export default devices;

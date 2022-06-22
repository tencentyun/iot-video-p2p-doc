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
  test_mjpg2: {
    showInHomePageBtn: true,
    productName: 'Mjpg',
    productId: '1FV89F1U7U',
    deviceName: 'evanxy_43610521_2',
    xp2pInfo: 'XP2Ptcng6Y/kQJVj+Wo/Hb/Z1g==%2.4.29m',
    liveParams: 'action=live-audio&channel=0',
    liveMjpgParams: 'action=live-mjpg&channel=0',
    playbackParams: 'action=playback-audio&channel=0',
    playbackMjpgParams: 'action=playback-mjpg&channel=0',
    options: {
      needMjpg: true,
    },
  },
};

Object.values(devices).forEach((device) => {
  device.liveParams = device.liveParams || 'action=live&channel=0&quality=standard';
  device.playbackParams = device.playbackParams || 'action=playback&channel=0';
});

export default devices;

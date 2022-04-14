/**
 * device属性说明：
 * showInHomePageBtn: boolean 是否显示在首页大按钮，产品用
 * showInHomePageNav: boolean 是否显示在首页导航，有onlyp2p入口，开发用
 *
 * 下面这些会自动填到player组件的输入框里，也可以手动修改
 * productId: string 摄像头的 productId
 * deviceName: string 摄像头的 deviceName
 * xp2pInfo: string 摄像头的 xp2pInfo
 * liveParams: string 摄像头的直播参数，默认 action=live&channel=0&quality=super
 * playbackParams: string 摄像头的回放参数，默认 action=playback&channel=0
 */

// 这些是预置的ipc设备
const devices = {
  ipc0: {
    showInHomePageBtn: true,
    productId: '9L1S66FZ3Q',
    deviceName: 'test_34683636_4',
    xp2pInfo: 'XP2P1Xl5RwePR/g3S0FO8VxUuatq%2.3.5',
    liveParams: 'action=live&channel=0&quality=standard',
    playbackParams: 'action=playback&channel=0',
  },
  ipc1: {
    showInHomePageBtn: true,
    productId: '9L1S66FZ3Q',
    deviceName: 'test_34683636_5',
    xp2pInfo: 'XP2PJjjVY/DtlAy0nTKv9jT8JrC4%2.3.11',
  },
  ipc2: {
    showInHomePageBtn: true,
    productId: '9L1S66FZ3Q',
    deviceName: 'test_34683636_3',
    xp2pInfo: 'XP2PcDd/JhEamiRjtLGL45WThnUQ%2.3.14',
  },
  downloadDemo: {
    showInHomePageBtn: true,
    productId: '65CC3I8Q4G',
    deviceName: 'llynne_41877702_5',
    xp2pInfo: 'XP2PRaiH8GqimBOseoPFEHWCimrd%2.3.11',
  },
  debug: {
    // showInHomePageBtn: true,
    // showInHomePageNav: true,
    productId: '9L1S66FZ3Q',
    deviceName: 'test_34683636_3',
    xp2pInfo: 'XP2PcDd3JlQPiXxDzaKo4YvCqnUq%2.3.5',
    liveParams: 'action=live&channel=0&quality=super',
    playbackParams: 'action=playback&channel=0',
  },
};

export default devices;

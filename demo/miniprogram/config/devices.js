/**
 * 属性说明：
 * showInHomePageBtn: boolean 是否显示在首页大按钮，产品用
 * showInHomePageNav: boolean 是否显示在首页导航，有onlyp2p入口，开发用
 * reserve: boolean 退出监控页时是否保留p2p连接
 *
 * 下面这些会自动填到player组件的输入框里，也可以手动修改
 * productId: string 摄像头的 productId
 * deviceName: string 摄像头的 deviceName
 * xp2pInfo: string 摄像头的 peername 或加密后的 xp2pInfo
 * flvFile: string 摄像头的 flvFile，默认 ipc.flv?action=live
 * command: string 摄像头的 command
 */

// 这些是预置的ipc设备
const devices = {
  judy1: {
    showInHomePageBtn: true,
    productId: '9L1S66FZ3Q',
    deviceName: 'test_34683636_1',
    xp2pInfo: 'XP2PbO/R01VuHltKhYmkE7EZ/Kns%2.3.5',
    flvFile: 'ipc.flv?action=live&channel=0&quality=super',
    command: 'action=user_define&cmd=xxx',
  },
  judy3: {
    showInHomePageBtn: true,
    showInHomePageNav: true,
    productId: '9L1S66FZ3Q',
    deviceName: 'test_34683636_3',
    xp2pInfo: 'XP2PcDd3JlQPiXxowvfvzrylrWcL%2.3.5',
    flvFile: 'ipc.flv?action=live&channel=0&quality=super',
    command: 'action=user_define&cmd=xxx',
  },
  jlfeng: {
    showInHomePageBtn: true,
    productId: 'LYEOZCNW0U',
    deviceName: '1_49822230_1',
    xp2pInfo: '',
    command: 'action=user_define&cmd=xxx',
  },
};

export default devices;

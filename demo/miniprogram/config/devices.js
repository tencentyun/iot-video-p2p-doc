/**
 * 属性说明：
 * showInHomePageBtn: boolean 是否显示在首页大按钮，产品用
 * showInHomePageNav: boolean 是否显示在首页导航，有onlyp2p入口，开发用
 * reserve: boolean 退出监控页时是否保留p2p连接
 *
 * 下面这些会自动填到player组件的输入框里，也可以手动修改
 * productId: string 摄像头的 productId
 * deviceName: string 摄像头的 deviceName
 * peername: string 摄像头的 peername 或加密后的 xp2pInfo
 * flvPath: string 摄像头的 flvPath，默认 ipc.flv
 * flvParams: string 摄像头的 flvParams，默认 action=live
 * command: string 摄像头的 command
 */

// 这些是预置的ipc设备
const devices = {
  jlfeng: {
    showInHomePageBtn: true,
    productId: 'LYEOZCNW0U',
    deviceName: '1_49822230_1',
    peername: '',
    command: 'action=user_define&cmd=xxx',
  },
  judy1: {
    showInHomePageBtn: true,
    productId: '9L1S66FZ3Q',
    deviceName: 'test_34683636_1',
    peername: 'XP2PbO/R01VuHltYvpyFHusb95n7%2.3.5',
    flvPath: 'ipc.flv',
    flvParams: 'action=live&channel=0&quality=standard',
    command: 'action=user_define&cmd=xxx',
  },
  ipc: {
    // showInHomePageNav: true,
    productId: 'AQTV2839QJ',
    deviceName: 'sp01_32820237_10',
    peername: '25QPD2ozz0p8RLMpLa',
    command: 'action=user_define&cmd=xxx',
  },
  ipc1: {
    showInHomePageNav: true,
    reserve: true,
    productId: 'CBOWA1B6I2',
    deviceName: 'iot_48598675_1',
    peername: 'XP2PUCSoT421lV5Hrlj/bmcaeiPA%2.1.0',
    command: 'action=user_define&cmd=xxx',
  },
};

export default devices;

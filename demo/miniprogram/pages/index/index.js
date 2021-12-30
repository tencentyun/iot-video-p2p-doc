import devices from '../../config/devices';
import streams from '../../config/streams';

const sysInfo = wx.getSystemInfoSync();

// 不用 xp2pManager 是因为它引用了wechat-p2p-player插件，release版没配置这个插件，会报错
const xp2pPlugin = requirePlugin('xp2p');
const p2pExports = xp2pPlugin.p2p;

const getShortFlvName = (flvFile) => {
  const filename = flvFile.split('.')[0];
  if (filename.length > 10) {
    return `${filename.substr(0, 4)}****${filename.substr(-4, 4)}`;
  }
  return filename;
};

Page({
  data: {
    wxVersion: sysInfo.version,
    wxSDKVersion: sysInfo.SDKVersion,
    xp2pVersion: p2pExports.XP2PVersion,

    // 这些控制p2p的
    controlId: 'iot-p2p-main-control',
    p2pControl: null,
    dirty: false,

    // 这些是监控页入口
    listBtn: [],
    listNav: [],
    firstServerStream: null,
    firstIPCStream: null,
  },
  onLoad() {
    const p2pControl = this.selectComponent(`#${this.data.controlId}`);
    this.setData({ p2pControl });

    const listBtn = [];
    const listNav = [];
    let firstServerStream = null;
    let firstIPCStream = null;
    for (const key in devices) {
      const item = devices[key];
      const navItem = {
        mode: 'ipc',
        cfg: key,
        title: `${item.productId}/${item.deviceName}`,
        ...item,
      };
      if (item.showInHomePageBtn) {
        listBtn.push(navItem);
        if (!firstIPCStream) {
          firstIPCStream = navItem;
        }
      }
      item.showInHomePageNav && listNav.push(navItem);
    }
    for (const key in streams) {
      const item = streams[key];
      const navItem = {
        mode: 'server',
        cfg: key,
        title: `1vN: ${item.serverName}/${getShortFlvName(item.flvFile)}`,
        ...item,
      };
      if (item.showInHomePageBtn) {
        listBtn.push(navItem);
        if (!firstServerStream) {
          firstServerStream = navItem;
        }
      }
      item.showInHomePageNav && listNav.push(navItem);
    }
    this.setData({ listBtn, listNav, firstServerStream, firstIPCStream });
  },
  onUnload() {},
  onShow() {
    // 再显示时同步一下状态，应该用事件通知，先简单处理吧
    if (!this.data.dirty || !this.data.p2pControl) {
      return;
    }
    this.data.p2pControl.refreshState();
    this.setData({ dirty: false });
  },
  onHide() {
    this.setData({ dirty: true });
  },
  onP2PModuleStateChange({ detail }) {
    console.log('index: onP2PModuleStateChange', detail);
  },
  gotoDemoPage(e) {
    const { url } = e.currentTarget.dataset;
    wx.navigateTo({ url });
  },
});

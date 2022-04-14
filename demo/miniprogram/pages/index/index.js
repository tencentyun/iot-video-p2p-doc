import devices from '../../config/devices';
import streams from '../../config/streams';
import { getXp2pManager } from '../../lib/xp2pManager';

const sysInfo = wx.getSystemInfoSync();
console.log('sysInfo', sysInfo);

const accountInfo = wx.getAccountInfoSync();
const miniProgramInfo = accountInfo.miniProgram;
console.log('miniProgramInfo', miniProgramInfo);

const xp2pManager = getXp2pManager();
const xp2pPluginInfo = xp2pManager.getXp2pPluginInfo();
const playerPluginInfo = xp2pManager.getPlayerPluginInfo();

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
    hostInfo: `${miniProgramInfo.appId}-${miniProgramInfo.envVersion}`,
    xp2pPluginInfo: xp2pPluginInfo ? `${xp2pPluginInfo.appId}-${xp2pPluginInfo.version}` : '',
    xp2pVersion: xp2pManager.XP2PVersion,
    playerPluginInfo: playerPluginInfo ? `${playerPluginInfo.appId}-${playerPluginInfo.version}` : '',
    playerVersion: xp2pManager.P2PPlayerVersion,

    // 这些是监控页入口
    listBtn: [],
    listNav: [],
    firstServerStream: null,
    firstIPCStream: null,
  },
  onLoad() {
    console.log('index: onLoad');
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
  onP2PModuleStateChange({ detail }) {
    console.log('index: onP2PModuleStateChange', detail);
  },
  gotoDemoPage(e) {
    const { url } = e.currentTarget.dataset;
    wx.navigateTo({ url });
  },
});

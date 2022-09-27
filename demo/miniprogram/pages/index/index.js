import devices from '../../config/devices';
import streams from '../../config/streams';
import config from '../../config/config';
import { getXp2pManager } from '../../lib/xp2pManager';

const sysInfo = wx.getSystemInfoSync();
console.log('sysInfo', sysInfo);

const accountInfo = wx.getAccountInfoSync();
const miniProgramInfo = accountInfo.miniProgram;
console.log('miniProgramInfo', miniProgramInfo);

const xp2pManager = getXp2pManager();
const xp2pPluginInfo = xp2pManager.getXp2pPluginInfo();
const playerPluginInfo = xp2pManager.getPlayerPluginInfo();

const { totalData } = config;

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
    recentIPCItem: null,
    listBtn: [],
    firstServerStream: null,
    firstIPCStream: null,

    // 选择的cfg
    cfg: '',
  },
  onLoad() {
    console.log('index: onLoad');
    const listBtn = [];
    let firstServerStream = null;
    let firstIPCStream = null;
    for (const key in devices) {
      const item = devices[key];
      const navItem = {
        p2pMode: 'ipc',
        cfg: key,
        title: `${item.productName || item.productId}/${item.deviceName}`,
        ...item,
      };
      if (item.showInHomePageBtn) {
        listBtn.push(navItem);
        if (!firstIPCStream) {
          firstIPCStream = navItem;
        }
      }
    }
    for (const key in streams) {
      const item = streams[key];
      const navItem = {
        p2pMode: 'server',
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
    }
    this.setData({ listBtn, firstServerStream, firstIPCStream });

    this.refreshRecnetIPC();
  },
  onShow() {
    this.refreshRecnetIPC();
  },
  refreshRecnetIPC() {
    const cfg = totalData.recentIPC || wx.getStorageSync('recentIPC');
    this.setData({
      recentIPCItem: cfg ? {
        p2pMode: 'ipc',
        cfg: 'recentIPC',
        title: `${cfg.productId}/${cfg.deviceName}`,
        ...cfg,
      } : null,
    });
  },
  onP2PModuleStateChange({ detail }) {
    console.log('index: onP2PModuleStateChange', detail);
  },
  onClickCfg(e) {
    const { cfg } = e.currentTarget.dataset;
    wx.navigateTo({ url: `/pages/xp2p-demo-1vN/demo?cfg=${cfg}` });
    // 容易误退出，还是跳到播放页再input
    // this.setData({ cfg });
  },
  onStartPlayer({ detail }) {
    console.log('index: onStartPlayer', detail);
    wx.navigateTo({ url: `/pages/xp2p-singleplayer/demo?json=${encodeURIComponent(JSON.stringify(detail))}` });
    this.setData({ cfg: '' });
  },
  onCancelInput() {
    this.setData({ cfg: '' });
  },
});

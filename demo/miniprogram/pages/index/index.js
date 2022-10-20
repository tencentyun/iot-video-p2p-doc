import config from '../../config/config';
import { getXp2pManager } from '../../lib/xp2pManager';

const sysInfo = wx.getSystemInfoSync();
console.log('sysInfo', sysInfo);

const accountInfo = wx.getAccountInfoSync();
const miniProgramInfo = accountInfo.miniProgram;
console.log('miniProgramInfo', miniProgramInfo);

const xp2pManager = getXp2pManager();

const { presetDevices, presetServerStreams, totalData } = config;

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
    xp2pVersion: xp2pManager.XP2PVersion,
    playerVersion: xp2pManager.P2PPlayerVersion,

    // 这些是监控页入口
    recentIPCItem: null,
    listVideoDevices: [],
    listMjpgDevices: [],
    listServerStreams: [],
    firstServerStream: null,
    firstIPCStream: null,
  },
  onLoad() {
    console.log('index: onLoad');
    const listVideoDevices = [];
    const listMjpgDevices = [];
    const listServerStreams = [];
    let firstServerStream = null;
    let firstIPCStream = null;
    for (const key in presetDevices) {
      const item = presetDevices[key];
      const navItem = {
        p2pMode: 'ipc',
        cfg: key,
        title: `${item.productName || item.productId}/${item.deviceName}`,
        ...item,
      };
      if (item.showInHomePageBtn) {
        if (navItem.isMjpgDevice) {
          listMjpgDevices.push(navItem);
        } else {
          listVideoDevices.push(navItem);
        }
        if (!firstIPCStream) {
          firstIPCStream = navItem;
        }
      }
    }
    for (const key in presetServerStreams) {
      const item = presetServerStreams[key];
      const navItem = {
        p2pMode: 'server',
        cfg: key,
        title: `1vN: ${item.serverName}/${getShortFlvName(item.flvFile)}`,
        ...item,
      };
      if (item.showInHomePageBtn) {
        listServerStreams.push(navItem);
        if (!firstServerStream) {
          firstServerStream = navItem;
        }
      }
    }
    this.setData({ listVideoDevices, listMjpgDevices, listServerStreams, firstServerStream, firstIPCStream });

    this.refreshRecnetIPC();
  },
  onShow() {
    this.refreshRecnetIPC();
  },
  refreshRecnetIPC() {
    const cfg = totalData.recentIPC;
    this.setData({
      recentIPCItem: cfg ? {
        p2pMode: 'ipc',
        cfg: 'recentIPC',
        title: `${cfg.isMjpgDevice ? 'M' : 'V'}: ${cfg.productId}/${cfg.deviceName}`,
        ...cfg,
      } : null,
    });
  },
  onP2PModuleStateChange({ detail }) {
    console.log('index: onP2PModuleStateChange', detail);
  },
  gotoPage(e) {
    const { url } = e.currentTarget.dataset;
    wx.navigateTo({ url });
  },
  async copyDocUrl(e) {
    const { doc } = e.currentTarget.dataset;
    if (!doc) {
      return;
    }
    await wx.setClipboardData({
      data: doc,
    });
    wx.showToast({ title: '文档地址已复制到剪贴板', icon: 'none' });
  },
});

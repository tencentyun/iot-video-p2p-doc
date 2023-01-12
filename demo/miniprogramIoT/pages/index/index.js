import { presetDevices, presetServerStreams, totalData } from '../../config/config';
import { getXp2pManager, Xp2pManagerEvent } from '../../lib/xp2pManager';

const sysInfo = wx.getSystemInfoSync();
const accountInfo = wx.getAccountInfoSync();
const miniProgramInfo = accountInfo.miniProgram;

let xp2pManager;

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
    playerVersion: '',
    xp2pVersion: '',
    xp2pUUID: '',
    xp2pState: '',

    // 这些是监控页入口
    recentIPCItem: null,
    listVideoDevices: [],
    listMjpgDevices: [],
    listServerStreams: [],
    firstServerStream: null,
    firstIPCStream: null,

    // 选择的cfg
    cfg: '',
  },
  onLoad() {
    console.log('index: onLoad');

    this.userData = {
      xp2pStateChangeListener: this.onXp2pStateChange.bind(this),
    };
    if (!xp2pManager) {
      xp2pManager = getXp2pManager();
      xp2pManager.addEventListener(Xp2pManagerEvent.XP2P_STATE_CHANGE, this.userData.xp2pStateChangeListener);
    }
    this.setData({
      playerVersion: xp2pManager.P2PPlayerVersion,
      xp2pVersion: xp2pManager.XP2PVersion,
      xp2pUUID: xp2pManager.uuid,
      xp2pState: xp2pManager.moduleState,
    });

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
        title: `${item.serverName}/${getShortFlvName(item.flvFile)}`,
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
  onUnload() {
    if (xp2pManager) {
      xp2pManager.removeEventListener(Xp2pManagerEvent.XP2P_STATE_CHANGE, this.userData.xp2pStateChangeListener);
    }
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
        title: `${cfg.productId}/${cfg.deviceName}`,
        ...cfg,
      } : null,
    });
  },
  onXp2pStateChange({ state }) {
    console.log('index: onXp2pStateChange', state);
    this.setData({ xp2pState: state });
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

import { presetDevices, presetServerStreams, totalData } from '../../config/config';

const sysInfo = wx.getSystemInfoSync();
const accountInfo = wx.getAccountInfoSync();
const miniProgramInfo = accountInfo.miniProgram;

const XP2PManagerEvent = {
  XP2P_STATE_CHANGE: 'xp2pStateChange',
  XP2P_NAT_EVENT: 'xp2pNatEvent',
};

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
    xp2pStateTime: 0,
    xp2pNatEvent: '',
    xp2pNatEventTime: 0,

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

    /**
     * demo是为了展示xp2p相关信息和状态才预加载 xp2pManager.js 并监听相关事件，实际应用可以不处理
     * 有构建过程的，可能不能直接用 require.async，建议查看构建工具文档
     */
    this.userData = {
      xp2pManager: null,
      xp2pStateChangeListener: this.onXp2pStateChange.bind(this),
      xp2pNatEventListener: this.onXp2pNatEvent.bind(this),
    };
    const app = getApp();
    if (app.xp2pManager) {
      console.log('index: xp2pManager existed');
      this.userData.xp2pManager = app.xp2pManager;
      this.onXp2pLoaded();
    } else {
      wx.nextTick(() => {
        const start = Date.now();
        console.log('index: preload xp2pManager');
        require.async('../video/lib/xp2pManager.js')
          .then((pkg) => {
            if (this.hasExited) {
              return;
            }
            console.log(`index: preload xp2pManager success, delay ${Date.now() - start}ms`, pkg);
            app.xp2pManager = pkg.getXp2pManager();
            this.userData.xp2pManager = app.xp2pManager;
            this.onXp2pLoaded();
          })
          .catch((err) => {
            if (this.hasExited) {
              return;
            }
            console.error(`index: preload xp2pManager fail, delay ${Date.now() - start}ms`, err);
          });
      });
    }
  },
  onUnload() {
    console.log('index: onUnload');
    this.hasExited = true;

    const { xp2pManager } = this.userData;
    if (xp2pManager) {
      xp2pManager.removeEventListener(XP2PManagerEvent.XP2P_STATE_CHANGE, this.userData.xp2pStateChangeListener);
      xp2pManager.removeEventListener(XP2PManagerEvent.XP2P_NAT_EVENT, this.userData.xp2pNatEventListener);
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
  onXp2pLoaded() {
    const { xp2pManager } = this.userData;
    console.log(`index: onXp2pLoaded, xp2pState ${xp2pManager?.moduleState}`);
    xp2pManager.addEventListener(XP2PManagerEvent.XP2P_STATE_CHANGE, this.userData.xp2pStateChangeListener);
    xp2pManager.addEventListener(XP2PManagerEvent.XP2P_NAT_EVENT, this.userData.xp2pNatEventListener);
    this.setData({
      playerVersion: xp2pManager.P2PPlayerVersion,
      xp2pVersion: xp2pManager.XP2PVersion,
      xp2pUUID: xp2pManager.uuid,
      xp2pState: xp2pManager.moduleState,
      xp2pStateTime: Date.now(),
    });
  },
  onXp2pStateChange({ state }) {
    console.log('index: onXp2pStateChange', state);
    this.setData({
      xp2pState: state,
      xp2pStateTime: Date.now(),
    });
    if (state === 'initing' || state === 'reseting') {
      this.setData({
        xp2pNatEvent: '',
        xp2pNatEventTime: 0,
      });
    }
  },
  onXp2pNatEvent({ type, detail }) {
    console.log('index: onXp2pNatEvent', type, detail);
    this.setData({
      xp2pNatEvent: type,
      xp2pNatEventTime: Date.now(),
    });
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

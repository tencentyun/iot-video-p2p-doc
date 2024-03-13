import { presetDevices, isDeviceCfgValid, presetServerStreams, totalData, updateRecentIPC, defaultShareInfo } from '../../config/config';
import { getUserId } from '../../utils';

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
    sysInfo: `${sysInfo.platform} / ${sysInfo.system}`,
    userId: getUserId(),
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
  onLoad(query) {
    console.log('index: onLoad', query);
    this.showPolicyModal();

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

    let url = '';
    switch (query.page) {
      case 'ipc-live':
        try {
          let json = query.json;
          if (json.charAt(0) === '%') {
            json = decodeURIComponent(query.json);
          }
          const detail = JSON.parse(json);
          console.log(`index: query.page ${query.page}, detail`, detail);
          // 转成 config 里的格式保存
          const deviceCfg = {
            ...detail.deviceInfo,
            xp2pInfo: detail.xp2pInfo,
            initCommand: detail.initCommand,
            liveStreamDomain: detail.liveStreamDomain,
            options: detail.options,
          };
          if (isDeviceCfgValid(deviceCfg)) {
            updateRecentIPC(deviceCfg);
            url = `/pages/video/pages/xp2p-demo-ipc/demo?json=${encodeURIComponent(json)}`;
          }
        } catch (err) {
          console.error(`index: query.page ${query.page}, parse json error`, err);
        };
        break;
    }
    url && wx.navigateTo({ url });
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
  onShareAppMessage() {
    return defaultShareInfo;
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
    console.log(`index: onXp2pLoaded, uuid ${xp2pManager?.uuid}, xp2pState ${xp2pManager?.moduleState}`);
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
  openSetting() {
    wx.openSetting({
      success() { /** */ },
      fail() {
        wx.showToast({ title: '打开失败！' });
      },
    });
  },
  gotoPage(e) {
    const { url, checkPlatform } = e.currentTarget.dataset;
    if (checkPlatform && !['ios', 'android', 'devtools'].includes(sysInfo.platform)) {
      wx.showToast({ title: `不支持当前平台: ${sysInfo.platform}`, icon: 'error' });
      return;
    }
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
  showPolicyModal() {
    const key = 'PRIVATE_POLICY_MODAL_SHOWED';
    const value = wx.getStorageSync(key);

    if (!value) {
      wx.setStorageSync(key, true);
      wx.showModal({
        title: '隐私政策',
        content: '我们严格按照《小程序服务声明》向您提供服务，不会收集和处理您的个人信息。如您对《小程序服务声明》有任何疑问或建议，可以通过声明内的联系方式向我们反馈。',
        confirmText: '我已知晓',
        cancelText: '查看声明',
        success(res) {
          if (!res.confirm) {
            console.log('res.confirm');
            wx.navigateTo({
              url: '/pages/private-policy/private-policy',
            });
          }
        },
      });
    }
  },
});

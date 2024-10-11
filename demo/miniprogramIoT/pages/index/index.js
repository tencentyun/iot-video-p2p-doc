import { isDeviceCfgValid, updateRecentIPC, defaultShareInfo } from '../../config/config';

const sysInfo = wx.getSystemInfoSync();

const XP2PManagerEvent = {
  XP2P_STATE_CHANGE: 'xp2pStateChange',
  XP2P_NAT_EVENT: 'xp2pNatEvent',
};

Page({
  data: {
    playerVersion: '',
    xp2pVersion: '',
    xp2pUUID: '',
    xp2pState: '',
    xp2pStateTime: 0,
    xp2pLocalPeername: '',
    xp2pNatEvent: '',
    xp2pNatEventTime: 0,

    // tcpFirst
    tcpFirst: false,
    canToggleTcpFirst: false,

    // 底部导航
    navigators: [
      {
        icon: 'order',
        title: 'Log管理',
        path: '/pages/user-files/files?name=logs',
      }, {
        icon: 'video',
        title: 'flv录像',
        path: '/pages/user-files/files?name=flvs',
      }, {
        icon: 'video',
        title: 'stream录像',
        path: '/pages/user-files/files?name=streams',
      }, {
        icon: 'phone',
        title: '对讲录像',
        path: '/pages/user-files/files?name=voices',
      }, {
        icon: 'download',
        title: '本地下载',
        path: '/pages/user-files/files?name=downloads',
      }, {
        icon: 'download',
        title: '云存下载',
        path: '/pages/user-files/files?name=cloud',
      }, {
        icon: 'video',
        title: 'Video测试',
        path: '/pages/test-video/test',
      }, {
        icon: 'video',
        title: 'local player',
        path: '/pages/video/pages/local-flv-player/player',
      }, {
        icon: 'phone',
        title: 'TWeCall',
        path: '/pages/video/pages/voip/voip',
      },
    ],
  },
  onLoad(query) {
    console.log('index: onLoad', query);
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
            console.log(`index: preload xp2pManager.js success, delay ${Date.now() - start}ms`, pkg);
            app.xp2pManager = pkg.getXp2pManager();
            this.userData.xp2pManager = app.xp2pManager;
            if (app.toggleTcpFirst) {
              this.setData({
                tcpFirst: app.tcpFirst,
                canToggleTcpFirst: true,
              });
            }
            console.log(`index: preload xp2pManager success, delay ${Date.now() - start}ms`, pkg);
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
  onShow() { },
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
      xp2pLocalPeername: this.userData.xp2pManager.localPeername,
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
    const { url, checkPlatform } = e.currentTarget.dataset;
    if (checkPlatform && !['ios', 'android', 'devtools'].includes(sysInfo.platform)) {
      wx.showToast({ title: `不支持当前平台: ${sysInfo.platform}`, icon: 'error' });
      return;
    }
    wx.navigateTo({ url });
  },

  handleNavigate(e) {
    const idx = parseInt(e.detail.key, 10);
    wx.navigateTo({ url: this.data.navigators[idx].path });
  },
});

import { getXp2pManager } from '../../lib/xp2pManager';

// 覆盖 console
const app = getApp();
const oriConsole = app.console;
const console = app.logger || oriConsole;

let xp2pManager;

const pageName = 'demo-page-server';
let pageSeq = 0;

Page({
  data: {
    // 这是onLoad时就固定的
    cfg: '',

    // 这些是控制player和p2p的
    playerId: 'iot-p2p-player',

    // 设备信息，在input组件里填
    targetId: '',
    deviceInfo: null,
    p2pMode: '',
    sceneType: '',

    // 播放器控制
    iconSize: 25,
    muted: false,
    orientation: 'vertical',
    fullScreen: false,

    // 调试
    showLog: true,
    showDebugInfo: false,
  },
  onLoad(query) {
    pageSeq++;
    const pageId = `${pageName}-${pageSeq}`;
    console.log('demo: onLoad', pageId, query);

    if (!xp2pManager) {
      xp2pManager = getXp2pManager();
    }

    this.userData = {
      pageId,
      deviceId: '',
      player: null,
    };

    console.log('demo: checkReset when enter');
    xp2pManager.checkReset();

    const cfg = query.cfg || '';
    this.setData({
      cfg,
    });
  },
  onShow() {
    console.log('demo: onShow');
  },
  onHide() {
    console.log('demo: onHide');
  },
  onUnload() {
    console.log('demo: onUnload');
    this.hasExited = true;

    // 监控页关掉player就好，不用销毁 p2p 模块
    if (this.userData.player) {
      console.log('demo: player.stopAll');
      this.userData.player.stopAll();
      this.userData.player = null;
    }

    // 断开连接
    if (this.userData.deviceId) {
      console.log('demo: stopP2PService', this.userData.deviceId);
      xp2pManager.stopP2PService(this.userData.deviceId, this.userData.pageId);
      this.userData.deviceId = '';
    }

    console.log('demo: checkReset when exit');
    xp2pManager.checkReset();
    console.log('demo: onUnload end');
  },
  onStartPlayer({ detail }) {
    console.log('demo: onStartPlayer', detail);
    if (detail.p2pMode !== 'server' || detail.sceneType !== 'live') {
      // p2pMode 不匹配
      console.log('demo: info error');
      this.setData({
        targetId: detail.targetId,
        deviceInfo: detail.deviceInfo,
        p2pMode: detail.p2pMode,
        sceneType: detail.sceneType,
      });
      return;
    }

    this.userData.deviceId = detail.deviceInfo.deviceId;

    // 开始连接
    console.log('demo: startP2PService', this.userData.deviceId);
    try {
      xp2pManager.startP2PService({
        p2pMode: detail.p2pMode,
        deviceInfo: detail.deviceInfo,
        flvUrl: detail.flvUrl,
        caller: this.userData.pageId,
      }).catch(() => undefined); // 只是提前连接，不用处理错误
    } catch (err) {
      console.error('demo: startP2PService err', err);
    }

    console.log('demo: create components');
    this.setData(detail, () => {
      const player = this.selectComponent(`#${this.data.playerId}`);
      if (player) {
        console.log('demo: create player success');
        this.userData.player = player;
      } else {
        console.error('demo: create player error');
      }
    });
  },
  // player事件
  onPlayerEvent({ type, detail }) {
    console.log('demo: onPlayerEvent', type, detail);
  },
  onPlayError({ detail }) {
    console.error('demo: onPlayError', detail);
    const { errMsg, errDetail } = detail;
    wx.showModal({
      content: `${errMsg || '播放失败'}\n${(errDetail && errDetail.msg) || ''}`, // 换行在开发者工具中无效，真机正常
      showCancel: false,
    });
  },
  onFullScreenChange({ detail }) {
    console.log('demo: onFullScreenChange', detail);
    this.setData({ fullScreen: detail.fullScreen });
  },
  // player控制
  changeMuted() {
    console.log('demo: changeMuted');
    this.setData({
      muted: !this.data.muted,
    });
  },
  changeOrientation() {
    console.log('demo: changeOrientation');
    this.setData({
      orientation: this.data.orientation === 'horizontal' ? 'vertical' : 'horizontal',
    });
  },
  async changeFullScreen() {
    console.log('demo: changeFullScreen');
    if (!this.userData.player) {
      console.error('demo: changeFullScreen but no player component');
      return;
    }
    if (!this.data.fullScreen) {
      try {
        await this.userData.player.requestFullScreen({ direction: 90 });
        this.setData({
          fullScreen: true,
        });
      } catch (err) {
        wx.showToast({
          title: err.errMsg,
          icon: 'error',
        });
      }
    } else {
      try {
        await this.userData.player.exitFullScreen();
        this.setData({
          fullScreen: false,
        });
      } catch (err) {
        wx.showToast({
          title: err.errMsg,
          icon: 'error',
        });
      }
    }
  },
  snapshotAndSave() {
    console.log('demo: snapshotAndSave');
    if (!this.userData.player) {
      console.error('demo: snapshotAndSave but no player component');
      return;
    }
    this.userData.player.snapshotAndSave();
  },
  toggleDebugInfo() {
    console.log('demo: toggleDebugInfo');
    this.setData({ showDebugInfo: !this.data.showDebugInfo });
  },
});

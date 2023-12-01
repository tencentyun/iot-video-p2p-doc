import { getXp2pManager } from '../../lib/xp2pManager';

// 覆盖 console
const app = getApp();
const oriConsole = app.console;
const console = app.logger || oriConsole;

let xp2pManager;

const formatTime = () => {
  const d = new Date();
  return `${d.getHours()}:${d.getMinutes()}:${d.getSeconds()}.${d.getMilliseconds()}`;
};

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
    options: {},

    // 播放器控制
    muted: false,
    orientation: 'vertical',
    fullScreen: false,

    // 控件icon
    controlsId: 'controls',
    iconSize: 25,
    showIcons: {
      quality: false,
      muted: true,
      orientation: true,
      fullScreen: true,
      snapshot: true,
    },

    // 调试
    showDebugInfo: false,

    stat: {
      p2pBytes: 0,
      cdnBytes: 0,
      standbySize: 0,
      connectingSize: 0,
      candidateSize: 0,
      childrenSize: 0,
      childrenStr: '',
      parent: '',
      subscribeLog: [],
    },
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

    xp2pManager.on('p2pDevNotify', this.onP2PDevNotify.bind(this));
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
    xp2pManager.startP2PService({
      p2pMode: detail.p2pMode,
      deviceInfo: detail.deviceInfo,
      flvUrl: detail.flvUrl,
      caller: this.userData.pageId,
    }).catch((err) => {
      // 只是提前连接，不用特别处理
      console.error('demo: startP2PService err', err);
    });

    console.log('demo: create components');
    this.setData(detail, () => {
      const player = this.selectComponent(`#${this.data.playerId}`);
      if (player) {
        console.log('demo: create player success');
        oriConsole.log('demo: player', player); // console 被覆盖了会写logger影响性能，查看组件用 oriConsole
        this.userData.player = player;
      } else {
        console.error('demo: create player error');
      }
      const controls = this.selectComponent(`#${this.data.controlsId}`);
      if (controls) {
        console.log('demo: create controls success');
        oriConsole.log('demo: controls', controls);
      } else {
        console.error('demo: create controls error');
      }
    });
  },
  onP2PDevNotify({ type, detail }) {
    switch (type) {
      case 'peers':
        this.setData({
          standbySize: detail.standbySize,
          candidateSize: detail.candidateSize,
          connectingSize: detail.connectingSize,
          childrenSize: detail.childrenSize,
          childrenStr: detail.childrenStr,
          localPeername: detail.localPeername,
          p2pBytes: Math.floor(this.data.stat.p2pBytes / 1024),
          cdnBytes: Math.floor(this.data.stat.cdnBytes / 1024),
        });
        break;
      case 'P2P':
        this.data.stat.p2pBytes += detail.chunkSize;
        break;
      case 'CDN':
        this.data.stat.cdnBytes += detail.chunkSize;
        break;
      case 'parent':
        this.setData({
          parent: detail.peername,
        });
        break;
      case 'subscribe':
        this.data.stat.subscribeLog.push(`[${formatTime()}] ${detail} \n`);
        this.setData({
          subscribeLog: this.data.stat.subscribeLog.join(''),
        });
        break;
    }
  },
  // player事件
  onPlayerEvent({ type, detail }) {
    console.log('demo: onPlayerEvent', type, detail);
  },
  onPlayStateEvent({ type, detail }) {
    console.log('demo: onPlayStateEvent', type, detail);
  },
  onPlayError({ type, detail }) {
    this.onPlayStateEvent({ type, detail });

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
  clickControlIcon({ detail }) {
    const { name } = detail;
    console.log('demo: clickControlIcon', name);
    switch (name) {
      case 'muted':
        this.changeMuted();
        break;
      case 'orientation':
        this.changeOrientation();
        break;
      case 'fullScreen':
        this.changeFullScreen();
        break;
      case 'snapshot':
        this.snapshotAndSave();
        break;
    }
  },
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

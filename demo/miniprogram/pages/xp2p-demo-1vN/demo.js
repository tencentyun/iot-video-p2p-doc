import { getXp2pManager } from '../../lib/xp2pManager';

// 覆盖 console
const app = getApp();
const oriConsole = app.console;
const console = app.logger || oriConsole;

const xp2pManager = getXp2pManager();

Page({
  data: {
    // 这是onLoad时就固定的
    cfg: '',

    // 这些是控制player和p2p的
    playerId: 'iot-p2p-player',
  },
  onLoad(query) {
    console.log('demo: onLoad', query);

    this.userData = {
      targetId: '',
      player: null,
    };

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
    if (this.userData.targetId) {
      console.log('demo: stopP2PService', this.userData.targetId);
      xp2pManager.stopP2PService(this.userData.targetId);
      this.userData.targetId = '';
    }

    console.log('demo: checkReset when exit');
    xp2pManager.checkReset();
    console.log('demo: onUnload end');
  },
  onStartPlayer({ detail }) {
    console.log('demo: onStartPlayer', detail);
    this.userData.targetId = detail.targetId;

    // 开始连接
    console.log('demo: startP2PService', this.userData.targetId);
    try {
      xp2pManager.startP2PService(this.userData.targetId, {
        url: detail.flvUrl,
        productId: detail.productId,
        deviceName: detail.deviceName,
        xp2pInfo: detail.xp2pInfo,
        liveStreamDomain: detail.liveStreamDomain,
        codeUrl: detail.codeUrl,
      }).catch(() => undefined); // 只是提前连接，不用处理错误
    } catch (err) {
      console.error('demo: startP2PService err', err);
    }

    console.log('demo: create player');
    this.setData(detail, () => {
      const player = this.selectComponent(`#${this.data.playerId}`);
      if (player) {
        this.userData.player = player;
      } else {
        console.error('demo: create player error', this.data.playerId);
      }
    });
  },
  onPlayError({ detail }) {
    console.error('demo: onPlayError', detail);
    const { errMsg, errDetail, isFatalError } = detail;
    wx.showModal({
      content: `${errMsg || '播放失败'}\n${(errDetail && errDetail.msg) || ''}`, // 换行在开发者工具中无效，真机正常
      showCancel: false,
      complete: () => {
        console.log(`demo: error modal complete, isFatalError ${isFatalError}`);
        if (isFatalError) {
          // 致命错误，需要reset的全部reset
          xp2pManager.checkReset();
          this.userData.player?.reset();
        }
      },
    });
  },
  onOpenPage() {
    wx.navigateTo({ url: '/pages/test-video/test' });
  },
});

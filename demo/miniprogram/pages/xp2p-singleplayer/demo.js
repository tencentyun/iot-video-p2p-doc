import { getXp2pManager } from '../../lib/xp2pManager';

// 覆盖 console
const app = getApp();
const oriConsole = app.console;
const console = app.logger || oriConsole;

const xp2pManager = getXp2pManager();

Page({
  data: {
    // 这是onLoad时就固定的
    p2pMode: '',
    targetId: '',
    flvUrl: '',
    mjpgFile: '',
    productId: '',
    deviceName: '',
    xp2pInfo: '',
    liveStreamDomain: '',
    codeUrl: '',
    options: null,
    onlyp2pMap: null,

    // 这些是控制player和p2p的
    playerId: 'iot-p2p-player',
    playerTitle: '',
  },
  onLoad(query) {
    console.log('singleplayer: onLoad', query);

    this.userData = {
      targetId: '',
      player: null,
    };

    let info;
    try {
      const json = decodeURIComponent(query.json);
      info = JSON.parse(json);
    } catch (err) {
      console.error('singleplayer: parse cfg error', err);
    };
    if (!info?.targetId) {
      wx.showModal({
        content: 'invalid cfg',
        showCancel: false,
      });
      return;
    }

    if (info.p2pMode === 'ipc') {
      info.playerTitle = `${info.productId}/${info.deviceName}`;
    }

    this.startPlayer(info);
  },
  onShow() {
    console.log('singleplayer: onShow');
  },
  onHide() {
    console.log('singleplayer: onHide');
  },
  onUnload() {
    console.log('singleplayer: onUnload');
    this.hasExited = true;

    // 监控页关掉player就好，不用销毁 p2p 模块
    if (this.userData.player) {
      console.log('singleplayer: player.stopAll');
      this.userData.player.stopAll();
      this.userData.player = null;
    }

    // 断开连接
    if (this.userData.targetId) {
      console.log('singleplayer: stopP2PService', this.userData.targetId);
      xp2pManager.stopP2PService(this.userData.targetId);
      this.userData.targetId = '';
    }

    console.log('singleplayer: checkReset when exit');
    xp2pManager.checkReset();
    console.log('singleplayer: onUnload end');
  },
  startPlayer(detail) {
    console.log('singleplayer: startPlayer', detail);
    this.userData.targetId = detail.targetId;

    // 开始连接
    console.log('singleplayer: startP2PService', this.userData.targetId);
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
      console.error('singleplayer: startP2PService err', err);
    }

    console.log('singleplayer: create player');
    this.setData(detail, () => {
      const player = this.selectComponent(`#${this.data.playerId}`);
      if (player) {
        this.userData.player = player;
      } else {
        console.error('singleplayer: create player error', this.data.playerId);
      }
    });
  },
  onPlayError({ detail }) {
    console.error('singleplayer: onPlayError', detail);
    const { errMsg, errDetail, isFatalError } = detail;
    wx.showModal({
      content: `${errMsg || '播放失败'}\n${(errDetail && errDetail.msg) || ''}`, // 换行在开发者工具中无效，真机正常
      showCancel: false,
      complete: () => {
        console.log(`singleplayer: error modal complete, isFatalError ${isFatalError}`);
        if (isFatalError) {
          // 致命错误，需要reset的全部reset
          xp2pManager.checkReset();
          this.userData.player?.reset();
        }
      },
    });
  },
});

import config from '../../config/config';
import { getXp2pManager } from '../../xp2pManager';

const xp2pManager = getXp2pManager();

const getPlayerProperties = (cfg, opts) => {
  const { totalData } = config;
  const cfgData = (cfg && totalData[cfg]) || totalData.tcptest;
  const realHost = cfgData.mode === 'server' ? cfgData.host : 'XP2P_INFO.xnet';

  return {
    mode: cfgData.mode,
    targetId: cfgData.targetId,
    flvUrl: `http://${realHost}${cfgData.basePath}${cfgData.flvFile}`,
    productId: cfgData.productId || '',
    deviceName: cfgData.deviceName || '',
    xp2pInfo: cfgData.xp2pInfo || cfgData.peername || '',
    codeUrl: cfgData.codeUrl || '',
    ...opts,
  };
};

Page({
  data: {
    // 这是onLoad时就固定的
    mode: '',
    targetId: '',
    flvUrl: '',
    productId: '',
    deviceName: '',
    xp2pInfo: '',
    codeUrl: '',
    onlyp2p: false,
    showDebugInfo: false,

    // 这些是控制player和p2p的
    playerId: 'iot-p2p-player',
    playerTitle: '',
    player: null,
  },
  onLoad(query) {
    console.log('singleplayer: onLoad', query);

    const cfg = query.cfg || query.mode || '';
    const onlyp2p = !!parseInt(query.onlyp2p, 10);
    const opts = {
      onlyp2p,
      showDebugInfo: this.data.showDebugInfo,
    };

    const newData = getPlayerProperties(cfg, opts);
    if (newData.mode === 'ipc') {
      newData.playerTitle = `${newData.productId}/${newData.deviceName}`;
    }

    console.log('singleplayer: setData', newData);
    this.setData(newData, () => {
      const player = this.selectComponent(`#${this.data.playerId}`);
      if (player) {
        this.setData({ player });
      } else {
        console.error('create player error', this.data.playerId);
      }
    });
  },
  onUnload() {
    console.log('singleplayer: onUnload');
    this.hasExited = true;

    // 监控页关掉player就好，不用销毁 p2p 模块
    if (this.data.player) {
      this.data.player.stopAll();
      this.setData({ player: null });
    }

    if (xp2pManager.networkChanged) {
      try {
        console.log('networkChanged, resetP2P when exit');
        xp2pManager.resetP2P();
      } catch (err) {}
    }

    if (xp2pManager.needResetLocalServer) {
      try {
        console.log('needResetLocalServer, resetLocalServer when exit');
        xp2pManager.resetLocalServer();
      } catch (err) {}
    }
  },
  onPlayError({ detail }) {
    console.log('singleplayer: onPlayError', detail.errType, 'isFatalError', detail.isFatalError, detail);
    const { playerId, errMsg, errDetail, isFatalError } = detail;
    wx.showModal({
      content: `${playerId}: ${errMsg || '播放失败'}\n${(errDetail && errDetail.msg) || ''}`, // 换行在开发者工具中无效，真机正常
      showCancel: false,
      complete: () => {
        if (isFatalError) {
          !this.hasExited && wx.navigateBack();
        }
      },
    });
  },
  onPlayerSystemPermissionDenied({ detail }) {
    wx.showModal({
      content: `systemPermissionDenied\n${detail.errMsg}`,
      showCancel: false,
    });
  },
});

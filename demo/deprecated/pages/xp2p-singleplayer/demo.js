import { getPlayerProperties } from '../../utils';
import { getXp2pManager } from '../../lib/xp2pManager';

const xp2pManager = getXp2pManager();

Page({
  data: {
    // 这是onLoad时就固定的
    p2pMode: '',
    targetId: '',
    productId: '',
    deviceName: '',
    xp2pInfo: '',
    flvFile: '',
    codeUrl: '',
    flvUrl: '',
    onlyp2p: false,

    // 这些是控制player和p2p的
    playerId: 'iot-p2p-player',
    playerTitle: '',
    player: null,
  },
  onLoad(query) {
    console.log('singleplayer: onLoad', query);

    console.log('singleplayer: checkReset when enter');
    xp2pManager.checkReset();

    const cfg = query.cfg || '';
    const onlyp2p = !!parseInt(query.onlyp2p, 10);
    const opts = {
      onlyp2p,
    };

    const newData = getPlayerProperties(cfg, opts);
    if (!newData) {
      wx.showModal({
        content: `invalid cfg ${cfg}`,
        showCancel: false,
      });
      return;
    }

    if (newData.p2pMode === 'ipc') {
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

    console.log('singleplayer: checkReset when exit');
    xp2pManager.checkReset();
  },
  onPlayError({ detail, currentTarget }) {
    console.log('singleplayer: onPlayError', currentTarget.id, detail.errType, 'isFatalError', detail.isFatalError, detail);
    const { errMsg, errDetail, isFatalError } = detail;
    wx.showModal({
      content: `${currentTarget.id}: ${errMsg || '播放失败'}\n${(errDetail && errDetail.msg) || ''}`, // 换行在开发者工具中无效，真机正常
      showCancel: false,
      complete: () => {
        if (isFatalError) {
          // demo简单点，直接退出，注意 onUnload 时可能需要reset插件
          // 如果不想退出，在这里reset插件（如果需要的话），然后重新创建player组件
          !this.hasExited && wx.navigateBack();
        }
      },
    });
  },
});

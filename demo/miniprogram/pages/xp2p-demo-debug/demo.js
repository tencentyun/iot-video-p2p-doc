import { getXp2pManager } from '../../xp2pManager';

const xp2pManager = getXp2pManager();

Page({
  data: {
    // 这是onLoad时就固定的
    cfg: '',
    onlyp2p: false,
    reserve: false, // 退出时保留连接，仅适用于1v1

    // 这些是控制player和p2p的
    playerId: 'iot-p2p-player',
    player: null,
  },
  onLoad(query) {
    console.log('demo: onLoad', query);

    const cfg = query.cfg || '';
    const onlyp2p = !!parseInt(query.onlyp2p, 10);
    const reserve = !!parseInt(query.reserve, 10);
    this.setData(
      {
        cfg,
        onlyp2p,
        reserve,
      },
      () => {
        console.log('now data', this.data);
        const player = this.selectComponent(`#${this.data.playerId}`);
        if (player) {
          this.setData({ player });
        } else {
          console.error('create player error', this.data.playerId);
        }
      },
    );
  },
  onUnload() {
    console.log('demo: onUnload');
    this.hasExited = true;

    // 监控页关掉player就好，不用销毁 p2p 模块
    if (this.data.player) {
      this.data.player.stopAll('auto'); // 按player内部属性来
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
  onPlayError({ detail, currentTarget }) {
    console.log('demo: onPlayError', currentTarget.id, detail);
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
  onPlayerSystemPermissionDenied({ detail }) {
    wx.showModal({
      content: `systemPermissionDenied\n${detail.errMsg}`,
      showCancel: false,
    });
  },
});

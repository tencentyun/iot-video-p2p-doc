Page({
  data: {
    // 这是onLoad时就固定的
    cfg: '',
    onlyp2p: false,
    reserve: false, // 退出时保留连接，仅适用于1v1

    // 这些控制p2p的
    controlId: 'iot-p2p-control',
    p2pControl: null,

    // 这些是控制player和p2p的
    playerId: 'iot-p2p-player',
    player: null,
  },
  onLoad(query) {
    console.log('onLoad', query);

    const p2pControl = this.selectComponent(`#${this.data.controlId}`);
    this.setData({ p2pControl });

    const cfg = query.cfg || query.mode || '';
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
    console.log('onUnload');

    // 监控页关掉player就好，不用销毁 p2p 模块
    if (this.data.player) {
      this.data.player.stopAll('auto'); // 按player内部属性来
      this.setData({ player: null });
    }
  },
  stopAllPlayers() {
    if (this.data.player) {
      this.data.player.stopAll();
    }
  },
  onP2PModuleStateChange({ detail }) {
    console.log('demo: onP2PModuleStateChange', detail);
  },
  onP2PDisconnect({ detail }) {
    const { playerId, notifyDetail } = detail;
    wx.showModal({
      content: `${playerId}: 连接失败或断开\n${(notifyDetail && notifyDetail.msg) || ''}`, // 换行在开发者工具中无效，真机正常
      confirmText: '重置P2P',
      success: (result) => {
        if (result.confirm) {
          // 重置P2P
          this.data.p2pControl.resetP2P();
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

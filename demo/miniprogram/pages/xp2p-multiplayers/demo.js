Page({
  data: {
    // 这是onLoad时就固定的
    cfg1: '',
    cfg2: '',
    onlyp2p: false,

    // 这些控制p2p的
    controlId: 'iot-p2p-control',
    p2pControl: null,

    // 这些是控制player和p2p的
    playerId1: 'iot-p2p-player-1',
    playerId2: 'iot-p2p-player-2',
    playerMap: {},
  },
  onLoad(query) {
    console.log('onLoad', query);

    const p2pControl = this.selectComponent(`#${this.data.controlId}`);
    this.setData({ p2pControl });

    const cfg1 = query.cfg1 || '';
    const cfg2 = query.cfg2 || '';
    const onlyp2p = !!parseInt(query.onlyp2p, 10);
    this.setData(
      {
        cfg1,
        cfg2,
        onlyp2p,
      },
      () => {
        console.log('now data', this.data);

        const playerMap = {};
        [this.data.playerId1, this.data.playerId2].forEach((playerId) => {
          const player = this.selectComponent(`#${playerId}`);
          if (player) {
            playerMap[playerId] = player;
          } else {
            console.error('create player error', playerId);
          }
        });
        this.setData(
          {
            playerMap,
          },
          () => {
            console.log('now playerMap', this.data.playerMap);
          },
        );
      },
    );
  },
  onUnload() {
    console.log('onUnload');

    // 监控页关掉player就好，不用销毁 p2p 模块
    this.stopAllPlayers();

    this.setData({ playerMap: {} });
  },
  stopAllPlayers() {
    Object.values(this.data.playerMap).forEach((player) => {
      player.stopAll();
    });
  },
  onP2PModuleStateChange({ detail }) {
    console.log('multiplayers: onP2PModuleStateChange', detail);
  },
});

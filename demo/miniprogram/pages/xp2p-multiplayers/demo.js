import { getXp2pManager } from '../../xp2pManager';

const xp2pManager = getXp2pManager();
const playerPlugin = requirePlugin('wechat-p2p-player');

Page({
  data: {
    // 这是onLoad时就固定的
    cfg1: '',
    cfg2: '',
    onlyp2p: false,

    // 这些是控制player和p2p的
    playerId1: 'iot-p2p-player-1',
    playerId2: 'iot-p2p-player-2',
    playerMap: {},

    // 退出时用
    needResetLocalServer: false,
  },
  onLoad(query) {
    console.log('multiplayers: onLoad', query);

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

    xp2pManager
      .initModule()
      .then((res) => {
        console.log('multiplayers: initModule res', res);
        if (res !== 0) {
          xp2pManager.destroyModule();
          wx.showModal({
            content: `initModule error, res: ${res}`,
            showCancel: false,
            complete: () => {
              !this.hasExited && wx.navigateBack();
            },
          });
        }
      })
      .catch((err) => {
        console.error('multiplayers: initModule error', err);
        xp2pManager.destroyModule();
        wx.showModal({
          content: 'initModule error',
          showCancel: false,
          complete: () => {
            !this.hasExited && wx.navigateBack();
          },
        });
      });
  },
  onUnload() {
    console.log('multiplayers: onUnload');
    this.hasExited = true;

    // 监控页关掉player就好，不用销毁 p2p 模块
    this.stopAllPlayers();

    this.setData({ playerMap: {} });

    if (xp2pManager.networkChanged) {
      console.log('networkChanged, destroyP2P when exit');
      xp2pManager.destroyModule();
    }

    if (this.data.needResetLocalServer) {
      try {
        console.log('reset playerPlugin');
        playerPlugin.reset();
      } catch (err) {
        console.error('reset playerPlugin error', err);
      }
    }
  },
  onShow() {
    console.log('multiplayers: onShow', Date.now());
  },
  onHide() {
    console.log('multiplayers: onHide', Date.now());
  },
  stopAllPlayers() {
    Object.values(this.data.playerMap).forEach((player) => {
      player.stopAll();
    });
  },
  onP2PDisconnect({ detail }) {
    console.log('multiplayers: onP2PDisconnect', Date.now(), detail);
    const { playerId, notifyDetail } = detail;
    wx.showModal({
      content: `${playerId}: 连接失败或断开\n${(notifyDetail && notifyDetail.msg) || ''}`, // 换行在开发者工具中无效，真机正常
      showCancel: false,
      complete: () => {
        !this.hasExited && wx.navigateBack();
      },
    });
  },
  onPlayerLocalServerError({ detail }) {
    console.log('multiplayers: onPlayerLocalServerError', Date.now(), detail);

    // 记下来，退出时再处理
    this.setData({ needResetLocalServer: true });

    wx.showModal({
      content: `${detail.playerId}: 本地连接失败`,
      showCancel: false,
      complete: () => {
        !this.hasExited && wx.navigateBack();
      },
    });
  },
});

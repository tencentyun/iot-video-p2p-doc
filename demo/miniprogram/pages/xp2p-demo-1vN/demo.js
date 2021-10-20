import { getXp2pManager } from '../../xp2pManager';

const xp2pManager = getXp2pManager();
const playerPlugin = requirePlugin('wechat-p2p-player');

Page({
  data: {
    // 这是onLoad时就固定的
    cfg: '',
    onlyp2p: false,
    reserve: false, // 退出时保留连接，仅适用于1v1

    // 这些是控制player和p2p的
    playerId: 'iot-p2p-player',
    player: null,

    // 退出时用
    needResetLocalServer: false,
  },
  onLoad(query) {
    console.log('demo: onLoad', query);

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

    xp2pManager
      .initModule()
      .then((res) => {
        console.log('demo: initModule res', res);
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
        console.error('demo: initModule error', err);
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
    console.log('demo: onUnload');
    this.hasExited = true;

    // 监控页关掉player就好，不用销毁 p2p 模块
    if (this.data.player) {
      this.data.player.stopAll('auto'); // 按player内部属性来
      this.setData({ player: null });
    }

    if (xp2pManager.networkChanged) {
      try {
        console.log('networkChanged, destroyP2P when exit');
        xp2pManager.destroyModule();
      } catch (err) {}
    }

    if (this.data.needResetLocalServer) {
      try {
        console.log('reset playerPlugin when exit');
        playerPlugin.reset();
      } catch (err) {
        console.error('reset playerPlugin error', err);
      }
    }
  },
  onShow() {
    console.log('demo: onShow', Date.now());
  },
  onHide() {
    console.log('demo: onHide', Date.now());
  },
  stopAllPlayers() {
    if (this.data.player) {
      this.data.player.stopAll();
    }
  },
  onP2PDisconnect({ detail }) {
    console.log('demo: onP2PDisconnect', Date.now(), detail);
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
    console.log('demo: onPlayerLocalServerError', Date.now(), detail);

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
  onPlayerSystemPermissionDenied({ detail }) {
    wx.showModal({
      content: `systemPermissionDenied\n${detail.errMsg}`,
      showCancel: false,
    });
  },
});

import config from '../../config';

const xp2pPlugin = requirePlugin('xp2p');
const p2pExports = xp2pPlugin.p2p;

const delay = (duration) => new Promise((resolve) => setTimeout(resolve, duration));

Page({
  data: {
    // 这是onLoad时就固定的
    cfg: '',
    onlyp2p: false,

    // 这些是p2p状态
    state: '',
    localPeername: '',
    timestamps: {
      init: 0,
      inited: 0,
      resetP2P: 0,
      reseted: 0,
    },

    // 这些是控制player和p2p的
    playerId: 'iot-p2p-player',
    player: null,
  },
  onLoad(query) {
    console.log('p2pExports', p2pExports);

    console.log('onLoad', query);
    const cfg = query.cfg || query.mode || '';
    const onlyp2p = !!parseInt(query.onlyp2p, 10);
    this.setData(
      {
        cfg,
        onlyp2p,
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

    // 监听网络变化
    wx.onNetworkStatusChange((res) => {
      console.error('network changed, now state: ', this.data.state);
      console.log(res);
      if (this.data.player) {
        this.data.player.stopAll();
        if (res.isConnected) {
          this.resetP2P();
          this.data.player.startPlay();
        }
      }
    });

    p2pExports.enableHttpLog(false);
    p2pExports.enableNetLog(false);

    // 自动 initModule
    this.initModule();
  },
  onUnload() {
    console.log('onUnload');
    this.destroyModule();
  },
  showToast(content) {
    wx.showToast({
      title: content,
      icon: 'none',
    });
  },
  resetXP2PData() {
    this.setData({
      state: '',
      localPeername: '',
      timestamps: {},
    });
  },
  printData() {
    console.info('now data', this.data);
  },
  initModule() {
    if (this.data.state) {
      this.showToast('p2pModule already running');
      return;
    }

    const start = Date.now();
    this.setData({ state: 'init', 'timestamps.init': start });

    p2pExports
      .init({
        appParams: config.appParams,
      })
      .then((res) => {
        console.log('init res', res);

        if (res === 0) {
          const now = Date.now();
          console.log('init delay', now - start);
          const localPeername = p2pExports.getLocalXp2pInfo();
          console.log('localPeername', localPeername);
          this.setData({ state: 'inited', 'timestamps.inited': now, localPeername });
        } else {
          this.resetXP2PData();
          wx.showModal({
            content: `init 失败, res=${res}`,
            showCancel: false,
          });
        }
      })
      .catch((errcode) => {
        console.error('init error', errcode);

        this.resetXP2PData();
        wx.showModal({
          content: `init 失败, errcode: ${errcode}`,
          showCancel: false,
        });
      });
  },
  destroyModule() {
    console.log('destroyModule');

    if (!this.data.state) {
      console.log('p2pModule not running');
      return;
    }

    if (this.data.player) {
      this.data.player.stopAll();
    }

    this.resetXP2PData();
    p2pExports.destroy();
  },
  destroyModuleAsync() {
    delay(10).then(() => {
      this.destroyModule();
    });
  },
  resetP2P() {
    if (!this.data.state) {
      console.log('p2pModule not running');
      return;
    }

    if (this.data.player) {
      this.data.player.stopAll();
    }

    const start = Date.now();
    this.setData({ state: 'resetP2P', 'timestamps.resetP2P': start, localPeername: '' });
    p2pExports
      .resetP2P()
      .then((res) => {
        console.log('resetP2P res', res);
        if (res === 0) {
          const now = Date.now();
          console.log('resetP2P delay', now - start);
          const localPeername = p2pExports.getLocalXp2pInfo();
          console.log('localPeername', localPeername);
          this.setData({ state: 'inited', 'timestamps.reseted': now, localPeername });
        } else {
          this.destroyModule();
          wx.showModal({
            content: `resetP2P 失败, res=${res}`,
            showCancel: false,
          });
        }
      })
      .catch((errcode) => {
        console.error('reset error', errcode);
        this.destroyModule();
        wx.showModal({
          content: `reset 失败, errcode: ${errcode}`,
          showCancel: false,
        });
      });
  },
  onP2PMessage_Notify(event) {
    const { playerId, type, detail } = event.detail;
    if (type === p2pExports.XP2PNotify_SubType.Disconnect) {
      wx.showModal({
        content: `${playerId}: 连接断开\n${(detail && detail.msg) || ''}`, // 换行在开发者工具中无效，真机正常
        confirmText: '重置P2P',
        success: (result) => {
          if (result.confirm) {
            // 重置P2P
            this.resetP2P();
          }
        },
      });
    }
  },
  onPlayerSystemPermissionDenied({ detail }) {
    wx.showModal({
      content: `systemPermissionDenied\n${detail.errMsg}`,
      showCancel: false,
    });
  },
});

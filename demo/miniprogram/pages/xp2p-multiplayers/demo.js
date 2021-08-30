import config from '../../config';

const xp2pPlugin = requirePlugin('xp2p');
const p2pExports = xp2pPlugin.p2p;

const delay = (duration) => new Promise((resolve) => setTimeout(resolve, duration));

Page({
  data: {
    // 这是onLoad时就固定的
    cfg1: '',
    cfg2: '',
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
    playerId1: 'iot-p2p-player-1',
    playerId2: 'iot-p2p-player-2',
    playerMap: {},
  },
  onLoad(query) {
    console.log('p2pExports', p2pExports);

    console.log('onLoad', query);
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

    p2pExports.enableHttpLog(false);
    p2pExports.enableNetLog(false);

    // 自动 initModule
    this.initModule();
  },
  onUnload() {
    console.log('onUnload');

    // 监控页关掉player就好，不用销毁 p2p 模块
    Object.values(this.data.playerMap).forEach((player) => {
      player.stopAll();
    });
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

    const app = getApp();
    app
      .initModule()
      .then((res) => {
        console.log('init res', res);

        if (res === 0) {
          const now = Date.now();
          console.log('init delay', now - start);
          const { localPeername } = app.p2pData;
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

    Object.values(this.data.playerMap).forEach((player) => {
      player.stopAll();
    });

    this.resetXP2PData();

    const app = getApp();
    app.destroyModule();
  },
  resetP2P() {
    if (!this.data.state) {
      console.log('p2pModule not running');
      return;
    }

    Object.values(this.data.playerMap).forEach((player) => {
      player.stopAll();
    });

    const start = Date.now();
    this.setData({ state: 'resetP2P', 'timestamps.resetP2P': start, localPeername: '' });

    const app = getApp();
    app
      .resetP2P()
      .then((res) => {
        console.log('resetP2P res', res);
        if (res === 0) {
          const now = Date.now();
          console.log('resetP2P delay', now - start);
          const { localPeername } = app.p2pData;
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
        console.error('resetP2P error', errcode);
        this.destroyModule();
        wx.showModal({
          content: `resetP2P 失败, errcode: ${errcode}`,
          showCancel: false,
        });
      });
  },
});

import devices from '../../devices';

Page({
  data: {
    // 这些是p2p状态
    state: '',
    localPeername: '',
    dirty: false,

    // 这些是监控页入口
    listBtn: [],
    listNav: [],
  },
  onLoad() {
    const listBtn = [];
    const listNav = [];
    for (const key in devices) {
      const item = devices[key];
      const navItem = {
        mode: 'ipc',
        cfg: key,
        ...item,
      };
      item.showInHomePageBtn && listBtn.push(navItem);
      item.showInHomePageNav && listNav.push(navItem);
    }
    this.setData({ listBtn, listNav });

    // 自动 initModule
    this.initModule();
  },
  onUnload() {},
  onShow() {
    // 再显示时同步一下状态，应该用事件通知，先简单处理吧
    if (!this.data.dirty) {
      return;
    }
    const app = getApp();
    this.setData({ state: app.p2pData.state, localPeername: app.p2pData.localPeername, dirty: false });
  },
  onHide() {
    this.setData({ dirty: true });
  },
  resetXP2PData() {
    this.setData({
      state: '',
      localPeername: '',
      dirty: false,
    });
  },
  initModule() {
    console.log('index: initModule');

    if (this.data.state) {
      this.showToast('p2pModule already running');
      return;
    }

    const start = Date.now();
    this.setData({ state: 'init' });

    const app = getApp();
    app
      .initModule()
      .then((res) => {
        console.log('index: init res', res);

        if (res === 0) {
          const now = Date.now();
          console.log('init delay', now - start);
          const { localPeername } = app.p2pData;
          console.log('localPeername', localPeername);
          this.setData({ state: 'inited', localPeername });
        } else {
          this.resetXP2PData();
          wx.showModal({
            content: `init 失败, res=${res}`,
            showCancel: false,
          });
        }
      })
      .catch((errcode) => {
        console.error('index: init error', errcode);

        this.resetXP2PData();
        wx.showModal({
          content: `init 失败, errcode: ${errcode}`,
          showCancel: false,
        });
      });
  },
  destroyModule() {
    console.log('index: destroyModule');

    if (!this.data.state) {
      console.log('p2pModule not running');
      return;
    }

    this.resetXP2PData();

    const app = getApp();
    app.destroyModule();
  },
  resetP2P() {
    console.log('index: resetP2P');

    if (!this.data.state) {
      console.log('p2pModule not running');
      return;
    }

    const start = Date.now();
    this.setData({ state: 'resetP2P', localPeername: '' });

    const app = getApp();
    app
      .resetP2P()
      .then((res) => {
        console.log('index: resetP2P res', res);
        if (res === 0) {
          const now = Date.now();
          console.log('resetP2P delay', now - start);
          const { localPeername } = app.p2pData;
          console.log('localPeername', localPeername);
          this.setData({ state: 'inited', localPeername });
        } else {
          this.destroyModule();
          wx.showModal({
            content: `resetP2P 失败, res=${res}`,
            showCancel: false,
          });
        }
      })
      .catch((errcode) => {
        console.error('index: resetP2P error', errcode);
        this.destroyModule();
        wx.showModal({
          content: `resetP2P 失败, errcode: ${errcode}`,
          showCancel: false,
        });
      });
  },
  gotoDemoPage(e) {
    const { url } = e.currentTarget.dataset;
    wx.navigateTo({ url });
  },
});

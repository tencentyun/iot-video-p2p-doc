// app.js
import config from './config';

const xp2pPlugin = requirePlugin('xp2p');
const p2pExports = xp2pPlugin.p2p;

App({
  p2pData: {
    promise: null,
    state: '',
    localPeername: '',
  },
  onLaunch() {
    console.log('App: onLaunch');
  },
  resetXP2PData() {
    this.p2pData.promise = null;
    this.p2pData.state = '';
    this.p2pData.localPeername = '';
  },
  initModule() {
    console.log('App: initModule');

    if (this.p2pData.state === 'inited') {
      // 已经初始化好了
      console.log('p2pModule already inited');
      return Promise.resolve(0);
    }

    if (this.p2pData.promise) {
      // 正在初始化
      return this.p2pData.promise;
    }

    const start = Date.now();
    this.p2pData.state = 'init';

    return (this.p2pData.promise = p2pExports
      .init({
        appParams: config.appParams,
      })
      .then((res) => {
        console.log('App: init res', res);

        if (res === 0) {
          const now = Date.now();
          console.log('init delay', now - start);
          const localPeername = p2pExports.getLocalXp2pInfo();
          console.log('localPeername', localPeername);
          this.p2pData.state = 'inited';
          this.p2pData.localPeername = localPeername;
        } else {
          this.resetXP2PData();
          wx.showModal({
            content: `init 失败, res=${res}`,
            showCancel: false,
          });
        }

        return res;
      })
      .catch((errcode) => {
        console.error('App: init error', errcode);

        this.resetXP2PData();
        wx.showModal({
          content: `init 失败, errcode: ${errcode}`,
          showCancel: false,
        });
      }));
  },
  destroyModule() {
    console.log('App: destroyModule');

    if (!this.p2pData.state) {
      console.log('p2pModule not running');
      return;
    }

    this.resetXP2PData();
    p2pExports.destroy();
  },
  resetP2P() {
    console.log('App: resetP2P');

    if (this.p2pData.state !== 'inited') {
      console.log('p2pModule not inited');
      return Promise.reject(-2002);
    }

    const start = Date.now();
    this.p2pData.state = 'resetP2P';

    return (this.p2pData.promise = p2pExports
      .resetP2P()
      .then((res) => {
        console.log('App: resetP2P res', res);

        if (res === 0) {
          const now = Date.now();
          console.log('resetP2P delay', now - start);
          const localPeername = p2pExports.getLocalXp2pInfo();
          console.log('localPeername', localPeername);
          this.p2pData.state = 'inited';
          this.p2pData.localPeername = localPeername;
        } else {
          this.destroyModule();
          wx.showModal({
            content: `resetP2P 失败, res=${res}`,
            showCancel: false,
          });
        }

        return res;
      })
      .catch((errcode) => {
        console.error('App: resetP2P error', errcode);
        this.destroyModule();
        wx.showModal({
          content: `resetP2P 失败, errcode: ${errcode}`,
          showCancel: false,
        });
      }));
  },
});

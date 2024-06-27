import { isDevTool } from '../../../../utils';

const playerPropConfigMap = {
  mode: {
    field: 'mode',
    type: 'radio-group',
    list: [
      { value: 'live', label: '直播' },
      { value: 'RTC', label: '实时通话' },
    ],
  },
};

Page({
  data: {
    localFilePath: '',
    needChooseFlv: false,
    needLimitSpeed: false,

    // 创建前确定的属性
    playerPropConfigList: [
      playerPropConfigMap.mode,
    ],
    playerProps: {
      mode: 'RTC',
      minCache: 0.2,
      maxCache: 10, // 播放本地视频，数据传输快，可能缓存很多数据，设大一点
    },

    playerId: '',
    chunkSize: 10240,
    chunkInterval: 50,
    showLog: false,

    playerReady: false,
    playerSrc: '',
    playStatus: '', // '' | 'playing'

    // 播放器控制
    muted: false,
    orientation: 'vertical',
    fill: false,
    fullScreen: false,

    // 控件icon
    controlsId: 'controls',
    iconSize: 25,
    showIcons: {
      muted: true,
      orientation: true,
      fill: true,
      fullScreen: true,
    },
  },
  onLoad(query) {
    console.log('onLoad', query);
    this.userData = {
      playerCtx: null,
    };

    if (query.localfilepath) {
      let localFilePath = query.localfilepath;
      if (query.localfilepath.indexOf('/') === -1) {
        // encode过的路径
        try {
          localFilePath = decodeURIComponent(query.localfilepath);
        } catch (err) {
          console.error('decode query.localfilepath error', err);
        };
      }
      console.log('localFilePath', localFilePath);
      this.setData({
        localFilePath,
      });
    } else {
      this.setData({
        needChooseFlv: true,
      });
    }

    if (query.limitspeed) {
      this.setData({
        needLimitSpeed: true,
        chunkSize: 1024,
        chunkInterval: 500,
      });
    }
  },
  onUnload() {
    console.log('onUnload');
    this.data.playerId && this.bindDestroyPlayer();
    console.log('onUnload end');
  },
  showToast(content) {
    wx.showToast({
      title: content,
      icon: 'none',
    });
  },
  onPlayerReady({ detail }) {
    console.log('==== onPlayerReady', detail);
    this.userData.playerCtx = detail.livePlayerContext;
    this.setData({
      playerReady: true,
    });

    // 指定了 localFilePath，直接播放
    if (this.data.localFilePath) {
      this.setData({
        playerSrc: this.data.localFilePath,
      });
    }
  },
  onPlayerError({ detail }) {
    console.error('==== onPlayerError', detail);
    const code = detail?.error?.code;
    this.userData.playerCtx = null;
    this.setData({
      playerReady: false,
      playerSrc: '',
      playStatus: '',
    });
    this.bindDestroyPlayer();

    wx.showModal({
      content: `player错误: ${code}`,
      showCancel: false,
    });
  },
  onPlay({ detail }) {
    console.log('==== onPlay', detail);
  },
  onStop({ detail }) {
    console.log('==== onStop', detail);
    this.setData({
      playStatus: '',
    });
  },
  onEnded({ detail }) {
    console.log('==== onEnded', detail);
    this.setData({
      playStatus: '',
    });
  },
  onError({ detail }) {
    console.error('==== onError', detail);
    this.setData({
      playStatus: '',
    });
  },
  onSimpleEvent({ type, detail }) {
    console.log(`==== ${type}`, detail);
  },
  onLivePlayerError({ detail }) {
    console.error('==== onLivePlayerError', detail);
    this.userData.playerCtx = null;
    this.setData({
      playerReady: false,
      playerSrc: '',
      playStatus: '',
    });
    this.bindDestroyPlayer();

    wx.showModal({
      content: `live-player错误: ${detail.errCode}\n${detail.errMsg}`,
      showCancel: false,
    });
  },
  onLivePlayerFullScreenChange({ detail }) {
    console.log('==== onLivePlayerFullScreenChange', detail);
    if (typeof detail.fullScreen === 'boolean') {
      this.setData({ fullScreen: detail.fullScreen });
    }
  },
  bindPlayerPropsChange({ detail, currentTarget: { dataset } }) {
    if (this.data.playerId) {
      console.log('already created');
      return;
    }
    const { field } = dataset;
    const { value } = detail;
    const newProps = {
      ...this.data.playerProps,
      [field]: value,
    };
    console.log('player prop change:', field, value);
    this.setData({
      playerProps: newProps,
    });
  },
  bindCreatePlayer() {
    if (isDevTool) {
      wx.showModal({
        content: '不支持在开发者工具中创建',
        showCancel: false,
      });
      return;
    }

    if (this.data.playerId) {
      console.log('player already existed');
      return;
    }

    console.log('create player');
    this.setData({
      playerId: 'local-flv-player-demo',
    });
  },
  bindDestroyPlayer() {
    if (!this.data.playerId) {
      console.log('player not existed');
      return;
    }
    this.bindClear();

    console.log('destroy player');
    this.userData.playerCtx = null;
    this.setData({
      playerId: '',
      playerReady: false,
    });
  },
  async bindChoose({ currentTarget }) {
    if (!this.userData.playerCtx) {
      console.log('choose file but player not ready');
      return;
    }
    const field = currentTarget.dataset.field || 'playerSrc';
    const ext = currentTarget.dataset.ext || '';
    if (this.data[field]) {
      console.log(`choose file but already set ${field}`);
      return;
    }
    let file;
    try {
      const res = await wx.chooseMessageFile({
        count: 1,
        type: 'file',
        extension: ext ? ext.split(',') : undefined,
      });
      file = res.tempFiles[0];
      console.log('choose file res', file);
      if (!file?.size) {
        console.error('file empty');
        wx.showToast({
          title: '文件大小为空',
          icon: 'error',
        });
        return;
      }
    } catch (err) {
      console.error('choose file fail', err);
      return;
    }
    console.log(`set ${field}`, file.path);
    this.setData({
      [field]: file.path,
    });
  },
  bindClear() {
    this.bindStop();
    console.log('clear src');
    this.setData({
      playerSrc: '',
    });
  },
  bindPlay() {
    if (!this.userData.playerCtx) {
      console.log('start play but player not ready');
      return;
    }
    if (!this.data.playerSrc) {
      console.log('start play but not set src');
      return;
    }
    console.log(`start play ${this.data.playerSrc}`);
    this.setData({
      playStatus: 'playing',
    });
    this.userData.playerCtx?.play();
  },
  bindStop() {
    if (!this.userData.playerCtx) {
      console.log('stop play but player not ready');
      return;
    }
    if (!this.data.playerSrc) {
      console.log('stop play but not set src');
      return;
    }
    console.log('stop play');
    this.userData.playerCtx.stop();
    this.setData({
      playStatus: '',
    });
  },
  // player控制
  clickControlIcon({ detail }) {
    const { name } = detail;
    console.log('clickControlIcon', name);
    switch (name) {
      case 'muted':
        this.changeMuted();
        break;
      case 'orientation':
        this.changeOrientation();
        break;
      case 'fill':
        this.changeFill();
        break;
      case 'fullScreen':
        this.changeFullScreen();
        break;
    }
  },
  changeMuted() {
    this.setData({ muted: !this.data.muted });
  },
  changeOrientation() {
    this.setData({
      orientation: this.data.orientation === 'horizontal' ? 'vertical' : 'horizontal',
    });
  },
  changeFill() {
    this.setData({
      fill: !this.data.fill,
    });
  },
  changeFullScreen() {
    if (!this.data.playerReady) {
      console.log('changeFullScreen but player not ready');
      return;
    }
    if (!this.data.fullScreen) {
      this.userData.playerCtx.requestFullScreen({
        direction: 90,
        success: (res) => {
          console.log('requestFullScreen success', res);
          this.setData({ fullScreen: true });
        },
        fail: (err) => {
          console.error('requestFullScreen fail', err);
          wx.showToast({
            title: err.errMsg,
            icon: 'error',
          });
        },
      });
    } else {
      this.userData.playerCtx.exitFullScreen({
        success: (res) => {
          console.log('exitFullScreen success', res);
          this.setData({ fullScreen: false });
        },
        fail: (err) => {
          console.error('exitFullScreen fail', err);
          wx.showToast({
            title: err.errMsg,
            icon: 'error',
          });
        },
      });
    }
  },
});

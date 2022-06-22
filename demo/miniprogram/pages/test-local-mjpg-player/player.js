import { getXp2pManager } from '../../lib/xp2pManager';
import { getRecordManager } from '../../lib/recordManager';

const xp2pManager = getXp2pManager();

Page({
  data: {
    systemInfo: {},
    pluginVersion: '',
    showPlayerLog: true,
    playerId: '',
    playerReady: false,
    playerCtx: null,
    playerSrc: '',
    playerAudioSrc: '',
    playerLoop: false,
    playStatus: '', // '' | 'playing'
    log: '',
  },
  onLoad(query) {
    this.userData = {
      // 渲染无关的尽量放这里
      recordManager: null,
      mjpgPath: '',
    };

    const systemInfo = wx.getSystemInfoSync() || {};
    this.setData({
      systemInfo,
      playerPluginVersion: xp2pManager.P2PPlayerVersion,
    });

    if (query.dirname && query.filename) {
      const recordManager = getRecordManager(query.dirname);
      this.userData.recordManager = recordManager;
      this.userData.mjpgPath = `${recordManager.baseDir}/${query.filename}`;

      // 指定了录像的，自动创建
      this.bindCreatePlayer();
    }
  },
  onUnload() {
    this.data.playerId && this.bindDestroyPlayer();
  },
  showToast(content) {
    wx.showToast({
      title: content,
      icon: 'none',
    });
  },
  addLog(str) {
    this.setData({ log: `${this.data.log}${Date.now()} - ${str}\n` });
  },
  clearLog() {
    this.setData({ log: '' });
  },
  onPlayerReady({ detail }) {
    console.log('==== onPlayerReady', detail);
    this.addLog('==== onPlayerReady');
    this.setData({
      playerReady: true,
      playerCtx: detail.mjpgPlayerContext,
      playerSrc: this.userData.mjpgPath,
    });
  },
  onPlayerError({ detail }) {
    console.error('==== onPlayerError', detail);
    const code = detail?.error?.code;
    this.addLog(`==== onPlayerError, code: ${code}`);
    this.setData({
      playerReady: false,
      playerCtx: null,
      playerSrc: '',
      playStatus: '',
    });
    this.bindDestroyPlayer();

    wx.showModal({
      content: `player错误: ${code}`,
      showCancel: false,
    });
  },
  onEnded({ detail }) {
    console.log('==== onEnded', detail);
    this.addLog('==== onEnded');
    this.setData({
      playStatus: '',
    });
  },
  onStreamError({ detail }) {
    console.error('==== onStreamError', detail);
    this.addLog(`==== onStreamError, ${detail.errMsg}`);
    this.setData({
      playStatus: '',
    });
  },
  onImageLoad({ detail }) {
    console.log('==== onImageLoad', detail);
    this.addLog(`==== onImageLoad, ${detail.width} x ${detail.height}`);
  },
  onImageError({ detail }) {
    console.error('==== onImageError', detail);
    this.addLog(`==== onImageError, ${detail.errMsg}`);
    this.setData({
      playStatus: '',
    });
  },
  onAudioError({ detail }) {
    console.error('==== onAudioError', detail);
    this.addLog(`==== onAudioError, ${detail.errMsg}`);
    this.setData({
      playStatus: '',
    });
  },
  bindCreatePlayer() {
    if (this.data.playerId) {
      console.log('already existed');
      return;
    }

    this.addLog('create player');
    this.setData({
      playerId: 'mpeg-player-local-demo',
    });
  },
  bindDestroyPlayer() {
    if (!this.data.playerId) {
      console.log('not existed');
      return;
    }
    this.bindClear();

    this.addLog('destroy player');
    this.setData({
      playerId: '',
      playerReady: false,
      playerCtx: null,
    });
  },
  async bindChoose({ currentTarget }) {
    if (!this.data.playerCtx) {
      console.log('player not ready');
      return;
    }
    const field = currentTarget.dataset.field || 'playerSrc';
    const ext = currentTarget.dataset.ext || '';
    if (this.data[field]) {
      console.log(`already set ${field}`);
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
        this.addLog('file empty');
        return;
      }
    } catch (err) {
      console.error('choose file fail', err);
      this.addLog('choose file fail');
      return;
    }
    this.addLog(`set ${field} ${file.path}`);
    this.setData({
      [field]: file.path,
    });
  },
  bindClear() {
    this.bindStop();
    this.addLog('clear src');
    this.setData({
      playerSrc: '',
      playerAudioSrc: '',
    });
  },
  bindPlay({ currentTarget }) {
    if (!this.data.playerCtx) {
      console.log('player not ready');
      return;
    }
    if (!this.data.playerSrc) {
      console.log('not set src');
      return;
    }
    this.addLog(`play ${this.data.playerSrc}`);
    this.setData({
      playerLoop: parseInt(currentTarget.dataset.loop, 10),
      playStatus: 'playing',
    });
    this.data.playerCtx?.play();
  },
  bindStop() {
    if (!this.data.playerCtx) {
      console.log('player not ready');
      return;
    }
    if (!this.data.playerSrc) {
      console.log('not set src');
      return;
    }
    this.addLog('stop');
    this.data.playerCtx.stop();
    this.setData({
      playStatus: '',
    });
  },
  bindPause() {
    if (!this.data.playerCtx) {
      console.log('player not ready');
      return;
    }
    this.data.playerCtx?.pause();
  },
  bindResume() {
    if (!this.data.playerCtx) {
      console.log('player not ready');
      return;
    }
    this.data.playerCtx?.resume();
  },
});

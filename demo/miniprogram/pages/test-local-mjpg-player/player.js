import { getXp2pManager } from '../../lib/xp2pManager';
import { getRecordManager } from '../../lib/recordManager';

const xp2pManager = getXp2pManager();

Page({
  data: {
    systemInfo: {},
    pluginVersion: '',
    playerId: '',
    playerReady: false,
    playerSrc: '',
    playerAudioSrc: '',
    playerLoop: false,
    playStatus: '', // '' | 'playing'
    log: '',
  },
  async onLoad(query) {
    this.userData = {
      // 渲染无关的尽量放这里
      playerCtx: null,
      recordManager: null,
      mjpgPath: '',
      aacPath: '',
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

      try {
        const aacName = query.filename.replace(/\.mjpg$/, '.aac');
        const aacInfo = await recordManager.getFileInfo(aacName);
        if (aacInfo?.size > 0) {
          this.userData.aacPath = `${recordManager.baseDir}/${aacName}`;
        }
      } catch (err) {}

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
  addBothLog(str) {
    console.log(str);
    this.addLog(str);
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
    this.userData.playerCtx = detail.mjpgPlayerContext;
    this.setData({
      playerReady: true,
      playerSrc: this.userData.mjpgPath,
      playerAudioSrc: this.userData.aacPath,
    });

    // 自动播放
    this.userData.mjpgPath && this.bindPlay({ type: 'autoplay' });
  },
  onPlayerError({ detail }) {
    console.error('==== onPlayerError', detail);
    const code = detail?.error?.code;
    this.addLog(`==== onPlayerError, code: ${code}`);
    this.userData.playerCtx = null;
    this.setData({
      playerReady: false,
      playerSrc: '',
      playerAudioSrc: '',
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
    this.userData.playerCtx = null;
    this.setData({
      playerId: '',
      playerReady: false,
    });
  },
  async bindChoose({ currentTarget }) {
    if (!this.userData.playerCtx) {
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
  bindPlay({ type, currentTarget } = {}) {
    if (!this.userData.playerCtx) {
      console.log('start play but player not ready');
      return;
    }
    if (!this.data.playerSrc) {
      console.log('start play but not set src');
      return;
    }
    this.addBothLog(`start play, type ${type}, src ${this.data.playerSrc}`);
    this.setData({
      playerLoop: parseInt(currentTarget?.dataset?.loop, 10),
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
    this.addBothLog('stop play');
    this.setData({
      playStatus: '',
    });
    this.userData.playerCtx.stop();
  },
  bindPause() {
    if (!this.userData.playerCtx) {
      console.log('pause play but player not ready');
      return;
    }
    this.userData.playerCtx?.pause();
  },
  bindResume() {
    if (!this.userData.playerCtx) {
      console.log('resume play but player not ready');
      return;
    }
    this.userData.playerCtx?.resume();
  },
});

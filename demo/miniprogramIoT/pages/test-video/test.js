// import { getRecordManager } from '../../lib/recordManager';

// const videoManager = getRecordManager('videos');
// const fileSystem = wx.getFileSystemManager();

const defaultCustomCache = true;

Page({
  data: {
    playerId: defaultCustomCache ? 'customPlayer' : 'player',
    customCache: defaultCustomCache,
    inputSrc: 'https://devstreaming-cdn.apple.com/videos/streaming/examples/img_bipbop_adv_example_fmp4/master.m3u8',
    src: '',
    ctx: null,
    errMsg: '',
  },
  onReady() {
    this.setData({
      ctx: wx.createVideoContext(this.data.playerId),
    });
  },
  onVideoEvent(e) {
    console.log('video event:', e.type, e.detail);
  },
  onVideoError(e) {
    console.error('video error:', e.detail);
    this.setData({
      errMsg: e.detail.errMsg,
    });
    this.data.ctx.stop();
  },
  switchCustomCache() {
    this.setData({
      customCache: !this.data.customCache,
    });
  },
  bindCreatePlayer() {
    if (this.data.playerId) {
      console.log('already existed');
      return;
    }

    this.setData({
      playerId: this.data.customCache ? 'customPlayer' : 'player',
    }, () => {
      this.setData({
        ctx: wx.createVideoContext(this.data.playerId),
      });
    });
  },
  bindDestroyPlayer() {
    if (!this.data.playerId) {
      console.log('not existed');
      return;
    }

    this.bindClearSrc();

    this.setData({
      playerId: '',
      src: '',
      ctx: null,
      errMsg: '',
    });
  },
  bindInputSrc(e) {
    this.setData({
      inputSrc: e.detail.value,
    });
  },
  async bindChoose(e) {
    const { from } = e.currentTarget.dataset;
    let file;
    if (from === 'message') {
      try {
        const res = await wx.chooseMessageFile({ count: 1 });
        file = res.tempFiles[0];
        console.log('chooseMessageFile success', file);
      } catch (err) {
        console.error('chooseMessageFile fail', err);
        this.setData({
          errMsg: err.errMsg,
        });
        return;
      }
    } else {
      try {
        const res = await wx.chooseMedia({ count: 1, mediaType: ['video'], sourceType: ['album'] });
        file = res.tempFiles[0];
        console.log('chooseMedia success', file);
      } catch (err) {
        console.error('chooseMedia fail', err);
        this.setData({
          errMsg: err.errMsg,
        });
        return;
      }
    }

    this.setData({
      inputSrc: filePath,
    });
  },
  bindSetSrc() {
    this.setData({
      src: this.data.inputSrc,
      errMsg: '',
    });
  },
  bindClearSrc() {
    this.data.ctx.stop();
    this.setData({
      src: '',
      errMsg: '',
    });
  },
  bindPlay() {
    this.data.ctx.play();
  },
  bindPause() {
    this.data.ctx.pause();
  },
  bindStop() {
    this.data.ctx.stop();
  },
});

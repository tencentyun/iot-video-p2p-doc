// import { getRecordManager } from '../../lib/recordManager';

// const videoManager = getRecordManager('videos');
// const fileSystem = wx.getFileSystemManager();

const defaultCustomCache = true;

Page({
  data: {
    playerId: defaultCustomCache ? 'customPlayer' : 'player',
    customCache: defaultCustomCache,
    inputSrc: 'https://zylcb.iotvideo.tencentcs.com/timeshift/live/21b9c5e8-ecfa-482a-a776-8fe9d2e6da5d/timeshift.m3u8?starttime_epoch=1673494053&endtime_epoch=1673494113&t=63c0cff5&us=d393d84a80ead0e38715b8c4280f7319&sign=c174bfccbcd119a46d9d1b2a23f7ab54',
    // inputSrc: 'http://devimages.apple.com/iphone/samples/bipbop/bipbopall.m3u8',
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

    // videoManager.prepareDir();
    // const fileName = file.name || `noname.${Date.now()}.mp4`;
    // const filePath = `${videoManager.baseDir}/${fileName}`;
    // fileSystem.saveFileSync(file.path || file.tempFilePath, filePath);

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

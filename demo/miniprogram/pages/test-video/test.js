Page({
  data: {
    // inputSrc: 'https://zylcb.iotvideo.tencentcs.com/timeshift/live/21f2453c-9896-4617-a085-1ea77a28d74d/timeshift.m3u8?starttime_epoch=1636682322&endtime_epoch=1636682785&t=618f9142&us=a43e598a6dbf00a47622f3ec34801d88&sign=f1d0f360dfe0e3a1d7301f8b2e926349',
    inputSrc: 'http://devimages.apple.com/iphone/samples/bipbop/bipbopall.m3u8',
    src: '',
    ctx: null,
    errMsg: '',
  },
  onReady() {
    this.setData({
      ctx: wx.createVideoContext('player'),
    });
  },
  statechange(e) {
    console.log('video statechange:', e.type, e.detail);
  },
  error(e) {
    console.error('video error:', e.detail);
    this.data.ctx.stop();
    this.setData({
      errMsg: e.detail.errMsg,
    });
  },
  bindInputSrc(e) {
    this.setData({
      inputSrc: e.detail.value,
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

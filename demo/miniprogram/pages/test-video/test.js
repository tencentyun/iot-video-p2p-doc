import { getRecordManager } from '../../lib/recordManager';

const videoManager = getRecordManager('videos');
const fileSystem = wx.getFileSystemManager();

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

    videoManager.prepareDir();
    const fileName = file.name || `noname.${Date.now()}.mp4`;
    const filePath = `${videoManager.baseDir}/${fileName}`;
    fileSystem.saveFileSync(file.path || file.tempFilePath, filePath);

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

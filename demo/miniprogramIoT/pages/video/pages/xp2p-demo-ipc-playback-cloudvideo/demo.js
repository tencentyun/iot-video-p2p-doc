import { presetDevices } from '../../../../config/config';
import { toDateTimeString } from '../../../../utils';
import { getRecordManager } from '../../../../lib/recordManager';
import { M3U8Downloader } from '../../lib/m3u8Downloader';

// 覆盖 console
const app = getApp();
const oriConsole = app.console;
const console = app.logger || oriConsole;

// 云存下载
const downloadManager = getRecordManager('cloud');

const pageName = 'demo-page-ipc-playback-cloudvideo';
let pageSeq = 0;

Page({
  data: {
    // 这是onLoad时就固定的
    cfg: '',

    // 这些是控制player和p2p的
    playerId: 'iot-cloudvideo-player',

    // 设备信息，在input组件里填
    targetId: '',
    deviceInfo: null,

    // 录像列表
    recordVideos: null,

    // 当前播放录像
    currentVideo: null, // 注意data、userData里都有

    // 当前下载录像
    currentDownload: null, // 注意data、userData里都有

    // 添加录像
    inputText: '',
    inputSrc: '',
  },
  onLoad(query) {
    pageSeq++;
    const pageId = `${pageName}-${pageSeq}`;
    console.log('demo: onLoad', pageId, query);

    this.userData = {
      pageId,
      deviceId: '',
      player: null,
      currentVideo: null,
      currentDownload: null,
    };

    const cfg = query.cfg || '';
    this.setData({
      cfg,
      deviceMsg: 'loading...',
    });

    const cfgData = cfg && presetDevices[cfg];
    if (!cfgData) {
      this.setData({
        deviceMsg: 'no cfgData',
      });
      return null;
    }

    const detail = {
      targetId: cfg,
      deviceInfo: {
        deviceId: `${cfgData.productId}/${cfgData.deviceName}`,
        productId: cfgData.productId,
        deviceName: cfgData.deviceName,
        isMjpgDevice: cfgData.isMjpgDevice,
      },
      cloudRecords: cfgData.cloudRecords,
    };
    this.onStartPlayer({ detail });
  },
  onShow() {
    console.log('demo: onShow');
  },
  onHide() {
    console.log('demo: onHide');
  },
  onUnload() {
    console.log('demo: onUnload');
    this.hasExited = true;

    // 停止
    this.stopVideo();
    this.stopDownload();

    console.log('demo: onUnload end');
  },
  onStartPlayer({ detail }) {
    console.log('demo: onStartPlayer', detail);
    if (detail.deviceInfo.isMjpgDevice) {
      // info 不匹配
      console.log('demo: info error');
      this.setData({
        targetId: detail.targetId,
        deviceInfo: detail.deviceInfo,
      });
      return;
    }

    this.userData.deviceId = detail.deviceInfo.deviceId;

    const recordVideos = (detail.cloudRecords || []).map(item => ({
      duration: item.endTime - item.startTime,
      text: `${toDateTimeString(new Date(item.startTime * 1000))} - ${toDateTimeString(new Date(item.endTime * 1000))}`,
      ...item,
    }));

    console.log('demo: create components');
    this.setData({
      ...detail,
      recordVideos,
    }, () => {
      const player = wx.createVideoContext(this.data.playerId);
      if (player) {
        console.log('demo: create player success');
        oriConsole.log('demo: player', player); // console 被覆盖了会写logger影响性能，查看组件用 oriConsole
        this.userData.player = player;
      } else {
        console.error('demo: create player error');
      }
    });
  },
  // video事件
  onVideoEvent({ type, detail }) {
    console.log('demo: onVideoEvent', type, detail);
  },
  onVideoError({ detail }) {
    console.error('demo: onVideoError', detail);
    const { errMsg, errDetail } = detail;
    wx.showModal({
      content: `${errMsg || '播放失败'}\n${(errDetail && errDetail.msg) || ''}`, // 换行在开发者工具中无效，真机正常
      showCancel: false,
    });
  },
  // 播放
  changeVideo({ currentTarget: { dataset } }) {
    const video = this.data.recordVideos[dataset.index];
    console.log('demo: changeVideo', video);
    if (video === this.userData.currentVideo) {
      wx.showToast({
        title: '正在播放此录像',
        icon: 'none',
      });
      return;
    }
    if (this.userData.currentVideo) {
      this.userData.player?.stop();
    }
    this.userData.currentVideo = video;
    this.setData({
      currentVideo: video,
    });
  },
  stopVideo() {
    if (!this.userData.currentVideo) {
      return;
    }
    console.log('demo: stopVideo', this.userData.currentVideo);
    this.userData.player?.stop();
    this.userData.currentVideo = null;
    this.setData({
      currentVideo: null,
    });
  },
  // 下载
  downloadVideo({ currentTarget: { dataset } }) {
    const video = this.data.recordVideos[dataset.index];
    console.log('demo: downloadVideo', video);
    if (!/^https/.test(video.videoSrc)) {
      wx.showToast({
        title: '仅支持下载 https url',
        icon: 'none',
      });
      return;
    }

    const url = video.videoSrc;
    const [urlNoQuery] = url.split('?');
    const isMP4 = /\.mp4$/i.test(urlNoQuery);
    const isM3U8 = /\.m3u8$/i.test(urlNoQuery);
    if (!isMP4 && !isM3U8) {
      wx.showToast({
        title: '仅支持下载 mp4、m3u8 视频',
        icon: 'none',
      });
      return;
    }

    if (video === this.userData.currentDownload) {
      wx.showToast({
        title: '正在下载此录像',
        icon: 'none',
      });
      return;
    }
    this.userData.currentDownload = video;
    this.setData({
      currentDownload: video,
    });

    downloadManager.prepareDir();
    if (isM3U8) {
      this.userData.m3u8Downloader = new M3U8Downloader({
        url,
        localDir: downloadManager.baseDir,
        success: (res) => {
          if (!this.userData.currentDownload) {
            return;
          }
          console.log('demo: download m3u8 success', url, res);
          this.stopDownload();

          this.saveVideo(res.tempFilePath);
        },
        fail: (err) => {
          if (!this.userData.currentDownload) {
            return;
          }
          console.error('demo: download m3u8 fail', url, err);
          wx.showToast({
            title: '下载 m3u8 失败',
            icon: 'none',
          });
          this.stopDownload();
        },
      });
      this.userData.m3u8Downloader.start();
    } else {
      this.userData.downloadTask = wx.downloadFile({
        url,
        success: (res) => {
          if (!this.userData.currentDownload) {
            return;
          }
          if (res.statusCode === 200) {
            console.log('demo: download mp4 success', url, res);
            this.stopDownload();

            this.saveVideo(res.tempFilePath);
          } else {
            console.error('demo: download mp4 statusCode error', url, res);
            wx.showToast({
              title: '下载 mp4 失败',
              icon: 'none',
            });
            this.stopDownload();
          }
        },
        fail: (err) => {
          if (!this.userData.currentDownload) {
            return;
          }
          console.error('demo: download mp4 fail', url, err);
          wx.showToast({
            title: '下载 mp4 失败',
            icon: 'none',
          });
          this.stopDownload();
        },
      });
    }
  },
  saveVideo(filePath) {
    console.log('demo: saveVideo', filePath);
    wx.saveVideoToPhotosAlbum({
      filePath,
      success: (saveRes) => {
        console.log('demo: saveVideoToPhotosAlbum success', saveRes);
        wx.showModal({
          title: '已保存到相册',
          showCancel: false,
        });
      },
      fail: (err) => {
        if (/cancel/.test(err.errMsg)) {
          // 用户取消保存，不用提示
          return;
        }
        console.error('demo: saveVideoToPhotosAlbum fail', err);
        wx.showModal({
          title: '保存到相册失败',
          content: err.errMsg || '',
          showCancel: false,
        });
      },
    });
  },
  stopDownload() {
    if (!this.userData.currentDownload) {
      return;
    }
    console.log('demo: stopDownload', this.userData.currentDownload);
    this.userData.currentDownload = null;
    if (this.userData.downloadTask) {
      this.userData.downloadTask.abort();
      this.userData.downloadTask = null;
    }
    if (this.userData.m3u8Downloader) {
      this.userData.m3u8Downloader.stop();
      this.userData.m3u8Downloader = null;
    }
    this.setData({
      currentDownload: null,
    });
  },
  // 自定义录像
  bindInputText(e) {
    this.setData({
      inputText: e.detail.value,
    });
  },
  bindInputSrc(e) {
    this.setData({
      inputSrc: e.detail.value,
    });
  },
  bindAddRecord() {
    if (!this.data.inputText || !this.data.inputSrc) {
      return;
    }
    const record = {
      startTime: Math.floor(Date.now() / 1000),
      text: this.data.inputText,
      videoSrc: this.data.inputSrc,
    };
    console.log('demo: add record', record);
    this.setData({
      inputText: '',
      inputSrc: '',
      recordVideos: [...this.data.recordVideos, record],
    });
  },
});

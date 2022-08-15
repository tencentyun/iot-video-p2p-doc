/* eslint-disable no-unused-vars, @typescript-eslint/no-unused-vars */
import { getXp2pManager } from '../../lib/xp2pManager';
import { getRecordManager } from '../../lib/recordManager';

const xp2pManager = getXp2pManager();
const recordManager = getRecordManager('pusher');

const aspectClassMap = {
  '9:16': 'narrow',
  '3:4': 'wide',
};

Page({
  data: {
    systemInfo: {},
    playerPluginVersion: '',
    pusherId: '',
    pusherReady: false,
    pusherComp: null,
    pusherCtx: null,
    pushStatus: '', // '' | 'pushing'
    canRead: false, // 能否读数据，比如推流暂时中断时不能读
    livePusherInfoStr: '',
    needRecord: false, // 点击start时确定
    recordFileName: '', // 收到startpush时确定
    aspect: '9:16',
    aspectClass: aspectClassMap['9:16'],
    remoteMirror: true,
    localMirror: 'enable',
    log: '',
  },
  onLoad() {
    this.userData = {
      // 渲染无关的尽量放这里
      hasReceivedAudio: false,
      hasReceivedVideo: false,
      flvTotalBytes: 0,
      livePusherInfo: null,
      fileObj: null, // 收到startpush时创建
    };

    const systemInfo = wx.getSystemInfoSync() || {};
    this.setData({
      systemInfo,
      playerPluginVersion: xp2pManager.P2PPlayerVersion,
    });
  },
  onUnload() {
    this.data.pusherId && this.bindDestroyPusher();
  },
  setUserData(userData) {
    this.userData && Object.assign(this.userData, userData);
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
  clearFlvData() {
    this.setUserData({
      hasReceivedAudio: false,
      hasReceivedVideo: false,
      flvTotalBytes: 0,
      livePusherInfo: null,
    });
    this.setData({
      livePusherInfoStr: '',
    });
  },
  openRecordFile() {
    if (this.userData?.fileObj) {
      this.closeRecordFile();
      return;
    }
    const fileObj = recordManager.openRecordFile('pusher-test');
    this.userData.fileObj = fileObj;
    this.setData({
      recordFileName: fileObj?.fileName || '',
    });
    this.addLog(`openRecordFile, ${fileObj?.fileName}`);
  },
  closeRecordFile() {
    if (!this.userData?.fileObj) {
      return;
    }
    const tmpObj = this.userData.fileObj;
    this.userData.fileObj = null;
    this.setData({ recordFileName: '' });
    this.addLog(`closeRecordFile, ${tmpObj.fileName}`);
    recordManager.closeRecordFile(tmpObj);
  },
  onPusherReady({ detail, currentTarget }) {
    console.log('==== onPusherReady', currentTarget.id, detail);
    this.addLog(`==== onPusherReady, id: ${currentTarget.id}, innerId: ${detail.pusherInnerId}`);
    this.setData({
      pusherReady: true,
      pusherComp: detail.pusherExport,
      pusherCtx: detail.livePusherContext,
    });
  },
  onPusherStartPush({ detail, currentTarget }) {
    console.log('==== onPusherStartPush', currentTarget.id, detail);
    this.addLog('==== onPusherStartPush');
    if (!this.data.pushStatus) {
      this.addLog('not pushing');
      this.data.pusherCtx.stop();
      return;
    }
    this.clearFlvData();
    if (this.data.needRecord) {
      this.openRecordFile();
    }
    this.setData({
      canRead: true,
    });
  },
  handleFlvData(buffer) {
    this.userData.flvTotalBytes += buffer.byteLength;
    this.userData.fileObj && recordManager.writeRecordFile(this.userData.fileObj, buffer);
  },
  onPusherFlvHeader({ detail, currentTarget }) {
    console.log('flv header', currentTarget.id, detail);
    this.addLog(`flv header, byteLength: ${detail.data.byteLength}`);
    this.handleFlvData(detail.data);
  },
  onPusherFlvAudioTag({ detail, currentTarget }) {
    if (!this.userData.hasReceivedAudio) {
      this.userData.hasReceivedAudio = true;
      console.log('first audioTag', currentTarget.id, detail);
      this.addLog(`first audioTag, byteLength: ${detail.data.byteLength}`);
    }
    this.handleFlvData(detail.data);
  },
  onPusherFlvVideoTag({ detail, currentTarget }) {
    if (!this.userData.hasReceivedVideo) {
      this.userData.hasReceivedVideo = true;
      console.log('first videoTag', currentTarget.id, detail);
      this.addLog(`first videoTag, byteLength: ${detail.data.byteLength}`);
    }
    this.handleFlvData(detail.data);
  },
  onPusherFlvDataTag({ detail, currentTarget }) {
    console.log('dataTag', currentTarget.id, detail);
    this.addLog(`dataTag, byteLength: ${detail.data.byteLength}, cmd: ${detail.params.cmd}`);
    this.handleFlvData(detail.data);
  },
  onPusherClose({ detail, currentTarget }) {
    console.log('==== onPusherClose', currentTarget.id, detail);
    const code = detail && detail.error && detail.error.code;
    this.addLog(`==== onPusherClose, code: ${code}`);
    this.setData({
      canRead: false,
    });
    this.closeRecordFile();
  },
  onPusherError({ detail, currentTarget }) {
    console.error('==== onPusherError', currentTarget.id, detail);
    const code = detail && detail.error && detail.error.code;
    this.addLog(`==== onPusherError, code: ${code}`);
    this.setData({
      pusherReady: false,
      pusherComp: null,
      pusherCtx: null,
      pushStatus: '',
    });
    this.closeRecordFile();
    if (code === 'WECHAT_SERVER_ERROR') {
      xp2pManager.needResetLocalRtmpServer = true;
      this.addLog(`set needResetLocalRtmpServer ${xp2pManager.needResetLocalRtmpServer}`);
      this.bindDestroyPusher();
    }
    wx.showModal({
      content: `pusher错误: ${code}`,
      showCancel: false,
    });
  },
  onLivePusherError({ detail }) {
    console.error('==== onLivePusherError', detail);
    this.addLog(`==== onLivePusherError, ${detail.errMsg}`);
    this.setData({
      pushStatus: '',
    });
  },
  onLivePusherStateChange({ detail }) {
    // console.log('onLivePusherStateChange', detail);
    switch (detail.code) {
      case 1001: // 已经连接推流服务器
        console.log('==== onLivePusherStateChange', detail.code, detail);
        // this.addLog(`==== LivePusher: ${detail.code} connected to rtmp server`);
        break;
      case 1002: // 已经与服务器握手完毕，开始推流，比 pusherStartPush 晚，这时其实已经收到过flv数据了
        console.log('==== onLivePusherStateChange', detail.code, detail);
        // this.addLog(`==== LivePusher: ${detail.code} start push`);
        break;
      // case 1007: // 首帧画面采集完成
      //   console.log('==== onLivePusherStateChange', detail.code, detail);
      //   this.addLog('==== first video frame captured');
      //   break;
      case 1102: // live-pusher断连, 已启动自动重连
        console.warn('==== onLivePusherStateChange', detail.code, detail);
        this.addLog(`==== LivePusher: ${detail.code} auto reconnect`);
        break;
      case 3002: // 连接本地RTMP服务器失败
        console.warn('==== onLivePusherStateChange', detail.code, detail);
        this.addLog(`==== LivePusher: ${detail.code} connect local server error`);
        // 本地server连不上，标记一下
        xp2pManager.needResetLocalRtmpServer = true;
        this.addLog(`set needResetLocalRtmpServer ${xp2pManager.needResetLocalRtmpServer}`);
        this.bindDestroyPusher();
        wx.showModal({
          content: `推流失败: ${detail.code}`,
          showCancel: false,
        });
        break;
      case -1307: // live-pusher断连，且经多次重连抢救无效，更多重试请自行重启推流
        console.error('==== onLivePusherStateChange', detail.code, detail);
        this.addLog(`==== LivePusher ${detail.code}, final error, needResetLocaRtmplServer ${xp2pManager.needResetLocaRtmplServer}`);
        // 到这里应该已经触发过 onPusherClose 了
        this.setData({
          pushStatus: '',
        });
        if (xp2pManager.needResetLocaRtmplServer) {
          this.bindDestroyPusher();
        }
        wx.showModal({
          content: `推流失败: ${detail.code}`,
          showCancel: false,
        });
        break;
      default:
        // 太多了，不打了
        // console.log('==== onLivePusherStateChange', detail.code, detail);
    }
  },
  onLivePusherNetStatus({ detail }) {
    // console.log('onLivePusherNetStatus', detail);
    if (!detail.info) {
      return;
    }
    // 不是所有字段都有值，不能直接覆盖整个info，只更新有值的字段
    if (!this.userData.livePusherInfo) {
      this.userData.livePusherInfo = {};
    }
    const { livePusherInfo } = this.userData;
    for (const key in detail.info) {
      if (detail.info[key] !== undefined) {
        livePusherInfo[key] = detail.info[key];
      }
    }
    this.setData({
      livePusherInfoStr: [
        `size: ${livePusherInfo.videoWidth}x${livePusherInfo.videoHeight}, fps: ${livePusherInfo.videoFPS?.toFixed(2)}, gop: ${livePusherInfo.videoGOP?.toFixed(2)}`,
        `bitrate(kbps): video ${livePusherInfo.videoBitrate}, audio ${livePusherInfo.audioBitrate}`,
        `cache(frames): video ${livePusherInfo.videoCache}, audio ${livePusherInfo.audioCache}`,
      ].join('\n'),
    });
  },
  bindCreatePusher() {
    if (this.data.pusherId) {
      console.log('already existed');
      return;
    }

    if (xp2pManager.needResetLocalRtmpServer) {
      this.addLog('xp2pManager.needResetLocalRtmpServer');
      xp2pManager.resetLocalRtmpServer();
    }

    this.addLog('create pusher');
    this.setData({
      pusherId: 'pusher-demo',
    });
  },
  bindDestroyPusher() {
    if (!this.data.pusherId) {
      console.log('not existed');
      return;
    }
    this.bindStop();

    this.addLog('destroy pusher');
    this.clearFlvData();
    this.setData({
      pusherId: '',
      pusherReady: false,
      pusherComp: null,
      pusherCtx: null,
      pushStatus: '',
    });
  },
  bindStart(e) {
    if (!this.data.pusherReady) {
      console.log('pusher not ready');
      return;
    }
    if (this.data.pushStatus) {
      console.log('already pushing');
      return;
    }
    const needRecord = !!parseInt(e.currentTarget.dataset.needRecord, 10);
    this.addLog(`start push, needRecord ${needRecord}`);
    this.clearFlvData();
    this.setData({
      pushStatus: 'pushing',
      needRecord,
    });
    // 这个会触发 onPusherStartPush
    this.data.pusherCtx.start({
      success: (res) => {
        this.addLog('start success');
      },
      fail: (res) => {
        this.addLog('start fail');
      },
    });
  },
  bindStop() {
    if (!this.data.pusherReady) {
      console.log('pusher not ready');
      return;
    }
    if (!this.data.pushStatus) {
      console.log('not pushing');
      return;
    }
    this.addLog('stop push');
    this.setData({
      pushStatus: '',
      needRecord: false,
    });
    // 这个会触发 onPusherClose
    this.data.pusherCtx.stop({
      success: (res) => {
        this.addLog('stop success');
      },
      fail: (res) => {
        this.addLog('stop fail');
      },
    });
  },
  // 以下是播放器控件相关的
  changeAspect() {
    const aspect = this.data.aspect === '3:4' ? '9:16' : '3:4';
    this.setData({
      aspect,
      aspectClass: aspectClassMap[aspect],
    });
  },
  changeRemoteMirror() {
    const remoteMirror = !this.data.remoteMirror;
    this.setData({
      remoteMirror,
      localMirror: remoteMirror ? 'enable' : 'disable',
    });
  },
});

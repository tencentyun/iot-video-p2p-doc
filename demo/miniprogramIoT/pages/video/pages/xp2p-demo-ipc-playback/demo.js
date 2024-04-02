import { pad, toMonthString, toDateTimeString, toTimeString, toDateTimeFilename, isDevTool } from '../../../../utils';
import { getRecordManager } from '../../../../lib/recordManager';
import { getXp2pManager } from '../../lib/xp2pManager';

// 覆盖 console
const app = getApp();
const oriConsole = app.console;
const console = app.logger || oriConsole;

let xp2pManager;

const downloadManager = getRecordManager('downloads');
const fileSystemManager = wx.getFileSystemManager();

// 微信限制单个文件最大 100M，这里限制一半
const maxSizeInM = 50;
const maxSize = maxSizeInM * 1024 * 1024;
const writeBlockSize = 1 * 1024 * 1024;

const pageName = 'demo-page-ipc-playback';
let pageSeq = 0;

Page({
  data: {
    // 这是onLoad时就固定的
    cfg: '',
    loadErrMsg: '',

    // 这些是控制player和p2p的
    playerId: 'iot-p2p-player',

    // 设备信息，在input组件里填
    targetId: '',
    deviceInfo: null,
    p2pMode: '',
    sceneType: '',
    xp2pInfo: '',
    onlyp2pMap: {
      flv: isDevTool,
      mjpg: isDevTool,
    },
    options: {},

    // 流的channel
    streamChannel: 0,

    // 传给播放器的录像信息
    videoInfo: null,

    // 播放器控制
    muted: false,
    orientation: 'vertical',
    rotate: 0,
    fill: false,
    fullScreen: false,

    // 控件icon
    controlsId: 'controls',
    iconSize: 25,
    showIcons: {
      quality: false,
      muted: true,
      orientation: false, // 视频流设备才支持，拿到 deviceInfo 后修改
      rotate: false, // 图片流设备才支持，拿到 deviceInfo 后修改
      fill: true,
      fullScreen: true,
      snapshot: true,
    },

    // 调试
    showDebugInfo: false,

    // 回放日期
    calendarMonth: toMonthString(new Date()),
    validDates: null,
    validDatesTip: '',

    recordDate: '',
    recordVideos: null,
    recordVideosTip: '',
    localFiles: null,
    localFilesTip: '',

    // 回放状态
    currentVideo: null, // 注意data、userData里都有
    showTogglePlayIcon: false,
    isPlaying: false, // 播放器状态，不一定播放成功
    isPlaySuccess: false, // 播放成功后才能暂停或者seek
    isPaused: false,
    isPlayError: false,
    currentSecStr: '',

    // 下载状态
    currentFile: null,  // 注意data、userData里都有
    downloadBytesStr: '',
    downloadSpeedStr: '',

    // tabs
    tabs: [
      {
        key: 'video',
        title: '录像',
      },
      {
        key: 'file',
        title: '文件',
      },
    ],
    activeTab: 'video',
  },
  onLoad(query) {
    pageSeq++;
    const pageId = `${pageName}-${pageSeq}`;
    console.log('demo: onLoad', pageId, query);

    if (!xp2pManager) {
      xp2pManager = getXp2pManager();
    }

    this.userData = {
      pageId,
      deviceId: '',
      serviceStateChangeHandler: null,
      serviceState: null,
      player: null,
      currentVideo: null,
      playState: null, // { supportProgress: boolean; currentTime: number }
      currentFile: null,
      downloadState: null, // { status: number; headers: any; chunkCount: number; downloadBytes: number, ... }
    };

    console.log('demo: checkReset when enter');
    xp2pManager.checkReset();

    if (query.json) {
      // 直接传播放数据
      let detail;
      try {
        let json = query.json;
        if (json.charAt(0) === '%') {
          json = decodeURIComponent(query.json);
        }
        detail = JSON.parse(json);
      } catch (err) {
        console.error('demo: parse json error', err);
      };
      if (!detail?.targetId || !detail?.deviceInfo || !detail?.p2pMode || !detail?.sceneType) {
        this.setData({ loadErrMsg: 'invalid json' });
        return;
      }
      this.onStartPlayer({ detail });
      return;
    }

    const cfg = query.cfg || '';
    this.setData({
      cfg,
    });
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

    // 停止播放
    if (this.userData.player) {
      console.log('demo: player.stopAll');
      this.userData.player.stopAll();
      this.userData.player = null;
    }

    // 停止下载
    if (this.userData.currentFile) {
      this.stopDownloadFile();
    }

    // 断开连接
    if (this.userData.deviceId) {
      console.log('demo: stopP2PService', this.userData.deviceId);
      xp2pManager.removeP2PServiceEventListener(
        this.userData.deviceId,
        'serviceStateChange',
        this.userData.serviceStateChangeHandler,
      );
      xp2pManager.stopP2PService(this.userData.deviceId, this.userData.pageId);
      this.userData.deviceId = '';
      this.userData.serviceStateChangeHandler = null;
      this.userData.serviceState = null;
    }

    console.log('demo: checkReset when exit');
    xp2pManager.checkReset();
    console.log('demo: onUnload end');
  },
  onStartPlayer({ detail }) {
    console.log('demo: onStartPlayer', detail);
    if (detail.p2pMode !== 'ipc' || detail.sceneType !== 'playback') {
      // p2pMode 不匹配
      console.log('demo: info error');
      this.setData({
        targetId: detail.targetId,
        deviceInfo: detail.deviceInfo,
        p2pMode: detail.p2pMode,
        sceneType: detail.sceneType,
      });
      return;
    }

    this.userData.deviceId = detail.deviceInfo.deviceId;

    // 开始连接
    console.log('demo: startP2PService', this.userData.deviceId);
    xp2pManager.startP2PService({
      p2pMode: detail.p2pMode,
      deviceInfo: detail.deviceInfo,
      xp2pInfo: detail.xp2pInfo,
      caller: this.userData.pageId,
    })
      .then((res) => {
        console.log('demo: startP2PService res', res);
        this.getRecordDatesInMonth();
      })
      .catch((err) => {
        // 只是提前连接，不用特别处理
        console.error('demo: startP2PService err', err);
      });

    // 监听事件要在 startP2PService 之后
    this.userData.serviceStateChangeHandler = (detail) => {
      console.log('demo: SERVICE_STATE_CHANGE', detail);
      this.userData.serviceState = detail;
    };
    xp2pManager.addP2PServiceEventListener(
      this.userData.deviceId,
      'serviceStateChange',
      this.userData.serviceStateChangeHandler,
    );

    const { showIcons } = this.data;
    if (detail.deviceInfo.isMjpgDevice) {
      // 图片流设备
      showIcons.orientation = false;
      showIcons.rotate = true;
    } else {
      // 视频流设备
      showIcons.orientation = true;
      showIcons.rotate = false;
    }

    let streamChannel = 0;
    if (detail.useChannelIds?.length > 0 && typeof detail.useChannelIds[0] === 'number') {
      streamChannel = detail.useChannelIds[0];
    }

    console.log('demo: set deviceInfo', detail.deviceInfo, detail.useChannelIds, streamChannel);

    this.setData({
      ...detail,
      showIcons,
      streamChannel,
      muted: detail.options.playerMuted,
    }, () => {
      const player = this.selectComponent(`#${this.data.playerId}`);
      if (player) {
        console.log('demo: create player success');
        oriConsole.log('demo: player', player); // console 被覆盖了会写logger影响性能，查看组件用 oriConsole
        this.userData.player = player;
      } else {
        console.error('demo: create player error');
      }
      const controls = this.selectComponent(`#${this.data.controlsId}`);
      if (controls) {
        console.log('demo: create controls success');
        oriConsole.log('demo: controls', controls);
      } else {
        console.error('demo: create controls error');
      }
    });
  },
  // player事件
  onPlayerEvent({ type, detail }) {
    console.log('demo: onPlayerEvent', type, detail);
  },
  onPlayStateEvent({ type, detail }) {
    console.log('demo: onPlayStateEvent', type, detail);
    switch (type) {
      case 'playstart': // 开始
        this.setData({
          isPlaying: true,
          isPlaySuccess: false,
          isPaused: false,
          isPlayError: false,
        });
        break;
      case 'playsuccess': // 成功
        this.setData({
          isPlaying: true,
          isPlaySuccess: true,
          isPaused: false,
          isPlayError: false,
        });
        break;
      case 'playpause': // 暂停
        this.setData({
          isPaused: true,
        });
        break;
      case 'playresume': // 续播
        this.setData({
          isPaused: false,
        });
        break;
      case 'playstop': // 停止
      case 'playend': // 结束
        this.setData({
          isPlaying: false,
          isPlaySuccess: false,
          isPaused: false,
          isPlayError: false,
        });
        break;
      case 'playerror': // 出错
        this.setData({
          isPlaying: false,
          isPlaySuccess: false,
          isPaused: false,
          isPlayError: true,
        });
        break;
    }
  },
  onPlaySuccess({ type, detail }) {
    this.onPlayStateEvent({ type, detail });

    console.log('demo: onPlaySuccess', detail);
  },
  onPlayError({ type, detail }) {
    this.onPlayStateEvent({ type, detail });

    console.error('demo: onPlayError', detail);
    const { errMsg, errDetail } = detail;
    wx.showModal({
      content: `${errMsg || '播放失败'}\n${(errDetail && errDetail.msg) || ''}`, // 换行在开发者工具中无效，真机正常
      showCancel: false,
    });
  },
  onFullScreenChange({ detail }) {
    console.log('demo: onFullScreenChange', detail);
    this.setData({ fullScreen: detail.fullScreen });
  },
  onSupportProgressChange({ detail }) {
    console.log('demo: onSupportProgressChange', detail);
    if (!this.userData.currentVideo) {
      return;
    }
    this.userData.playState.supportProgress = detail.supportProgress;
    this.setData({
      supportProgress: detail.supportProgress,
    });
  },
  onTimeUpdate({ detail }) {
    if (!this.userData.currentVideo) {
      return;
    }
    // 收到这个说明支持暂停/续播
    if (!this.data.showTogglePlayIcon) {
      this.setData({
        showTogglePlayIcon: true,
      });
    }
    // 录像内播放时长
    this.userData.playState.currentTime = detail.currentTime;
    // 转换成时间点
    const currentSec = this.userData.currentVideo.start_time + Math.round(detail.currentTime);
    const currentSecStr = toTimeString(new Date(currentSec * 1000));
    if (currentSecStr !== this.data.currentSecStr) {
      this.setData({ currentSecStr });
    }
  },
  // player控制
  togglePlay() {
    if (!this.userData.currentVideo) {
      return;
    }
    console.log('demo: togglePlay');
    if (!this.userData.player) {
      console.error('demo: togglePlay but no player component');
      return;
    }
    if (this.data.isPlaying) {
      if (!this.data.isPaused) {
        console.log('demo: call player.pause');
        this.userData.player.pause();
      } else {
        console.log('demo: call player.resume');
        this.userData.player.resume();
      }
    } else {
      if (!this.data.isPlayError) {
        console.log('demo: call player.play');
        this.userData.player.play();
      } else {
        console.log('demo: call player.retry');
        this.userData.player.retry();
      }
    }
  },
  clickControlIcon({ detail }) {
    const { name } = detail;
    console.log('demo: clickControlIcon', name);
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
      case 'snapshot':
        this.snapshotAndSave();
        break;
    }
  },
  changeMuted() {
    console.log('demo: changeMuted');
    this.setData({
      muted: !this.data.muted,
    });
  },
  changeOrientation() {
    console.log('demo: changeOrientation');
    this.setData({
      orientation: this.data.orientation === 'horizontal' ? 'vertical' : 'horizontal',
    });
  },
  changeFill() {
    console.log('demo: changeFill');
    this.setData({
      fill: !this.data.fill,
    });
  },
  async changeFullScreen() {
    console.log('demo: changeFullScreen');
    if (!this.userData.player) {
      console.error('demo: changeFullScreen but no player component');
      return;
    }
    if (!this.data.fullScreen) {
      try {
        await this.userData.player.requestFullScreen({ direction: 90 });
        this.setData({
          fullScreen: true,
        });
      } catch (err) {
        wx.showToast({
          title: err.errMsg,
          icon: 'error',
        });
      }
    } else {
      try {
        await this.userData.player.exitFullScreen();
        this.setData({
          fullScreen: false,
        });
      } catch (err) {
        wx.showToast({
          title: err.errMsg,
          icon: 'error',
        });
      }
    }
  },
  snapshotAndSave() {
    console.log('demo: snapshotAndSave');
    if (!this.userData.player) {
      console.error('demo: snapshotAndSave but no player component');
      return;
    }
    this.userData.player.snapshotAndSave();
  },
  toggleDebugInfo() {
    console.log('demo: toggleDebugInfo');
    this.setData({ showDebugInfo: !this.data.showDebugInfo });
  },
  // 录像数据
  async getRecordDatesInMonth() {
    if (!this.data.calendarMonth) {
      return;
    }
    console.log('demo: getRecordDatesInMonth', this.userData.deviceId, this.data.calendarMonth);
    this.setData({
      validDatesTip: 'loading...',
      validDates: null,
    });
    let res;
    try {
      res = await xp2pManager.getRecordDatesInMonth(
        this.userData.deviceId,
        { month: this.data.calendarMonth, channel: this.data.streamChannel },
      );
    } catch (err) {
      console.error('demo: getRecordDatesInMonth error', err);
      this.setData({
        validDatesTip: '获取录像日期失败',
      });
      return;
    }
    console.log('demo: getRecordDatesInMonth res', res);
    this.setData({
      validDatesTip: '',
      validDates: res.date_list.map(date => ({ month: res.month, date })),
    });
  },
  async getRecordVideosInDate() {
    if (!this.data.recordDate) {
      return;
    }
    console.log('demo: getRecordVideosInDate', this.userData.deviceId, this.data.recordDate);
    this.setData({
      recordVideosTip: 'loading...',
      recordVideos: null,
    });
    const date = this.data.recordDate;
    let res;
    try {
      res = await xp2pManager.getRecordVideosInDate(
        this.userData.deviceId,
        { date, channel: this.data.streamChannel },
      );
    } catch (err) {
      console.error('demo: getRecordVideosInDate error', err);
      this.setData({
        recordVideosTip: '获取录像列表失败',
      });
      return;
    }
    console.log('demo: getRecordVideosInDate success, res.video_list.length', res.video_list.length);
    if (res.video_list.length > 0) {
      console.log('demo: first video', res.video_list[0]);
    }
    const nextDateSec = new Date(this.data.recordDate.replace(/-/g, '/')).getTime() / 1000 + 3600 * 24;
    const getTimeStr = (time) => {
      if (time < nextDateSec) {
        return toTimeString(new Date(time * 1000));
      }
      return toDateTimeString(new Date(time * 1000));
    };
    this.setData({
      recordVideosTip: '',
      recordVideos: res.video_list.map(item => ({
        date,
        duration: item.end_time - item.start_time,
        text: `${getTimeStr(item.start_time)} - ${getTimeStr(item.end_time)}`,
        ...item,
      })),
    });
  },
  async getFilesInDate() {
    if (!this.data.recordDate) {
      return;
    }
    console.log('demo: getFilesInDate', this.userData.deviceId, this.data.recordDate);
    this.setData({
      localFilesTip: 'loading...',
      localFiles: null,
    });
    const date = this.data.recordDate;
    let res;
    try {
      res = await xp2pManager.getFilesInDate(
        this.userData.deviceId,
        { date, channel: this.data.streamChannel },
      );
    } catch (err) {
      console.error('demo: getFilesInDate error', err);
      this.setData({
        localFilesTip: '获取文件列表失败',
      });
      return;
    }
    console.log('demo: getFilesInDate success, res.file_list.length', res.file_list.length);
    if (res.file_list.length > 0) {
      console.log('demo: first file', res.file_list[0]);
    }
    const nextDateSec = new Date(this.data.recordDate.replace(/-/g, '/')).getTime() / 1000 + 3600 * 24;
    const getTimeStr = (time) => {
      if (time < nextDateSec) {
        return toTimeString(new Date(time * 1000));
      }
      return toDateTimeString(new Date(time * 1000));
    };
    this.setData({
      localFilesTip: '',
      localFiles: res.file_list.map(item => ({
        date,
        text: `${getTimeStr(item.start_time)} - ${getTimeStr(item.end_time)}`,
        ...item,
      })),
    });
  },
  changeMonth({ detail }) {
    console.log('demo: changeMonth', detail.value);
    this.setData({
      calendarMonth: detail.value,
      validDates: null,
    }, () => {
      this.getRecordDatesInMonth();
    });
  },
  changeDate({ currentTarget: { dataset } }) {
    console.log('demo: changeDate', dataset);
    this.setData({
      recordDate: `${dataset.month}-${pad(dataset.date, 2)}`,
      recordVideos: null,
      localFiles: null,
    }, () => {
      this.getRecordVideosInDate();
      this.getFilesInDate();
    });
  },
  changeTab({ currentTarget: { dataset } }) {
    const tab = this.data.tabs[dataset.index];
    console.log('demo: changeTab', tab);
    this.setData({
      activeTab: tab.key,
    });
  },
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
    this.userData.currentVideo = video;
    this.userData.playState = {};
    this.setData({
      currentVideo: video,
      showTogglePlayIcon: false,
      isPlaying: false,
      isPlaySuccess: false,
      isPaused: false,
      isPlayError: false,
      currentSecStr: '',
      // 不直接设为video，因为字段名可能不一样
      videoInfo: {
        startTime: video.start_time,
        endTime: video.end_time,
      },
    });
  },
  seekVideo({ currentTarget: { dataset } }) {
    if (!this.userData.currentVideo
      || !this.data.showTogglePlayIcon
      || !this.data.isPlaying
      || !this.data.isPlaySuccess
    ) {
      return;
    }
    const change = parseInt(dataset.change, 10);
    let toTime = this.userData.playState.currentTime + change;
    toTime = Math.max(toTime, 0);
    toTime = Math.min(toTime, this.userData.currentVideo.duration);
    console.log('demo: seekVideo', this.userData.playState.currentTime, toTime);
    this.userData.player.seek(toTime)
      .then((res) => {
        console.log('demo: seekVideo success', res);
      })
      .catch((err) => {
        console.log('demo: seekVideo error', err);
      });
  },
  stopVideo() {
    if (!this.userData.currentVideo) {
      return;
    }
    console.log('demo: stopVideo', this.userData.currentVideo);
    this.userData.currentVideo = null;
    this.userData.playState = null;
    this.setData({
      // 自己的
      currentVideo: null,
      showTogglePlayIcon: false,
      isPlaying: false,
      isPlaySuccess: false,
      isPaused: false,
      isPlayError: false,
      currentSecStr: '',
      // 传给组件的
      videoInfo: null,
    });
  },
  downloadFile({ currentTarget: { dataset } }) {
    const file = this.data.localFiles[dataset.index];
    const onlyDownload = dataset.onlyDownload || '';
    console.log('demo: downloadFile', file, onlyDownload);
    if (file === this.userData.currentFile) {
      wx.showToast({
        title: '正在下载此文件',
        icon: 'none',
      });
      return;
    }
    if (this.userData.currentFile) {
      wx.showToast({
        title: '请等待下载完成后再开始新的下载',
        icon: 'none',
      });
      return;
    }

    if (file.file_size > maxSize) {
      wx.showToast({
        title: `文件大小超出上限 ${maxSizeInM}M`,
        icon: 'none',
      });
      return;
    }

    // 保存到用户文件
    let fixedFilename = [
      this.userData.deviceId,
      toDateTimeFilename(new Date(file.start_time * 1000)),
      file.file_name,
    ].join('-');
    const pos = fixedFilename.lastIndexOf('.');
    if (pos < 0) {
      fixedFilename = `${fixedFilename}.mp4`; // 默认mp4
    }
    console.log('demo: prepareFile', fixedFilename);
    const filePath = downloadManager.prepareFile(fixedFilename);
    const fd = fileSystemManager.openSync({ filePath, flag: 'as+' });
    console.log('demo: prepareFile res', filePath, fd);

    this.userData.currentFile = file;
    this.userData.downloadState = {
      filePath,
      fd,
      timestamp: Date.now(),
      onlyDownload, // 调试用

      // 下载状态
      status: NaN,
      headers: null,
      chunkCount: 0,
      downloadBytes: 0,
      blockInfo: null,
      writeBytes: 0,

      // 下载速度
      lastRefreshBytes: 0,
      lastRefreshTimestamp: 0,
      downloadSpeed: 0,

      // 控制刷新频率
      refreshTimer: null,

      // 结果
      downloadResult: null,
      downloadSuccess: null,
      downloadDelay: 0,
      avgSpeed: 0,
    };
    this.setData({
      currentFile: file,
      downloadBytesStr: '0',
      downloadSpeedStr: '',
    });
    xp2pManager.startDownloadFile(
      this.userData.deviceId,
      { file_name: file.file_name },
      {
        onHeadersReceived: this.onDownloadHeadersReceived.bind(this),
        onChunkReceived: this.onDownloadChunkReceived.bind(this),
        onSuccess: this.onDownloadSuccess.bind(this),
        onFailure: this.onDownloadFailure.bind(this),
        onError: this.onDownloadError.bind(this),
      },
    );
  },
  onDownloadHeadersReceived({ status, headers }) {
    console.log('demo: onDownloadHeadersReceived', status, headers);
    if (!this.userData.downloadState) {
      return;
    }
    this.userData.downloadState.status = status;
    this.userData.downloadState.headers = headers;
  },
  onDownloadChunkReceived(chunk) {
    if (!this.userData.downloadState) {
      return;
    }
    const writePos = this.userData.downloadState.downloadBytes;
    this.userData.downloadState.chunkCount++;
    this.userData.downloadState.downloadBytes += chunk.byteLength;
    if (this.userData.downloadState.chunkCount === 1) {
      console.log('demo: onDownloadChunkReceived firstChunk', chunk.byteLength);
      // 第一个立刻刷新，这个方法里会启动refreshTimer
      this.refreshDownloadProgress();
    }

    if (this.userData.downloadState.blockInfo?.blockBytes + chunk.byteLength > writeBlockSize) {
      // block写不下，把之前的写到文件里，这个方法里会清除blockInfo
      this.writeBlockToFile();
    }

    if (!this.userData.downloadState.blockInfo) {
      this.userData.downloadState.blockInfo = {
        filePosition: writePos, // 写文件时用
        blockBuffer: new Uint8Array(writeBlockSize),
        blockBytes: 0,
      };
    }

    // 写入block，注意chunk要转成Uint8Array
    const { blockInfo } = this.userData.downloadState;
    blockInfo.blockBuffer.set(new Uint8Array(chunk), blockInfo.blockBytes);
    blockInfo.blockBytes += chunk.byteLength;
  },
  writeBlockToFile() {
    if (!this.userData.downloadState?.blockInfo) {
      return;
    }

    const { blockInfo } = this.userData.downloadState;
    this.userData.downloadState.blockInfo = null;

    if (this.userData.downloadState.onlyDownload) {
      return;
    }

    // 写入临时文件
    const writeState = this.userData.downloadState;
    fileSystemManager.write({
      fd: writeState.fd,
      data: blockInfo.blockBuffer.buffer,
      length: blockInfo.blockBytes,
      position: blockInfo.filePosition,
      encoding: 'binary',
      success: ({ bytesWritten }) => {
        const { currentFile, downloadState } = this.userData;
        if (!currentFile || downloadState !== writeState) {
          return;
        }
        if (bytesWritten === blockInfo.blockBytes) {
          downloadState.writeBytes += bytesWritten;
          if (downloadState.downloadSuccess && downloadState.writeBytes >= downloadState.downloadBytes) {
            this.doDownloadComplete();
          }
        } else {
          console.error('demo: fileSystemManager.write success but bytesWritten error', blockInfo.blockBytes, res);
          this.stopDownloadFile();
          wx.showModal({
            title: '下载失败',
            content: `${currentFile.file_name}\n${downloadState.downloadBytes}/${currentFile.file_size}\n写入文件失败`,
            showCancel: false,
          });
        }
      },
      fail: (err) => {
        const { currentFile, downloadState } = this.userData;
        if (!currentFile || downloadState !== writeState) {
          return;
        }
        console.error('demo: fileSystemManager.write fail', err);
        this.stopDownloadFile();
        wx.showModal({
          title: '下载失败',
          content: `${currentFile.file_name}\n${downloadState.downloadBytes}/${currentFile.file_size}\n写入文件失败`,
          showCancel: false,
        });
      },
    });
  },
  onDownloadSuccess(res) {
    console.log('demo: onDownloadSuccess', res);
    this.checkDownloadComplete(res, true);
  },
  onDownloadFailure(res) {
    console.log('demo: onDownloadFailure', res);
    this.checkDownloadComplete(res);
  },
  onDownloadError(res) {
    console.log('demo: onDownloadError', res);
    this.checkDownloadComplete(res);
  },
  checkDownloadComplete(res, isSuccess) {
    const { currentFile, downloadState } = this.userData;
    if (!currentFile) {
      return;
    }

    // 记录下载结果
    downloadState.downloadResult = res;
    downloadState.downloadSuccess = isSuccess || false;

    // 结束立刻刷新
    this.refreshDownloadProgress();

    // 算个平均速度
    const delay = Date.now() - downloadState.timestamp;
    let avgSpeed;
    if (delay >= 100) {
      avgSpeed = downloadState.downloadBytes / delay / 1.024; // KB/s
    }
    downloadState.downloadDelay = delay;
    downloadState.avgSpeed = avgSpeed;

    // 剩下的block也要写入临时文件
    if (downloadState.blockInfo) {
      this.writeBlockToFile();
    }

    // 记录下载结果
    if (downloadState.downloadSuccess && downloadState.writeBytes < downloadState.downloadBytes) {
      // 下载成功但写入还未完成，等待写入结果
      console.log(`demo: download success, wait writing complete ${downloadState.writeBytes}/${downloadState.downloadBytes}`);
      return;
    }

    // 真正结束
    this.doDownloadComplete();
  },
  doDownloadComplete() {
    if (!this.userData.currentFile) {
      return;
    }
    const { currentFile, downloadState } = this.userData;
    console.log('demo: doDownloadComplete', currentFile, downloadState);
    this.clearDownloadData();

    const { downloadSuccess, downloadResult, downloadBytes, writeBytes, avgSpeed } = downloadState;
    wx.showModal({
      title: (downloadSuccess && writeBytes >= downloadBytes) ? '下载成功' : '下载失败',
      content: [
        currentFile.file_name,
        `download: ${downloadBytes}/${currentFile.file_size}`,
        `write: ${writeBytes}/${downloadBytes}`,
        `avgSpeed: ${avgSpeed ? avgSpeed.toFixed(2) : '-'} KB/s`,
        `status: ${downloadResult?.status}, errcode: ${downloadResult?.errcode}, errmsg: ${downloadResult?.errmsg}`,
      ].join('\n'),
      showCancel: false,
    });
  },
  stopDownloadFile() {
    if (!this.userData.currentFile) {
      return;
    }
    const { currentFile, downloadState } = this.userData;
    console.log('demo: stopDownloadFile', currentFile, downloadState);
    this.clearDownloadData();

    xp2pManager.stopDownloadFile(this.userData.deviceId);
  },
  clearDownloadData() {
    if (this.userData.downloadState?.refreshTimer) {
      clearTimeout(this.userData.downloadState.refreshTimer);
      this.userData.downloadState.refreshTimer = null;
    }
    if (this.userData.downloadState?.fd) {
      fileSystemManager.closeSync({ fd: this.userData.downloadState.fd });
      this.userData.downloadState.fd = null;
    }
    this.userData.currentFile = null;
    this.userData.downloadState = null;
    this.setData({
      currentFile: null,
      downloadBytesStr: '',
      downloadSpeedStr: '',
    });
  },
  refreshDownloadProgress() {
    if (!this.userData.downloadState) {
      this.setData({
        downloadBytesStr: '',
        downloadSpeedStr: '',
      });
      return;
    }
    const { downloadState } = this.userData;
    if (downloadState.refreshTimer) {
      clearTimeout(downloadState.refreshTimer);
      downloadState.refreshTimer = null;
    }
    if (downloadState.lastRefreshBytes) {
      const recv = downloadState.downloadBytes - downloadState.lastRefreshBytes;
      const delay = Date.now() - downloadState.lastRefreshTimestamp;
      downloadState.downloadSpeed = recv / delay / 1.024; // KB/s
    }
    downloadState.lastRefreshBytes = downloadState.downloadBytes;
    downloadState.lastRefreshTimestamp = Date.now();
    this.setData({
      downloadBytesStr: String(downloadState.downloadBytes),
      downloadSpeedStr: `${downloadState.downloadSpeed.toFixed(2)} KB/s`,
    });

    if (!downloadState.downloadResult) {
      downloadState.refreshTimer = setTimeout(this.refreshDownloadProgress.bind(this), 1000);
    }
  },
});

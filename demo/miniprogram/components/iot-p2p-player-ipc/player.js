/* eslint-disable camelcase, @typescript-eslint/naming-convention */
import { isDevTools, getParamValue, toDateString, toTimeString, toDateTimeString } from '../../utils';
import { getXp2pManager } from '../../lib/xp2pManager';
import { getRecordManager } from '../../lib/recordManager';
import { isStreamEnd, isStreamError } from '../iot-p2p-common-player/common';
import { VoiceOpEnum, VoiceStateEnum } from '../iot-p2p-voice/common';
import { commandMap } from './common';

// 覆盖 console
const app = getApp();
const oriConsole = app.console;
const console = app.logger || oriConsole;

const xp2pManager = getXp2pManager();

const downloadManager = getRecordManager('downloads');
const fileSystemManager = wx.getFileSystemManager();

const sceneConfig = {
  live: {
    sections: {
      quality: true,
      ptz: true,
      voice: true,
      commands: true,
    },
  },
  playback: {
    sections: {
      download: true,
      commands: true,
    },
  },
};

let ipcPlayerSeq = 0;

Component({
  behaviors: ['wx://component-export'],
  properties: {
    ipcClass: {
      type: String,
      value: '',
    },
    playerClass: {
      type: String,
      value: '',
    },
    muted: {
      type: Boolean,
      value: false,
    },
    targetId: {
      type: String,
      value: '',
    },
    sceneType: {
      type: String,
      value: 'live',
    },
    flvFile: {
      type: String,
      value: '',
    },
    mjpgFile: {
      type: String,
      value: '',
    },
    productId: {
      type: String,
      value: '',
    },
    deviceName: {
      type: String,
      value: '',
    },
    xp2pInfo: {
      type: String,
      value: '',
    },
    liveStreamDomain: {
      type: String,
      value: '',
    },
    options: {
      type: Object,
    },
    sections: {
      type: Object,
    },
    // 以下仅供调试，正式组件不需要
    onlyp2pMap: {
      type: Object,
      value: {
        flv: isDevTools,
        mjpg: isDevTools,
      },
    },
  },
  data: {
    innerId: '',
    isDetached: false,

    isMjpgDevice: false,
    flvUrl: '',
    innerOptions: null,
    innerSections: null,

    // 这些是控制player和p2p的
    playerId: 'iot-p2p-common-player',
    player: null,
    p2pReady: false,
    streamSuccess: false,
    checkFunctions: null,

    // 就是 flvUrl 里的 action: live / live-audio / playback / playback-audio
    streamType: '',
    streamState: 'StreamIdle',

    // p2p-player的错误提示，要展示给p2p-mjpg-player
    playErrMsg: '',

    playerPaused: false,

    // 这些是控制mjpgPlayer的
    mjpgPlayerId: 'iot-p2p-mjpg-player',
    mjpgPlayer: null,

    // 这些是语音对讲，playerReady后再创建语音
    voiceCompId: '', // 'iot-p2p-voice',
    voiceComp: null,
    voiceState: '', // VoiceStateEnum

    // 自定义信令
    inputCommand: 'action=inner_define&channel=0&cmd=get_device_st&type=playback',
    inputCommandResponseType: 'text',

    // 搞个方便操作的面板
    ptzBtns: [
      { name: 'up', cmd: 'ptz_up_press' },
      { name: 'down', cmd: 'ptz_down_press' },
      { name: 'left', cmd: 'ptz_left_press' },
      { name: 'right', cmd: 'ptz_right_press' },
    ],
    ptzCmd: '',
    releasePTZTimer: null,

    // 选择录像日期
    inputDate: toDateString(new Date()),

    // 录像时段
    inputPlaybackTime: '',
    playerPlaybackTime: '',
    playerPlaybackTimeLocaleStr: '',
    playbackDuration: 0,
    playbackProgress: 0, // 从设备端拿到的progress，单位ms

    // slider，单位ms
    sliderProgress: 0, // 展示在slider上的进度，用户可以拖动
    sliderTimer: null,

    // 继续播放的progress，单位ms
    playbackProgressToResume: 0,

    // 一些回放进度相关的提示
    playbackProgressStr: '',

    // 下载
    fileList: null,
    inputDownloadFilename: '',
    downloadList: [],
    downloadFilename: '',
    downloadTotal: 0,
    downloadBytes: 0,
  },
  lifetimes: {
    created() {
      // 在组件实例刚刚被创建时执行
      ipcPlayerSeq++;
      this.setData({ innerId: `ipc-player-${ipcPlayerSeq}` });
      console.log(`[${this.data.innerId}]`, '==== created');
    },
    attached() {
      // 在组件实例进入页面节点树时执行
      console.log(`[${this.data.innerId}]`, '==== attached', this.id);
      oriConsole.log(this.properties);

      // 有 mjpgFile 认为是图片流设备
      const isMjpgDevice = !!this.properties.mjpgFile;

      const innerOptions = {
        needCheckStream: false,
        playerRTC: !isMjpgDevice, // 图片流的默认live，非图片流的默认RTC（RTC时延更低，但是ios只支持16k以上）
        playerShowControlRightBtns: true,
        intercomType: 'Recorder',
        ...this.properties.options,
      };
      console.log(`[${this.data.innerId}]`, 'innerOptions', innerOptions);

      const innerSections = {
        ...sceneConfig[this.properties.sceneType].sections,
        ...this.properties.sections,
      };
      if (isMjpgDevice) {
        // 图片流设备不支持切换 quality
        innerSections.quality = false;
      }
      console.log(`[${this.data.innerId}]`, 'innerSections', innerSections);

      const flvUrl = this.properties.flvFile ? `http://XP2P_INFO.xnet/ipc.p2p.com/${this.properties.flvFile}` : '';
      const streamType = flvUrl ? (getParamValue(flvUrl, 'action') || 'live') : '';
      console.log(`[${this.data.innerId}]`, 'streamType', streamType);
      this.setData({
        isMjpgDevice,
        flvUrl,
        innerOptions,
        innerSections,
        streamType,
        checkFunctions: {
          checkIsFlvValid: this.checkIsFlvValid.bind(this),
          checkCanStartStream: innerOptions.needCheckStream ? this.checkCanStartStream.bind(this) : null,
        },
      });

      console.log(`[${this.data.innerId}]`, 'create player');
      const player = this.selectComponent(`#${this.data.playerId}`);
      if (player) {
        this.setData({ player });
      } else {
        console.error(`[${this.data.innerId}]`, 'create player error', this.data.playerId);
      }

      if (this.data.isMjpgDevice) {
        console.log(`[${this.data.innerId}]`, 'create mjpgPlayer');
        const mjpgPlayer = this.selectComponent(`#${this.data.mjpgPlayerId}`);
        if (mjpgPlayer) {
          this.setData({ mjpgPlayer });
        } else {
          console.error(`[${this.data.innerId}]`, 'create mjpgPlayer error', this.data.mjpgPlayerId);
        }
      }
    },
    ready() {
      // 在组件在视图层布局完成后执行
    },
    detached() {
      // 在组件实例被从页面节点树移除时执行
      console.log(`[${this.data.innerId}]`, '==== detached');
      this.setData({ isDetached: true });
      this.stopAll();
      console.log(`[${this.data.innerId}]`, '==== detached end');
    },
    error() {
      // 每当组件方法抛出错误时执行
    },
  },
  export() {
    return {
      stopAll: this.stopAll.bind(this),
      reset: this.reset.bind(this),
      startVoice: this.startVoice.bind(this),
      stopVoice: this.stopVoice.bind(this),
      toggleVoice: this.toggleVoice.bind(this),
      snapshot: this.snapshot.bind(this),
      snapshotAndSave: this.snapshotAndSave.bind(this),
    };
  },
  methods: {
    stopControls() {
      if (this.data.ptzCmd || this.data.releasePTZTimer) {
        this.controlDevicePTZ('ptz_release_pre');
      }

      if (this.data.downloadList.length > 0) {
        this.stopDownload();
      }

      if (this.data.voiceComp) {
        this.data.voiceComp.stopVoice();
      }

      if (this.data.mjpgPlayer) {
        this.data.mjpgPlayer.stop();
      }

      this.clearPlaybackData();
    },
    stopAll() {
      console.log(`[${this.data.innerId}]`, 'stopAll');
      this.stopControls();

      if (this.data.player) {
        this.data.player.stopAll();
      }
    },
    reset() {
      console.log(`[${this.data.innerId}]`, 'reset');
      this.stopControls();

      if (this.data.player) {
        this.data.player.reset();
      }
    },
    startVoice() {
      console.log(`[${this.data.innerId}]`, 'startVoice in voiceState', this.data.voiceState);
      if (!this.data.voiceComp) {
        console.log(`[${this.data.innerId}]`, 'no voiceComp');
        return;
      }

      this.data.voiceComp.startVoice();
    },
    stopVoice() {
      console.log(`[${this.data.innerId}]`, 'stopVoice in voiceState', this.data.voiceState);
      if (!this.data.voiceComp) {
        console.log(`[${this.data.innerId}]`, 'no voiceComp');
        return;
      }

      this.data.voiceComp.stopVoice();
    },
    snapshot() {
      console.log(`[${this.data.innerId}]`, 'snapshot');
      const player = this.data.isMjpgDevice ? this.data.mjpgPlayer : this.data.player;
      if (!player) {
        return Promise.reject({ errMsg: 'player not ready' });
      }

      return player.snapshot();
    },
    snapshotAndSave() {
      console.log(`[${this.data.innerId}]`, 'snapshotAndSave');
      const player = this.data.isMjpgDevice ? this.data.mjpgPlayer : this.data.player;
      if (!player) {
        this.showToast('player not ready');
        return;
      }

      player.snapshotAndSave();
    },
    showToast(content) {
      !this.data.isDetached && wx.showToast({
        title: content,
        icon: 'none',
      });
    },
    showModal(params) {
      !this.data.isDetached && wx.showModal(params);
    },
    passEvent(e) {
      this.triggerEvent(e.type, e.detail);
    },
    // 以下是 common-player 的事件
    onPlayerStateChange(e) {
      console.log(`[${this.data.innerId}]`, 'onPlayerStateChange', e.detail.playerState);
      const playerReady = e.detail.playerState === 'PlayerReady';
      if (!playerReady) {
        return;
      }
      console.log(`[${this.data.innerId}] mainPlayerReady, need voice ${this.data.innerSections.voice}, has created ${!!this.data.voiceCompId}`);
      if (this.data.innerSections.voice && !this.data.voiceCompId) {
        console.log(`[${this.data.innerId}] create voiceComp`);
        this.setData({
          voiceCompId: 'iot-p2p-voice',
        }, () => {
          const voiceComp = this.selectComponent(`#${this.data.voiceCompId}`);
          console.log(`[${this.data.innerId}] create voiceComp end, voiceComp ${!!voiceComp}`);
          if (voiceComp) {
            this.setData({ voiceComp });
          } else {
            console.error(`[${this.data.innerId}]`, 'create voiceComp error', this.data.voiceCompId);
          }
        });
      }
    },
    onP2PStateChange(e) {
      console.log(`[${this.data.innerId}]`, 'onP2PStateChange', e.detail.p2pState);
      const p2pReady = e.detail.p2pState === 'ServiceStarted';
      if (this.data.p2pReady && !p2pReady) {
        // 注意要在修改 p2pReady 之前
        this.stopAll();
      }
      this.setData({ p2pReady });
      this.passEvent(e);
    },
    onStreamStateChange(e) {
      console.log(`[${this.data.innerId}]`, 'onStreamStateChange', e.detail.streamState);
      const streamSuccess = e.detail.streamState === 'StreamHeaderParsed' || e.detail.streamState === 'StreamDataReceived';
      if (this.properties.sceneType === 'playback') {
        if (!this.data.streamSuccess && streamSuccess) {
          // success后需要seek
          this.data.playbackProgressToResume && this.sendPlaybackSeekAfterSuccess();
        } else if (this.data.streamSuccess && (
          !this.data.p2pReady
          || isStreamEnd(e.detail.streamState)
          || isStreamError(e.detail.streamState)
        )) {
          // 播放结束或出错
          this.data.sliderTimer && clearTimeout(this.data.sliderTimer);
          this.setData({
            playbackProgress: 0,
            sliderProgress: 0,
            sliderTimer: null,
            playbackProgressToResume: 0,
            playbackProgressStr: '',
          });
        }
      }
      this.setData({ streamSuccess, streamState: e.detail.streamState });
      this.passEvent(e);
    },
    onPlayError(e) {
      console.error(`[${this.data.innerId}]`, 'onPlayError', e.detail);
      this.setData({ playErrMsg: e.detail.errMsg });
      this.passEvent(e);
    },
    // 以下是 mjpgPlayer 的事件
    onMjpgPlayerStateChange(e) {
      console.log(`[${this.data.innerId}]`, 'onMjpgPlayerStateChange', e.detail.playerState);
    },
    onMjpgPlayError(e) {
      console.error(`[${this.data.innerId}]`, 'onMjpgPlayError', e.detail);
      const { errMsg, errDetail } = e.detail;
      this.showModal({
        content: `${errMsg || '播放图片流失败'}\n${(errDetail && errDetail.msg) || ''}`, // 换行在开发者工具中无效，真机正常,
        showCancel: false,
      });
    },
    onMjpgClickRetry(e) {
      console.log(`[${this.data.innerId}]`, 'onMjpgClickRetry', e.detail);
      if (!this.data.player) {
        console.log(`[${this.data.innerId}]`, 'no player');
        return;
      }
      console.log(`[${this.data.innerId}]`, 'call retry');
      this.data.player.retry();
    },
    // 以下是 voice 的事件
    onVoiceStateChange(e) {
      console.log(`[${this.data.innerId}]`, 'onVoiceStateChange', e.detail.voiceState);
      this.setData({ voiceState: e.detail.voiceState });
      this.passEvent(e);
    },
    onBeforeStartVoice(e) {
      console.log(`[${this.data.innerId}]`, `onBeforeStartVoice in voiceState ${this.data.voiceState}, voiceOp ${e.detail.voiceOp}`);
      if (e.detail.voiceOp === VoiceOpEnum.Pause) {
        // 暂停播放，解决回音问题
        console.log(`[${this.data.innerId}]`, 'pausePlayer before start voice');
        this.pausePlayer();
      } else if (e.detail.voiceOp === VoiceOpEnum.Mute) {
        // 静音，解决回音问题
        console.log(`[${this.data.innerId}]`, 'set superMuted before start voice');
        this.setData({ superMuted: true });
      }
    },
    onAfterStopVoice(e) {
      console.log(`[${this.data.innerId}]`, `onAfterStopVoice in voiceState ${this.data.voiceState}, voiceOp ${e.detail.voiceOp}`);
      if (e.detail.voiceOp === VoiceOpEnum.Pause) {
        // 要暂停播放的，对讲结束恢复播放
        console.log(`[${this.data.innerId}]`, 'resumePlayer after stop voice');
        this.resumePlayer();
      } else if (e.detail.voiceOp === VoiceOpEnum.Mute) {
        // 要静音的，对讲结束恢复声音
        console.log(`[${this.data.innerId}]`, 'unset superMuted after stop voice');
        this.setData({ superMuted: false });
      }
    },
    onVoiceError(e) {
      console.error(`[${this.data.innerId}]`, 'onVoiceError', e.detail);
      const { errMsg, errDetail } = e.detail;
      this.showModal({
        content: `${errMsg || '对讲失败'}\n${(errDetail && errDetail.msg) || ''}`, // 换行在开发者工具中无效，真机正常,
        showCancel: false,
      });
    },
    // 以下是用户交互
    changeQuality(e) {
      console.log(`[${this.data.innerId}]`, 'changeQuality');
      if (!this.data.p2pReady) {
        console.log(`[${this.data.innerId}]`, 'p2p not ready');
        return;
      }
      if (!this.data.player) {
        console.log(`[${this.data.innerId}]`, 'no player');
        return;
      }

      this.setData({
        playerPaused: false,
      });

      const { quality } = e.currentTarget.dataset;
      const [_filename, params] = this.properties.flvFile?.split('?');
      const otherParams = params?.replace(/&?quality=[^&]*/g, '');
      const newParams = `${otherParams}&quality=${quality}`;
      console.log(`[${this.data.innerId}]`, 'call changeFlv', newParams);
      this.data.player.changeFlv({ params: newParams });
    },
    checkIsFlvValid({ filename, params = '' }) {
      console.log(`[${this.data.innerId}]`, 'checkIsFlvValid', filename, params);
      const newStreamType = getParamValue(params, 'action') || '';
      if (newStreamType !== this.data.streamType) {
        // 不改变streamType
        console.warn(`[${this.data.innerId}]`, 'checkIsFlvValid false, streamType mismatch', this.data.streamType, newStreamType);
        return false;
      }
      if (this.properties.sceneType === 'playback') {
        const start = parseInt(getParamValue(params, 'start_time'), 10);
        const end = parseInt(getParamValue(params, 'end_time'), 10);
        console.warn(`[${this.data.innerId}]`, 'checkIsFlvValid false, playback time invalid', params);
        return start > 0 && end - start >= 5;
      }
      return true;
    },
    checkCanStartStream({ filename, params = '' }) {
      console.log(`[${this.data.innerId}]`, 'checkCanStartStream', filename, params);

      // 1v1转1v多和检查不共存
      if (this.data.liveStreamDomain) {
        this.data.innerOptions.needCheckStream = false;
      }

      let errMsg = '';

      if (!this.checkIsFlvValid({ filename, params })) {
        // flv参数错误
        errMsg = 'flv参数错误';
        this.showToast(errMsg);
        return Promise.reject(errMsg);
      }

      if (!this.data.innerOptions.needCheckStream) {
        // 不用检查设备状态
        return Promise.resolve(true);
      }

      return new Promise((resolve, reject) => {
        xp2pManager
          .sendInnerCommand(this.properties.targetId, {
            cmd: 'get_device_st',
            params: {
              type: this.data.streamType,
              quality: getParamValue(params, 'quality') || '',
            },
          })
          .then((res) => {
            let canStart = false;
            const data = res[0]; // 返回的 res 是数组
            const status = parseInt(data && data.status, 10); // 有的设备返回的 status 是字符串，兼容一下
            console.log(`[${this.data.innerId}]`, 'checkCanStartStream status', status);
            switch (status) {
              case 0:
                canStart = true;
                break;
              case 1:
                errMsg = '设备正忙，请稍后重试';
                break;
              case 405:
                errMsg = '当前连接人数超过限制，请稍后重试';
                break;
              default:
                console.error(`[${this.data.innerId}]`, 'check can start stream, unknown status', status);
            }
            if (canStart) {
              resolve(true);
            } else {
              errMsg = errMsg || '获取设备状态失败';
              this.showToast(errMsg);
              reject(errMsg);
            }
          })
          .catch((errmsg) => {
            console.log(`[${this.data.innerId}]`, 'checkCanStartStream err', errmsg);
            errMsg = '获取设备状态失败';
            this.showToast(errMsg);
            reject(errMsg);
          });
      });
    },
    pausePlayer({ success, fail, needPauseStream = false } = {}) {
      if (!this.data.player) {
        console.log(`[${this.data.innerId}]`, 'no player');
        return;
      }

      if (this.data.playerPaused) {
        console.log(`[${this.data.innerId}]`, 'already paused');
        return;
      }

      console.log(`[${this.data.innerId}]`, 'call pause');
      this.data.player.pause({
        needPauseStream,
        success: () => {
          console.log(`[${this.data.innerId}]`, 'call pause success');
          this.setData({
            playerPaused: true,
          });
          success && success();
        },
        fail: (err) => {
          console.log(`[${this.data.innerId}]`, 'call pause fail', err);
          this.showToast(`call pause fail: ${err.errMsg}`);
          fail && fail(err);
        },
      });
    },
    resumePlayer({ success, fail } = {}) {
      if (!this.data.player) {
        console.log(`[${this.data.innerId}]`, 'no player');
        return;
      }

      if (!this.data.playerPaused) {
        console.log(`[${this.data.innerId}]`, 'not paused');
        return;
      }

      console.log(`[${this.data.innerId}]`, 'call resume');
      this.data.player.resume({
        success: () => {
          console.log(`[${this.data.innerId}]`, 'call resume success');
          this.setData({
            playerPaused: false,
          });
          success && success();
        },
        fail: (err) => {
          console.log(`[${this.data.innerId}]`, 'call resume fail', err);
          this.showToast(`call resume fail: ${err.errMsg}`);
          fail && fail(err);
        },
      });
    },
    pauseLive() {
      console.log(`[${this.data.innerId}]`, 'pauseLive');
      if (!this.data.p2pReady) {
        console.log(`[${this.data.innerId}]`, 'p2p not ready');
        return;
      }

      this.pausePlayer();
    },
    resumeLive() {
      console.log(`[${this.data.innerId}]`, 'resumeLive');
      if (!this.data.p2pReady) {
        console.log(`[${this.data.innerId}]`, 'p2p not ready');
        return;
      }

      this.resumePlayer();
    },
    pickDate(e) {
      this.setData({
        inputDate: e.detail.value,
      });
    },
    inputIPCPlaybackTime(e) {
      this.setData({
        inputPlaybackTime: e.detail.value,
      });
    },
    getRecordDates(e) {
      const date = new Date(this.data.inputDate.replace(/-/g, '/'));
      if (!this.data.inputDate) {
        this.showToast('please select date');
        return;
      }
      this.sendInnerCommand(e, date, (recordDays = []) => {
        if (recordDays.length > 0) {
          const day = recordDays[recordDays.length - 1];
          date.setDate(day);
          this.setData({
            inputDate: toDateString(date),
          });
        }
      });
    },
    getRecordVideos(e) {
      const date = new Date(this.data.inputDate.replace(/-/g, '/'));
      if (!this.data.inputDate) {
        this.showToast('please select date');
        return;
      }
      this.sendInnerCommand(e, date, ({ video_list = [] } = {}) => {
        if (video_list.length > 0) {
          // 更新 inputPlaybackTime
          const item = video_list[video_list.length - 1];
          this.setData({ inputPlaybackTime: `start_time=${item.start_time}&end_time=${item.end_time}` });
        }
      });
    },
    getVideoList(e) {
      const date = new Date(this.data.inputDate.replace(/-/g, '/'));
      if (!this.data.inputDate) {
        this.showToast('please select date');
        return;
      }
      this.sendInnerCommand(e, date, ({ file_list = [] } = {}) => {
        if (file_list.length > 0) {
          // 更新 inputDownloadFilename
          const item = file_list[file_list.length - 1];
          this.setData({
            fileList: file_list,
            inputDownloadFilename: item.file_name,
          });
        }
      });
    },
    clearPlaybackData() {
      this.data.sliderTimer && clearTimeout(this.data.sliderTimer);
      this.setData({
        sliderProgress: 0,
        sliderTimer: null,
      });
      this.setData({
        playerPaused: false,
        playerPlaybackTime: '',
        playerPlaybackTimeLocaleStr: '',
        playbackDuration: 0,
        playbackProgress: 0,
        playbackProgressToResume: 0,
        playbackProgressStr: '',
      });
    },
    startPlayback() {
      console.log(`[${this.data.innerId}]`, 'startPlayback');
      if (!this.data.p2pReady) {
        console.log(`[${this.data.innerId}]`, 'p2p not ready');
        return;
      }
      if (!this.data.player) {
        console.log(`[${this.data.innerId}]`, 'no player');
        return;
      }
      if (!this.data.inputPlaybackTime) {
        this.showToast('please input playback time');
        return;
      }

      this.clearPlaybackData();

      const startTime = parseInt(getParamValue(this.data.inputPlaybackTime, 'start_time'), 10);
      const endTime = parseInt(getParamValue(this.data.inputPlaybackTime, 'end_time'), 10);
      const startDate = new Date(startTime * 1000);
      const endDate = new Date(endTime * 1000);
      this.setData({
        playerPlaybackTime: this.data.inputPlaybackTime,
        playerPlaybackTimeLocaleStr: `${toDateTimeString(startDate)} ~ ${toTimeString(endDate)}`,
        playbackDuration: (endTime - startTime) * 1000,
      });

      const params = `action=${this.data.streamType}&channel=0&${this.data.inputPlaybackTime}`;
      console.log(`[${this.data.innerId}]`, 'call changeFlv', params);
      this.data.player.changeFlv({ params });
    },
    stopPlayback() {
      console.log(`[${this.data.innerId}]`, 'stopPlayback');
      if (!this.data.p2pReady) {
        console.log(`[${this.data.innerId}]`, 'p2p not ready');
        return;
      }
      if (!this.data.player) {
        console.log(`[${this.data.innerId}]`, 'no player');
        return;
      }

      this.clearPlaybackData();

      const params = `action=${this.data.streamType}&channel=0`;
      console.log(`[${this.data.innerId}]`, 'call changeFlv', params);
      this.data.player.changeFlv({ params });
    },
    inputIPCDownloadFilename(e) {
      this.setData({
        inputDownloadFilename: e.detail.value,
      });
    },
    downloadInputFile() {
      console.log(`[${this.data.innerId}]`, 'downloadInputFile');
      if (!this.data.p2pReady) {
        console.log(`[${this.data.innerId}]`, 'p2p not ready');
        return;
      }
      if (!this.data.inputDownloadFilename) {
        this.showToast('please input filename');
        return;
      }

      let fileItem = this.data.fileList?.find(item => item.file_name === this.data.inputDownloadFilename);
      if (!fileItem) {
        // 构造一个
        fileItem = {
          file_type: '0',
          file_name: this.data.inputDownloadFilename,
          file_size: 1,
        };
      }

      this.addToDownloadList([fileItem]);
    },
    async downloadRecord() {
      console.log(`[本地下载] [${this.data.innerId}]`, 'downloadRecord');
      const startTime = parseInt(getParamValue(this.data.inputPlaybackTime, 'start_time'), 10);
      const endTime = parseInt(getParamValue(this.data.inputPlaybackTime, 'end_time'), 10);

      // Step1 获取文件列表
      const res = await xp2pManager.sendInnerCommand(this.properties.targetId, {
        cmd: 'get_file_list',
        channel: 0, // 固定为0
        params: {
          start_time: startTime,
          end_time: endTime,
          file_type: '0',
        },
      });
      let fileList = res?.file_list;
      console.log('[本地下载] fileList: ', fileList);
      // file_type: '0'-视频，'1'-图片
      if (Array.isArray(fileList) && fileList.some(item => item.file_type === '0')) {
        fileList = fileList.filter(item => item.file_type === '0');
        console.log('[本地下载] 已加入下载队列！');
        wx.showToast({
          title: '已加入下载队列！',
          icon: 'none',
          duration: 2000,
        });
      } else {
        console.log('[本地下载] 该时间段内无录像');
        wx.showToast({
          title: '该时间段内无录像',
          icon: 'none',
        });
        return;
      }

      this.addToDownloadList(fileList);
    },
    addToDownloadList(fileList) {
      // 加入downloadList，这里只下载视频，file_type: '0'-视频，'1'-图片
      this.setData({
        downloadList: this.data.downloadList.concat(fileList),
      });

      if (this.data.downloadFilename) {
        // 正在下载前面的
        return;
      }

      this.startSingleDownload();
    },
    async startSingleDownload() {
      if (this.data.downloadList.length === 0 || this.data.downloadFilename) {
        return;
      }

      // Step2 下载文件
      const file = this.data.downloadList[0];

      const downloadFilename = file.file_name;
      const downloadTotal = parseInt(file.file_size, 10);
      let downloadBytes = 0;
      this.setData({
        downloadFilename,
        downloadTotal,
        downloadBytes,
      });

      let fixedFilename = file.file_name.replace(/\//g, '_');
      const pos = fixedFilename.lastIndexOf('.');
      if (pos >= 0) {
        // 把文件大小加到文件名里方便对比
        fixedFilename = `${fixedFilename.substring(0, pos)}.${file.file_size}${fixedFilename.substring(pos)}`;
      } else {
        fixedFilename = `${file.file_name}.${file.file_size}.mp4`; // 默认mp4
      }
      const filePath = downloadManager.prepareFile(fixedFilename);
      console.log(`[${this.data.innerId}]`, 'startSingleDownload', downloadFilename, fixedFilename, filePath);

      await xp2pManager.startLocalDownload(
        this.properties.targetId,
        {
          urlParams: `channel=0&file_name=${file.file_name}&offset=0`,
        },
        {
          onChunkReceived: (chunk) => {
            // 显示进度
            downloadBytes += chunk.byteLength;
            this.setData({
              downloadBytes,
            });
            // 将chunk包写入临时文件
            try {
              fileSystemManager.appendFileSync(filePath, chunk, 'binary');
            } catch (e) {
              console.error('[本地下载] onChunkReceived error:\n', e);
            }
          },
          onSuccess: (res) => {
            console.log('[本地下载] onSuccess', res);
          },
          onFailure: (res) => {
            console.log('[本地下载] onFailure', res);
          },
          onError: (res) => {
            console.log('[本地下载] onError', res);
          },
          onComplete: () => {
            // 不一定下载成功
            console.log(`[本地下载] onComplete ${downloadBytes}/${downloadTotal}`);
          },
        },
      );

      if (this.data.downloadList[0] !== file) {
        // 已经停止下载，或者又开始下载其他文件了
        return;
      }

      // 保存到相册，注意保存完了再开始下一个，否则多次下载同一个文件时下一个请求会覆盖本次下载的文件
      if (downloadBytes >= downloadTotal) {
        try {
          await this.saveFile(filePath, file.file_type);
          this.showToast('下载成功');
        } catch (err) {
          this.showModal({
            title: '保存失败',
            content: err.errMsg,
            showCancel: false,
          });
        };
      } else {
        this.showToast(downloadBytes > 0 ? '下载中断' : '下载失败');
      }

      this.setData({
        downloadFilename: '',
        downloadTotal: 0,
        downloadBytes: 0,
      });
      this.setData({
        downloadList: this.data.downloadList.slice(1),
      });

      // 下载下一个
      this.startSingleDownload();
    },
    // 保存到相册
    saveFile(filePath, fileType) {
      return new Promise((resolve, reject) => {
        if (fileType === '0') {
          wx.saveVideoToPhotosAlbum({
            filePath,
            success: resolve,
            fail: reject,
          });
        } else if (fileType === '1') {
          wx.saveImageToPhotosAlbum({
            filePath,
            success: resolve,
            fail: reject,
          });
        } else {
          // anything else.
          reject({ errMsg: 'invalid file type' });
        }
      });
    },
    stopDownload() {
      console.log(`[本地下载] [${this.data.innerId}]`, 'stopDownload', this.data.downloadList.length);
      if (this.data.downloadList.length <= 0) {
        return;
      }
      this.setData({
        downloadList: [],
        downloadFilename: '',
        downloadTotal: 0,
        downloadBytes: 0,
      });
      xp2pManager.stopLocalDownload(this.properties.targetId);
    },
    sliderProgressChange(e) {
      this.setData({
        sliderProgress: e.detail.value,
      });
      this.data.sliderTimer && clearTimeout(this.data.sliderTimer);
      this.setData({
        sliderTimer: setTimeout(() => {
          this.seekPlayback();
        }, 500),
      });
    },
    getPlaybackProgress({ success, fail } = {}) {
      console.log(`[${this.data.innerId}]`, 'getPlaybackProgress');
      if (!this.data.p2pReady) {
        console.log(`[${this.data.innerId}]`, 'p2p not ready');
        fail && fail();
        return;
      }
      if (!this.data.playerPlaybackTime) {
        console.log(`[${this.data.innerId}]`, 'no playback');
        fail && fail();
        return;
      }
      if (!this.data.streamSuccess) {
        console.log(`[${this.data.innerId}]`, 'playback not playing');
        return;
      }

      xp2pManager
        .sendInnerCommand(this.properties.targetId, {
          cmd: 'playback_progress',
        })
        .then((res) => {
          console.log(`[${this.data.innerId}]`, 'playback_progress res', res);
          const status = parseInt(res && res.status, 10); // 设备返回的 status 是字符串，兼容一下
          if (status !== 0) {
            this.showToast(`playback_progress err, status: ${status}`);
            fail && fail();
            return;
          }

          let progress = parseInt(res.progress, 10); // 偏移，单位ms
          // - 100 是因为要去掉videoCache的误差，应该从netstatus里读，demo简单处理
          progress = Math.max(progress - 100, 0);

          this.setData({
            playbackProgress: progress,
            sliderProgress: progress,
          });

          // 回调的progress统一成number类型
          res.progress = progress;
          success && success(res);
        })
        .catch((errmsg) => {
          console.log(`[${this.data.innerId}]`, 'playback_progress fail', errmsg);
          this.showToast('playback_progress fail');
          fail && fail();
        });
    },
    seekPlayback() {
      console.log(`[${this.data.innerId}]`, 'seekPlayback');
      if (!this.data.p2pReady) {
        console.log(`[${this.data.innerId}]`, 'p2p not ready');
        return;
      }
      if (!this.data.playerPlaybackTime) {
        console.log(`[${this.data.innerId}]`, 'no playback');
        return;
      }
      if (!this.data.streamSuccess) {
        console.log(`[${this.data.innerId}]`, 'playback not playing');
        return;
      }

      const { playbackProgress, sliderProgress } = this.data;
      console.log(`[${this.data.innerId}]`, `do seekPlayback, last ${playbackProgress}, to ${sliderProgress}`);

      this.setData({
        playbackProgressStr: `seeking ${sliderProgress}`,
      });

      xp2pManager
        .sendInnerCommand(this.properties.targetId, {
          cmd: 'playback_seek',
          params: {
            progress: sliderProgress,
          },
        })
        .then((res) => {
          console.log(`[${this.data.innerId}]`, 'playback_seek res', res);
          const status = parseInt(res && res.status, 10); // 有的设备返回的 status 是字符串，兼容一下
          if (status !== 0) {
            this.showToast(`playback_seek err, status: ${status}`);

            // 出错，slider回到之前的progress
            this.setData({
              sliderProgress: playbackProgress,
              playbackProgressStr: '',
            });
            return;
          }

          // 成功，修改playbackProgress
          this.setData({
            playbackProgress: sliderProgress,
            playbackProgressStr: '',
          });

          // 如果在暂停状态，更新暂停的progress
          if (this.data.playerPaused) {
            this.setData({
              playbackProgressToResume: sliderProgress,
            });
          }

          // seek后再拉进度看看对不对
          this.getPlaybackProgress({
            success: (res) => {
              const progress = parseInt(res.progress, 10); // 偏移，单位ms
              this.setData({
                playbackProgressStr: `after seek: ${sliderProgress} -> ${progress}`,
              });
            },
          });
        })
        .catch((errmsg) => {
          console.log(`[${this.data.innerId}]`, 'playback_seek fail', errmsg);
          this.showToast('playback_seek fail');

          // 出错，slider回到之前的progress
          this.setData({
            sliderProgress: playbackProgress,
            playbackProgressStr: '',
          });
        });
    },
    pausePlayback() {
      console.log(`[${this.data.innerId}]`, 'pausePlayback');
      if (!this.data.p2pReady) {
        console.log(`[${this.data.innerId}]`, 'p2p not ready');
        return;
      }
      if (!this.data.playerPlaybackTime) {
        console.log(`[${this.data.innerId}]`, 'no playback');
        return;
      }
      if (!this.data.streamSuccess) {
        console.log(`[${this.data.innerId}]`, 'playback not playing');
        return;
      }

      // 获取到进度才能暂停，否则不知道从哪里开始继续播
      this.getPlaybackProgress({
        success: (res) => {
          const playbackProgressToResume = res.progress;
          this.setData({
            playbackProgressToResume,
            playbackProgressStr: `paused: ${playbackProgressToResume}`,
          });
          this.doPausePlayback();
        },
      });
    },
    doPausePlayback() {
      console.log(`[${this.data.innerId}]`, 'doPausePlayback');
      this.pausePlayer({
        needPauseStream: true,
        success: () => {
          if (!this.data.streamSuccess) {
            // 已经停了，不用发 playback_pause 了
            return;
          }
          console.log(`[${this.data.innerId}]`, 'sendPlaybackPause');
          xp2pManager
            .sendInnerCommand(this.properties.targetId, {
              cmd: 'playback_pause',
            })
            .then((res) => {
              console.log(`[${this.data.innerId}]`, 'playback_pause res', res);
              const status = parseInt(res && res.status, 10); // 返回的 status 是字符串，兼容一下
              if (status !== 0) {
                this.showToast(`playback_pause err, status: ${status}`);
              }
            })
            .catch((errmsg) => {
              console.log(`[${this.data.innerId}]`, 'playback_pause fail', errmsg);
              this.showToast('playback_pause fail');
            });
        },
      });
    },
    resumePlayback() {
      console.log(`[${this.data.innerId}]`, 'resumePlayback');
      if (!this.data.p2pReady) {
        console.log(`[${this.data.innerId}]`, 'p2p not ready');
        return;
      }
      if (!this.data.playerPlaybackTime) {
        console.log(`[${this.data.innerId}]`, 'no playback');
        return;
      }

      this.resumePlayer({
        success: () => {
          // 没断开就resume，断开了就seek
          const hasStream = this.data.streamSuccess;
          console.log(`[${this.data.innerId}] need resume stream, hasStream ${hasStream}`);
          if (hasStream) {
            // 没断开，直接resume
            this.sendPlaybackResume();
          } else {
            // 断开了，等拉到数据后seek，见 onStreamStateChange
          }
        },
      });
    },
    sendPlaybackResume() {
      const { playbackProgressToResume } = this.data;
      this.setData({
        playbackProgressToResume: 0,
        playbackProgressStr: '',
      });

      console.log(`[${this.data.innerId}] sendPlaybackResume`);
      xp2pManager
        .sendInnerCommand(this.properties.targetId, {
          cmd: 'playback_resume',
        })
        .then((res) => {
          // 不管成功失败都resumeStream
          console.log(`[${this.data.innerId}]`, 'call resumeStream');
          this.data.player.resumeStream();

          console.log(`[${this.data.innerId}]`, 'playback_resume res', res);
          const status = parseInt(res && res.status, 10); // 有的设备返回的 status 是字符串，兼容一下
          if (status !== 0) {
            this.showToast(`playback_resume err, status: ${status}`);
            return;
          }

          // resume后再拉进度看看对不对
          this.getPlaybackProgress({
            success: (res) => {
              console.log(`[${this.data.innerId}] after resume: ${playbackProgressToResume} -> ${res.progress}`);
              this.setData({
                playbackProgressStr: `after resume: ${playbackProgressToResume} -> ${res.progress}`,
              });
            },
          });
        })
        .catch((errmsg) => {
          // 不管成功失败都resumeStream
          console.log(`[${this.data.innerId}]`, 'call resumeStream');
          this.data.player.resumeStream();

          console.log(`[${this.data.innerId}]`, 'playback_resume fail', errmsg);
          this.showToast('playback_resume fail');
        });
    },
    sendPlaybackSeekAfterSuccess() {
      if (!this.data.playbackProgressToResume) {
        // 不用seek
        return;
      }

      const { playbackProgressToResume } = this.data;
      this.setData({
        playbackProgressToResume: 0,
        playbackProgressStr: `seeking ${playbackProgressToResume}`,
      });

      console.log(`[${this.data.innerId}] sendPlaybackSeekAfterSuccess, progress ${playbackProgressToResume}`);
      const start = Date.now();
      xp2pManager
        .sendInnerCommand(this.properties.targetId, {
          cmd: 'playback_seek',
          params: {
            progress: playbackProgressToResume,
          },
        })
        .then((res) => {
          if (!this.data.streamSuccess) {
            // 又断开了。。。
            console.log(`[${this.data.innerId}]`, `playback_seek res status: ${res.status}, but stream not success`);
            this.setData({
              playbackProgressToResume,
              playbackProgressStr: `paused: ${playbackProgressToResume}`,
            });
            return;
          }
          // 不管成功失败都resumeStream
          console.log(`[${this.data.innerId}]`, `call resumeStream after ${Date.now() - start}ms`);
          this.data.player.resumeStream();

          console.log(`[${this.data.innerId}]`, 'playback_seek res', res);
          const status = parseInt(res && res.status, 10); // 有的设备返回的 status 是字符串，兼容一下
          if (status !== 0) {
            this.showToast(`playback_seek err, status: ${status}`);
            return;
          }

          // resume后再拉进度看看对不对
          this.getPlaybackProgress({
            success: (res) => {
              console.log(`[${this.data.innerId}] after resume (by seek): ${playbackProgressToResume} -> ${res.progress}`);
              this.setData({
                playbackProgressStr: `after resume (by seek): ${playbackProgressToResume} -> ${res.progress}`,
              });
            },
          });
        })
        .catch((errmsg) => {
          if (!this.data.streamSuccess) {
            // 又断开了。。。
            console.log(`[${this.data.innerId}]`, `playback_seek error ${errmsg}, but stream not success`);
            this.setData({
              playbackProgressToResume,
              playbackProgressStr: `paused: ${playbackProgressToResume}`,
            });
            return;
          }
          // 不管成功失败都resumeStream
          console.log(`[${this.data.innerId}]`, `call resumeStream after ${Date.now() - start}ms`);
          this.data.player.resumeStream();

          console.log(`[${this.data.innerId}]`, 'playback_seek fail', errmsg);
          this.showToast('playback_seek fail');
        });
    },
    sendInnerCommand(e, inputParams = undefined, callback = undefined) {
      console.log(`[${this.data.innerId}]`, 'sendInnerCommand');
      if (!this.data.p2pReady) {
        console.log(`[${this.data.innerId}]`, 'p2p not ready');
        return;
      }

      let cmdName = '';
      if (typeof e === 'string') {
        cmdName = e;
      } else {
        cmdName = e.currentTarget.dataset.cmdName;
      }
      if (!cmdName || !commandMap[cmdName]) {
        this.showToast(`sendInnerCommand: invalid cmdName ${cmdName}`);
        return;
      }

      const { cmd, params, dataHandler } = commandMap[cmdName];
      let realParams = params;
      if (typeof params === 'function') {
        realParams = params(inputParams);
      }
      console.log(`[${this.data.innerId}]`, 'do sendInnerCommand', this.properties.targetId, cmd, realParams);
      xp2pManager
        .sendInnerCommand(this.properties.targetId, { cmd, params: realParams })
        .then((res) => {
          console.log(`[${this.data.innerId}]`, 'sendInnerCommand res', res);
          let content = `sendInnerCommand\ncmd: ${cmd}\nres: ${JSON.stringify(res)}`;
          let parsedRes;
          if (dataHandler) {
            parsedRes = dataHandler(res);
            console.log(`[${this.data.innerId}]`, 'parsedRes', parsedRes);
            content += `\nparsedRes: ${JSON.stringify(parsedRes)}`;
          }
          this.showModal({
            content,
            showCancel: false,
          });

          if (callback) {
            callback(dataHandler ? parsedRes : res);
          }
        })
        .catch((errmsg) => {
          console.error(`[${this.data.innerId}]`, 'sendInnerCommand error', errmsg);
          this.showModal({
            content: errmsg,
            showCancel: false,
          });
        });
    },
    inputIPCCommand(e) {
      this.setData({
        inputCommand: e.detail.value,
      });
    },
    commandResponseTypeChanged(e) {
      this.setData({
        inputCommandResponseType: e.detail.value,
      });
    },
    sendCommand() {
      console.log(`[${this.data.innerId}]`, 'sendCommand');
      if (!this.data.p2pReady) {
        console.log(`[${this.data.innerId}]`, 'p2p not ready');
        return;
      }

      if (!this.data.inputCommand) {
        this.showToast('sendCommand: please input command');
        return;
      }

      xp2pManager
        .sendCommand(this.properties.targetId, this.data.inputCommand, {
          responseType: this.data.inputCommandResponseType || 'text',
        })
        .then((res) => {
          console.log(`[${this.data.innerId}]`, 'sendCommand res', res);
          let content = `sendCommand res: type=${res.type}, status=${res.status}`;
          if (res.type === 'success') {
            const type = typeof res.data;
            if (type === 'string') {
              content += `, data=${res.data}`;
            } else if (res.data && res.data.toString() === '[object ArrayBuffer]') {
              content += `, data=ArrayBuffer(${res.data.byteLength})`;
            }
          }
          this.showModal({
            content,
            showCancel: false,
          });
        })
        .catch((errcode) => {
          console.error(`[${this.data.innerId}]`, 'sendCommand error', errcode);
          this.showModal({
            content: `sendCommand error: ${errcode}`,
            showCancel: false,
          });
        });
    },
    toggleVoice() {
      console.log(`[${this.data.innerId}]`, 'toggleVoice in voiceState', this.data.voiceState);
      if (!this.data.voiceComp) {
        console.log(`[${this.data.innerId}]`, 'no voiceComp');
        return;
      }

      if (this.data.voiceState && this.data.voiceState !== VoiceStateEnum.sending) {
        // 启动中，这时不处理
        console.log(`[${this.data.innerId}]`, 'can not toggleVoice in voiceState', this.data.voiceState);
        return;
      }

      if (this.data.voiceState !== VoiceStateEnum.sending) {
        // waiting 期间也 startVoice，具体交给 voice 组件处理
        this.startVoice();
      } else {
        this.stopVoice();
      }
    },
    controlDevicePTZ(e) {
      console.log(`[${this.data.innerId}]`, 'controlDevicePTZ');
      if (!this.data.p2pReady) {
        console.log(`[${this.data.innerId}]`, 'p2p not ready');
        return;
      }
      const cmd = e && e.currentTarget ? e.currentTarget.dataset.cmd : e;
      if (!cmd) {
        return;
      }
      console.log(`[${this.data.innerId}]`, 'do controlDevicePTZ', cmd);

      if (this.data.releasePTZTimer) {
        clearTimeout(this.data.releasePTZTimer);
        this.setData({ releasePTZTimer: null });
      }

      if (cmd !== 'ptz_release_pre') {
        this.setData({ ptzCmd: cmd });
      } else {
        this.setData({ ptzCmd: '' });
      }

      const p2pId = this.data.targetId;
      const cmdDetail = {
        topic: 'ptz',
        data: {
          cmd,
        },
      };
      const start = Date.now();
      xp2pManager
        .sendUserCommand(p2pId, { cmd: cmdDetail })
        .then((res) => {
          console.log(`[${this.data.innerId}]`, `[${p2pId}] sendPTZCommand delay ${Date.now() - start}, res`, res);
        })
        .catch((err) => {
          console.error(`[${this.data.innerId}]`, `[${p2pId}] sendPTZCommand delay ${Date.now() - start}, error`, err);
        });
    },
    releasePTZBtn() {
      console.log(`[${this.data.innerId}]`, 'releasePTZBtn');
      if (!this.data.p2pReady) {
        console.log(`[${this.data.innerId}]`, 'p2p not ready');
        return;
      }
      console.log(`[${this.data.innerId}]`, 'delay releasePTZBtn');

      // 先把cmd清了，恢复按钮状态
      this.setData({ ptzCmd: '' });

      if (this.data.releasePTZTimer) {
        clearTimeout(this.data.releasePTZTimer);
        this.setData({ releasePTZTimer: null });
      }

      // 延迟发送release
      const releasePTZTimer = setTimeout(() => {
        this.controlDevicePTZ('ptz_release_pre');
      }, 500);
      this.setData({ releasePTZTimer });
    },
  },
});

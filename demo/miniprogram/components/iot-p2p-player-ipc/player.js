import config from '../../config/config';
import { getParamValue, toDateString, toDateTimeString, toTimeString } from '../../utils';
import { getXp2pManager, Xp2pManagerErrorEnum } from '../../xp2pManager';

const xp2pManager = getXp2pManager();

const { commandMap } = config;

// ts才能用enum，先这么处理吧
const VoiceTypeEnum = {
  Recorder: 'Recorder',
  Pusher: 'Pusher',
  DuplexAudio: 'DuplexAudio',
  DuplexVideo: 'DuplexVideo',
};

const voiceConfigMap = {
  [VoiceTypeEnum.Recorder]: { needPusher: false },
  [VoiceTypeEnum.Pusher]: { needPusher: true },
  [VoiceTypeEnum.DuplexAudio]: {
    needPusher: true,
    isDuplex: true,
    options: { urlParams: 'calltype=audio' },
  },
  [VoiceTypeEnum.DuplexVideo]: {
    needPusher: true,
    isDuplex: true,
    options: { urlParams: 'calltype=video' },
  },
};

const VoiceStateEnum = {
  checking: 'checking', // 检查权限和设备状态
  starting: 'starting', // 发起voice请求
  sending: 'sending', // 发送语音数据(包括等待pusher开始)
  error: 'error',
};

let ipcPlayerSeq = 0;

Component({
  behaviors: ['wx://component-export'],
  properties: {
    targetId: {
      type: String,
    },
    flvUrl: {
      type: String,
    },
    productId: {
      type: String,
    },
    deviceName: {
      type: String,
    },
    xp2pInfo: {
      type: String,
    },
    needCheckStream: {
      type: Boolean,
      value: false,
    },
    needPusher: {
      type: Boolean,
      value: false,
    },
    needDuplex: {
      type: Boolean,
      value: false,
    },
    // 以下仅供调试，正式组件不需要
    onlyp2p: {
      type: Boolean,
    },
  },
  data: {
    innerId: '',
    isDetached: false,

    // 这些是控制player和p2p的
    playerId: 'iot-p2p-common-player',
    player: null,
    p2pReady: false,
    streamSuccess: false,
    checkFunctions: null,

    // live / playback
    type: '',

    playerPaused: false,

    // 语音对讲
    voiceState: '', // VoiceStateEnum
    voiceType: '', // recorder / pusher

    // 这些是控制pusher的
    pusherId: 'iot-p2p-common-pusher',
    pusher: null,
    pusherReady: false,

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
      console.log(`[${this.data.innerId}]`, '==== attached', this.id, this.properties);

      const type = getParamValue(this.properties.flvUrl, 'action') || 'live';
      console.log(`[${this.data.innerId}]`, 'type', type);
      this.setData({
        type,
        checkFunctions: {
          checkIsFlvValid: this.checkIsFlvValid.bind(this),
          checkCanStartStream: this.properties.needCheckStream ? this.checkCanStartStream.bind(this) : null,
        },
      });

      const player = this.selectComponent(`#${this.data.playerId}`);
      if (player) {
        this.setData({ player });
      } else {
        console.error(`[${this.data.innerId}]`, 'create player error', this.data.playerId);
      }

      const pusher = this.selectComponent(`#${this.data.pusherId}`);
      if (pusher) {
        this.setData({ pusher });
      } else {
        console.error(`[${this.data.innerId}]`, 'create pusher error', this.data.pusherId);
      }
    },
    ready() {
      // 在组件在视图层布局完成后执行
    },
    detached() {
      // 在组件实例被从页面节点树移除时执行
      console.log(`[${this.data.innerId}]`, '==== detached');
      this.stopAll();
      this.setData({ isDetached: true });
      console.log(`[${this.data.innerId}]`, '==== detached end');
    },
    error() {
      // 每当组件方法抛出错误时执行
    },
  },
  export() {
    return {
      stopAll: this.stopAll.bind(this),
    };
  },
  methods: {
    stopAll() {
      if (this.data.voiceState) {
        this.stopVoice();
      }

      if (this.data.ptzCmd || this.data.releasePTZTimer) {
        this.controlDevicePTZ('ptz_release_pre');
      }

      if (this.data.pusher) {
        this.data.pusher.stop();
      }

      if (this.data.player) {
        this.data.player.stopAll();
      }

      this.clearPlaybackData();
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
      if (this.data.type === 'playback') {
        if (!this.data.streamSuccess && streamSuccess) {
          // success后需要seek
          this.data.playbackProgressToResume && this.sendPlaybackSeekAfterSuccess();
        } else if (this.data.streamSuccess && (
          !this.data.p2pReady
          || e.detail.streamState === 'StreamCheckError'
          || e.detail.streamState === 'StreamStartError'
          || e.detail.streamState === 'StreamDataEnd'
          || e.detail.streamState === 'StreamError'
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
      this.setData({ streamSuccess });
      this.passEvent(e);
    },
    // 以下是 pusher 的事件
    onPusherStateChange(e) {
      console.log(`[${this.data.innerId}]`, 'onPusherStateChange', e.detail.pusherState);
      const pusherReady = e.detail.pusherState === 'PusherReady';
      this.setData({ pusherReady });
    },
    onPusherPushError(e) {
      console.log(`[${this.data.innerId}]`, 'onPusherPushError', e.detail);
      if (this.data.voiceState && voiceConfigMap[this.data.voiceType].needPusher) {
        this.stopVoice();
      }
      const { errMsg, errDetail } = e.detail;
      this.showModal({
        content: `${errMsg || '推流失败'}\n${(errDetail && errDetail.msg) || ''}`, // 换行在开发者工具中无效，真机正常,
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

      const { flv } = e.currentTarget.dataset;
      const [filename, params] = flv.split('?');
      console.log(`[${this.data.innerId}]`, 'call changeFlv', filename, params);
      this.data.player.changeFlv({ filename, params });
    },
    checkIsFlvValid({ filename, params = '' }) {
      console.log(`[${this.data.innerId}]`, 'checkIsFlvValid', filename, params);
      const newType = getParamValue(params, 'action') || '';
      if (newType !== this.data.type) {
        // 不改变type
        return false;
      }
      if (this.data.type === 'playback') {
        const start = parseInt(getParamValue(params, 'start_time'), 10);
        const end = parseInt(getParamValue(params, 'end_time'), 10);
        return start > 0 && end - start >= 5;
      }
      return true;
    },
    checkCanStartStream({ filename, params = '' }) {
      console.log(`[${this.data.innerId}]`, 'checkCanStartStream', filename, params);

      let errMsg = '';

      if (!this.checkIsFlvValid({ filename, params })) {
        // flv参数错误
        errMsg = 'flv参数错误';
        this.showToast(errMsg);
        return Promise.reject(errMsg);
      }

      if (!this.properties.needCheckStream) {
        // 不用检查设备状态
        return Promise.resolve(true);
      }

      return new Promise((resolve, reject) => {
        xp2pManager
          .sendInnerCommand(this.properties.targetId, {
            cmd: 'get_device_st',
            params: {
              type: this.data.type,
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
    checkAuthCanStartVoice() {
      console.log(`[${this.data.innerId}]`, 'checkAuthCanStartVoice');
      return new Promise((resolve, reject) => {
        xp2pManager
          .checkRecordAuthorize()
          .then(() => {
            console.log(`[${this.data.innerId}]`, 'checkRecordAuthorize success');
            resolve();
          })
          .catch((err) => {
            console.log(`[${this.data.innerId}]`, 'checkRecordAuthorize err', err);
            this.showToast('请授权小程序访问麦克风');
            reject(err);
          });
      });
    },
    checkDeviceCanStartVoice() {
      console.log(`[${this.data.innerId}]`, 'checkDeviceCanStartVoice');
      return new Promise((resolve, reject) => {
        xp2pManager
          .sendInnerCommand(this.properties.targetId, {
            cmd: 'get_device_st',
            params: {
              type: 'voice',
            },
          })
          .then((res) => {
            let canStart = false;
            let errMsg = '';
            const data = res[0]; // 返回的 res 是数组
            const status = parseInt(data && data.status, 10); // 有的设备返回的 status 是字符串，兼容一下
            console.log(`[${this.data.innerId}]`, 'checkDeviceCanStartVoice status', status);
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
                console.error(`[${this.data.innerId}]`, 'check can start voice, unknown status', status);
            }
            if (canStart) {
              resolve();
            } else {
              this.showToast(errMsg || '获取设备状态失败');
              reject(errMsg || '获取设备状态失败');
            }
          })
          .catch((errmsg) => {
            console.log(`[${this.data.innerId}]`, 'checkDeviceCanStartVoice error', errmsg);
            this.showToast('获取设备状态失败');
            reject('获取设备状态失败');
          });
      });
    },
    async startVoice(e) {
      console.log(`[${this.data.innerId}]`, 'startVoice');
      if (!this.data.p2pReady) {
        console.log(`[${this.data.innerId}]`, 'p2p not ready');
        return;
      }
      if (this.data.voiceState) {
        console.log(`[${this.data.innerId}]`, `can not start voice in voiceState ${this.data.voiceState}`);
        return;
      }

      const voiceType = e.currentTarget.dataset.voiceType || VoiceTypeEnum.Recorder;
      const voiceConfig = voiceConfigMap[voiceType] || {};
      if (voiceConfig.needPusher && !this.data.pusherReady) {
        this.showToast('pusher not ready');
        return;
      }

      // 记录对讲类型
      this.setData({ voiceType });

      if (voiceConfig.isDuplex) {
        // 是双向音视频，在demo里省略呼叫应答功能，直接发起
        this.doStartVoiceByPusher(e);
        return;
      }

      // 是普通语音对讲，先检查能否对讲
      this.setData({ voiceState: VoiceStateEnum.checking });

      try {
        await this.checkAuthCanStartVoice();
      } catch (err) {
        if (!this.data.voiceState) {
          // 已经stop了
          return;
        }
        console.log(`[${this.data.innerId}]`, '==== checkAuthCanStartVoice error', err);
        this.stopVoice();
        return;
      }

      try {
        await this.checkDeviceCanStartVoice();
      } catch (err) {
        if (!this.data.voiceState) {
          // 已经stop了
          return;
        }
        console.log(`[${this.data.innerId}]`, '==== checkDeviceCanStartVoice error', err);
        this.stopVoice();
        return;
      }

      if (!this.data.voiceState) {
        // 已经stop了
        return;
      }
      // 检查通过，开始对讲
      console.log(`[${this.data.innerId}]`, '==== checkCanStartVoice success');
      if (voiceConfig.needPusher) {
        this.doStartVoiceByPusher(e);
      } else {
        this.doStartVoiceByRecorder(e);
      }
    },
    doStartVoiceByRecorder(e) {
      // 每种采样率有对应的编码码率范围有效值，设置不合法的采样率或编码码率会导致录音失败
      // 具体参考 https://developers.weixin.qq.com/miniprogram/dev/api/media/recorder/RecorderManager.start.html
      const [numberOfChannels, sampleRate, encodeBitRate] = e.currentTarget.dataset.recorderCfg
        .split('-')
        .map((v) => Number(v));
      const recorderOptions = {
        numberOfChannels, // 录音通道数
        sampleRate, // 采样率
        encodeBitRate, // 编码码率
      };

      console.log(`[${this.data.innerId}]`, 'do doStartVoiceByRecorder', this.properties.targetId, recorderOptions);
      this.setData({ voiceState: VoiceStateEnum.starting });
      xp2pManager
        .startVoice(this.properties.targetId, recorderOptions, {
          onPause: (res) => {
            console.log(`[${this.data.innerId}]`, 'voice onPause', res);
            // 简单点，recorder暂停就停止语音对讲
            this.stopVoice();
          },
          onStop: (res) => {
            console.log(`[${this.data.innerId}]`, 'voice onStop', res);
            if (!res.willRestart) {
              // 如果是到时间触发的，插件会自动续期，不自动restart的才需要stopVoice
              this.stopVoice();
            }
          },
        })
        .then((res) => {
          if (!this.data.voiceState) {
            // 已经stop了
            return;
          }
          console.log(`[${this.data.innerId}]`, 'startVoice success', res);
          this.setData({ voiceState: VoiceStateEnum.sending });
        })
        .catch((res) => {
          if (!this.data.voiceState) {
            // 已经stop了
            return;
          }
          console.log(`[${this.data.innerId}]`, 'startVoice fail', res);
          this.showToast(res === Xp2pManagerErrorEnum.NoAuth ? '请授权小程序访问麦克风' : '发起语音对讲失败');
          this.stopVoice();
        });
    },
    doStartVoiceByPusher(_e) {
      const { options } = voiceConfigMap[this.data.voiceType];
      // const voiceOptions = { offCrpto: true, ...options };
      const voiceOptions = { offCrpto: false, ...options };

      console.log(`[${this.data.innerId}]`, 'do doStartVoiceByPusher', this.properties.targetId, voiceOptions);
      this.setData({ voiceState: VoiceStateEnum.starting });
      xp2pManager
        .startVoiceData(this.properties.targetId, voiceOptions, {
          onStop: () => {
            if (!this.data.voiceState) {
              // 已经stop了
              return;
            }
            console.log(`[${this.data.innerId}]`, 'voice onStop');
            this.stopVoice();
          },
          onComplete: () => {
            if (!this.data.voiceState) {
              // 已经stop了
              return;
            }
            console.log(`[${this.data.innerId}]`, 'voice onComplete');
            this.stopVoice();
          },
        })
        .then((writer) => {
          if (!this.data.voiceState) {
            // 已经stop了
            return;
          }
          console.log(`[${this.data.innerId}]`, 'startVoiceData success', writer);
          this.setData({ voiceState: VoiceStateEnum.sending });
          this.data.pusher.start({
            writer,
            fail: (err) => {
              console.log(`[${this.data.innerId}]`, 'voice pusher start fail', err);
              this.stopVoice();
            },
          });
        })
        .catch((res) => {
          if (!this.data.voiceState) {
            // 已经stop了
            return;
          }
          console.log(`[${this.data.innerId}]`, 'startVoiceData fail', res);
          this.showToast('对讲失败');
          this.stopVoice();
        });
    },
    stopVoice() {
      console.log(`[${this.data.innerId}]`, 'stopVoice');
      if (!this.data.p2pReady) {
        console.log(`[${this.data.innerId}]`, 'p2p not ready');
        return;
      }
      if (!this.data.voiceState) {
        console.log(`[${this.data.innerId}]`, 'not voicing');
        return;
      }

      console.log(`[${this.data.innerId}]`, 'do stopVoice', this.properties.targetId, this.data.voiceType, this.data.voiceState);

      const { voiceType, voiceState } = this.data;
      this.setData({ voiceType: '', voiceState: '' });
      if (voiceConfigMap[voiceType].needPusher) {
        // 如果是pusher，先停掉
        if (voiceState === VoiceStateEnum.sending) {
          this.data.pusher.stop();
        }
      } else {
        // 如果是recorder，p2p模块里的stopVoice里会停
      }
      xp2pManager.stopVoice(this.properties.targetId);
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

      const filename = 'ipc.flv';
      const params = `action=playback&channel=0&${this.data.inputPlaybackTime}`;
      console.log(`[${this.data.innerId}]`, 'call changeFlv', filename, params);
      this.data.player.changeFlv({ filename, params });
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

      const filename = 'ipc.flv';
      const params = 'action=playback&channel=0';
      console.log(`[${this.data.innerId}]`, 'call changeFlv', filename, params);
      this.data.player.changeFlv({ filename, params });
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
    toggleVoice(e) {
      if (!this.data.p2pReady) {
        return;
      }

      const isSendingVoice = this.data.voiceState === VoiceStateEnum.sending;
      if (!isSendingVoice) {
        this.startVoice(e);
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

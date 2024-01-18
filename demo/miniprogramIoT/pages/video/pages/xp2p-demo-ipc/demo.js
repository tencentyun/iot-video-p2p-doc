import { isDevTool } from '../../../../utils';
import { getXp2pManager } from '../../lib/xp2pManager';

// 覆盖 console
const app = getApp();
const oriConsole = app.console;
const console = app.logger || oriConsole;

let xp2pManager;

const pageName = 'demo-page-ipc';
let pageSeq = 0;

const wmpfVoip = requirePlugin('wmpf-voip').default;
// 监听 voip 通话
wmpfVoip.onVoipEvent((event) => {
  console.info('demo onVoipEvent', event.eventName);
});

const pusherPropConfigMap = {
  enableCamera: {
    field: 'enableCamera',
    label: '开启摄像头',
    type: 'checkbox',
  },
  enableMic: {
    field: 'enableMic',
    label: '开启麦克风',
    type: 'checkbox',
  },
  mode: {
    field: 'mode',
    type: 'radio-group',
    list: [
      { value: 'RTC', label: '实时通话' },
      { value: 'SD', label: '标清' },
      { value: 'HD', label: '高清' },
      { value: 'FHD', label: '超清' },
    ],
  },
  orientation: {
    field: 'orientation',
    type: 'radio-group',
    list: [
      { value: 'vertical', label: '竖直' },
      { value: 'horizontal', label: '水平' },
    ],
  },
  aspect: {
    field: 'aspect',
    type: 'radio-group',
    list: [
      { value: '3:4', label: '3:4' },
      { value: '9:16', label: '9:16' },
    ],
  },
  videoLongSide: {
    field: 'videoLongSide',
    type: 'radio-group',
    list: [
      { value: 480, label: '480' },
      { value: 640, label: '640' },
      { value: 1280, label: '1280' },
      { value: 1920, label: '1920' },
    ],
  },
  voiceChangerType: {
    field: 'voiceChangerType',
    type: 'radio-group',
    list: [
      { value: 0, label: '关闭' },
      { value: 1, label: '熊孩子' },
      { value: 2, label: '萝莉' },
      { value: 3, label: '大叔' },
    ],
  },
};

// 影响性能，需要调试时才打开
const isDevMode = wx.getAccountInfoSync().miniProgram.envVersion === 'develop';
const needLivePusherInfo = isDevMode;
const showPusherVideoSize = isDevMode;

Page({
  data: {
    // 这是onLoad时就固定的
    cfg: '',
    loadErrMsg: '',

    // 设备信息，在input组件里填
    targetId: '',
    deviceInfo: null,
    p2pMode: '',
    xp2pInfo: '',
    liveStreamDomain: '',
    sceneType: '',
    streamQuality: '',
    useChannelIds: [], // number[]，要看的通道list
    options: {},

    // 开发者工具不支持 live-player，设置 onlyp2pMap 可以控制只拉数据不实际播放
    // 仅调试用，实际项目中带参数直接进页面时不要设置这个参数
    onlyp2pMap: {
      flv: isDevTool,
      mjpg: isDevTool,
    },

    // 控件icon
    iconSize: 25,

    // 有的设备需要先发初始化信令
    initCommand: '',
    initState: '',

    // 修复对讲后 live-player 声音变小的问题
    soundMode: 'speaker',

    // 要接收的事件，组件只会抛出设置过的，以免log太多
    acceptPlayerEvents: {
      // statechange: true,
      // netstatus: true,
      // mjpgnetstatus: true,
    },

    // PTZ
    ptzBtns: [
      { name: 'up', cmd: 'ptz_up_press' },
      { name: 'down', cmd: 'ptz_down_press' },
      { name: 'left', cmd: 'ptz_left_press' },
      { name: 'right', cmd: 'ptz_right_press' },
    ],
    ptzCmd: '',
    releasePTZTimer: null,

    // 信令
    inputCommand: 'action=inner_define&channel=0&cmd=get_device_st&type=voice',
    inputCommandResponseType: 'text',

    // 对讲方式，onStartPlayer 时确定
    intercomType: '', // 'voice' | 'video'

    // intercomType: voice, 语音对讲
    voiceId: 'iot-p2p-voice',
    voiceState: '',
    pusherProps: {
      voiceChangerType: 0,
      acceptPusherEvents: {
        netstatus: needLivePusherInfo,
      },
    },
    voiceChangerTypeList: pusherPropConfigMap.voiceChangerType.list,

    // intercomType: video, 双向音视频
    intercomId: 'iot-p2p-intercom',
    stateList: [],
    eventList: [],
    intercomState: '',
    showPusherVideoSize,
    intercomVideoSize: '', // 从netstatus事件里解析出来的实际size，有一定延迟
    intercomPusherProps: {
      enableCamera: true,
      enableMic: true,
      mode: 'RTC',
      orientation: 'vertical', // vertical / horizontal
      aspect: '3:4', // 3:4 / 9:16
      videoLongSide: 640,
      videoWidth: 480,
      videoHeight: 640,
      // fps: 15,
      // minBitrate: 200,
      // maxBitrate: 1000,
      acceptPusherEvents: {
        netstatus: needLivePusherInfo || showPusherVideoSize,
      },
    },
    intercomPusherPropConfigList: [
      pusherPropConfigMap.enableCamera,
      pusherPropConfigMap.enableMic,
      // pusherPropConfigMap.mode, // 只有 RTC 才支持设置 aspect
      pusherPropConfigMap.orientation,
      pusherPropConfigMap.aspect,
      // pusherPropConfigMap.videoLongSide, // 不生效
    ],
    intercomVideoSizeClass: 'vertical_3_4',
  },
  onLoad(query) {
    pageSeq++;
    const pageId = `${pageName}-${pageSeq}`;
    console.log('demo: onLoad', pageId, query);

    if (!xp2pManager) {
      xp2pManager = getXp2pManager();
    }

    // 渲染无关的放这里
    this.userData = {
      pageId,
      deviceId: '',
      serviceStateChangeHandler: null,
      serviceState: null,
      players: [],
      voice: null,
      pusherInfoCount: 0,
      needFixSoundMode: false,
      releasePTZTimer: null,
    };

    console.log('demo: checkReset when enter');
    xp2pManager.checkReset();

    if (query.json) {
      // 直接传播放数据
      let detail;
      try {
        const json = decodeURIComponent(query.json);
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

    // 停止对讲
    if (this.userData.voice && this.data.voiceState !== 'VoiceIdle') {
      this.stopVoice();
    }

    if (this.userData.intercom && this.data.intercomState !== 'IntercomIdle') {
      this.stopIntercomCall();
    }

    // 停止PTZ
    if (this.data.ptzCmd || this.userData.releasePTZTimer) {
      this.controlPTZ('ptz_release_pre');
    }

    console.log('demo: onHide end');
  },
  onUnload() {
    console.log('demo: onUnload');
    this.hasExited = true;

    // 停止对讲
    if (this.userData.voice && this.data.voiceState !== 'VoiceIdle') {
      this.stopVoice();
    }

    if (this.userData.intercom && this.data.intercomState !== 'IntercomIdle') {
      this.stopIntercomCall();
    }

    // 停止PTZ
    if (this.data.ptzCmd || this.userData.releasePTZTimer) {
      this.controlPTZ('ptz_release_pre');
    }

    // 断开连接
    if (this.userData.deviceId) {
      console.log('demo: stopP2PService', this.userData.deviceId);
      xp2pManager.removeP2PServiceEventListener(this.userData.deviceId, this.userData.serviceStateChangeHandler);
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
    if (detail.p2pMode !== 'ipc' || detail.sceneType !== 'live') {
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
    this.userData.serviceStateChangeHandler = (detail) => {
      console.log('demo: SERVICE_STATE_CHANGE', detail);
      this.userData.serviceState = detail;
    };
    xp2pManager.addP2PServiceEventListener(
      this.userData.deviceId,
      'serviceStateChange',
      this.userData.serviceStateChangeHandler,
    );

    // 开始连接
    console.log('demo: startP2PService', this.userData.deviceId);
    const servicePromise = xp2pManager.startP2PService({
      p2pMode: detail.p2pMode,
      deviceInfo: detail.deviceInfo,
      xp2pInfo: detail.xp2pInfo,
      liveStreamDomain: detail.liveStreamDomain,
      caller: this.userData.pageId,
    })
      .then((res) => {
        console.log('demo: startP2PService res', res);

        this.onFeedbackFromDevice();
      })
      .catch((err) => {
        // 只是提前连接，不用特别处理
        console.error('demo: startP2PService err', err);
      });

    console.log('demo: set deviceInfo', detail.deviceInfo, detail.useChannelIds);

    this.setData({
      ...detail,
      intercomType: detail.options.intercomType || 'voice',
    }, () => {
      if (detail.initCommand) {
        // 需要初始化设备
        this.setData({ initState: 'requesting' });
        servicePromise
          .then(() => {
            console.log('demo: sendInitCommand', this.userData.deviceId);
            xp2pManager.sendCommand(this.userData.deviceId, detail.initCommand)
              .then((res) => {
                console.log('demo: sendInitCommand res', res);
                if (res.type === 'success') {
                  this.setData({ initState: 'success' }, () => {
                    this.getComponents();
                  });
                } else {
                  this.setData({ initState: 'commandError' });
                }
              })
              .catch((err) => {
                console.error('demo: sendInitCommand commandError', err);
                this.setData({ initState: 'commandError' });
              });
          })
          .catch((err) => {
            console.error('demo: sendInitCommand serviceError', err);
            this.setData({ initState: 'serviceError' });
          });
      } else {
        this.getComponents();
      }
    });
  },
  // 初始化后再获取组件实例
  getComponents() {
    console.log('demo: create components');

    if (this.data.intercomType === 'video') {
      const intercom = this.selectComponent(`#${this.data.intercomId}`);
      if (intercom) {
        console.log('demo: create intercom success');
        oriConsole.log('demo: intercom', intercom);
        this.userData.intercom = intercom;
        this.setData({
          intercomState: 'IntercomIdle',
        });
      } else {
        console.error('demo: create intercom error');
      }
    } else if (this.data.intercomType === 'voice') {
      const voice = this.selectComponent(`#${this.data.voiceId}`);
      if (voice) {
        console.log('demo: create voice success');
        oriConsole.log('demo: voice', voice);
        this.userData.voice = voice;
        this.setData({
          voiceState: 'VoiceIdle',
        });
      } else {
        console.error('demo: create voice error');
      }
    }

    const players = [];

    this.data.useChannelIds.forEach((id) => {
      const player = this.selectComponent(`#p2p-live-player-${id}`);

      if (player) {
        players.push(player);
      }
    });

    this.userData.players = players;
  },
  hasSuccessPlayer() {
    return (this.userData.players || []).find(player => !!player?.isPlaySuccess());
  },
  // 退出后就不再提示
  showToast(content) {
    !this.hasExited && wx.showToast({
      title: content,
      icon: 'none',
    });
  },
  showModal(params) {
    !this.hasExited && wx.showModal(params);
  },

  gotoP2PPlayback() {
    console.log('demo: gotoP2PPlayback');
    const deviceDetail = {
      targetId: this.data.targetId,
      deviceInfo: this.data.deviceInfo,
      p2pMode: this.data.p2pMode,
      sceneType: 'playback',
      xp2pInfo: this.data.xp2pInfo,
      liveStreamDomain: this.data.liveStreamDomain,
      onlyp2pMap: this.data.onlyp2pMap,
      options: this.data.options,
    };
    const url = `/pages/video/pages/xp2p-demo-ipc-playback/demo?json=${encodeURIComponent(JSON.stringify(deviceDetail))}`;
    wx.navigateTo({ url });
  },
  gotoCloudPlayback() {
    console.log('demo: gotoCloudPlayback');
    const { isMjpgDevice } = this.data.deviceInfo;
    const url = `/pages/video/pages/xp2p-demo-ipc-playback-${isMjpgDevice ? 'cloudmjpg' : 'cloudvideo'}/demo?cfg=${this.data.cfg}`;
    wx.navigateTo({ url });
  },
  changeSoundMode() {
    console.log('demo: changeSoundMode');
    this.setData({
      soundMode: this.data.soundMode === 'ear' ? 'speaker' : 'ear',
    });
  },
  onFullScreenChange({ currentTarget: { dataset }, detail }) {
    const channel = Number(dataset.channel);
    console.log(`demo: onFullScreenChange, channel ${channel} ${detail.fullScreen}`);
  },

  // voice事件
  onVoiceStateChange({ detail }) {
    console.log('demo: onVoiceStateChange', detail, `last voiceState ${this.data.voiceState}`);
    this.setData({
      voiceState: detail.voiceState,
    });
  },
  onVoiceProcess({ type, detail }) {
    console.log('demo: onVoiceProcess', type, detail);
    switch (type) {
      case 'voicesuccess':
        this.userData.needFixSoundMode = true;
        break;
      case 'voicestop':
      case 'voiceerror':
        if (this.userData.needFixSoundMode) {
          console.log('demo: fix soundMode');
          this.userData.needFixSoundMode = false;
          this.setData({
            soundMode: 'ear',
          });
          setTimeout(() => {
            this.setData({
              soundMode: 'speaker',
            });
          }, 500);
        }
        break;
    }
  },
  onVoiceError({ type, detail }) {
    this.onVoiceProcess({ type, detail });

    console.error('demo: onVoiceError', detail);
    this.showToast(detail.errMsg || '启动对讲失败');
  },
  onVoiceLivePusherNetStatus({ detail }) {
    if (!detail.info) {
      return;
    }
    if (this.userData.pusherInfoCount < 10) {
      this.userData.pusherInfoCount++;
      console.log('demo: onVoiceLivePusherNetStatus', this.userData.pusherInfoCount, detail);
    }
  },
  // feedback 事件通知
  onFeedbackFromDevice() {
    xp2pManager.addP2PServiceEventListener(
      this.userData.deviceId,
      'feedbackFromDevice',
      async (body) => {
        console.log('demo: FEEDBACK_FROM_DEVICE', body);
        await wx.showModal({
          title: 'feedbackFromDevice',
          content: JSON.stringify(body),
        });
      },
    );
  },
  // 双向音视频事件通知，4.0.1 以上监听 intercomerror 即可，不再触发 intercomeventchange，
  onIntercomEventChange({ detail }) {
    console.log('demo: onIntercomEventChange: ', detail);
    this.setData({
      eventList: [...this.data.eventList, detail.event],
    });
    let tips = '';
    const isCalling = ['Calling', 'Sending'].includes(this.data.intercomState);
    switch (detail.event) {
      // 插件自身事件
      case 'IntercomError': {
        tips = detail.detail?.errMsg || '呼叫异常';
        break;
      }
      case 'VoiceError': {
        tips = '初始化语音对讲组件异常';
        break;
      }
      case 'CancelCalling': {
        tips = '小程序取消呼叫';
        break;
      }
      case 'Hangup': {
        tips = '小程序挂断';
        break;
      }

      // 设备端响应事件
      case 'BeHangup': {
        tips = isCalling && '设备端挂断';
        break;
      }
      case 'RejectCalling': {
        tips = isCalling && '设备端拒接';
        break;
      }
      case 'CallCanceled': {
        tips = isCalling && '设备端取消呼叫';
        break;
      }
      case 'Busy': {
        tips = isCalling && '设备端繁忙';
        break;
      }
      case 'CallTimeout': {
        tips = isCalling && '设备端呼叫超时';
        break;
      }
      default: {
        break;
      }
    }
    if (tips) this.showToast(tips);
  },
  onIntercomStateChange({ detail }) {
    console.log('demo: onIntercomStateChange: ', detail, `last intercomState ${this.data.intercomState}`);
    this.setData({
      stateList: [...this.data.stateList, detail.state],
      intercomState: detail.state,
    });
  },
  onIntercomProcess({ type, detail }) {
    console.log('demo: onIntercomProcess', type, detail);
  },
  onIntercomError({ detail }) {
    console.log('demo: onIntercomError', detail);
    let tips = '';
    if (detail.errType === 'FeedbackResult') {
      const isCalling = ['Calling', 'Sending'].includes(this.data.intercomState);
      tips = isCalling && detail.errMsg;
    } else {
      tips = detail.errMsg || '呼叫异常';
    }
    if (tips) this.showToast(tips);
  },
  onIntercomLivePusherNetStatus({ detail }) {
    // console.log('demo: onIntercomLivePusherNetStatus', detail);
    if (!detail.info) {
      return;
    }
    if (this.userData.pusherInfoCount < 10) {
      this.userData.pusherInfoCount++;
      console.log('demo: onIntercomLivePusherNetStatus', this.userData.pusherInfoCount, detail);
    }
    if (detail.info.videoWidth && detail.info.videoHeight) {
      const intercomVideoSize = `${detail.info.videoWidth}x${detail.info.videoHeight}`;
      if (intercomVideoSize !== this.data.intercomVideoSize) {
        console.log('demo: intercomVideoSize change', intercomVideoSize, detail.info);
        this.setData({ intercomVideoSize });
      }
    }
  },
  // voice控制
  toggleVoice() {
    console.log('demo: toggleVoice');
    if (this.data.voiceState === 'VoiceIdle') {
      this.startVoice();
    } else if (this.data.voiceState === 'VoiceSending') {
      this.stopVoice();
    }
  },
  startVoice(e) {
    const needRecord = parseInt(e?.currentTarget?.dataset?.needRecord, 10) > 0;
    console.log('demo: startVoice, needRecord', needRecord);

    // 只要有一个player播放成功，就启动对讲
    const isPlaySuccess = this.hasSuccessPlayer();

    if (!isPlaySuccess) {
      console.log('demo: startVoice err, isPlaySuccess false');
      wx.showToast({
        title: '请等待播放后再开启对讲',
        icon: 'error',
      });
      return;
    }

    if (!this.userData.voice) {
      console.error('demo: startVoice but no voice component');
      return;
    }

    this.userData.pusherInfoCount = 0;
    this.userData.voice.startVoice({
      needRecord,
    });
  },
  stopVoice() {
    console.log('demo: stopVoice');

    if (!this.userData.voice) {
      console.error('demo: stopVoice but no voice component');
      return;
    }

    this.userData.voice.stopVoice();
  },
  voiceChangerChange({ detail }) {
    const newType = Number(detail.value) || 0;
    this.setData({
      'pusherProps.voiceChangerType': newType,
    });
  },
  // intercom控制
  startIntercomCall(e) {
    const needRecord = parseInt(e?.currentTarget?.dataset?.needRecord, 10) > 0;
    console.log('demo: startIntercomCall, needRecord', needRecord);

    // 只要有一个player播放成功，就启动对讲
    const isPlaySuccess = this.hasSuccessPlayer();

    if (!isPlaySuccess) {
      console.log('demo: startIntercomCall err, isPlaySuccess false');
      wx.showToast({
        title: '请等待播放后再开始呼叫',
        icon: 'error',
      });
      return;
    }

    // 检查实例是否初始化成功
    if (!this.userData.intercom) {
      console.error('demo: startIntercomCall but no intercom component');
      return;
    }

    this.userData.pusherInfoCount = 0;
    this.userData.intercom.intercomCall({
      needRecord,
    });
  },
  stopIntercomCall() {
    console.log('demo: stopIntercomCall');

    if (!this.userData.intercom) {
      console.error('demo: stopIntercomCall but no intercom component');
      return;
    }

    this.setData({
      stateList: [],
      eventList: [],
      intercomState: 'Ready2Call',
      intercomVideoSize: '',
    });

    this.userData.intercom.intercomHangup();
  },
  intercomPusherPropChange({ detail, currentTarget: { dataset } }) {
    const { field } = dataset;
    let value = detail.value;
    if (field === 'videoLongSide') {
      value = Number(detail.value) || 640;
    }
    const newProps = {
      ...this.data.intercomPusherProps,
      [field]: value,
    };
    if (field === 'orientation' || field === 'aspect' || field === 'videoLongSide') {
      const longSide = newProps.videoLongSide;
      const shortSide = (newProps.aspect === '3:4') ? (longSide / 4 * 3) : (longSide / 16 * 9);
      if (newProps.orientation === 'horizontal') {
        newProps.videoWidth = longSide;
        newProps.videoHeight = shortSide;
      } else {
        newProps.videoWidth = shortSide;
        newProps.videoHeight = longSide;
      }
    }
    console.log('demo: intercomPusherPropChange', field, detail.value, newProps);
    this.setData({
      intercomPusherProps: newProps,
      intercomVideoSizeClass: `${newProps.orientation}_${newProps.aspect.replace(':', '_')}`,
    });
  },
  // ptz控制
  controlPTZ(e) {
    const cmd = (typeof e === 'string') ? e : e?.currentTarget?.dataset?.cmd;
    if (!cmd) {
      return;
    }

    console.log('demo: controlPTZ', cmd);

    if (this.userData.releasePTZTimer) {
      clearTimeout(this.userData.releasePTZTimer);
      this.userData.releasePTZTimer = null;
    }

    if (cmd !== 'ptz_release_pre') {
      this.setData({ ptzCmd: cmd });
    } else {
      this.setData({ ptzCmd: '' });
    }

    xp2pManager.sendPTZCommand(this.userData.deviceId, { ptzCmd: cmd })
      .then((res) => {
        console.log(`demo: sendPTZCommand ${cmd} res`, res);
      })
      .catch((err) => {
        console.error(`demo: sendPTZCommand ${cmd} error`, err);
      });
  },
  releasePTZBtn() {
    console.log('demo: releasePTZBtn');

    // 先把cmd清了，恢复按钮状态
    this.setData({ ptzCmd: '' });

    if (this.userData.releasePTZTimer) {
      clearTimeout(this.userData.releasePTZTimer);
      this.userData.releasePTZTimer = null;
    }

    // 延迟发送release
    this.userData.releasePTZTimer = setTimeout(() => {
      this.controlPTZ('ptz_release_pre');
    }, 500);
  },
  // 信令
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
    console.log(`[${this.userData.pageId}]`, 'sendCommand');

    if (!this.data.inputCommand) {
      this.showToast('sendCommand: please input command');
      return;
    }

    xp2pManager
      .sendCommand(this.userData.deviceId, this.data.inputCommand, {
        responseType: this.data.inputCommandResponseType || 'text',
      })
      .then((res) => {
        console.log(`[${this.userData.pageId}]`, 'sendCommand res', res);
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
      .catch((err) => {
        console.error(`[${this.userData.pageId}]`, 'sendCommand error', err);
        this.showModal({
          content: `sendCommand error: ${err.errMsg}`,
          showCancel: false,
        });
      });
  },
});

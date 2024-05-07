import { defaultShareInfo } from '../../../../config/config';
import { isDevTool, toTimeMsString, compareVersion } from '../../../../utils';
import { getXp2pManager } from '../../lib/xp2pManager';
import { CustomPusher } from '../../lib/customPusher';

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
    label: '摄像头',
    type: 'checkbox',
  },
  enableMic: {
    field: 'enableMic',
    label: '麦克风',
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

// 视频对讲水位
const intercomP2PWaterMark = {
  low: 0,
  high: 500 * 1024, // 高水位字节数，可根据码率和可接受延迟自行调整
};
// 视频对讲水位码率，默认高码率，需要流控用低码率
const intercomBirateMap = {
  low: {
    fps: 10,
    minBitrate: 200,
    maxBitrate: 400,
  },
  high: {
    fps: 15,
    minBitrate: 200,
    maxBitrate: 600,
  },
};
// 视频对讲开启流控
const intercomAutoBitrate = true;

// 影响性能，需要调试时才打开
const needLivePusherInfo = false;
const showPusherVideoSize = false;

// 页面隐藏自动关闭对讲
const autoStopVoiceIfPageHide = true;

// 测试页面刷新
const needTestRender = wx.getAccountInfoSync().miniProgram.envVersion === 'develop';

// 模拟pusher对讲用
// eslint-disable-next-line max-len
const mockFlvHeader = new Uint8Array([0x46, 0x4c, 0x56, 0x01, 0x05, 0x00, 0x00, 0x00, 0x09, 0x00, 0x00, 0x00, 0x00]).buffer; // FLV Header

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

    // 页面隐藏自动关闭对讲
    autoStopVoiceIfPageHide,

    // intercomType: voice, 语音对讲
    voiceId: 'iot-p2p-voice',
    voiceState: '',
    pusherProps: {
      voiceChangerType: 0,
      disableCameraIfPageHide: autoStopVoiceIfPageHide,
      disableMicIfPageHide: autoStopVoiceIfPageHide,
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
      ...intercomBirateMap.high,
      disableCameraIfPageHide: autoStopVoiceIfPageHide,
      disableMicIfPageHide: autoStopVoiceIfPageHide,
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
    livePusherContextReady: false,

    // 对讲前预览
    supportPreview: false,
    isPreview: false,

    // 用文件模拟对讲
    supportCustomPusher: false,
    customPusher: null,

    // 测试页面刷新
    needTestRender,
    testStr: '',
  },
  onLoad(query) {
    pageSeq++;
    const pageId = `${pageName}-${pageSeq}`;
    console.log('demo: onLoad', pageId, query);

    // 渲染无关的放这里
    this.userData = {
      pageId,
      deviceId: '',
      serviceStateChangeHandler: null,
      serviceState: null,
      players: [],
      voice: null,
      intercom: null,
      pusherInfoCount: 0,
      needFixSoundMode: false,

      /**
       * 视频对讲水位设置，需要 xp2p 插件 4.1.3 以上
       * 小程序侧数据缓存水位变化时会检测堆积状态，状态变化触发 buffer_state_change 回调
       * 缓存水位低于 low 时会持续触发 writable
       * 缓存水位高于 high 时会持续触发 unwritable
       * 回调参数详见 onIntercomP2PEvent
       */
      intercomP2PWaterMark,
      intercomBufferInfo: null, // { bitrateType, state, timer }

      // PTZ
      releasePTZTimer: null,

      // 测试页面刷新
      testTimer: null,
      startRenderTime: 0,
      lastRenderTime: 0,
    };

    if (!xp2pManager) {
      xp2pManager = getXp2pManager();
    }

    this.setData({
      supportPreview: compareVersion(xp2pManager.XP2PVersion, '4.1.4') >= 0,
      supportCustomPusher: compareVersion(xp2pManager.XP2PVersion, '4.1.4') >= 0,
    });

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

    // 停止对讲
    if (autoStopVoiceIfPageHide) {
      if (this.userData.voice && this.data.voiceState !== 'VoiceIdle') {
        this.stopVoice();
      }

      if (this.userData.intercom && this.data.intercomState !== 'IntercomIdle') {
        this.stopIntercomCall();
      }
    }

    // 停止PTZ
    if (this.data.ptzCmd || this.userData.releasePTZTimer) {
      this.controlPTZ('ptz_release_pre');
    }
  },
  onUnload() {
    console.log('demo: onUnload');
    this.hasExited = true;

    // 停止测试timer
    if (this.userData.testTimer) {
      this.stopTestRender();
    }

    // 停止对讲
    if (this.userData.voice && this.data.voiceState !== 'VoiceIdle') {
      this.stopVoice();
    }

    if (this.userData.intercom && this.data.intercomState !== 'IntercomIdle' && this.data.intercomState !== 'Ready2Call') {
      this.stopIntercomCall();
    }

    // 停止PTZ
    if (this.data.ptzCmd || this.userData.releasePTZTimer) {
      this.controlPTZ('ptz_release_pre');
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
  onShareAppMessage() {
    // 还在输入界面或者数据无效，分享首页
    if (!this.userData.deviceId) {
      console.log('demo: share home', defaultShareInfo.path);
      return defaultShareInfo;
    }
    // 分享设备
    const deviceDetail = {
      targetId: `share_${this.userData.deviceId}`,
      p2pMode: this.data.p2pMode,
      sceneType: 'live',
      deviceInfo: this.data.deviceInfo,
      xp2pInfo: this.data.xp2pInfo,
      liveStreamDomain: this.data.liveStreamDomain,
      initCommand: this.data.initCommand,
      useChannelIds: this.data.useChannelIds,
      options: this.data.options,
    };
    const sharePath = `/pages/index/index?page=ipc-live&json=${encodeURIComponent(JSON.stringify(deviceDetail))}`;
    console.log('demo: share ipc-live', sharePath);
    return {
      title: `XP2P 监控 ${this.userData.deviceId}`,
      path: sharePath,
      imageUrl: defaultShareInfo.imageUrl,
    };
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

    // 测试页面刷新
    if (this.data.needTestRender) {
      this.startTestRender();
    }

    this.userData.deviceId = detail.deviceInfo.deviceId;

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

    // 监听事件要在 startP2PService 之后
    this.userData.serviceStateChangeHandler = (detail) => {
      // detail: { p2pState: XP2PServiceState }
      console.log('demo: SERVICE_STATE_CHANGE', detail);
      this.userData.serviceState = detail;
    };
    xp2pManager.addP2PServiceEventListener(
      this.userData.deviceId,
      'serviceStateChange',
      this.userData.serviceStateChangeHandler,
    );

    if (!detail.useChannelIds) {
      // 默认通道0
      detail.useChannelIds = [0];
    }
    console.log('demo: set deviceInfo', detail.deviceInfo, detail.useChannelIds);

    this.setData({
      ...detail,
      streamQuality: detail.options.liveQuality || 'high',
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
    console.log('demo: getComponents');

    const players = [];
    this.data.useChannelIds.forEach((id) => {
      const player = this.selectComponent(`#p2p-live-player-${id}`);

      if (player) {
        players.push(player);
      }
    });
    this.userData.players = players;

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
      options: this.data.options,
      onlyp2pMap: this.data.onlyp2pMap,
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
  onPlayStateChange({ currentTarget: { dataset }, detail }) {
    const channel = Number(dataset.channel);
    console.log(`demo: onPlayStateChange, channel ${channel}`, detail);

    // 播放结束/出错，停止对讲
    if (!detail.playState.isPlaying && !this.hasSuccessPlayer()) {
      console.log('demo: all player stopped');
      if (this.userData.voice && this.data.voiceState !== 'VoiceIdle') {
        this.stopVoice();
      }
      if (this.userData.intercom && this.data.intercomState !== 'IntercomIdle' && this.data.intercomState !== 'Ready2Call') {
        this.stopIntercomCall();
      }
    }
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
    this.showToast(detail.errMsg || '对讲发生错误');
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
      (body) => {
        console.log('demo: FEEDBACK_FROM_DEVICE', body);
        wx.showModal({
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
    console.log('demo: onIntercomStateChange: ', detail, `${this.data.intercomState} -> ${detail.state}`);
    this.setData({
      stateList: [...this.data.stateList, detail.state],
      intercomState: detail.state,
    });
  },
  onIntercomProcess({ type, detail }) {
    console.log('demo: onIntercomProcess', type, detail);

    if (type === 'intercomstop' || type === 'intercomerror') {
      this.clearIntercomBufferInfo();
    }
  },
  onIntercomError({ type, detail }) {
    this.onIntercomProcess({ type, detail });

    console.error('demo: onIntercomError', detail);
    let tips = '';
    if (detail.errType === 'FeedbackResult') {
      const isCalling = ['Calling', 'Sending', 'BeHangup'].includes(this.data.intercomState);
      tips = isCalling && detail.errMsg;
    } else {
      tips = detail.errMsg || '呼叫异常';
    }
    if (tips) this.showToast(tips);
  },
  onIntercomPreviewChange({ detail }) {
    console.log('demo: onIntercomPreviewChange', detail);
    this.setData({ isPreview: detail.preview });
  },
  onIntercomPreviewError({ detail }) {
    console.error('demo: onIntercomPreviewError', detail);
    this.showToast(detail.errMsg || '预览异常');
  },
  onIntercomLivePusherContextChange({ detail }) {
    console.log('demo: onIntercomLivePusherContextChange', detail);
    this.userData.livePusherContext = detail.livePusherContext;
    this.setData({ livePusherContextReady: !!this.userData.livePusherContext });
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
  onIntercomP2PEvent(evtName, detail) {
    switch (evtName) {
      case 'buffer_state_change': {
        /*
          buffer水位状态变化，detail: { state: -1 | 0 | 1; size: number }
          state: 水位状态
            - -1 水位 < low
            - 0 水位 [low, high]
            - 1 水位 > high
          size: 字节数

          一个简单的流控策略：水位维持在high以上（state > 0）几秒钟就降码率，维持high以下（state <= 0）几秒钟再恢复，避免跳来跳去的情况
        */
        console.log('demo: onIntercomP2PEvent', evtName, detail);
        if (!intercomAutoBitrate
          || !this.userData.intercomBufferInfo
          || detail.state === this.userData.intercomBufferInfo.state
        ) {
          return;
        }

        // 水位状态变化，清理之前的timer
        if (this.userData.intercomBufferInfo.timer) {
          console.log('demo: clear buffer timer, old state', this.userData.intercomBufferInfo.state);
          clearTimeout(this.userData.intercomBufferInfo.timer);
          this.userData.intercomBufferInfo.timer = null;
        }
        this.userData.intercomBufferInfo.state = detail.state;

        // 需要改变码率时才设timer
        const bitrateType = detail.state > 0 ? 'low' : 'high';
        if (this.userData.intercomBufferInfo.bitrateType !== bitrateType) {
          console.log(`demo: use ${bitrateType} bitrate after 3s`);
          this.userData.intercomBufferInfo.timer = setTimeout(() => {
            clearTimeout(this.userData.intercomBufferInfo.timer);
            this.userData.intercomBufferInfo.timer = null;
            this.userData.intercomBufferInfo.bitrateType = bitrateType;
            console.log(`demo: use ${bitrateType} bitrate`, intercomBirateMap[bitrateType]);
            this.setData({
              intercomPusherProps: {
                ...this.data.intercomPusherProps,
                ...intercomBirateMap[bitrateType],
              },
            });
          }, 3000);
        }
        break;
      }
      case 'writable': {
        // buffer水位低于 low 时会持续触发，detail: number，字节数
        break;
      }
      case 'unwritable': {
        // buffer水位高于 high 时会持续触发，detail: number，字节数
        break;
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
    const canStart = this.data.useChannelIds.length === 0 || this.hasSuccessPlayer();

    if (!canStart) {
      console.log('demo: startVoice err, isPlaySuccess false');
      wx.showToast({
        title: '请等待播放后再开启对讲',
        icon: 'error',
      });
      return;
    }

    if (!this.userData.voice) {
      console.error('demo: startVoice but no voice component');
      wx.showToast({
        title: '对讲组件尚未初始化',
        icon: 'error',
      });
      return;
    }

    this.userData.pusherInfoCount = 0;
    this.userData.voice.startVoice({
      needRecord,
    });
  },
  stopVoice() {
    console.log('demo: stopVoice in voiceState', this.data.voiceState);

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
  startIntercomPreview() {
    console.log('demo: startIntercomPreview');

    // 检查实例是否初始化成功
    if (!this.userData.intercom) {
      console.error('demo: startIntercomPreview but no intercom component');
      wx.showToast({
        title: '对讲组件尚未初始化',
        icon: 'error',
      });
      return;
    }

    if (!this.userData.intercom.startPreview) {
      console.error('demo: startIntercomPreview but not support');
      wx.showToast({
        title: '请升级插件版本',
        icon: 'error',
      });
      return;
    }

    // 预览，需要 xp2p 插件 4.1.4 以上
    this.userData.intercom.startPreview();
  },
  stopIntercomPreview() {
    console.log('demo: stopIntercomPreview');

    // 检查实例是否初始化成功
    if (!this.userData.intercom) {
      console.error('demo: stopIntercomPreview but no intercom component');
      return;
    }

    if (!this.userData.intercom.stopPreview) {
      console.error('demo: stopIntercomPreview but not support');
      wx.showToast({
        title: '请升级插件版本',
        icon: 'error',
      });
      return;
    }

    // 预览，需要 xp2p 插件 4.1.4 以上
    this.userData.intercom.stopPreview();
  },
  async startIntercomCall(e) {
    const needRecord = parseInt(e?.currentTarget?.dataset?.needRecord, 10) > 0;
    const customPusherType = e?.currentTarget?.dataset?.customPusher;
    console.log(`demo: startIntercomCall, needRecord ${needRecord}, customPusherType ${customPusherType}`);

    // 只要有一个player播放成功，就启动对讲
    const canStart = this.data.useChannelIds.length === 0 || this.hasSuccessPlayer();

    if (!canStart) {
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
      wx.showToast({
        title: '对讲组件尚未初始化',
        icon: 'error',
      });
      return;
    }

    // 用文件模拟推流，需要 xp2p 插件 4.1.4 以上
    this.userData.customPusher = null;
    if (customPusherType === 'header') {
      this.userData.customPusher = {
        start: ({ writer }) => {
          console.log('[MockPusher] start');
          writer.addChunk(mockFlvHeader);
        },
        stop: () => {
          console.log('[MockPusher] stop');
        },
      };
    } else if (customPusherType === 'file') {
      try {
        const res = await wx.chooseMessageFile({
          count: 1,
        });
        const file = res.tempFiles[0];
        console.log('demo: chooseMockFlv res', file);
        if (!file?.size) {
          console.error('demo: chooseMockFlv error, file empty');
          wx.showToast({
            title: '文件大小为空',
            icon: 'error',
          });
          return;
        }
        if (file.size < 1024) {
          console.error('demo: chooseMockFlv error, file too small');
          wx.showToast({
            title: '文件太小',
            icon: 'error',
          });
          return;
        }
        const customPusher = new CustomPusher({
          file,
          errorCallback: (err) => {
            if (this.userData.customPusher !== customPusher) {
              return;
            }
            console.error('demo: customPusher error', err);
            wx.showToast({
              title: 'customPusher出错，停止对讲',
              icon: 'error',
            });
            this.stopIntercomCall();
          },
        });
        this.userData.customPusher = customPusher;
      } catch (err) {
        console.error('demo: chooseMockFlv fail', err);
        return;
      }
    }

    // 开始对讲时默认用高码率
    console.log('demo: startIntercomCall, default high bitrate');
    this.userData.intercomBufferInfo = {
      bitrateType: 'high',
    };
    this.setData({
      intercomPusherProps: {
        ...this.data.intercomPusherProps,
        ...intercomBirateMap.high,
      },
    });

    this.userData.pusherInfoCount = 0;
    this.userData.intercom.setP2PWaterMark?.(this.userData.intercomP2PWaterMark);
    this.userData.intercom.setP2PEventCallback?.(this.onIntercomP2PEvent.bind(this));
    this.userData.intercom.intercomCall({
      needRecord,
      customPusher: this.userData.customPusher,
    });
  },
  stopIntercomCall() {
    console.log('demo: stopIntercomCall in intercomState', this.data.intercomState);

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
    this.clearIntercomBufferInfo();

    this.userData.intercom.intercomHangup();

    if (this.userData.customPusher) {
      this.userData.customPusher.destroy?.();
      this.userData.customPusher = null;
    }
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
  clearIntercomBufferInfo() {
    if (!this.userData.intercomBufferInfo) {
      return;
    }
    console.log('demo: clearIntercomBufferInfo');
    const { bitrateType, timer } = this.userData.intercomBufferInfo;
    this.userData.intercomBufferInfo = null;
    if (timer) {
      clearTimeout(timer);
    }
    if (bitrateType !== 'high') {
      this.setData({
        intercomPusherProps: {
          ...this.data.intercomPusherProps,
          ...intercomBirateMap.high,
        },
      });
    }
  },
  switchCamera() {
    if (!this.userData.livePusherContext) {
      console.error('demo: switchCamera but no livePusherContext');
      return;
    }
    if (!this.userData.livePusherContext.switchCamera) {
      console.error('demo: switchCamera but no livePusherContext.switchCamera');
      return;
    }
    console.log('demo: switchCamera');
    this.userData.livePusherContext.switchCamera({
      success: () => {
        console.log('demo: switchCamera success');
      },
      fail: (error) => {
        console.error('demo: switchCamera fail', error);
      },
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
  // 测试页面刷新
  startTestRender() {
    if (this.userData.testTimer) {
      return;
    }

    const now = Date.now();
    this.userData.startRenderTime = now;
    this.userData.lastRenderTime = now;

    let tmpDate = null;
    let totalSec = 0;
    this.userData.testTimer = setInterval(() => {
      tmpDate = new Date();
      totalSec = Math.round((tmpDate.getTime() - this.userData.startRenderTime) / 1000);
      this.setData({ testStr: `${toTimeMsString(tmpDate)}, last ${tmpDate.getTime() - this.userData.lastRenderTime}ms, total ${Math.floor(totalSec / 60)}m${totalSec % 60}s`});
      this.userData.lastRenderTime = tmpDate.getTime();
    }, 10000);

    this.setData({ testStr: toTimeMsString(new Date()) });
  },
  stopTestRender() {
    if (!this.userData.testTimer) {
      return;
    }

    this.userData.startRenderTime = 0;
    this.userData.lastRenderTime = 0;

    clearInterval(this.userData.testTimer);
    this.userData.testTimer = null;

    this.setData({ testStr: '' });
  },
});

import { STORE } from '../../../../lib/demo-storage-store';
import { isDevTool } from '../../../../utils';

// 覆盖 console
const app = getApp();
const oriConsole = app.console;
const console = app.logger || oriConsole;

let playerId = 1000;
const logPrefix = '[demo] [intercom-call] page:';
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
// 页面隐藏自动关闭对讲
const autoStopVoiceIfPageHide = true;

// 影响性能，需要调试时才打开
const intercomShowPusherInfo = true;

Page({
  data: {
    errMsg: '初始化 ing...',

    playerId: `intercom-call-player-${playerId}`,
    deviceInfo: {},
    needCheckStream: false,
    streamChannel: 0,
    innerStreamQuality: 'high',
    streamParams: '', // xxx=xxx&xxx=xxx
    mode: 'RTC',
    muted: false,
    acceptPlayerEvents: { statechange: true, netstatus: true },
    showLog: true,
    showDebugInfo: false,
    onlyp2pMap: { flv: isDevTool, mjpg: isDevTool },

    controlsId: `intercom-call-controls-${playerId}`,
    showIcons: true,
    iconSize: 30,
    qualityMap: {},
    quality: 'high',
    orientation: 'vertical',
    rotate: 0,
    fill: false,
    fullScreen: false,
    record: false,

    innerId: '',
    player: null,

    intercomId: `intercom-call-intercom-${playerId}`,
    intercomPusherProps: {
      enableCamera: true,
      enableMic: true,
      mode: 'RTC',
      orientation: 'vertical', // vertical / horizontal
      aspect: '3:4', // 3:4 / 9:16
      videoWidth: 480,
      videoHeight: 640,
      ...intercomBirateMap.high,
      disableCameraIfPageHide: autoStopVoiceIfPageHide,
      disableMicIfPageHide: autoStopVoiceIfPageHide,
      acceptPusherEvents: {
        netstatus: intercomShowPusherInfo,
      },
    },
    autoStopVoiceIfPageHide,

    // 组件实例
    instance: { player: null, intercom: null },

    // 发起呼叫
    initedFeedback: false,
    calling: 'idle', // idle | calling | sending
    callingTimer: null,
    errMsgTimer: null,
  },
  onLoad: function (options) {
    playerId++;
    console.log('intercom call page onLoad: ', { options, xp2pInfo: decodeURIComponent(options.xp2pInfo), xp2pManager: app.xp2pManager });
    const { deviceId } = options;
    const deviceInfo = STORE.getDeviceById(deviceId);

    if (deviceInfo) {
      this.setData({
        innerId: `intercom-call-inner-${playerId}-ch-${this.data.streamChannel}`,
        deviceInfo,
        errMsg: '',
      });
    } else {
      this.setErrMsg('设备信息格式化失败，请重试!');
    }

    // 获取到设备信息后才开始打洞连接
    this.preStartService();

    this.getComponents();

    setTimeout(() => {
      console.log('onload xp2pManager: ', app.xp2pManager);
    }, 1000);
  },
  onShow: function () {

  },
  onUnload() {
    this.removeFeedbackListener();
  },

  // 初始化后再获取组件实例
  getComponents() {
    console.log('demo: getComponents');

    const player = this.selectComponent(`#${this.data.playerId}`);
    console.log('demo: create player success', player);

    if (player) {
      const intercom = this.selectComponent(`#${this.data.intercomId}`);
      if (intercom) {
        console.log('demo: create intercom success', intercom);
        this.setData({ instance: { intercom, player } });
      } else {
        this.setData({ instance: { ...this.data.instance, player } });
        console.error('demo: create intercom error');
      }
    }
  },

  // ========== start 双向视频逻辑 ==========
  /**
   * ## 建立xp2p连接
   */
  async preStartService() {
    const { deviceId, productId, deviceName, xp2pInfo } = this.data.deviceInfo;
    const res = await app.xp2pManager.startP2PService({
      p2pMode: 'ipc',
      deviceInfo: { deviceId, productId, deviceName },
      xp2pInfo,
      caller: '[intercom-call-page]',
    });
    console.log(logPrefix, '[intercom-call-page] preStartService', res);

    this.addFeedbackListener();
  },

  /**
   * ## 发起呼叫
   */
  async call() {
    if (this.data.callingTimer && this.data.calling !== 'idle') {
      this.setErrMsg('正在呼叫中');
      return;
    };

    if (!this.data.instance.intercom) {
      this.setErrMsg('对讲组件尚未初始化完成');
      this.getComponents();
      return;
    }

    this.data.instance.intercom.startPreview();

    // 启动定时器
    // 打开呼叫等待页面
    this.setData({
      calling: 'calling',
      callingTimer: setTimeout(() => {
        wx.showToast({ title: '呼叫超时', icon: 'none' });
        clearTimeout(this.data.callingTimer);
        this.setData({ calling: 'idle', callingTimer: null });
        this.sendUserCommand('wx_call_timeout');
      }, 60_000),
    });

    // 监听 feedback 消息
    if (!this.data.initedFeedback) this.addFeedbackListener();

    if (!await this.sendUserCommand('wx_call_start')) {
      this.setErrMsg('发送呼叫信令失败，请重试!');
      return;
    };
    console.log(logPrefix, 'caller call', 'sent wx_call_start');

    // 结果处理:
    // - 收到 feedback 播放/挂断: 开始拉流和推流/挂断
    // - 没收到 feedback: 超时退出
  },
  async callerCanel() {
    clearTimeout(this.data.callingTimer);
    this.setData({ calling: 'idle', callingTimer: null });
    this.sendUserCommand('wx_call_cancel');
    if (this.data.instance.intercom) this.data.instance.intercom.intercomHangup();
  },

  callerHangup() {
    console.log(logPrefix, 'callerHangup', 'stop intercomCall push');
    this.clearErrMsg();
    this.setData({ calling: 'idle', callingTimer: null });
    this.sendUserCommand('wx_call_hangup');
    if (this.data.instance.intercom) this.data.instance.intercom.intercomHangup();
    clearTimeout(this.data.callingTimer);
  },

  /**
   * ## 监听设备的反馈消息
   * @param {{iv_private_cmd: string}} params
   * @returns
   */
  addFeedbackListener() {
    // 监听 feedback 消息
    const res = app.xp2pManager.addP2PServiceEventListener(
      this.data.deviceInfo.deviceId,
      // 'feedbackFromDevice',
      'serviceReceivePrivateCommand', // 这里走的内部信令，不是 feedbackFromDevice
      this.feedbackFromDevice.bind(this),
    );
    console.log(logPrefix, '[addFeedbackListener] result', res);
    this.setData({
      initedFeedback: res,
    });
  },
  removeFeedbackListener() {
    // 移除 feedback 消息监听
    app.xp2pManager.removeP2PServiceEventListener(
      this.data.deviceInfo.deviceId,
      'serviceReceivePrivateCommand',
      this.feedbackFromDevice.bind(this),
    );
    this.setData({ initedFeedback: false });
  },

  feedbackFromDevice(params) {
    console.log(logPrefix, '[addFeedbackListener] feedbackFromDevice', params);
    if (this.data.calling !== 'idle') {
      this.clearErrMsg();
      // 呼叫中 接收接听、超时和挂断的操作，其他的忽略
      switch (params?.iv_private_cmd) {
        // 接听
        case 'call_answer': {
          this.listenerAnswered();
          return;
        }

        // 呼叫超时
        case 'call_timeout': {
          wx.showToast({ title: '呼叫超时', icon: 'none' });
          break;
        }

        // 挂断
        case 'call_hang_up': {
          wx.showToast({ title: '对方已挂断', icon: 'none' });
          break;
        }

        // 拒绝接听
        case 'call_reject': {
          wx.showToast({ title: '已拒接', icon: 'none' });
          break;
        }

        // 忙线
        case 'call_busy': {
          wx.showToast({ title: '忙线中', icon: 'none' });
          break;
        }

        // 设备端取消
        case 'call_cancel': {
          wx.showToast({ title: '已取消', icon: 'none' });
          break;
        }
        default:
          break;
      }
      this.setData({ calling: 'idle' });
      if (this.data.instance.intercom) this.data.instance.intercom.intercomHangup();
    } else {
      // 没有在呼叫中的都忽略
    }
  },

  // 已接听，开始推流操作
  listenerAnswered() {
    console.log(logPrefix, 'listenerAnswered', 'start intercomCall push');
    this.data.instance.intercom.intercomCall();
    this.setIntercomUI();
    this.setData({ calling: 'sending' });
    this.clearErrMsg();
  },
  setIntercomUI() {
    // 修改为对讲 UI
  },
  closeIntercomUI() {
    // 修改为正常 UI
  },
  // ========== end 双向视频逻辑 ==========

  /**
   * ## 发送用户自定义命令
   * wx_call_start - 发起呼叫
   * wx_call_cancel - 取消呼叫
   * wx_call_hangup - 挂断
   * wx_call_timeout - 呼叫超时
   */
  async sendUserCommand(cmd) {
    const sendRes = await app
      .xp2pManager
      .sendCommand(this.data.deviceInfo.deviceId, `action=user_define&channel=0&cmd=${cmd}`)
      .then(() => 'success')
      .catch(e => console.error(e));
    console.log(logPrefix, 'sendUserCommand', cmd, sendRes);
    return sendRes;
  },

  onPlayerEvent({ type, detail }) {
    console.log(logPrefix, 'onPlayerEvent', type, detail);
  },
  onFullScreenChange({ type, detail }) {
    console.log(logPrefix, 'onFullScreenChange', type, detail);
  },
  onMjpgPlayerEvent({ type, detail }) {
    console.log(logPrefix, 'onMjpgPlayerEvent', type, detail);
  },
  onMjpgPlayStateEvent({ type, detail }) {
    console.log(logPrefix, 'onMjpgPlayStateEvent', type, detail);
  },
  onRecordStateChange({ type, detail }) {
    console.log(logPrefix, 'onRecordStateChange', type, detail);
  },
  onRecordFileStateChange({ type, detail }) {
    console.log(logPrefix, 'onRecordFileStateChange', type, detail);
  },

  // ========== iot-p2p-intercom ==========
  onIntercomEventChange({ detail }) {
    console.log(logPrefix, this.intercomId, 'onIntercomEventChange', detail);
  },
  onIntercomStateChange({ detail }) {
    console.log(logPrefix, this.intercomId, 'onIntercomStateChange', detail);
  },
  onIntercomProcess({ detail }) {
    console.log(logPrefix, this.intercomId, 'onIntercomProcess', detail);
  },
  onIntercomError({ detail }) {
    console.log(logPrefix, this.intercomId, 'onIntercomError', detail);
  },
  onIntercomPreviewChange({ detail }) {
    console.log(logPrefix, this.intercomId, 'onIntercomPreviewChange', detail);
  },
  onIntercomPreviewError({ detail }) {
    console.log(logPrefix, this.intercomId, 'onIntercomPreviewError', detail);
  },
  onIntercomLivePusherContextChange({ detail }) {
    console.log(logPrefix, this.intercomId, 'onIntercomLivePusherContextChange', detail);
  },
  onIntercomSystemPermissionError({ detail }) {
    console.log(logPrefix, this.intercomId, 'onIntercomSystemPermissionError', detail);
  },
  onIntercomLivePusherNetStatus({ detail }) {
    console.log(logPrefix, this.intercomId, 'onIntercomLivePusherNetStatus', detail);
  },

  // ========== 其他 ==========
  toggleDebugInfo() {
    console.log('demo: toggleDebugInfo');
    this.setData({ showDebugInfo: !this.data.showDebugInfo });
  },
  clickControlIcon({ detail }) {
    const { name } = detail;
    console.log('demo: clickControlIcon', name);
  },
  setErrMsg(msg) {
    if (this.data.errMsgTimer) clearTimeout(this.data.errMsgTimer);
    const errMsgTimer = setTimeout(() => {
      this.setData({ errMsg: '' });
      clearTimeout(errMsgTimer);
      this.setData({ errMsgTimer: null });
    }, 3000);
    this.setData({ errMsg: msg, errMsgTimer });
  },
  clearErrMsg() {
    if (this.data.errMsgTimer) clearTimeout(this.data.errMsgTimer);
    this.setData({ errMsg: '', errMsgTimer: null });
  },
});

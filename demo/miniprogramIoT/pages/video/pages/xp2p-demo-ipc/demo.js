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

Page({
  data: {
    // 这是onLoad时就固定的
    cfg: '',
    loadErrMsg: '',

    // 设备信息，在input组件里填
    targetId: '',
    deviceInfo: null,
    p2pMode: '',
    sceneType: '',
    xp2pInfo: '',
    liveStreamDomain: '',
    onlyp2pMap: {
      flv: isDevTool,
      mjpg: isDevTool,
    },
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

    // 双向音视频
    intercomId: 'iot-p2p-intercom',
    // 对讲
    voiceId: 'iot-p2p-voice',
    voiceState: '',
    pusherProps: {
      voiceChangerType: 0,
    },
    intercomPusherProps: {
      enableCamera: true,
      enableMic: true,
      videoWidth: 360,
      videoHeight: 480,
    },
    voiceChangerTypes: [
      { value: 0, label: '关闭' },
      { value: 1, label: '熊孩子' },
      { value: 2, label: '萝莉' },
      { value: 3, label: '大叔' },
    ],

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

    // 对讲方式
    intercomType: 'voice', // 'voice' | 'video'

    // 双向音视频
    stateList: [],
    eventList: [],
    intercomState: '',
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
      voice: null,
      needFixSoundMode: false,
      releasePTZTimer: null,
      players: [],
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
  },
  onUnload() {
    console.log('demo: onUnload');
    this.hasExited = true;

    // 停止对讲
    if (this.userData.voice && this.data.voiceState !== 'VoiceIdle') {
      this.stopVoice();
    }

    // 停止PTZ
    if (this.data.ptzCmd || this.userData.releasePTZTimer) {
      this.controlPTZ('ptz_release_pre');
    }

    // 断开连接
    if (this.userData.deviceId) {
      console.log('demo: stopP2PService', this.userData.deviceId);
      xp2pManager.stopP2PService(this.userData.deviceId, this.userData.pageId);
      this.userData.deviceId = '';
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

    console.log('demo: set deviceInfo', detail.deviceInfo);

    this.setData({
      ...detail,
      muted: detail.options.playerMuted,
      intercomType: detail.options.intercomType || 'voice',
      ...(detail.options.intercomType === 'video' ? {
        'pusherProps.enableCamera': true,
        'pusherProps.enableMic': true,
        'pusherProps.videoWidth': 360,
        'pusherProps.videoHeight': 480,
      } : {
        'pusherProps.enableCamera': false, // 关闭摄像头,默认值 false
        'pusherProps.enableMic': true, // 开启麦克风,默认值 true
        'pusherProps.videoWidth': 0, // 视频宽度,默认值 0
        'pusherProps.videoHeight': 0, // 视频高度,默认值 0
      }),
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

    const intercom = this.selectComponent(`#${this.data.intercomId}`);
    if (intercom) {
      console.log('demo: create intercom success');
      oriConsole.log('demo: intercom', intercom);
      this.userData.intercom = intercom;
      this.setData({
        intercomState: 'intercomIdle',
      });
    } else {
      console.error('demo: create intercom error');
    }

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

    const players = [];

    this.data.useChannelIds.forEach((id) => {
      const player = this.selectComponent(`#p2p-live-player-${id}`);

      if (player) {
        players.push(player);
      }
    });

    this.userData.players = players;
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
  // voice事件
  onVoiceStateChange({ detail }) {
    console.log('demo: onVoiceStateChange', detail);
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
          wx.nextTick(() => {
            this.setData({
              soundMode: 'speaker',
            });
          });
        }
        break;
    }
  },
  // feedback 事件通知
  onFeedbackFromDevice() {
    xp2pManager.addP2PServiceEventListener(
      this.userData.deviceId,
      'feedbackFromDevice',
      (body) => {
        console.log('demo: FEEDBACK_FROM_DEVICE', body);
      },
    );
  },
  // 双向音视频事件通知
  onIntercomEventChange({ detail }) {
    console.log('demo: onIntercomEventChange: ', { detail });
    this.setData({
      eventList: [...this.data.eventList, detail.event],
    });
    let tips = '';
    const isCalling = ['calling', 'Sending'].includes(this.data.intercomState);
    switch (detail.event) {
      // 插件自身事件
      case 'IntercomError': {
        tips = '呼叫异常';
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
    if (tips) wx.showToast({ title: tips });
  },
  onIntercomStateChange({ detail }) {
    console.log('demo: onIntercomStateChange: ', { detail });
    this.setData({
      stateList: [...this.data.stateList, detail.state],
      intercomState: detail.state,
    });
    wx.showToast({
      title: detail,
      icon: 'none',
    });
  },
  onVoiceError({ type, detail }) {
    this.onVoiceProcess({ type, detail });

    console.error('demo: onVoiceError', detail);
    wx.showToast({
      title: detail.errMsg || '启动对讲失败',
      icon: 'none',
    });
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
  // 开关视频对讲 麦克风
  toggleMic() {
    this.setData({ 'intercomPusherProps.enableMic': !intercomPusherProps.enableMic });
  },
  // 开关视频对讲 摄像头
  toggleCamera() {
    this.setData({ 'intercomPusherProps.enableCamera': !intercomPusherProps.enableCamera });
  },
  startIntercomCall(e) {
    const needRecord = parseInt(e?.currentTarget?.dataset?.needRecord, 10) > 0;
    console.log('demo: startIntercomCall, needRecord', needRecord);

    // 只要有一个player播放成功，就启动对讲
    const successPlayer = (this.userData.players || []).find(player => !!player.isPlaySuccess());

    console.log('开启双向音视频对讲：', e);
    if (!successPlayer) {
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

    this.userData.intercom.intercomCall({
      needRecord,
    });
  },
  stopIntercomCall() {
    console.log('demo: stopIntercomCall');
    this.setData({ stateList: [], eventList: [], intercomState: 'Ready2Call' });

    if (!this.userData.intercom) {
      console.error('demo: stopIntercomCall but no intercom component');
      return;
    }

    this.userData.intercom.intercomHangup();
  },
  startVoice(e) {
    const needRecord = parseInt(e?.currentTarget?.dataset?.needRecord, 10) > 0;
    console.log('demo: startVoice, needRecord', needRecord);

    // 只要有一个player播放成功，就启动对讲
    const successPlayer = (this.userData.players || []).find(player => !!player.isPlaySuccess());

    if (!successPlayer) {
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

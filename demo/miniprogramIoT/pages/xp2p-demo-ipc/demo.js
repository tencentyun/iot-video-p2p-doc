import { getXp2pManager } from '../../lib/xp2pManager';

// 覆盖 console
const app = getApp();
const oriConsole = app.console;
const console = app.logger || oriConsole;

let xp2pManager;

const qualityList = [
  { value: 'standard', text: '标清' },
  { value: 'high', text: '高清' },
];
const qualityMap = {};
qualityList.forEach(({ value, text}) => {
  qualityMap[value] = text;
});

const pageName = 'demo-page-ipc';
let pageSeq = 0;

Page({
  data: {
    // 这是onLoad时就固定的
    cfg: '',

    // 这些是控制player和p2p的
    playerId: 'iot-p2p-player',

    // 设备信息，在input组件里填
    targetId: '',
    deviceInfo: null,
    p2pMode: '',
    sceneType: '',
    xp2pInfo: '',
    liveStreamDomain: '',

    // 有的设备需要先发初始化信令
    initCommand: '',
    initState: '',

    // 清晰度
    streamQuality: '',
    qualityMap,

    // 播放器控制
    muted: false,
    orientation: 'vertical',
    rotate: 0,
    fullScreen: false,
    fullScreenInfo: null,

    // 修复对讲后 live-player 声音变小的问题
    soundMode: 'speaker',

    // 要接收的事件，组件只会抛出设置过的，以免log太多
    acceptPlayerEvents: {
      statechange: true,
      // netstatus: true,
      // mjpgnetstatus: true,
    },

    // 控件icon
    controlsId: 'controls',
    iconSize: 25,
    showIcons: {
      quality: true,
      muted: true,
      orientation: false, // 视频流设备才支持，拿到 deviceInfo 后修改
      rotate: false, // 图片流设备才支持，拿到 deviceInfo 后修改
      fullScreen: true,
      snapshot: true,
    },

    // 播放错误
    isPlayError: false,

    // 调试
    showLog: true,
    showDebugInfo: false,

    // 对讲
    voiceId: 'iot-p2p-voice',
    voiceState: '',

    // PTZ
    ptzBtns: [
      { name: 'up', cmd: 'ptz_up_press' },
      { name: 'down', cmd: 'ptz_down_press' },
      { name: 'left', cmd: 'ptz_left_press' },
      { name: 'right', cmd: 'ptz_right_press' },
    ],
    ptzCmd: '',
    releasePTZTimer: null,
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
      player: null,
      voice: null,
      needFixSoundMode: false,
      releasePTZTimer: null,
    };

    console.log('demo: checkReset when enter');
    xp2pManager.checkReset();

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
      })
      .catch((err) => {
        // 只是提前连接，不用特别处理
        console.error('demo: startP2PService err', err);
      });

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

    console.log('demo: set deviceInfo', detail.deviceInfo);
    this.setData({
      ...detail,
      showIcons,
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
                console.log('demo: sendInitCommand err', err);
                this.setData({ initState: 'commandError' });
              });
          })
          .catch((_err) => {
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
    const player = this.selectComponent(`#${this.data.playerId}`);
    if (player) {
      console.log('demo: create player success');
      oriConsole.log('demo: player', player); // console 被覆盖了会写logger影响性能，查看组件用 oriConsole
      this.userData.player = player;
    } else {
      console.error('demo: create player error');
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
    const controls = this.selectComponent(`#${this.data.controlsId}`);
    if (controls) {
      console.log('demo: create controls success');
      oriConsole.log('demo: controls', controls);
    } else {
      console.error('demo: create controls error');
    }
  },
  // player事件
  onPlayerEvent({ type, detail }) {
    console.log('demo: onPlayerEvent', type, detail);
  },
  onPlayStateEvent({ type, detail }) {
    console.log('demo: onPlayStateEvent', type, detail);

    const isPlayError = type === 'playerror';
    if (isPlayError === this.data.isPlayError) {
      return;
    }
    this.setData({
      isPlayError,
    });
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
    const { fullScreen, ...others } = detail;
    this.setData({
      fullScreen: detail.fullScreen,
      fullScreenInfo: detail.fullScreen ? others : null,
    });
  },
  onMjpgPlayerEvent({ type, detail }) {
    console.log('demo: onMjpgPlayerEvent', type, detail);
  },
  onMjpgPlayStateEvent({ type, detail }) {
    console.log('demo: onMjpgPlayStateEvent', type, detail);
  },
  // player控制
  clickControlIcon({ detail }) {
    const { name } = detail;
    console.log('demo: clickControlIcon', name);
    switch (name) {
      case 'quality':
        this.changeQuality();
        break;
      case 'muted':
        this.changeMuted();
        break;
      case 'orientation':
        this.changeOrientation();
        break;
      case 'rotate':
        this.changeRotate();
        break;
      case 'fullScreen':
        this.changeFullScreen();
        break;
      case 'snapshot':
        this.snapshotAndSave();
        break;
    }
  },
  changeQuality() {
    wx.showActionSheet({
      itemList: qualityList.map(item => item.text),
      success: ({ tapIndex }) => {
        const item = qualityList[tapIndex];
        if (item.value === this.data.streamQuality) {
          return;
        }
        console.log('demo: changeQuality', item.value);
        this.setData({ streamQuality: item.value });
      },
    });
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
  changeRotate() {
    console.log('demo: changeRotate');
    this.setData({
      rotate: (this.data.rotate + 90) % 360,
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
  retryPlayer() {
    console.log('demo: retryPlayer');
    if (!this.userData.player) {
      console.error('demo: retryPlayer but no player component');
      return;
    }
    this.userData.player.retry();
  },
  toggleDebugInfo() {
    console.log('demo: toggleDebugInfo');
    this.setData({ showDebugInfo: !this.data.showDebugInfo });
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
  startVoice(e) {
    const needRecord = parseInt(e?.currentTarget?.dataset?.needRecord, 10) > 0;
    console.log('demo: startVoice, needRecord', needRecord);

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
});

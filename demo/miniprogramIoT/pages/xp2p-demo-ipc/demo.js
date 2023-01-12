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

    // 清晰度
    streamQuality: '',
    qualityMap,

    // 播放器控制
    iconSize: 25,
    muted: false,
    orientation: 'vertical',
    fullScreen: false,

    // 播放错误
    isPlayError: false,

    // 调试
    showLog: true,
    showDebugInfo: false,

    // 对讲
    voiceId: 'iot-voice',
    voiceState: '',
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
      player: null,
      voice: null,
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
    if (this.data.voiceState !== 'VoiceIdle') {
      this.stopVoice();
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
    xp2pManager.startP2PService({
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

    console.log('demo: create components');
    this.setData(detail, () => {
      const player = this.selectComponent(`#${this.data.playerId}`);
      if (player) {
        console.log('demo: create player success');
        this.userData.player = player;
      } else {
        console.error('demo: create player error');
      }
      const voice = this.selectComponent(`#${this.data.voiceId}`);
      if (voice) {
        console.log('demo: create voice success');
        this.userData.voice = voice;
        this.setData({
          voiceState: 'VoiceIdle',
        });
      } else {
        console.error('demo: create voice error');
      }
    });
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
    this.setData({ fullScreen: detail.fullScreen });
  },
  onMjpgPlayerEvent({ type, detail }) {
    console.log('demo: onMjpgPlayerEvent', type, detail);
  },
  onMjpgPlayStateEvent({ type, detail }) {
    console.log('demo: onMjpgPlayStateEvent', type, detail);
  },
  // player控制
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
});
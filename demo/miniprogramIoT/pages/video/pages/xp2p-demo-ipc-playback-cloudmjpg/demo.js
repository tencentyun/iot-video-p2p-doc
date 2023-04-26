import { presetDevices } from '../../../../config/config';
import { toTimeString, toDateTimeString } from '../../../../utils';

// 覆盖 console
const app = getApp();
const oriConsole = app.console;
const console = app.logger || oriConsole;

const pageName = 'demo-page-ipc-playback-cloudmjpg';
let pageSeq = 0;

Page({
  data: {
    // 这是onLoad时就固定的
    cfg: '',

    // 这些是控制player和p2p的
    playerId: 'iot-cloud-player',

    // 设备信息，在input组件里填
    targetId: '',
    deviceInfo: null,

    // 录像信息
    videoInfo: null,

    // 播放器控制
    muted: false,
    rotate: 0,
    fill: false,

    // 控件icon
    controlsId: 'controls',
    iconSize: 25,
    showIcons: {
      muted: true,
      rotate: true,
      fill: true,
      snapshot: true,
    },

    // 调试
    showLog: true,
    showDebugInfo: false,

    // 录像列表
    recordVideos: null,

    // 回放状态
    currentVideo: null, // 注意data、userData里都有
    isPlaying: false, // 播放器状态，不一定播放成功
    isPaused: false,
    isPlayError: false,
    currentSecStr: '',
  },
  onLoad(query) {
    pageSeq++;
    const pageId = `${pageName}-${pageSeq}`;
    console.log('demo: onLoad', pageId, query);

    this.userData = {
      pageId,
      deviceId: '',
      player: null,
      currentVideo: null,
      playState: null, // { currentTime: number }
    };

    const cfg = query.cfg || '';
    this.setData({
      cfg,
      deviceMsg: 'loading...',
    });

    const cfgData = cfg && presetDevices[cfg];
    if (!cfgData) {
      this.setData({
        deviceMsg: 'no cfgData',
      });
      return null;
    }

    const detail = {
      targetId: cfg,
      deviceInfo: {
        deviceId: `${cfgData.productId}/${cfgData.deviceName}`,
        productId: cfgData.productId,
        deviceName: cfgData.deviceName,
        isMjpgDevice: cfgData.isMjpgDevice,
      },
      cloudRecords: cfgData.cloudRecords,
    };
    this.onStartPlayer({ detail });
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

    console.log('demo: onUnload end');
  },
  onStartPlayer({ detail }) {
    console.log('demo: onStartPlayer', detail);
    if (!detail.deviceInfo.isMjpgDevice) {
      // info 不匹配
      console.log('demo: info error');
      this.setData({
        targetId: detail.targetId,
        deviceInfo: detail.deviceInfo,
      });
      return;
    }

    this.userData.deviceId = detail.deviceInfo.deviceId;

    const recordVideos = (detail.cloudRecords || []).map(item => ({
      duration: item.endTime - item.startTime,
      text: `${toDateTimeString(new Date(item.startTime * 1000))} - ${toDateTimeString(new Date(item.endTime * 1000))}`,
      ...item,
    }));

    console.log('demo: create components');
    this.setData({
      ...detail,
      recordVideos,
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
      case 'playsuccess': // 成功
        this.setData({
          isPlaying: true,
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
          isPaused: false,
          isPlayError: false,
        });
        break;
      case 'playerror': // 出错
        this.setData({
          isPlaying: false,
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
  onTimeUpdate({ detail }) {
    if (!this.userData.currentVideo) {
      return;
    }
    // 录像内播放时长
    this.userData.playState.currentTime = detail.currentTime;
    // 转换成时间点
    const currentSec = this.userData.currentVideo.startTime + Math.round(detail.currentTime);
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
      case 'rotate':
        this.changeRotate();
        break;
      case 'fill':
        this.changeFill();
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
  changeRotate() {
    console.log('demo: changeRotate');
    this.setData({
      rotate: (this.data.rotate + 90) % 360,
    });
  },
  changeFill() {
    console.log('demo: changeFill');
    this.setData({
      fill: !this.data.fill,
    });
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
      isPlaying: false,
      isPaused: false,
      isPlayError: false,
      currentSecStr: '',
      // 不直接设为video，因为字段名可能不一样
      videoInfo: {
        startTime: video.startTime,
        endTime: video.endTime,
        mjpgSrc: video.mjpgSrc,
        audioSrc: video.audioSrc,
      },
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
      isPlaying: false,
      isPaused: false,
      isPlayError: false,
      currentSecStr: '',
      // 传给组件的
      videoInfo: null,
    });
  },
});

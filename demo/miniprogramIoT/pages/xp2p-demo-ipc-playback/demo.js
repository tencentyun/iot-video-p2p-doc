import { pad, toMonthString, toDateTimeString, toTimeString } from '../../utils';
import { getXp2pManager } from '../../lib/xp2pManager';

// 覆盖 console
const app = getApp();
const oriConsole = app.console;
const console = app.logger || oriConsole;

let xp2pManager;

const pageName = 'demo-page-ipc-playback';
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

    // 回放参数
    streamParams: '',

    // 播放器控制
    iconSize: 25,
    muted: false,
    orientation: 'vertical',
    fullScreen: false,

    // 调试
    showLog: true,
    showDebugInfo: false,

    // 回放日期
    calendarMonth: toMonthString(new Date()),
    validDates: null,

    recordDate: '',
    recordVideos: null,

    // 回放状态
    showTogglePlayIcon: false,
    isPlaying: false, // 播放器状态，不一定播放成功
    currentSecStr: '',
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
      currentVideo: null,
      playState: null, // { supportProgress: boolean; currentTime: number }
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

    // 监控页关掉player就好，不用销毁 p2p 模块
    if (this.userData.player) {
      console.log('demo: player.stopAll');
      this.userData.player.stopAll();
      this.userData.player = null;
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
    try {
      xp2pManager.startP2PService({
        p2pMode: detail.p2pMode,
        deviceInfo: detail.deviceInfo,
        xp2pInfo: detail.xp2pInfo,
        caller: this.userData.pageId,
      })
        .then((res) => {
          console.log('demo: startP2PService res', res);
          if (res !== 0) {
            return;
          }
          this.getRecordDatesInMonth();
        })
        .catch(() => undefined); // 只是提前连接，不用处理错误
    } catch (err) {
      console.error('demo: startP2PService err', err);
    }

    console.log('demo: create components');
    this.setData(detail, () => {
      const player = this.selectComponent(`#${this.data.playerId}`);
      if (player) {
        console.log('demo: create player success');
        this.userData.player = player;
      } else {
        console.error('demo: create player error');
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
      case 'playresume': // 续播
        this.setData({
          isPlaying: true,
        });
        break;
      case 'playpause': // 暂停
      case 'playstop': // 停止
      case 'playend': // 结束
      case 'playerror': // 出错
        this.setData({
          isPlaying: false,
        });
        break;
    }
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
    console.log('demo: togglePlay');
    if (!this.userData.player) {
      console.error('demo: togglePlay but no player component');
      return;
    }
    if (this.data.isPlaying) {
      this.userData.player.pause();
    } else {
      this.userData.player.resume();
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
    const res = await xp2pManager.getRecordDatesInMonth(
      this.userData.deviceId,
      { month: this.data.calendarMonth },
    );
    console.log('demo: getRecordDatesInMonth res', res);
    this.setData({
      validDates: res.date_list.map(date => ({ month: res.month, date })),
    });
  },
  async getRecordVideosInDate() {
    if (!this.data.recordDate) {
      return;
    }
    console.log('demo: getRecordVideosInDate', this.userData.deviceId, this.data.recordDate);
    const res = await xp2pManager.getRecordVideosInDate(
      this.userData.deviceId,
      { date: this.data.recordDate },
    );
    console.log('demo: getRecordVideosInDate res', res);
    const nextDateSec = new Date(this.data.recordDate.replace(/-/g, '/')).getTime() / 1000 + 3600 * 24;
    const getTimeStr = (time) => {
      if (time < nextDateSec) {
        return toTimeString(new Date(time * 1000));
      }
      return toDateTimeString(new Date(time * 1000));
    };
    this.setData({
      recordVideos: res.video_list.map(item => ({
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
    }, () => {
      this.getRecordVideosInDate();
    });
  },
  changeVideo({ currentTarget: { dataset } }) {
    const video = this.data.recordVideos[dataset.index];
    console.log('demo: changeVideo', video);
    this.userData.currentVideo = video;
    this.userData.playState = {};
    this.setData({
      streamParams: `start_time=${video.start_time}&end_time=${video.end_time}`,
    });
  },
});

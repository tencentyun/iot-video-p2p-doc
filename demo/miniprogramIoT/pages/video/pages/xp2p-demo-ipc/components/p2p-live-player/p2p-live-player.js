// import { removeFileByPath } from '../../../../../../lib/recordManager';
import { CustomParser } from '../../../../lib/customParser';

const qualityList = [
  { value: 'standard', text: '标清' },
  { value: 'high', text: '高清' },
];
const qualityMap = {};

qualityList.forEach(({ value, text }) => {
  qualityMap[value] = text;
});

// 处理流数据
const needParseStreamData = false;

// 录制flv配置
const recordFlvOptions = {
  maxFileSize: 100 * 1024 * 1024, // 单个flv文件的最大字节数，默认 100 * 1024 * 1024
  needAutoStartNextIfFull: false, // 当文件大小达到 maxFileSize 时，是否自动开始下一个文件，但是中间可能会丢失一部分数据，默认 false
  needSaveToAlbum: true, // 是否保存到相册，设为 true 时插件内实现转mp4再保存，默认 false
  showLog: true,
};

// 覆盖 console
const app = getApp();
const oriConsole = app.console;
const console = app.logger || oriConsole;

Component({
  behaviors: ['wx://component-export'],
  options: {
    styleIsolation: 'apply-shared',
    multipleSlots: true,
  },
  properties: {
    compClass: String,
    deviceInfo: {
      type: Object,
      value: {
        deviceId: '',
        productId: '',
        deviceName: '',
        isMjpgDevice: false,
      },
    },
    xp2pInfo: {
      type: String,
      value: '',
    },
    liveStreamDomain: {
      type: String,
      value: '',
    },
    needCheckStream: {
      type: Boolean,
      value: false,
    },
    sceneType: {
      type: String,
      value: 'live',
    },
    streamChannel: {
      type: Number,
      value: 0,
    },
    streamQuality: {
      type: String,
      value: 'high',
    },
    streamParams: {
      type: String,
      value: '',
    },
    mode: {
      type: String,
      value: 'RTC',
    },
    soundMode: {
      type: String,
      value: 'speaker',
    },
    muted: {
      type: Boolean,
      value: false,
    },
    acceptPlayerEvents: {
      type: Object,
      value: {},
    },
    onlyp2pMap: Object,
    showLog: {
      type: Boolean,
      value: false,
    },
  },
  data: {
    playerId: 'iot-p2p-player',

    // 播放状态
    isPlaying: false, // 播放器状态，不一定播放成功
    isPlaySuccess: false, // 播放成功后才能对讲
    isPlayError: false,

    // 清晰度
    innerStreamQuality: '',
    qualityMap,

    // 播放器控制
    // muted: false, // 支持 properties 控制
    orientation: 'vertical',
    rotate: 0,
    fill: false,

    // 全屏
    fullScreen: false,
    fullScreenInfo: null,

    // 录制
    record: false,

    // 调试
    showDebugInfo: false,

    // 控件
    controlsId: 'controls',
    iconSize: 25,
    showIcons: {
      quality: true,
      muted: true,
      orientation: false, // 视频流设备才支持，拿到 deviceInfo 后修改
      rotate: false, // 图片流设备才支持，拿到 deviceInfo 后修改
      fill: true,
      fullScreen: true,
      snapshot: true,
      record: true,
    },
  },
  lifetimes: {
    created() {
      this.userData = {
        innerId: 'p2p-live-player',
        player: null,
      };
    },
    attached() {
      const { showIcons } = this.data;

      if (this.properties.deviceInfo.isMjpgDevice) {
        // 图片流设备
        showIcons.orientation = false;
        showIcons.rotate = true;
      } else {
        // 视频流设备
        showIcons.orientation = true;
        showIcons.rotate = false;
      }

      this.userData.innerId += `.ch-${this.properties.streamChannel}`;
      this.setData({
        innerStreamQuality: this.properties.streamQuality,
        showIcons,
      });
    },
    ready() {
      this.getComponents();
    },
  },
  export() {
    return this.getExport();
  },
  methods: {
    // 获取组件实例
    getComponents() {
      console.log(this.userData.innerId, 'create components');

      const player = this.selectComponent(`#${this.data.playerId}`);
      if (player) {
        console.log(this.userData.innerId, 'create player success');
        oriConsole.log(this.userData.innerId, 'player', player); // console 被覆盖了会写logger影响性能，查看组件用 oriConsole
        this.userData.player = player;

        // 如果要处理流数据，需要在播放前设置自定义解析器
        if (needParseStreamData && this.userData.player.setCustomParser) {
          console.log(this.userData.innerId, 'setCustomParser');
          this.userData.customParser = new CustomParser();
          this.userData.player.setCustomParser(this.userData.customParser);
        }
      } else {
        console.error(this.userData.innerId, 'create player error');
      }

      const controls = this.selectComponent(`#${this.data.controlsId}`);
      if (controls) {
        console.log(this.userData.innerId, 'create controls success');
        oriConsole.log(this.userData.innerId, 'controls', controls);
      } else {
        console.error(this.userData.innerId, 'create controls error');
      }
    },

    // player事件
    onPlayerEvent({ type, detail }) {
      console.log(this.userData.innerId, 'onPlayerEvent', type, detail);
    },
    onPlayStateEvent({ type, detail }) {
      console.log(this.userData.innerId, 'onPlayStateEvent', type, detail);
      let playState;
      switch (type) {
        case 'playstart':
          playState = {
            isPlaying: true,
            isPlaySuccess: false,
            isPlayError: false,
          };
          break;
        case 'playsuccess':
          playState = {
            isPlaying: true,
            isPlaySuccess: true,
            isPlayError: false,
          };
          break;
        case 'playstop':
        case 'playend':
          playState = {
            isPlaying: false,
            isPlaySuccess: false,
            isPlayError: false,
          };
          break;
        case 'playerror':
          playState = {
            isPlaying: false,
            isPlaySuccess: false,
            isPlayError: true,
          };
          break;
      }
      if (playState) {
        this.setData(playState);
        this.triggerEvent('playstatechagne', { type, playState });
      }
    },
    onPlayError({ type, detail }) {
      this.onPlayStateEvent({ type, detail });

      console.error(this.userData.innerId, 'onPlayError', detail);
      const { errMsg, errDetail } = detail;
      wx.showModal({
        content: `${errMsg || '播放失败'}\n${(errDetail && errDetail.msg) || ''}`, // 换行在开发者工具中无效，真机正常
        showCancel: false,
      });
    },
    onFullScreenChange({ type, detail }) {
      console.log(this.userData.innerId, 'onFullScreenChange', detail);
      const { fullScreen, ...others } = detail;
      this.setData({
        fullScreen: detail.fullScreen,
        fullScreenInfo: detail.fullScreen ? others : null,
      });
      this.triggerEvent(type, detail);
    },
    onMjpgPlayerEvent({ type, detail }) {
      console.log(this.userData.innerId, 'onMjpgPlayerEvent', type, detail);
    },
    onMjpgPlayStateEvent({ type, detail }) {
      console.log(this.userData.innerId, 'onMjpgPlayStateEvent', type, detail);
    },
    onRecordStateChange({ detail }) {
      console.log(this.userData.innerId, 'onRecordStateChange', detail);
      this.setData({
        record: detail.record,
      });
    },
    onRecordFileStateChange({ detail }) {
      /*
        detail: {
          fileName: string;
          state: string; // Start / Write / WriteSuccess / Extract / Export / Save / SaveSuccess / Error;
          filePath?: string;
          fileSize?: number;
          errType?: string; // fileEmpty / writeError / extractError / exportError / saveError
          errMsg?: string;
        }
      */
      console.log(this.userData.innerId, 'onRecordFileStateChange', detail);
      switch (detail.state) {
        case 'Extract':
          // 如果文件较大，转码时间会比较长，显示loading
          if (detail.fileSize > 10 * 1024 * 1024) {
            wx.showLoading({ title: '正在转码...' });
          }
          break;
        case 'Save':
          wx.hideLoading();
          break;
        case 'SaveSuccess':
          wx.showToast({
            title: '录像已保存到相册',
            icon: 'success',
          });
          break;
        case 'Error':
          // 要保存到相册时，保存成功会自动删除flv文件，出错时不自动删除，可以在flv管理页里查看和删除文件
          // 如果不需要管理出错的文件，需要自行删除，以免占用空间导致后续录像失败
          // removeFileByPath(detail.filePath);
          if (detail.errType === 'saveError' && /cancel/.test(detail.errMsg)) {
            // 用户取消保存，不用提示
            return;
          }
          console.error(this.userData.innerId, 'onRecordFileError', detail);
          wx.showModal({
            title: '录像出错',
            content: `${detail.fileName}\n${detail.errType}: ${detail.errMsg || ''}`,
            showCancel: false,
          });
          break;
      }
    },
    toggleDebugInfo() {
      console.log(this.userData.innerId, 'toggleDebugInfo');
      this.setData({ showDebugInfo: !this.data.showDebugInfo });
    },

    // player控制
    clickControlIcon({ detail }) {
      const { name } = detail;
      console.log(this.userData.innerId, 'clickControlIcon', name);
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
        case 'fill':
          this.changeFill();
          break;
        case 'fullScreen':
          this.changeFullScreen();
          break;
        case 'snapshot':
          // this.snapshotAndSave();
          this.snapshotAndSaveCustom();
          break;
        case 'record':
          this.changeRecord();
          break;
      }
    },
    changeQuality() {
      wx.showActionSheet({
        itemList: qualityList.map(item => item.text),
        success: ({ tapIndex }) => {
          const item = qualityList[tapIndex];
          if (item.value === this.data.innerStreamQuality) {
            return;
          }
          console.log(this.userData.innerId, 'changeQuality', item.value);
          this.setData({ innerStreamQuality: item.value });
        },
      });
    },
    changeMuted() {
      const newVal = !this.data.muted;
      console.log(this.userData.innerId, 'changeMuted', newVal);
      this.setData({
        muted: newVal,
      });
    },
    changeOrientation() {
      const newVal = this.data.orientation === 'horizontal' ? 'vertical' : 'horizontal';
      console.log(this.userData.innerId, 'changeOrientation', newVal);
      this.setData({
        orientation: newVal,
      });
    },
    changeRotate() {
      const newVal = (this.data.rotate + 90) % 360;
      console.log(this.userData.innerId, 'changeRotate', newVal);
      this.setData({
        rotate: newVal,
      });
    },
    changeFill() {
      const newVal = !this.data.fill;
      console.log(this.userData.innerId, 'changeFill', newVal);
      this.setData({
        fill: newVal,
      });
    },
    async changeFullScreen() {
      const newVal = !this.data.fullScreen;
      console.log(this.userData.innerId, 'changeFullScreen', newVal);
      if (!this.userData.player) {
        console.error(this.userData.innerId, 'changeFullScreen but no player component');
        return;
      }
      if (newVal) {
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
    snapshotAndSave(params) {
      console.log(this.userData.innerId, 'snapshotAndSave', params);
      if (!this.userData.player) {
        console.error(this.userData.innerId, 'snapshotAndSave but no player component');
        return;
      }
      return this.userData.player.snapshotAndSave(params);
    },
    async snapshotAndSaveCustom() {
      const promise = this.snapshotAndSave({ showResult: false });
      if (!promise) {
        // 4.1.2 才支持自定义提示并返回 Promise
        return;
      }
      try {
        await promise;
        wx.showToast({
          title: '截图已保存到相册',
          icon: 'success',
        });
      } catch (err) {
        /*
          err: {
            errType: string; // snapshotError / saveAuthError / saveError / timeout
            errDetail?: { errMsg: string };
          }
        */
        console.error(this.userData.innerId, 'snapshotAndSaveCustom error', err);
        if (err.errType === 'saveAuthError') {
          wx.showModal({ showCancel: false, title: '截图失败', content: '请授权小程序访问相册' });
        } else {
          wx.showToast({
            title: '截图失败',
            icon: 'error',
          });
        }
      }
    },
    changeRecord() {
      const newVal = !this.data.record;
      console.log(this.userData.innerId, 'changeRecord', newVal);
      if (!this.userData.player) {
        console.error(this.userData.innerId, 'changeRecord but no player component');
        return;
      }
      if (!this.userData.player.startRecordFlv) {
        console.error(this.userData.innerId, 'changeRecord but no player.startRecordFlv');
        wx.showToast({
          title: '请升级插件版本',
          icon: 'error',
        });
        return;
      }
      if (newVal) {
        this.userData.player.startRecordFlv(recordFlvOptions);
      } else {
        this.userData.player.stopRecordFlv();
      }
      // 可能失败，onRecordStateChange 里再修改
      // this.setData({
      //   record: newVal,
      // });
    },
    retryPlayer() {
      console.log(this.userData.innerId, 'retryPlayer');
      if (!this.userData.player) {
        console.error(this.userData.innerId, 'retryPlayer but no player component');
        return;
      }
      this.userData.player.retry();
    },

    // 导出
    getExport() {
      if (!this.compExport) {
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        const componentInstance = this;

        this.compExport = {
          isPlaySuccess() {
            return componentInstance.data.isPlaySuccess;
          },
          isFullScreen() {
            return componentInstance.data.fullScreen;
          },
          requestFullScreen(params = { direction: 90 }) {
            if (!componentInstance.userData.player) {
              return Promise.reject({ errMsg: 'player not ready' });
            }
            return componentInstance.userData.player.requestFullScreen(params);
          },
          exitFullScreen(params) {
            if (!componentInstance.userData.player) {
              return Promise.reject({ errMsg: 'player not ready' });
            }
            return componentInstance.userData.player.exitFullScreen(params);
          },
          snapshotAndSave(params) {
            return componentInstance.snapshotAndSave(params);
          },
        };
      }

      return this.compExport;
    },
  },
});

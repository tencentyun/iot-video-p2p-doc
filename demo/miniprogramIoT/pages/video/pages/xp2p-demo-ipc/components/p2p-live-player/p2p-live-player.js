const qualityList = [
  { value: 'standard', text: '标清' },
  { value: 'high', text: '高清' },
];
const qualityMap = {};

qualityList.forEach(({ value, text }) => {
  qualityMap[value] = text;
});

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
    needCheckStream: {
      type: Boolean,
      value: false,
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

    fullScreen: false,
    fullScreenInfo: null,

    // 清晰度
    innerStreamQuality: '',
    qualityMap,

    // 播放器控制
    // muted: false, // 支持 properties 控制
    orientation: 'vertical',
    rotate: 0,
    fill: false,

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
      console.log(this.userData.innerId, 'create components', this.data.playerId);
      const player = this.selectComponent(`#${this.data.playerId}`);

      if (player) {
        console.log(this.userData.innerId, 'create player success');
        oriConsole.log(this.userData.innerId, 'player', player); // console 被覆盖了会写logger影响性能，查看组件用 oriConsole
        this.userData.player = player;
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
      switch (type) {
        case 'playstart':
          this.setData({
            isPlaying: true,
            isPlaySuccess: false,
            isPlayError: false,
          });
          break;
        case 'playsuccess':
          this.setData({
            isPlaying: true,
            isPlaySuccess: true,
            isPlayError: false,
          });
          break;
        case 'playstop':
        case 'playend':
          this.setData({
            isPlaying: false,
            isPlaySuccess: false,
            isPlayError: false,
          });
          break;
        case 'playerror':
          this.setData({
            isPlaying: false,
            isPlaySuccess: false,
            isPlayError: true,
          });
          break;
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
          this.snapshotAndSave();
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
      this.userData.player.snapshotAndSave(params);
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
            componentInstance.snapshotAndSave(params);
          },
        };
      }

      return this.compExport;
    },
  },
});

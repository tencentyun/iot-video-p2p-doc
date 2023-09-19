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
    deviceInfo: Object,
    xp2pInfo: String,
    streamChannel: {
      type: Number,
      value: 0,
    },
    streamQuality: String,
    liveStreamDomain: String,
    sceneType: String,
    needCheckStream: {
      type: Boolean,
      value: false,
    },
    mode: String,
    soundMode: String,
    acceptPlayerEvents: {
      type: Object,
      value: {},
    },
    onlyp2pMap: Object,
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
    muted: false,
    orientation: 'vertical',
    rotate: 0,
    fill: false,

    // 调试
    showLog: true,
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
        player: null,
      };
    },
    attached() {
      const { showIcons } = this.data;

      console.log('this.properties.deviceInfo.isMjpgDevice', this.properties.deviceInfo.isMjpgDevice);

      if (this.properties.deviceInfo.isMjpgDevice) {
        // 图片流设备
        showIcons.orientation = false;
        showIcons.rotate = true;
      } else {
        // 视频流设备
        showIcons.orientation = true;
        showIcons.rotate = false;
      }

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
      console.log('demo: create components', this.data.playerId);
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
    },

    // player事件
    onPlayerEvent({ type, detail }) {
      console.log('demo: onPlayerEvent', type, detail);
    },
    onPlayStateEvent({ type, detail }) {
      console.log('demo: onPlayStateEvent', type, detail);
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
    toggleDebugInfo() {
      console.log('demo: toggleDebugInfo');
      this.setData({ showDebugInfo: !this.data.showDebugInfo });
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
          console.log('demo: changeQuality', item.value);
          this.setData({ innerStreamQuality: item.value });
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
    changeFill() {
      console.log('demo: changeFill');
      this.setData({
        fill: !this.data.fill,
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
    changeSoundMode() {
      console.log('demo: changeSoundMode');
      this.setData({
        soundMode: this.data.soundMode === 'ear' ? 'speaker' : 'ear',
      });
    },
    retryPlayer() {
      console.log('demo: retryPlayer');
      if (!this.userData.player) {
        console.error('demo: retryPlayer but no player component');
        return;
      }
      this.userData.player.retry();
    },
    snapshotView() {
      console.log('demo: snapshotView');
      if (!this.userData.player) {
        console.error('demo: snapshotView but no player component');
        return;
      }
      this.userData.player.snapshotAndSave({
        sourceType: 'view',
      });
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
          getStreamChannel() {
            return componentInstance.properties.streamChannel;
          },
        };
      }

      return this.compExport;
    },
  },
});

import { isDevTool, toTimeMsString } from '../../../../../utils';
import { STORE } from '../../../../../lib/demo-storage-store';
const logPrefix = '[demo] [ipc-live] page:';
const pageName = 'ipc-live-demo';
let pageSeq = 0;
let xp2pManager = null;
// 覆盖 console
const app = getApp();
const oriConsole = app.console;
const console = app.logger || oriConsole;
const intercomP2PWaterMark = {
  low: 0,
  high: 500 * 1024, // 高水位字节数，可根据码率和可接受延迟自行调整
};
const needTestRender = wx.getAccountInfoSync().miniProgram.envVersion === 'develop';
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
  needKeepFile: wx.getAccountInfoSync().miniProgram.envVersion === 'develop', // 是否保留flv文件，设为 true 时需要自行清理文件，默认 false
  showLog: true,
};


Component({
  behaviors: ['wx://component-export'],
  options: {
    addGlobalClass: true,
  },
  properties: {
    fullScreen: {
      type: Boolean,
      value: false,
    },
    showIcons: {
      type: Object,
      value: {},
    },
    showDebugInfo: {
      type: Boolean,
      value: false,
    },
    supportPTZ: {
      type: Boolean,
      value: false,
    },
  },
  data: {
    deviceInfo: {
      xp2pInfo: '',
    },
    deviceList: [],
    streamQuality: 'high',
    playerId: 'ipc-live-player-1000',
    needCheckStream: false,
    acceptPlayerEvents: { statechange: true, netstatus: true },
    onlyp2pMap: { flv: isDevTool, mjpg: isDevTool },
    needTestRender,
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

    // 控件
    controlsId: 'controls',
    innerStreamQuality: 'standard',
    qualityMap,
    muted: false,
    ptzBtns: [
      { name: 'up', cmd: 'ptz_up_press' },
      { name: 'down', cmd: 'ptz_down_press' },
      { name: 'left', cmd: 'ptz_left_press' },
      { name: 'right', cmd: 'ptz_right_press' },
    ],
  },
  methods: {
    // 获取组件实例
    getComponents() {
      console.log(this.userData.innerId, 'create components');

      const player = this.selectComponent(`#${this.data.playerId}`);
      console.log('player', player);
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
      console.log('======deviceId======', this.userData.deviceId);
      console.log('======ptzcmd======', cmd);
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
          getXp2pManager() {
            return xp2pManager;
          },
          onSendCommandSubmit(...args) {
            return componentInstance.onSendCommandSubmit(...args);
          },
        };
      }

      return this.compExport;
    },
    export() {
      return this.getExport();
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
    onFeedbackFromDevice() {
      xp2pManager.addP2PServiceEventListener(
        this.userData.deviceId,
        'feedbackFromDevice',
        (body) => {
          console.log('demo: FEEDBACK_FROM_DEVICE', body);
          // wx.showModal({
          //   title: 'feedbackFromDevice',
          //   content: JSON.stringify(body),
          // });
        },
      );
    },
    async onSendCommandSubmit(cmd, payload) {
      /**
       * cmd get_device_st
       * payload action=inner_define&channel=0&type=voice
       */
      const { deviceId } = this.data.deviceInfo;
      if (!cmd) {
        console.log('please input you cmd');
      }
      const cmdStr = `cmd=${cmd}&${payload}`;
      console.log('cmdStr', cmdStr);
      try {
        const res = await xp2pManager.sendCommand(deviceId, cmdStr);
        console.log('sendCommand', res);
        return res;
      } catch (e) {
        console.log('e', e);
      }
    },
    onStartPlayer(detail) {
      // 测试页面刷新
      if (this.data.needTestRender) {
        this.startTestRender();
      }
      this.userData.deviceId = detail.deviceId;
      const startServiceParams = {
        p2pMode: detail.p2pMode,
        deviceInfo: {
          deviceId: detail.deviceId,
          productId: detail.productId,
          deviceName: detail.deviceName,
        },
        xp2pInfo: detail.xp2pInfo,
        liveStreamDomain: detail.liveStreamDomain,
        caller: this.data.playerId,
      };
      console.log('startServiceParams', startServiceParams);
      const servicePromise = xp2pManager.startP2PService(startServiceParams)
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
        }
      });
    },
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
        this.setData({ testStr: `${toTimeMsString(tmpDate)}, last ${tmpDate.getTime() - this.userData.lastRenderTime}ms, total ${Math.floor(totalSec / 60)}m${totalSec % 60}s` });
        this.userData.lastRenderTime = tmpDate.getTime();
      }, 10000);

      this.setData({ testStr: toTimeMsString(new Date()) });
    },
  },
  lifetimes: {
    created() {
      this.userData = {
        player: null,
      };
    },
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    async attached() {
      console.log('this.data.showIcons', this.data.showIcons);
      pageSeq++;
      // 在组件实例进入页面节点树时执行
      if (!xp2pManager) {
        const { getXp2pManager } = await require.async('../../../../video/lib/xp2pManager.js');
        xp2pManager = getXp2pManager();
      }
      const pageId = `${pageName}-${pageSeq}`;
      this.userData = {
        pageId,
        deviceId: '',
        serviceStateChangeHandler: null,
        serviceState: null,
        players: [],
        hasCreateOtherComponents: false,
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
      if (STORE.storageDeviceList.length > 0) {
        this.setData({
          deviceList: STORE.storageDeviceList,
          deviceInfo: {
            ...STORE.storageDeviceList[0],
            liveStreamDomain: '',
            initCommand: true,
          },
        }, () => {
          console.log('deviceInfo', this.data.deviceInfo);
          this.onStartPlayer({
            ...this.data.deviceInfo,
            targetId: this.data.deviceInfo.deviceId,
          });
        });
      }
      return null;
    },
    detached() {
      // 在组件实例被从页面节点树移除时执行
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
    },
    ready() {
      this.getComponents();
    },

  },
});

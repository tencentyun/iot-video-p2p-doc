import config from '../../config/config';
import { adjustXp2pInfo, compareVersion, getDeviceFlags, isDevTools } from '../../utils';
import { getXp2pManager } from '../../lib/xp2pManager';

const xp2pManager = getXp2pManager();
const { XP2PVersion } = xp2pManager;

const { totalData } = config;

Component({
  behaviors: ['wx://component-export'],
  properties: {
    cfg: {
      type: String,
      value: '',
    },
  },
  data: {
    // 这是onLoad时就固定的
    p2pMode: '',
    cfgTargetId: '',
    isMjpgDevice: false,

    // 场景
    scene: 'live',
    sceneList: [
      {
        value: 'live',
        text: '直播',
        checked: true,
      },
      {
        value: 'playback',
        text: '回放',
        checked: false,
      },
    ],

    // 1v1用
    simpleInputs: [
      {
        field: 'productId',
        // text: 'productId',
        value: '',
      },
      {
        field: 'deviceName',
        // text: 'deviceName',
        value: '',
      },
      {
        field: 'xp2pInfo',
        // text: 'xp2pInfo',
        value: '',
      },
      {
        field: 'liveQuality',
        text: 'liveQuality',
        value: '',
        scene: 'live',
      },
      {
        field: 'liveStreamDomain',
        text: '1v1转1vn server拉流域名(填入开启1v1转1vn)',
        value: '',
        placeholder: '和`播放前先检查能否拉流`不兼容',
        scene: 'live',
      },
    ],
    simpleChecks: [
      {
        field: 'needCheckStream',
        text: '播放前先检查能否拉流',
        checked: false,
      },
      {
        field: 'playerRTC',
        text: '播放使用RTC模式',
        checked: true,
      },
    ],
    intercomType: 'Recorder',
    intercomTypeList: [
      {
        value: 'Recorder',
        text: 'Recorder',
        desc: 'RecorderManager采集，PCM编码',
        checked: true,
      },
      {
        value: 'Pusher',
        text: 'Pusher',
        desc: 'LivePusher采集，AAC编码，支持回音消除',
        checked: false,
      },
      // {
      //   value: 'DuplexVideo',
      //   text: '双向音视频（实验中）',
      //   desc: 'LivePusher采集，视频H.264，音频AAC',
      //   checked: false,
      // },
    ],

    // 1v多用
    inputUrl: '',

    // 调试用，开发者工具里不支持 live-player 和 TCPServer，默认只拉数据不播放
    isDevTools,
    playStreamChecked: {
      flv: !isDevTools,
      mjpg: !isDevTools,
    },

    // 这些是p2p状态
    targetId: '',
    // 1v1用
    flvFile: '',
    mjpgFile: '',
    // 1v多用
    flvUrl: '',
  },
  lifetimes: {
    created() {
      // 在组件实例刚刚被创建时执行
    },
    attached() {
      // 在组件实例进入页面节点树时执行
      if (!this.id) {
        this.id = 'iot-p2p-input';
      }
      console.log(`[${this.id}]`, 'attached', this.id, this.properties);
      const data = this.properties.cfg && totalData[this.properties.cfg];
      if (!data) {
        console.log(`[${this.id}]`, 'invalid cfg');
        return;
      }

      console.log(`[${this.id}]`, 'setData from cfg data', data);
      // 基础字段
      const { simpleInputs } = this.data;
      simpleInputs.forEach((item) => {
        item.value = typeof data[item.field] === 'string' ? data[item.field] : '';
      });

      // 小程序里可以调整的字段
      const options = data.options || {};
      const { simpleChecks } = this.data;
      simpleChecks.forEach((item) => {
        item.checked = typeof options[item.field] === 'boolean' ? options[item.field] : false;
      });
      const intercomType = options.intercomType || 'Recorder';
      const { intercomTypeList } = this.data;
      intercomTypeList.forEach((item) => {
        item.checked = item.value === intercomType;
      });

      // setData
      this.setData(
        {
          p2pMode: data.p2pMode,
          cfgTargetId: data.targetId || '',
          isMjpgDevice: typeof data.isMjpgDevice === 'boolean' ? data.isMjpgDevice : false,
          // 1v1用
          simpleInputs,
          simpleChecks,
          intercomType,
          intercomTypeList,
          // 1v多用
          inputUrl: data.flvUrl || '',
        },
        () => {
          console.log(`[${this.id}]`, 'now data', this.data);
        },
      );
    },
    ready() {
      // 在组件在视图层布局完成后执行
    },
    detached() {
      // 在组件实例被从页面节点树移除时执行
      console.log(`[${this.id}]`, 'detached');
    },
    error() {
      // 每当组件方法抛出错误时执行
    },
  },
  export() {},
  methods: {
    showToast(content) {
      wx.showToast({
        title: content,
        icon: 'none',
      });
    },
    // 1v1用
    changeSceneRadio(e) {
      const { sceneList } = this.data;
      sceneList.forEach((item) => {
        item.checked = item.value === e.detail.value;
      });
      this.setData({
        scene: e.detail.value,
        sceneList,
      });
    },
    async importXp2pInfo() {
      try {
        const res = await wx.getClipboardData();
        const errMsg = '格式错误';
        if (typeof res.data !== 'string') {
          this.showToast(errMsg);
          return;
        }
        const arr = res.data.split(/\s+/).filter(str => str.length)
          .map(str => str.replace(/^(productId|deviceName|xp2pInfo):/i, ''));
        if (arr.length < 3) {
          this.showToast(errMsg);
          return;
        }
        const [productId, deviceName, xp2pInfo] = arr;
        console.log('try importXp2pInfo', productId, deviceName, xp2pInfo);
        if (!/^\w+$/.test(productId)) {
          this.showToast('productId 格式错误');
          return;
        }
        if (!/^\w+$/.test(deviceName)) {
          this.showToast('deviceName 格式错误');
          return;
        }
        if (!/^XP2P/.test(xp2pInfo)) {
          this.showToast('xp2pInfo 格式错误');
          return;
        }
        const newData = {
          productId,
          deviceName,
          xp2pInfo,
        };
        const { simpleInputs } = this.data;
        simpleInputs.forEach(item => {
          if (item.field in newData) {
            item.value = newData[item.field];
          }
        });
        this.setData({
          simpleInputs,
        });
        this.showToast('已导入');
      } catch (err) {
        this.showToast(err.errMsg);
      }
    },
    inputSimpleInput(e) {
      const { index } = e.currentTarget.dataset;
      const item = this.data.simpleInputs[index];
      item.value = e.detail.value;
      this.setData({
        simpleInputs: this.data.simpleInputs,
      });
    },
    switchSimpleCheck(e) {
      const { index } = e.currentTarget.dataset;
      const item = this.data.simpleChecks[index];
      item.checked = e.detail.value;
      this.setData({
        simpleChecks: this.data.simpleChecks,
      });
    },
    changeIntercomTypeRadio(e) {
      const { intercomTypeList } = this.data;
      intercomTypeList.forEach((item) => {
        item.checked = item.value === e.detail.value;
      });
      this.setData({
        intercomType: e.detail.value,
        intercomTypeList,
      });
    },
    // 1v多用
    inputStreamUrl(e) {
      this.setData({
        inputUrl: e.detail.value,
      });
    },
    // 调试用
    switchPlayStream(e) {
      const { playStreamChecked } = this.data;
      playStreamChecked[e.currentTarget.dataset.stream] = e.detail.value;
      this.setData({
        playStreamChecked,
      });
    },
    getStreamData(sceneType, inputValues, options) {
      if (!this.data.cfgTargetId) {
        this.showToast('no targetId');
        return;
      }

      if (this.data.p2pMode === 'ipc') {
        if (!inputValues.productId) {
          this.showToast('please input productId');
          return;
        }
        if (!inputValues.deviceName) {
          this.showToast('please input deviceName');
          return;
        }
        if (!inputValues.xp2pInfo) {
          this.showToast('please input xp2pInfo');
          return;
        }
        if (sceneType === 'live') {
          if (this.data.isMjpgDevice && inputValues.liveStreamDomain) {
            this.showToast('图片流不支持`1v1转1vn`');
            return;
          }
          if (inputValues.liveStreamDomain && options.needCheckStream) {
            this.showToast('开启`1v1转1vn`时需取消`播放前先检查能否拉流`');
            return;
          }
        }
        if (sceneType === 'playback') {
          if (this.data.isMjpgDevice) {
            this.showToast('图片流不支持回放');
            return;
          }
        }
      } else {
        const supportHttps = compareVersion(XP2PVersion, '1.1.0') >= 0;
        if (!supportHttps) {
          this.showToast('please update xp2p plugin');
          return;
        }
        if (!this.data.inputUrl) {
          this.showToast('please input stream url');
          return;
        }
        if (!/^https:/.test(this.data.inputUrl)) {
          this.showToast('only support https url');
          return;
        }
      }

      let xp2pInfo = '';
      let flvFile = '';
      let mjpgFile = '';
      let flvUrl = '';
      if (this.data.p2pMode === 'ipc') {
        xp2pInfo = adjustXp2pInfo(inputValues.xp2pInfo); // 兼容直接填 peername 的情况
        const flags = getDeviceFlags(xp2pInfo);
        console.log(`[${this.id}] device flags`, flags);
        if (this.data.isMjpgDevice) {
          if (!flags?.mjpg) {
            // 图片流设备，但是 xp2pInfo 没有 mjpg 标记
            this.showToast('xp2pInfof flag mismatch, check device type');
            return;
          }
          if (sceneType === 'live') {
            flvFile = 'ipc.flv?action=live-audio&channel=0';
            mjpgFile = 'ipc.flv?action=live-mjpg&channel=0';
          } else if (sceneType === 'playback') {
            flvFile = 'ipc.flv?action=playback-audio&channel=0';
            mjpgFile = 'ipc.flv?action=playback-mjpg&channel=0';
          }
        } else {
          if (flags?.mjpg) {
            // 非图片流设备，但是 xp2pInfo 有 mjpg 标记
            this.showToast('xp2pInfof flag mismatch, check device type');
            return;
          }
          if (sceneType === 'live') {
            flvFile = `ipc.flv?action=live&channel=0&quality=${inputValues.liveQuality || ''}`;
          } else if (sceneType === 'playback') {
            flvFile = 'ipc.flv?action=playback&channel=0';
          }
        }
      } else {
        flvUrl = this.data.inputUrl;
      }

      return {
        targetId: this.data.cfgTargetId,
        productId: inputValues.productId,
        deviceName: inputValues.deviceName,
        liveStreamDomain: inputValues.liveStreamDomain,
        xp2pInfo,
        flvFile,
        mjpgFile,
        flvUrl,
      };
    },
    startPlayer() {
      const inputValues = {};
      this.data.simpleInputs.forEach(({ field, value }) => {
        inputValues[field] = value;
      });
      const options = {
        intercomType: this.data.intercomType, // 对讲方式
      };
      this.data.simpleChecks.forEach((item) => {
        options[item.field] = item.checked;
      });
      const onlyp2pMap = {};
      for (const stream in this.data.playStreamChecked) {
        onlyp2pMap[stream] = !this.data.playStreamChecked[stream];
      }

      const sceneType = this.data.scene || 'live';
      const streamData = this.getStreamData(sceneType, inputValues, options);
      if (!streamData) {
        return;
      }

      if (this.data.p2pMode === 'ipc') {
        // 注意字段和totalData的里一致
        const recentIPC = {
          p2pMode: 'ipc',
          targetId: 'recentIPC',
          isMjpgDevice: this.data.isMjpgDevice,
          ...inputValues,
          options,
        };
        console.log(`[${this.id}]`, 'set recentIPC', recentIPC);
        totalData.recentIPC = recentIPC;
        wx.setStorageSync('recentIPC', recentIPC);
      }

      console.log(`[${this.id}]`, 'startPlayer', this.data.p2pMode, sceneType, streamData, options);
      this.setData(streamData);
      this.triggerEvent('startPlayer', {
        p2pMode: this.data.p2pMode,
        sceneType,
        ...streamData,
        options,
        onlyp2pMap,
      });
    },
    async copyDocUrl(e) {
      const { doc } = e.currentTarget.dataset;
      if (!doc) {
        return;
      }
      await wx.setClipboardData({
        data: doc,
      });
      wx.showToast({ title: '文档地址已复制到剪贴板', icon: 'none' });
    },
  },
});

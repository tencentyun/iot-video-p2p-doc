import { totalData } from '../../config/config';
import { adjustXp2pInfo, getDeviceFlags, isDevTool } from '../../utils';

Component({
  behaviors: ['wx://component-export'],
  properties: {
    cfg: {
      type: String,
      value: '',
    },
    scene: {
      type: String,
      value: 'live',
    },
    showCancel: {
      type: Boolean,
      value: false,
    },
  },
  data: {
    // 这是onLoad时就固定的
    p2pMode: '',
    cfgTargetId: '',
    isMjpgDevice: false,

    // 场景
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
        field: 'initCommand',
        text: '设备初始化信令',
        value: '',
        placeholder: '',
        scene: 'live',
      },
      {
        field: 'liveQuality',
        text: '默认清晰度',
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
      {
        field: 'supportPTZ',
        text: '设备支持PTZ',
        checked: false,
        scene: 'live',
      },
    ],
    voiceType: 'Recorder',
    voiceTypeList: [
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
    isDevTool,
    playStreamChecked: {
      flv: !isDevTool,
      mjpg: !isDevTool,
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
    attached() {
      // 在组件实例进入页面节点树时执行
      if (!this.id) {
        this.id = 'iot-device-input';
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
      const voiceType = options.voiceType || 'Recorder';
      const { voiceTypeList } = this.data;
      voiceTypeList.forEach((item) => {
        item.checked = item.value === voiceType;
      });

      // setData
      this.setData({
        p2pMode: data.p2pMode,
        cfgTargetId: data.targetId || '',
        isMjpgDevice: typeof data.isMjpgDevice === 'boolean' ? data.isMjpgDevice : false,
        // 1v1用
        simpleInputs,
        simpleChecks,
        voiceType,
        voiceTypeList,
        // 1v多用
        inputUrl: data.flvUrl || '',
      });

      this.changeSceneRadio({ detail: { value: this.properties.scene }});
    },
    detached() {
      // 在组件实例被从页面节点树移除时执行
      console.log(`[${this.id}]`, 'detached');
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
        const arr = res.data.replace(/[^\w/=%.]/g, ' ').split(/\s+/)
          .filter(str => str.length >= 10); // 这3个数据的长度都 >= 10
        let productId;
        let deviceName;
        let xp2pInfo;
        arr.forEach((str) => {
          if (/^[A-Z0-9]+$/.test(str)) {
            // 匹配 productId 规则
            productId = str;
          } else if (/^[A-Za-z0-9]+_\d+_\d+$/.test(str)) {
            // 匹配 deviceName 规则
            deviceName = str;
          } else if (/^XP2P/.test(str)) {
            // 匹配 xp2pInfo 规则
            xp2pInfo = str;
          }
        });
        if (!productId) {
          this.showToast('未找到有效的 productId');
          return;
        }
        if (!deviceName) {
          this.showToast('未找到有效的 deviceName');
          return;
        }
        if (!xp2pInfo) {
          this.showToast('未找到有效的 xp2pInfo');
          return;
        }
        console.log('importXp2pInfo', productId, deviceName, xp2pInfo);
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
    changeVoiceTypeRadio(e) {
      const { voiceTypeList } = this.data;
      voiceTypeList.forEach((item) => {
        item.checked = item.value === e.detail.value;
      });
      this.setData({
        voiceType: e.detail.value,
        voiceTypeList,
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

      let deviceInfo = null;
      let xp2pInfo = '';
      let initCommand = '';
      let liveStreamDomain = '';
      let streamQuality = '';
      let flvUrl = '';
      if (this.data.p2pMode === 'ipc') {
        // deviceInfo
        const deviceId = `${inputValues.productId}/${inputValues.deviceName}`;
        deviceInfo = {
          deviceId,
          productId: inputValues.productId,
          deviceName: inputValues.deviceName,
          isMjpgDevice: this.data.isMjpgDevice,
        };

        // xp2pInfo
        if (!inputValues.xp2pInfo) {
          this.showToast('please input xp2pInfo');
          return;
        }
        xp2pInfo = adjustXp2pInfo(inputValues.xp2pInfo); // 兼容直接填 peername 的情况
        const flags = getDeviceFlags(xp2pInfo);
        console.log(`[${this.id}] device flags`, flags);
        if (this.data.isMjpgDevice) {
          if (!flags?.mjpg) {
            // 图片流设备，但是 xp2pInfo 没有 mjpg 标记
            this.showToast('xp2pInfo flag mismatch, check device type');
            return;
          }
        } else {
          if (flags?.mjpg) {
            // 非图片流设备，但是 xp2pInfo 有 mjpg 标记
            this.showToast('xp2pInfo flag mismatch, check device type');
            return;
          }
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
          initCommand = inputValues.initCommand || '';
          liveStreamDomain = inputValues.liveStreamDomain || '';
          streamQuality = inputValues.liveQuality || '';
        }
        if (sceneType === 'playback') {
          if (this.data.isMjpgDevice) {
            this.showToast('图片流不支持回放');
            return;
          }
        }
      } else if (this.data.p2pMode === 'server') {
        // deviceInfo
        deviceInfo = {
          deviceId: this.data.cfgTargetId,
        };

        // flvUrl
        if (!this.data.inputUrl) {
          this.showToast('please input stream url');
          return;
        }
        if (!/^https:/.test(this.data.inputUrl)) {
          this.showToast('only support https url');
          return;
        }
        flvUrl = this.data.inputUrl;
      } else {
        this.showToast(`unknown p2pMode ${this.data.p2pMode}`);
        return;
      }

      return {
        targetId: this.data.cfgTargetId,
        deviceInfo,
        xp2pInfo,
        initCommand,
        liveStreamDomain,
        streamQuality,
        flvUrl,
      };
    },
    startPlayer() {
      const inputValues = {};
      this.data.simpleInputs.forEach(({ field, value }) => {
        inputValues[field] = value;
      });
      const options = {
        voiceType: this.data.voiceType, // 对讲方式
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
    cancel() {
      this.triggerEvent('cancel');
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

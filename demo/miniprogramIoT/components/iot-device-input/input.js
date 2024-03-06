import { totalData, updateRecentIPC } from '../../config/config';
import { adjustXp2pInfo, getDeviceFlags, isDevTool } from '../../utils';
const getDefaultChannelOptions = () => (
  [
    {
      value: 0,
      name: 'channel-0',
      checked: true,
    },
    {
      value: 1,
      name: 'channel-1',
      checked: false,
    },
  ]
);

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
    channelOptions: getDefaultChannelOptions(),
    useChannelIds: [],
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
        hideIfEmpty: true, // 配置里有值才显示这个字段，没配就不显示
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
        field: 'supportPTZ',
        text: '设备支持PTZ',
        checked: false,
        scene: 'live',
      },
      {
        field: 'playerRTC',
        text: '播放使用RTC模式（需要设备采样率16k以上）',
        checked: true,
      },
      {
        field: 'playerMuted',
        text: '默认静音',
        checked: false,
      },
      {
        field: 'playerLog',
        text: '显示播放组件log（影响性能，谨慎开启）',
        checked: false,
      },
      {
        field: 'intercomLog',
        text: '显示对讲组件log（影响性能，谨慎开启）',
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
    ],
    intercomType: 'voice',
    intercomTypeList: [{
      value: 'voice',
      text: '语音对讲',
      checked: true,
    }, {
      value: 'video',
      text: '视频对讲',
      desc: '只支持 LivePusher 采集，与 Voip 通话建立双向音视频通话',
      checked: false,
    }],
    liveQuality: 'high',
    liveQualityList: [{
      value: 'standard',
      text: '标清',
      checked: false,
    }, {
      value: 'high',
      text: '高清',
      checked: true,
    }, {
      value: 'super',
      text: '超清',
      checked: false,
    }],

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
      const intercomType = options.intercomType || 'video';
      const { intercomTypeList } = this.data;
      intercomTypeList.forEach((item) => {
        item.checked = item.value === intercomType;
      });
      const liveQuality = options.liveQuality || 'high';
      const { liveQualityList } = this.data;
      liveQualityList.forEach((item) => {
        item.checked = item.value === liveQuality;
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
        intercomType,
        intercomTypeList,
        liveQuality,
        liveQualityList,
        // 1v多用
        inputUrl: data.flvUrl || '',
      });

      this.changeSceneRadio({ detail: { value: this.properties.scene } });
    },
    detached() {
      // 在组件实例被从页面节点树移除时执行
      console.log(`[${this.id}]`, 'detached');
    },
  },
  export() { },
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
        const arr = res.data.replace(/[^\w/+=%.]/g, ' ').split(/\s+/)
          .filter(str => !!str
            && !/^ProductId$/i.test(str)
            && !/^DeviceName$/i.test(str)
            && !/^Xp2pInfo$/i.test(str)
          );
        console.log('clipboard', res.data, arr);
        let productId;
        let deviceName;
        let xp2pInfo;
        arr.forEach((str) => {
          if (/^[A-Z0-9]{10}\/\w+$/.test(str)) {
            // 匹配 deviceId 规则
            [productId, deviceName] = str.split('/');
          } else if (/^[A-Z0-9]{10}$/.test(str)) {
            // 匹配 productId 规则
            productId = str;
          } else if (/^\w+$/.test(str)) {
            // 匹配 deviceName 规则
            deviceName = str;
          } else if (/^XP2P[\w/+=]+%[\w.]+/.test(str)) {
            // 匹配 xp2pInfo 规则
            xp2pInfo = str;
          }
        });

        if (!productId && !deviceName && !xp2pInfo) {
          this.showToast('未找到有效的数据');
          return;
        }
        const newData = {};
        productId && (newData.productId = productId);
        deviceName && (newData.deviceName = deviceName);
        xp2pInfo && (newData.xp2pInfo = xp2pInfo);
        console.log('importXp2pInfo', newData);
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
    switchLiveChannel(e) {
      const { index } = e.currentTarget.dataset;
      const item = this.data.channelOptions[index];
      item.checked = e.detail.value;
      this.setData({
        channelOptions: this.data.channelOptions,
      });
    },
    changePlaybackChannel(e) {
      const { channelOptions } = this.data;
      channelOptions.forEach((item) => {
        item.checked = item.value === Number(e.detail.value);
      });
      this.setData({
        channelOptions,
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
    changeQualityRadio(e) {
      const { liveQualityList } = this.data;
      liveQualityList.forEach((item) => {
        item.checked = item.value === e.detail.value;
      });
      this.setData({
        liveQuality: e.detail.value,
        liveQualityList,
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
      let flvUrl = '';
      const useChannelIds = this.data.channelOptions.filter(item => item.checked).map(item => item.value);

      // 可以都不选
      // if (useChannelIds.length === 0) {
      //   useChannelIds = [0];
      // }

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
        flvUrl,
        useChannelIds,
      };
    },
    startPlayer() {
      const inputValues = {};
      this.data.simpleInputs.forEach(({ field, value }) => {
        inputValues[field] = value;
      });
      const options = {
        liveQuality: this.data.liveQuality, // 清晰度
        intercomType: this.data.intercomType, // 对讲类型
        voiceType: this.data.voiceType, // 语音采集方式
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
        updateRecentIPC({
          isMjpgDevice: this.data.isMjpgDevice,
          ...inputValues,
          options,
        });
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

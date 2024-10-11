import { STORE } from '../../../../lib/demo-storage-store';

const logPrefix = '[demo] [demo-device-selector]';

Component({
  behaviors: ['wx://component-export'],
  options: {
    addGlobalClass: true,
  },
  properties: {
    className: {
      type: String,
      value: '',
    },
    full: {
      type: Boolean,
      value: false,
    },
    showIcons: {
      type: Object,
      value: {
        quality: false,
        muted: false,
        orientation: false, // 视频流设备才支持
        rotate: false, // 图片流监控才支持旋转
        fill: false,
        fullScreen: false,
        snapshot: false,
        record: false,
      },
    },
    iconSize: {
      type: Number,
      value: 25,
    },
    qualityMap: {
      type: Object,
      value: {},
    },
    quality: {
      type: String,
      value: '',
    },
    muted: {
      type: Boolean,
      value: false,
    },
    orientation: {
      type: String,
      value: 'vertical',
    },
    rotate: {
      type: Number,
      value: 0,
    },
    fill: {
      type: Boolean,
      value: false,
    },
    fullScreen: {
      type: Boolean,
      value: false,
    },
    record: {
      type: Boolean,
      value: false,
    },
    // 是否展示 demo 的跳转链接
    showDemoLink: {
      type: Boolean,
      value: true,
    },
  },
  data: {
    showDeviceList: false,
    deviceList: [],
    deviceData: { options: STORE.defaultOptions },

    // 其他表单项
    channelIds: [],
    othersOptions: [],
  },
  export() {
    return {};
  },
  lifetimes: {
    attached() {
      this.initDevices();
      this.setData({
        channelIds: [
          { key: '0', checked: this.data.deviceData.options.useChannelIds.includes(0), name: 'Channel-0' },
          { key: '1', checked: this.data.deviceData.options.useChannelIds.includes(1), name: 'Channel-1' },
        ],
        othersOptions: [
          { key: 'playback', checked: this.data.deviceData.options.playback, name: '本地回放支持' },
          { key: 'cloudStorage', checked: this.data.deviceData.options.cloudStorage, name: '云存支持' },
          { key: 'twecall', checked: this.data.deviceData.options.twecall, name: 'twecall支持' },
          { key: 'ptz', checked: this.data.deviceData.options.ptz, name: 'PTZ支持' },
          { key: 'userCommand', checked: this.data.deviceData.options.userCommand, name: '自定义信令支持' },
          { key: 'rtcMode', checked: this.data.deviceData.options.rtcMode, name: 'RTC模式播放' },
          { key: 'isMuted', checked: this.data.deviceData.options.isMuted, name: '静音播放' },
          { key: 'showPlayerLog', checked: this.data.deviceData.options.showPlayerLog, name: '显示播放组件log' },
          { key: 'showIntercomLog', checked: this.data.deviceData.options.showIntercomLog, name: '显示对讲组件log' },
          { key: 'onlyFlv', checked: this.data.deviceData.options.onlyFlv, name: '只拉数据不播放' },
        ],
      });
    },
  },
  methods: {
    initDevices() {
      console.log(logPrefix, 'initDevices', STORE.storageDeviceList);

      if (STORE.storageDeviceList.length > 0) this.setData({
        deviceList: STORE.storageDeviceList,
        deviceData: {
          ...STORE.storageDeviceList[0],
          options: {
            // 避免历史数据没有 options
            ...STORE.defaultOptions,
            ...STORE.storageDeviceList[0].options,
          },
        },
      });
    },

    /**
     * ## 设置设备列表显示/隐藏
     */
    setShowDeviceList(bool) {
      if (typeof bool === 'boolean') {
        this.setData({ showDeviceList: bool });
      } else {
        this.setData({ showDeviceList: !this.data.showDeviceList });
      }
    },
    hideDeviceList() {
      this.setShowDeviceList(false);
    },

    selectDevice(e) {
      const { item: device } = e.currentTarget.dataset;
      console.log(logPrefix, 'selectDevice', device);

      this.setData({
        deviceData: device,
        showDeviceList: false,
      });
    },

    gotoVideoDemoPage(e) {
      if (!this.data.deviceData) return;

      const page = e.currentTarget.dataset.page;
      console.log(logPrefix, 'goDevicePage page: ', page, this.data.deviceData);

      const { deviceId, isMjpgDevice, p2pMode } = STORE.initDevice(this.data.deviceData);
      STORE.updateRecentDevice(this.data.deviceData);

      switch (page) {
        case 'twecall-intercom': {
          let url = '/pages/video/pages/xp2p-intercom-call/demo';
          const params = `?deviceId=${`${deviceId}`}`;
          url += params;
          wx.navigateTo({ url });
          break;
        }
        case 'live': {
          wx.navigateTo({ url: `/pages/video/pages/xp2p-demo-${p2pMode === 'server' ? 'server' : 'ipc'}/demo?deviceId=${deviceId}` });
          break;
        }
        case 'playback': {
          wx.navigateTo({ url: `/pages/video/pages/xp2p-demo-ipc-playback/demo?deviceId=${deviceId}` });
          break;
        }
        case 'cloud': {
          wx.navigateTo({ url: `/pages/video/pages/xp2p-demo-ipc-playback-${isMjpgDevice ? 'cloudmjpg' : 'cloudvideo'}/demo?deviceId=${deviceId}` });
          break;
        }
        default:
          wx.showToast({ title: '暂不支持', icon: 'none' });
          break;
      }
    },
    async importXp2pInfo() {
      try {
        const res = await wx.getClipboardData();
        const errMsg = '格式错误';
        if (typeof res.data !== 'string') {
          wx.showToast({ title: errMsg, icon: 'none' });
          return;
        }

        let rawData = null;
        try {
          rawData = JSON.parse(res.data);
          if (typeof rawData !== 'object') {
            rawData = null;
            throw 'not json deviceData';
          };

          if (rawData.productId || rawData.deviceName || rawData.xp2pInfo) {
            this.setData({ deviceData: STORE.initDevice(rawData) });

            wx.showToast({ title: 'json数据已导入', icon: 'none' });
            return;
          }
        } catch (_e) { }

        let productId;
        let deviceName;
        let xp2pInfo;
        try {
          const arr = res.data.trim().split('\n').reverse().map(s => s.trim());
          if (arr.length < 2) throw 'not enough data';
          xp2pInfo = arr.find(str => /^XP2P/.test(str));
          if (!xp2pInfo) throw 'no xp2pInfo';
          const xp2pInfoIdx = arr.indexOf(xp2pInfo);

          for (let idx = xp2pInfoIdx + 1; idx < arr.length; idx++) {
            const str = arr[idx];
            if (!str) continue;

            if (str[10] === '/') {
              // 匹配 deviceId 规则
              const [p, d] = str.split('/').map(s => s.trim());
              if (p && d && /^[A-Z0-9]{10}$/.test(p)) {
                productId = p;
                deviceName = d;
                break;
              }
            }

            if (/^[A-Z0-9]{10}$/.test(str)) {
              // 匹配 productId 规则
              // deviceName 和 productId 连一起整，如果 productId 的判定规则命中了 deviceName，则把 productId 赋值 deviceName
              if (productId) deviceName = productId;
              productId = str;

              // 都获取到值后就返回
              if (deviceName && productId) break;
            } else {
              deviceName = str;
            }
          }
        } catch (_err) { }

        if (!productId) {
          wx.showToast({ title: '未找到有效的 productId', icon: 'none' });
          return;
        }
        if (!deviceName) {
          wx.showToast({ title: '未找到有效的 deviceName', icon: 'none' });
          return;
        }
        if (!xp2pInfo) {
          wx.showToast({ title: '未找到有效的 xp2pInfo', icon: 'none' });
          return;
        }
        this.setData({ deviceData: STORE.initDevice({ productId, deviceName, xp2pInfo }) });
        wx.showToast({ title: '已导入', icon: 'none' });
      } catch (err) {
        console.error(logPrefix, err);
        wx.showToast({ title: '导入失败', icon: 'none' });
      }
    },
    handleInputDeviceData(e) {
      const { label } = e.currentTarget.dataset;
      const { value } = e.detail;
      this.setData({
        deviceData: {
          ...this.data.deviceData,
          [label.trim()]: value.trim(),
        }
      });

      const { productId, deviceName, xp2pInfo } = this.data.deviceData;
      if (productId && deviceName && xp2pInfo) {
        this.setData({
          deviceData: STORE.initDevice(this.data.deviceData),
        });
      }
    },

    // ========== 其他表单输入 ==========
    onChangeChannelIds(e) {
      const { key, checked } = e.detail;
      const channelIds = [...this.data.channelIds];
      for (const ch of channelIds) {
        if (ch.key === key) {
          ch.checked = checked;
          break;
        }
      }

      // 同步到 deviceData 上
      this.setData({
        channelIds,
        deviceData: {
          ...this.data.deviceData,
          options: {
            ...this.data.deviceData.options,
            useChannelIds: channelIds.map(ch => {
              if (ch.checked) return parseInt(ch.key, 10);
              return null;
            }).filter(id => id !== null),
          },
        }
      });
    },
    onQualityChange(e) {
      this.setData({
        deviceData: {
          ...this.data.deviceData,
          options: {
            ...this.data.deviceData.options,
            quality: e.detail.key,
          },
        }
      });
    },
    onRadioChage(e) {
      const formitemName = e.currentTarget.dataset.name;
      this.setData({
        deviceData: {
          ...this.data.deviceData,
          options: {
            ...this.data.deviceData.options,
            [formitemName]: e.detail.key,
          },
        }
      });
    },

    onChangeOthers(e) {
      const { key, checked } = e.detail;
      const othersOptions = [...this.data.othersOptions];

      for (const opt of othersOptions) {
        if (opt.key === key) {
          opt.checked = checked;
          break;
        }
      }

      const opts = {};
      othersOptions.forEach(opt => opts[opt.key] = opt.checked);

      // 同步到 deviceData 上
      this.setData({
        othersOptions,
        deviceData: {
          ...this.data.deviceData,
          options: {
            ...this.data.deviceData.options,
            ...opts,
          },
        }
      });
    },

  },

});

import config from '../../config/config';
import { adjustXp2pInfo, compareVersion } from '../../utils';
import { getXp2pManager } from '../../xp2pManager';

const xp2pManager = getXp2pManager();
const { XP2PVersion } = xp2pManager;

Component({
  behaviors: ['wx://component-export'],
  properties: {
    cfg: {
      type: String,
    },
  },
  data: {
    // 这是onLoad时就固定的
    mode: '',

    // 这些是不同的流，注意改变输入值不应该改变已经启动的p2p服务
    inputTargetId: '',

    // 1v1用
    inputProductId: '',
    inputDeviceName: '',
    inputXp2pInfo: '',
    inputLiveParams: '',
    inputPlaybackParams: '',

    // 1v多用
    inputUrl: '',
    inputCodeUrl: '',
    needCode: false,

    // 调试用
    onlyp2pChecked: wx.getSystemInfoSync().platform === 'devtools', // 开发者工具里不支持 live-player 和 TCPServer，默认勾选 onlyp2p

    // 这些是p2p状态
    targetId: '',
    flvUrl: '',
  },
  lifetimes: {
    created() {
      // 在组件实例刚刚被创建时执行
    },
    attached() {
      // 在组件实例进入页面节点树时执行
      console.log(`[${this.id}]`, 'attached', this.id, this.properties);
      const { totalData } = config;
      const data = this.properties.cfg && totalData[this.properties.cfg];
      if (!data) {
        console.log(`[${this.id}]`, 'invalid cfg');
        return;
      }

      console.log(`[${this.id}]`, 'setData from cfg data', data);
      this.setData(
        {
          mode: data.mode,
          inputTargetId: data.targetId || '',
          // 1v1用
          inputProductId: data.productId || '',
          inputDeviceName: data.deviceName || '',
          inputXp2pInfo: data.xp2pInfo || data.peername || '',
          inputLiveParams: data.liveParams || 'action=live&channel=0&quality=super',
          inputPlaybackParams: data.playbackParams || 'action=playback&channel=0',
          // 1v多用
          inputUrl: data.flvUrl || '',
          inputCodeUrl: data.codeUrl || '',
          needCode: /^http:/.test(data.flvUrl),
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
    inputP2PTargetId(e) {
      this.setData({
        inputTargetId: e.detail.value,
      });
    },
    inputIPCProductId(e) {
      this.setData({
        inputProductId: e.detail.value,
      });
    },
    inputIPCDeviceName(e) {
      this.setData({
        inputDeviceName: e.detail.value,
      });
    },
    inputIPCXp2pInfo(e) {
      this.setData({
        inputXp2pInfo: e.detail.value,
      });
    },
    inputIPCLiveParams(e) {
      this.setData({
        inputLiveParams: e.detail.value,
      });
    },
    inputIPCPlaybackParams(e) {
      this.setData({
        inputPlaybackParams: e.detail.value,
      });
    },
    inputServerCodeUrl(e) {
      this.setData({
        inputCodeUrl: e.detail.value,
      });
    },
    inputStreamUrl(e) {
      this.setData({
        inputUrl: e.detail.value,
      });
    },
    switchOnlyP2P(e) {
      this.setData({
        onlyp2pChecked: e.detail.value,
      });
    },
    getStreamData(type) {
      if (!this.data.inputTargetId) {
        this.showToast('please input targetId');
        return;
      }

      if (this.data.mode === 'ipc') {
        if (!this.data.inputXp2pInfo) {
          this.showToast('please input xp2pInfo');
          return;
        }
        if (type === 'live' && !this.data.inputLiveParams) {
          this.showToast('please input live params');
          return;
        }
        if (type === 'playback' && !this.data.inputPlaybackParams) {
          this.showToast('please input playback params');
          return;
        }
      } else {
        if (!this.data.inputUrl) {
          this.showToast('please input url');
          return;
        }
        const supportHttps = compareVersion(XP2PVersion, '1.1.0') >= 0;
        if (supportHttps && !/^https:/.test(this.data.inputUrl)) {
          this.showToast('only support https url');
          return;
        }
        if (!supportHttps && !/^http:/.test(this.data.inputUrl)) {
          this.showToast('only support http url');
          return;
        }
      }

      let flvUrl = '';
      if (this.data.mode === 'ipc') {
        let flvParams = '';
        if (type === 'live') {
          flvParams = this.data.inputLiveParams;
        } else if (type === 'playback') {
          flvParams = this.data.inputPlaybackParams;
        }
        flvUrl = `http://XP2P_INFO.xnet/ipc.p2p.com/ipc.flv?${flvParams}`;
      } else {
        flvUrl = this.data.inputUrl;
      }

      return {
        targetId: this.data.inputTargetId,
        flvUrl,
        streamExInfo: {
          productId: this.data.inputProductId,
          deviceName: this.data.inputDeviceName,
          xp2pInfo: adjustXp2pInfo(this.data.inputXp2pInfo), // 兼容直接填 peername 的情况
          codeUrl: this.data.inputCodeUrl,
        },
      };
    },
    startPlayer(e) {
      const streamData = this.getStreamData(e.currentTarget.dataset.type || 'live');
      if (!streamData) {
        return;
      }

      console.log('startPlayer', streamData);
      this.setData(streamData);
      this.triggerEvent('startPlayer', {
        mode: this.data.mode,
        targetId: streamData.targetId,
        flvUrl: streamData.flvUrl,
        ...streamData.streamExInfo,
        onlyp2p: this.data.onlyp2pChecked,
      });
    },
  },
});

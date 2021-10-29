import config from '../../config/config';

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
    inputUrl: '',

    // 1v1用
    inputProductId: '',
    inputDeviceName: '',
    inputXp2pInfo: '',
    inputFlvFile: '',

    // 1v多用
    inputCodeUrl: '',

    // 调试用
    onlyp2pChecked: false,
    showDebugInfoChecked: true,

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
      const data = (this.properties.cfg && totalData[this.properties.cfg]) || totalData.tcptest;
      const realHost = data.host || this.getHostFromPeername(data.xp2pInfo || data.peername);
      const flvFile = data.flvFile || '';

      console.log(`[${this.id}]`, 'setData from cfg data', data);
      this.setData(
        {
          mode: data.mode,
          inputTargetId: data.targetId || '',
          inputProductId: data.productId || '',
          inputDeviceName: data.deviceName || '',
          inputXp2pInfo: data.xp2pInfo || data.peername || '',
          inputFlvFile: flvFile || '',
          inputCodeUrl: data.codeUrl || '',
          inputUrl: `http://${realHost}${data.basePath}${flvFile}`,
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
    isPeername(peername) {
      return /^\w+$/.test(peername) && !/^XP2P/.test(peername);
    },
    getHostFromPeername(peername) {
      // 如果是加密过的xp2pInfo，里面有/等字符，不是合法的host，用 XP2P_INFO 占个位
      return this.isPeername(peername) ? `${peername}.xnet` : 'XP2P_INFO.xnet';
    },
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
    inputIPCFlvFile(e) {
      this.setData({
        inputFlvFile: e.detail.value,
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
    switchShowDebugInfo(e) {
      this.setData({
        showDebugInfoChecked: e.detail.value,
      });
    },
    getStreamData() {
      if (!this.data.inputTargetId) {
        this.showToast('please input targetId');
        return;
      }

      if (this.data.mode === 'ipc') {
        if (!this.data.inputXp2pInfo) {
          this.showToast('please input xp2pInfo');
          return;
        }
        if (!this.data.inputFlvFile) {
          this.showToast('please input flvFile');
          return;
        }
      } else {
        if (!this.data.inputUrl) {
          this.showToast('please input url');
          return;
        }
      }

      let flvUrl = this.data.inputUrl;
      let xp2pInfo = '';
      if (this.data.mode === 'ipc') {
        // 替换url里的host
        flvUrl = flvUrl.replace(/^http:\/\/(\w+).xnet/, `http://${this.getHostFromPeername(this.data.inputXp2pInfo)}`);
        xp2pInfo = this.isPeername(this.data.inputXp2pInfo)
          ? `XP2P${this.data.inputXp2pInfo}`
          : this.data.inputXp2pInfo;

        // 替换flvFile
        const index = flvUrl.lastIndexOf('/');
        if (index >= 0) {
          flvUrl = flvUrl.substr(0, index + 1) + this.data.inputFlvFile;
        }
      }

      return {
        targetId: this.data.inputTargetId,
        inputUrl: flvUrl,
        flvUrl,
        streamExInfo: {
          productId: this.data.inputProductId,
          deviceName: this.data.inputDeviceName,
          xp2pInfo,
          codeUrl: this.data.inputCodeUrl,
        },
      };
    },
    startPlayer() {
      const streamData = this.getStreamData();
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
        showDebugInfo: this.data.showDebugInfoChecked,
      });
    },
  },
});

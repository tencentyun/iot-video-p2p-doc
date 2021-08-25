import config from '../../config';
import devices from '../../devices';

const xp2pPlugin = requirePlugin('xp2p');
const playerPlugin = requirePlugin('wechat-p2p-player');

const p2pExports = xp2pPlugin.p2p;
const { PlayerCloseType } = playerPlugin;

const defaultData = {
  xntp: {
    mode: 'server-xntp',
    ...config.server.xntp,
    targetId: '6e0b2be040a943489ef0b9bb344b96b8',
    flvPath: '6e0b2be040a943489ef0b9bb344b96b8.hd.flv',
  },
  tcp: {
    mode: 'server-tcp',
    ...config.server.tcp,
    targetId: '6e0b2be040a943489ef0b9bb344b96b8',
    flvPath: '6e0b2be040a943489ef0b9bb344b96b8.hd.flv',
  },
  tcp80: {
    mode: 'server-tcp',
    ...config.server.tcp80,
    targetId: '6e0b2be040a943489ef0b9bb344b96b8',
    flvPath: '6e0b2be040a943489ef0b9bb344b96b8.hd.flv',
  },
};

// ipc设备都加进去
const ipcBaseData = {
  mode: 'ipc',
  ...config.ipc['v1.3'],
};
for (const key in devices) {
  defaultData[key] = {
    ...ipcBaseData,
    ...devices[key],
    targetId: key,
  };
}

Component({
  behaviors: ['wx://component-export'],
  properties: {
    cfg: {
      type: String,
    },
    onlyp2p: {
      type: Boolean,
    },
  },
  data: {
    // 这是onLoad时就固定的
    mode: '',
    needPlayer: false,

    // 这些是不同的流，注意改变输入值不应该改变已经启动的p2p服务
    inputTargetId: '',
    inputUrl: '',

    // 1v1用
    inputProductId: '',
    inputDeviceName: '',
    inputXp2pInfo: '',
    inputFlvFile: '',
    inputCommand: '',

    // 1v多用
    inputCodeUrl: '',

    // 这些是p2p状态
    state: '',
    targetId: '',
    flvUrl: '',
    streamExInfo: null,
    playing: false,
    totalBytes: 0,
    innerUrl: '',
    peerlist: '',
    log: '',
    serviceTimestamps: {
      clickStartPlay: 0,
      prepareService: 0,
      serviceStarted: 0,
      conncted: 0,
      startStream: 0,
      request: 0,
      dataParsed: 0,
      firstChunk: 0,
    },

    // 这些是控制player和p2p的
    playerId: '',
    player: null,
    playerCtx: null,
  },
  lifetimes: {
    created() {
      // 在组件实例刚刚被创建时执行
    },
    attached() {
      // 在组件实例进入页面节点树时执行
      console.log(`[${this.id}]`, 'attached', this.id, this.properties);
      const data = (this.properties.cfg && defaultData[this.properties.cfg]) || defaultData.tcp;
      const onlyp2p = this.properties.onlyp2p || false;
      const needPlayer = !onlyp2p;
      const playerId = needPlayer
        ? `${this.id || `iot-p2p-player-${Date.now()}-${Math.floor(Math.random() * 1000)}`}-player`
        : '';
      const realHost = data.host || this.getHostFromPeername(data.peername);
      const flvFile = `${data.flvPath}${data.flvParams ? `?${data.flvParams}` : ''}`;
      this.setData(
        {
          mode: data.mode,
          needPlayer,
          playerId,
          inputTargetId: data.targetId || '',
          inputProductId: data.productId || '',
          inputDeviceName: data.deviceName || '',
          inputXp2pInfo: data.peername || '',
          inputFlvFile: flvFile || '',
          inputCommand: data.command || '',
          inputCodeUrl: data.codeUrl || '',
          inputUrl: `http://${realHost}${data.basePath}${flvFile}`,
          state: needPlayer ? '' : 'inited',
        },
        () => {
          console.log(`[${this.id}]`, 'attached, now data', this.data);
        },
      );
    },
    ready() {
      // 在组件在视图层布局完成后执行
    },
    detached() {
      // 在组件实例被从页面节点树移除时执行
      this.stopAll();
    },
    error() {
      // 每当组件方法抛出错误时执行
    },
  },
  export() {
    return {
      prepare: this.prepare.bind(this),
      startPlay: this.startPlay.bind(this),
      stopPlay: this.stopPlay.bind(this),
      startVoice: this.startVoice.bind(this),
      stopVoice: this.stopVoice.bind(this),
      stopAll: this.stopAll.bind(this),
    };
  },
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
    onPlayerReady({ detail }) {
      console.log(`[${this.id}]`, '======== onPlayerReady', detail);
      this.addLog('==== onPlayerReady');
      this.setData({
        state: 'inited',
        player: this.selectComponent(`#${this.data.playerId}`),
        playerCtx: detail.livePlayerContext,
      });
    },
    onPlayerStartPull() {
      console.info(`[${this.id}]`, '======== onPlayerStartPull');
      this.addLog('==== onPlayerStartPull');
      // 如果player请求断掉再恢复，持续的流无法播放，暂时p2p先重新拉流处理
      this.startStream();
    },
    onNetstatusChange(e) {
      // console.log('net change: ', e.detail.info);
    },
    onPlayerClose({ detail }) {
      console.info(`[${this.id}]`, '======== onPlayerClose', detail);
      this.addLog('==== onPlayerClose');
      if (detail.error?.code === PlayerCloseType.LIVE_PLAYER_CLOSED) {
        console.error('player close, now state: ', this.data.state);
        // 拉流过程中停止
        if (this.data.state === 'firstChunk' || this.data.state === 'dataParsed' || this.data.state === 'request') {
          // 因为player会自动重试，触发startPull回调，这里只是停止拉流即可。
          this.stopStream();
        }
      }
    },
    onPlayerStateChange({ detail }) {
      // console.log(`[${this.id}]`, '======== onPlayerStateChange', detail);
    },
    onPlayerError({ detail }) {
      console.log(`[${this.id}]`, '======== onPlayerError', detail);
      this.addLog('==== onPlayerError');
      if (detail.errMsg?.indexOf('system permission denied') >= 0) {
        // 如果liveplayer是RTC模式，当微信没有系统录音权限时会出错，但是没有专用的错误码，微信侧建议先判断errMsg来兼容
        this.triggerEvent('systemPermissionDenied', detail);
        return;
      }
      this.triggerEvent('playerError', detail);
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
    inputIPCCommand(e) {
      this.setData({
        inputCommand: e.detail.value,
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
    resetServiceData() {
      this.setData({
        targetId: '',
        flvUrl: '',
        streamExInfo: null,
        playing: false,
        totalBytes: 0,
        innerUrl: '',
        peerlist: '',
        log: '',
        serviceTimestamps: {},
      });
    },
    printData() {
      console.info(`[${this.id}]`, 'now data', this.data);
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
    prepare() {
      const streamData = this.getStreamData();
      if (!streamData) {
        return;
      }

      if (this.data.state !== 'inited') {
        this.showToast(`can not start service in state ${this.data.state}`);
        return;
      }

      this.setData(streamData, () => {
        // 确定 targetId 和 flvUrl
        console.log(`[${this.id}]`, 'prepare, now data', this.data);
        this.prepareService();
      });
    },
    stopAll() {
      if (!this.data.targetId) {
        return;
      }
      this.stopPlay();
      this.stopVoice();

      const { targetId } = this.data;
      this.resetServiceData();
      p2pExports.stopServiceById(targetId);

      if (this.data.player || !this.data.needPlayer) {
        this.setData({
          state: 'inited',
        });
      } else {
        this.setData({
          state: 'unknown', // 不应该到这里
        });
      }
    },
    startPlay() {
      const streamData = this.getStreamData();
      if (!streamData) {
        return;
      }

      if (this.data.state !== 'inited' && this.data.state !== 'serviceStarted') {
        this.showToast(`can not start service in state ${this.data.state}`);
        return;
      }

      this.addLog('click start play');
      this.setData(
        {
          ...streamData,
          'serviceTimestamps.clickStartPlay': Date.now(),
        },
        () => {
          // 确定 targetId 和 flvUrl
          console.log(`[${this.id}]`, 'startPlay, now data', this.data);
          if (this.data.needPlayer) {
            if (!this.data.playerCtx) {
              this.showToast('player not ready');
              return;
            }
            // 这个会触发 onPlayerStartPull
            this.data.playerCtx.play({
              success: (res) => {
                console.log(`[${this.id}]`, 'call play success');
                this.addLog('==== call play success');
              },
              fail: (res) => {
                console.log(`[${this.id}]`, 'call play fail', res);
                this.addLog('==== call play fail');
                this.showToast('call play fail');
              },
            });
          } else {
            this.startStream();
          }
        },
      );
    },
    stopPlay() {
      this.addLog('click stop play');
      if (this.data.needPlayer) {
        if (!this.data.playerCtx) {
          return;
        }
        // 这个会触发 onPlayerClose
        this.data.playerCtx.stop({
          success: (res) => {
            console.log(`[${this.id}]`, 'call stop success');
            this.addLog('==== call stop success');
          },
          fail: (res) => {
            console.log(`[${this.id}]`, 'call stop fail');
            this.addLog('==== call stop fail');
            this.showToast('call stop fail');
          },
        });
      } else {
        this.stopStream();
      }
    },
    startVoice(e) {
      console.log(e.currentTarget.dataset);
      const offCrypto = e.currentTarget.dataset.offcrypto || false;
      console.log('是否加密: ', !offCrypto);
      if (!this.data.targetId) {
        this.showToast('startVoice: invalid targetId');
        return;
      }
      console.log(`[${this.id}]`, 'startVoice');
      console.log('check auth');
      this.checkAudioAuthorize()
        .then((result) => {
          console.log('授权结果：', result);
          // 语音对讲
          const recorderManager = wx.getRecorderManager();

          p2pExports
            .startVoiceService(this.data.targetId, recorderManager, { wxObj: wx, offCrypto })
            .then((result) => {
              console.log(`[${this.id}]`, '语音服务启动结果', result);
              if (result === 0) {
                this.voiceState = 'started';
              }
            })
            .catch((error) => {
              console.log(`[${this.id}]`, '语音服务启动出错', error);
            });
        })
        .catch((error) => {
          // todo, 第一次弹窗未授权后，不再出现弹窗
          console.log('没有授权', error);
        });
    },
    stopVoice() {
      p2pExports.stopVoiceService(this.data.targetId);
      this.voiceState = 'stopped';
    },
    sendCommand() {
      if (!this.data.targetId) {
        this.showToast('sendCommand: invalid targetId');
        return;
      }

      if (!this.data.inputCommand) {
        this.showToast('sendCommand: please input command');
        return;
      }

      console.log(`[${this.id}]`, 'sendCommand', this.data.targetId, this.data.inputCommand);
      p2pExports
        .sendCommand(this.data.targetId, this.data.inputCommand)
        .then((res) => {
          console.log(`[${this.id}]`, 'sendCommand res', res);
          wx.showModal({
            content: `sendCommand res: type=${res.type}, status=${res.status}, data=${res.data}`,
            showCancel: false,
          });
        })
        .catch((errcode) => {
          console.error(`[${this.id}]`, 'sendCommand error', errcode);
          wx.showModal({
            content: `sendCommand error: ${errcode}`,
            showCancel: false,
          });
        });
    },
    prepareService(serviceSuccessCallback) {
      if (!this.data.targetId) {
        console.log('prepareService: invalid targetId', this.data);
        this.showToast('prepareService: invalid targetId');
        return;
      }

      if (!this.data.flvUrl) {
        console.log('prepareService: invalid flvUrl', this.data);
        this.showToast('prepareService: invalid flvUrl');
        return;
      }

      if (this.data.state === 'serviceStarted') {
        // 已经prepare过
        serviceSuccessCallback && serviceSuccessCallback();
        return;
      }

      if (this.data.state !== 'inited') {
        this.showToast(`can not start service in state: ${this.data.state}`);
        return;
      }

      const { targetId, flvUrl, streamExInfo } = this.data;
      console.log(`[${this.id}]`, 'startP2PService', targetId, flvUrl, streamExInfo);

      const msgCallback = (event, subtype, detail) => {
        this.onP2PMessage(targetId, event, subtype, detail);
      };

      const start = Date.now();
      this.addLog('prepare service');
      this.setData({ state: 'prepareService', 'serviceTimestamps.prepareService': start });

      p2pExports
        .startP2PService(
          targetId,
          { url: flvUrl, ...streamExInfo },
          {
            msgCallback,
            // 不传 dataCallback 表示后面再启动拉流
          },
        )
        .then((res) => {
          console.log(`[${this.id}]`, 'startP2PService res', res);
          if (res === 0) {
            const now = Date.now();
            console.log(`[${this.id}]`, 'startP2PService delay', now - start);
            this.addLog('service started');
            this.setData({ state: 'serviceStarted', 'serviceTimestamps.serviceStarted': now });
            serviceSuccessCallback && serviceSuccessCallback();
          } else {
            this.stopAll();
            wx.showModal({
              content: `startP2PService 失败, res=${res}`,
              showCancel: false,
            });
          }
        })
        .catch((errcode) => {
          console.error(`[${this.id}]`, 'startP2PService error', errcode);
          this.stopAll();
          wx.showModal({
            content: `startP2PService 失败, errcode: ${errcode}`,
            showCancel: false,
          });
        });
    },

    startStream() {
      let dataCallback;
      let chunkCount = 0;
      let totalBytes = 0;
      const onlyDataCallback = (data) => {
        const now = Date.now();
        chunkCount++;
        totalBytes += data.byteLength;
        if (chunkCount === 1) {
          this.addLog(`first chunk delay ${now - this.data.serviceTimestamps.clickStartPlay}`);
          this.setData({ state: 'firstChunk', 'serviceTimestamps.firstChunk': now });
        }
        this.setData({
          totalBytes,
        });
      };
      if (this.data.needPlayer) {
        // 用player触发请求时
        const { player } = this.data;
        dataCallback = (data) => {
          onlyDataCallback(data);
          player.addChunk(data);
        };
      } else {
        // 只拉数据时
        dataCallback = onlyDataCallback;
      }

      this.prepareService(() => {
        if (!this.data.targetId || this.data.playing) {
          return;
        }

        const [filename, params] = this.data.inputFlvFile.split('?');

        this.addLog(`start stream: ${filename} ${params}`);
        this.setData({
          state: 'startStream',
          'serviceTimestamps.startStream': Date.now(),
          playing: true,
          totalBytes: 0,
        });

        p2pExports.startP2PStream(this.data.targetId, {
          flv: { filename, params },
          // msgCallback, // 不传 msgCallback 就是保持之前设置的
          dataCallback,
        });
      });
    },
    stopStream() {
      if (!this.data.targetId || !this.data.playing) {
        return;
      }

      this.addLog('stop stream');
      this.setData({ state: 'serviceStarted', 'serviceTimestamps.startStream': 0, playing: false, totalBytes: 0 });

      p2pExports.stopP2PStream(this.data.targetId);
    },
    onP2PMessage(targetId, event, subtype, detail) {
      if (targetId !== this.data.targetId) {
        console.warn(
          `[${this.id}]`,
          `onP2PMessage, targetId error, now ${this.data.targetId}, receive`,
          targetId,
          event,
          subtype,
        );
        return;
      }

      switch (event) {
        case p2pExports.XP2PEventEnum.Notify:
          this.onP2PMessage_Notify(subtype, detail);
          break;

        case p2pExports.XP2PEventEnum.DevNotify:
          this.onP2PMessage_DevNotify(subtype, detail);
          break;

        case p2pExports.XP2PEventEnum.Log:
          console.log(`[${this.id}]`, 'onP2PMessage, Log', subtype, detail);
          break;

        default:
          console.log(`[${this.id}]`, 'onP2PMessage, unknown event', event, subtype);
      }
    },
    onP2PMessage_Notify(type, detail) {
      const now = Date.now();
      switch (type) {
        case p2pExports.XP2PNotify_SubType.Connected:
          console.log(`[${this.id}]`, 'XP2PNotify_SubType.Connected', detail);
          this.addLog('notify conncted');
          this.addLog(`connct delay ${now - this.data.serviceTimestamps.prepareService}`);
          // 注意不要修改state，Connected只在心跳保活时可能收到，不在关键路径上，只是记录一下
          this.setData({ 'serviceTimestamps.conncted': now });
          break;
        case p2pExports.XP2PNotify_SubType.Request:
          console.log(`[${this.id}]`, 'XP2PNotify_SubType.Request', detail);
          this.addLog('notify request');
          this.setData({ state: 'request', 'serviceTimestamps.request': now });
          break;
        case p2pExports.XP2PNotify_SubType.Parsed:
          // 数据传输开始
          console.log(`[${this.id}]`, 'XP2PNotify_SubType.Parsed', detail);
          this.addLog('notify parsed');
          this.addLog(`parsed delay ${now - this.data.serviceTimestamps.clickStartPlay}`);
          this.setData({ state: 'dataParsed', 'serviceTimestamps.dataParsed': now });
          break;
        case p2pExports.XP2PNotify_SubType.Success:
        case p2pExports.XP2PNotify_SubType.Eof:
          // 数据传输正常结束
          console.log(`[${this.id}]`, 'XP2PNotify_SubType.Success/Eof', detail);
          if (this.data.state === 'dataParsed' || this.data.state === 'firstChunk') {
            // dataParsed 之前的好像可以自动重试
            this.showToast('直播结束');
          }
          this.stopStream();
          break;
        case p2pExports.XP2PNotify_SubType.Fail:
          // 数据传输出错
          console.log(`[${this.id}]`, 'XP2PNotify_SubType.Fail', detail);
          this.showToast(`直播请求出错, errcode: ${detail.errcode}`);
          this.stopStream();
          break;
        case p2pExports.XP2PNotify_SubType.Close:
          // 用户主动关闭
          console.log(`[${this.id}]`, 'XP2PNotify_SubType.Close', detail);
          break;
        case p2pExports.XP2PNotify_SubType.Disconnect:
          // p2p链路断开
          console.error(`[${this.id}]`, 'XP2PNotify_SubType.Disconnect', detail);
          if (this.data.state && this.data.state !== 'inited') {
            this.showToast('连接断开');
            this.stopAll();
            this.triggerEvent('p2pNotify', {
              playerId: this.id,
              targetId: this.data.targetId,
              type,
              detail,
            });
          }
          break;
      }
    },
    onP2PMessage_DevNotify(type, detail) {
      switch (type) {
        case p2pExports.XP2PDevNotify_SubType.InnerUrl:
          this.setData({ innerUrl: detail });
          break;
        case p2pExports.XP2PDevNotify_SubType.Peerlist:
          this.setData({ peerlist: `${Date.now()} - ${detail}` });
          break;
        case p2pExports.XP2PDevNotify_SubType.Subscribe:
          this.addLog(detail);
          break;
      }
    },
    addLog(str) {
      this.setData({ log: `${this.data.log}${Date.now()} - ${str}\n` });
    },
    checkAudioAuthorize() {
      return new Promise((resolve, reject) => {
        wx.getSetting({
          success(res) {
            if (!res.authSetting['scope.record']) {
              wx.authorize({
                scope: 'scope.record',
                success() {
                  // 用户已经同意小程序使用录音功能，后续调用 wx.startRecord 接口不会弹窗询问
                  resolve(0);
                },
                fail() {
                  reject(1);
                },
              });
            } else {
              resolve(0);
            }
          },
        });
      });
    },
  },
});

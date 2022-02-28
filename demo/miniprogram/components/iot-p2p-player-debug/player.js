import config from '../../config/config';
import { canUseP2PIPCMode, canUseP2PServerMode, adjustXp2pInfo } from '../../utils';
import { getXp2pManager, Xp2pManagerErrorEnum } from '../../xp2pManager';

const xp2pManager = getXp2pManager();
const { XP2PEventEnum, XP2PNotify_SubType, XP2PDevNotify_SubType } = xp2pManager;

const { commandMap } = config;

// ts才能用enum，先这么处理吧
const PlayStateEnum = {
  unknown: 'unknown',
  playerReady: 'playerReady',
  playerError: 'playerError',
  servicePreparing: 'servicePreparing',
  serviceStarted: 'serviceStarted',
  // 这些全部 stream 开头，方便清理
  streamPreparing: 'streamPreparing',
  streamStarted: 'streamStarted',
  streamRequest: 'streamRequest',
  streamHeaderParsed: 'streamHeaderParsed',
  streamFirstChunk: 'streamFirstChunk',
};

const PlayErrorEnum = {
  localServerError: 'localServerError',
  p2pDisconnect: 'p2pDisconnect',
  p2pPlayerError: 'p2pPlayerError',
  livePlayerError: 'livePlayerError',
  livePlayerStateChange: 'livePlayerStateChange',
};
const errMsgMap = {
  [PlayErrorEnum.localServerError]: '本地连接失败',
  [PlayErrorEnum.p2pDisconnect]: '连接失败或断开',
  [PlayErrorEnum.p2pPlayerError]: '播放器错误',
  [PlayErrorEnum.livePlayerError]: '播放器错误',
  [PlayErrorEnum.livePlayerStateChange]: '播放失败',
};

Component({
  behaviors: ['wx://component-export'],
  properties: {
    cfg: {
      type: String,
    },
    onlyp2p: {
      type: Boolean,
    },
    reserve: {
      type: Boolean,
    },
  },
  data: {
    // 这是onLoad时就固定的
    mode: '',
    canUseP2P: false,
    needPlayer: false,
    realReserve: false,

    // 这些是不同的流，注意改变输入值不应该改变已经启动的p2p服务
    inputTargetId: '',
    inputUrl: '',

    // 1v1用
    inputProductId: '',
    inputDeviceName: '',
    inputXp2pInfo: '',
    inputFlvParams: '',
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
    serviceTimestamps: {},

    // 语音对讲
    voiceState: '',

    // 这些是控制player和p2p的
    hasPlayer: false, // needPlayer时才有效，出错销毁时设为false
    playerId: '',
    playerComp: null,
    playerCtx: null,
    playerMsg: '',
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
        this.setData({ playerMsg: `无效的配置 ${this.properties.cfg}` });
        return;
      }
      const canUseP2P = (data.mode === 'ipc' && canUseP2PIPCMode) || (data.mode === 'server' && canUseP2PServerMode);
      const onlyp2p = this.properties.onlyp2p || false;
      const reserve = this.properties.reserve || false;
      const realReserve = data.mode === 'ipc' && reserve;
      const needPlayer = !onlyp2p;
      const hasPlayer = needPlayer && canUseP2P;
      const playerId = needPlayer
        ? `${this.id || `iot-p2p-player-${Date.now()}-${Math.floor(Math.random() * 1000)}`}-player`
        : '';
      const playerMsg = needPlayer && !canUseP2P ? '您的微信基础库版本过低，请升级后再使用' : '';
      this.setData(
        {
          mode: data.mode,
          canUseP2P,
          needPlayer,
          realReserve,
          hasPlayer,
          playerId,
          playerMsg,
          inputTargetId: data.targetId || '',
          inputProductId: data.productId || '',
          inputDeviceName: data.deviceName || '',
          inputXp2pInfo: data.xp2pInfo || data.peername || '',
          inputFlvParams: data.liveParams || '',
          inputCommand: 'action=inner_define&channel=0&cmd=get_device_st&type=playback',
          inputCodeUrl: data.codeUrl || '',
          inputUrl: data.flvUrl || '',
          state: needPlayer ? '' : PlayStateEnum.playerReady,
        },
        () => {
          console.log(`[${this.id}]`, 'attached, now data', this.data);
          if (this.data.state === PlayStateEnum.playerReady) {
            this.checkReservedService();
          }
        },
      );
    },
    ready() {
      // 在组件在视图层布局完成后执行
    },
    detached() {
      // 在组件实例被从页面节点树移除时执行
      this.stopAll('auto');
    },
    error() {
      // 每当组件方法抛出错误时执行
    },
  },
  export() {
    return {
      prepare: this.prepare.bind(this),
      stopAll: this.stopAll.bind(this),
      addLog: this.addLog.bind(this),
    };
  },
  methods: {
    showToast(content) {
      wx.showToast({
        title: content,
        icon: 'none',
      });
    },
    addLog(str) {
      const newLog = `${this.data.log}${Date.now()} - ${str}\n`;
      this.setData({ log: newLog });
      return newLog;
    },
    setLog(str) {
      const newLog = `${Date.now()} - ${str}\n`;
      this.setData({ log: newLog });
      return newLog;
    },
    clearLog() {
      this.setData({ log: '' });
    },
    checkReservedService() {
      if (!this.data.realReserve) {
        return;
      }
      const nowService = xp2pManager.getServiceInitInfo(this.data.inputTargetId);
      if (!nowService || !nowService.id || !nowService.streamInfo) {
        return;
      }

      // 有保留连接
      this.addLog('service already started');

      // 更新callbacks
      xp2pManager.updateServiceCallbacks(nowService.id, {
        msgCallback: (event, subtype, detail) => {
          this.onP2PMessage(nowService.id, event, subtype, detail);
        },
      });

      // 之前的信息显示出来
      const { streamInfo } = nowService;
      // 解析flvParams
      let flvParams = this.data.inputFlvParams;
      const index = streamInfo.url.lastIndexOf('/');
      if (index >= 0) {
        const flvFile = streamInfo.url.substr(index + 1) || '';
        flvParams = flvFile.split('?')[1] || '';
      }
      this.setData(
        {
          targetId: nowService.id,
          inputUrl: streamInfo.url,
          flvUrl: streamInfo.url,
          inputProductId: streamInfo.productId || '',
          inputDeviceName: streamInfo.deviceName || '',
          inputXp2pInfo: streamInfo.xp2pInfo || '',
          inputFlvParams: flvParams || '',
          inputCodeUrl: streamInfo.codeUrl || '',
          streamExInfo: {
            productId: streamInfo.productId,
            deviceName: streamInfo.deviceName,
            xp2pInfo: streamInfo.xp2pInfo,
            codeUrl: streamInfo.codeUrl,
          },
          state: PlayStateEnum.serviceStarted,
        },
        () => {
          console.log(`[${this.id}]`, 'use init streamInfo, now data', this.data);
        },
      );
    },
    onPlayerReady({ detail }) {
      console.log(`[${this.id}]`, '======== onPlayerReady', detail);
      this.addLog('==== onPlayerReady');
      this.setData(
        {
          state: PlayStateEnum.playerReady,
          playerComp: this.selectComponent(`#${this.data.playerId}`),
          playerCtx: detail.livePlayerContext,
        },
        () => {
          if (this.data.state === PlayStateEnum.playerReady) {
            this.checkReservedService();
          }
        },
      );
    },
    onPlayerStartPull() {
      console.info(`[${this.id}]`, `======== onPlayerStartPull in state ${this.data.state}`, this.data.targetId);
      if (!this.data.targetId) {
        return;
      }
      this.addLog('==== onPlayerStartPull');
      // 如果player请求断掉再恢复，持续的流无法播放，暂时p2p先重新拉流处理
      this.startStream();
    },
    onPlayerClose({ detail }) {
      console.info(`[${this.id}]`, `======== onPlayerClose in state ${this.data.state}`, this.data.targetId, detail);
      if (!this.data.targetId) {
        return;
      }
      this.addLog('==== onPlayerClose');
      // 停止拉流
      this.stopStream();
    },
    onPlayerError({ detail }) {
      console.log(`[${this.id}]`, '======== onPlayerError', detail);
      this.addLog('==== onPlayerError');
      this.setData({
        state: PlayStateEnum.playerError,
      });
      this.stopPlay();
      this.handlePlayError(PlayErrorEnum.PlayerError, { msg: `p2pPlayerError: ${detail.error.code}` });
    },
    // eslint-disable-next-line no-unused-vars, @typescript-eslint/no-unused-vars
    onLivePlayerError({ detail }) {
      console.error(`[${this.id}]`, '======== onLivePlayerError', detail);
      this.addLog('==== onLivePlayerError');
      this.setData({
        state: PlayStateEnum.playerError,
      });
      if (detail.errMsg && detail.errMsg.indexOf('system permission denied') >= 0) {
        // 如果liveplayer是RTC模式，当微信没有系统录音权限时会出错，但是没有专用的错误码，微信侧建议先判断errMsg来兼容
        this.triggerEvent('systemPermissionDenied', detail);
        return;
      }
      // TODO 什么情况会走到这里？
      this.stopPlay();

      this.handlePlayError(PlayErrorEnum.livePlayerError, { msg: `livePlayerError: ${detail.errMsg}` });
    },
    // eslint-disable-next-line no-unused-vars, @typescript-eslint/no-unused-vars
    onLivePlayerStateChange({ detail }) {
      // console.log(`[${this.id}]`, '======== onLivePlayerStateChange', detail.code, detail.message);
      if (!this.data.targetId) {
        // 已经停止p2pservice了，不再处理
        return;
      }
      switch (detail.code) {
        case 2103: // 网络断连, 已启动自动重连
          console.error('==== onLivePlayerStateChange', detail.code, detail);
          if (/errCode:-1004(\D|$)/.test(detail.message)) {
            // -1004 无法连接服务器
            xp2pManager.needResetLocalServer = true;

            // 这时其实网络状态应该也变了，但是网络状态变化事件延迟较大，networkChanged不一定为true
            // 所以把 networkChanged 也设为true
            xp2pManager.networkChanged = true;

            this.addLog('==== onLivePlayerStateChange 2103 无法连接本地server');
            this.stopAll();
            this.setData({ hasPlayer: false });
            this.handlePlayError(PlayErrorEnum.localServerError, { msg: `livePlayerStateChange: ${detail.code} ${detail.message}` });
          }
          break;
        case -2301: // live-player断连，且经多次重连抢救无效，需要提示出错，由用户手动重试
          console.error('==== onLivePlayerStateChange', detail.code, detail);
          // 到这里应该已经触发过 onPlayerClose 了
          this.addLog('==== onLivePlayerStateChange -2301 多次重连抢救无效');
          this.stopPlay();
          this.handlePlayError(PlayErrorEnum.livePlayerStateChange, { msg: `livePlayerStateChange: ${detail.code} ${detail.message}` });
          break;
      }
    },
    // eslint-disable-next-line no-unused-vars, @typescript-eslint/no-unused-vars
    onLivePlayerNetStatusChange({ detail }) {
      // console.log(`[${this.id}]`, '======== onLivePlayerNetStatusChange', detail.info);
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
    inputIPCFlvParams(e) {
      this.setData({
        inputFlvParams: e.detail.value,
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
        // log: '', // 保留log，开始新的时再清
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
        if (!this.data.inputFlvParams) {
          this.showToast('please input live params');
          return;
        }
      } else {
        if (!this.data.inputUrl) {
          this.showToast('please input url');
          return;
        }
      }

      let flvUrl = '';
      if (this.data.mode === 'ipc') {
        flvUrl = `http://XP2P_INFO.xnet/ipc.p2p.com/ipc.flv?${this.data.inputFlvParams}`;
      } else {
        flvUrl = this.data.inputUrl;
      }

      return {
        targetId: this.data.inputTargetId,
        inputUrl: flvUrl,
        flvUrl,
        streamExInfo: {
          productId: this.data.inputProductId,
          deviceName: this.data.inputDeviceName,
          xp2pInfo: adjustXp2pInfo(this.data.inputXp2pInfo), // 兼容直接填 peername 的情况
          codeUrl: this.data.inputCodeUrl,
        },
      };
    },
    prepare() {
      const streamData = this.getStreamData();
      if (!streamData) {
        return;
      }

      if (this.data.state !== PlayStateEnum.playerReady) {
        this.showToast(`can not start service in state ${this.data.state}`);
        return;
      }

      this.clearLog();

      this.setData(streamData, () => {
        // 确定 targetId 和 flvUrl
        console.log(`[${this.id}]`, 'prepare, now data', this.data);
        this.prepareService();
      });
    },
    stopAll(e) {
      if (!this.data.targetId) {
        return;
      }

      if (e && e.currentTarget) {
        // 这是真的点击
        this.addLog('click stop all');
      } else {
        this.addLog('stop all');
      }

      this.stopVoice();

      // 不用等stopPlay的回调，先把流停掉
      this.stopStream();
      this.stopPlay();

      let reserve;
      if (e === 'auto') {
        reserve = this.data.realReserve;
      } else if (e === true) {
        // 必须指定true才保留，因为e还可能是 clickevent 等等
        reserve = true;
      } else {
        // 其他都不保留
        reserve = false;
      }

      // 1v1 才支持保留连接
      const realReserve = this.data.mode === 'ipc' && reserve === true;
      if (realReserve) {
        // 保留连接
        console.log(`[${this.id}]`, 'stopAll but reserve');
      } else {
        // 不保留，全部停掉
        console.log(`[${this.id}]`, 'stopAll');
        const { targetId } = this.data;
        this.resetServiceData();
        xp2pManager.stopP2PService(targetId);
      }

      if (this.data.playerComp || !this.data.needPlayer) {
        this.setData({
          state: PlayStateEnum.playerReady,
        });
      } else {
        this.setData({
          state: PlayStateEnum.unknown, // 不应该到这里
        });
      }
    },
    startPlay() {
      const streamData = this.getStreamData();
      if (!streamData) {
        return;
      }

      if (this.data.state !== PlayStateEnum.playerReady && this.data.state !== PlayStateEnum.serviceStarted) {
        this.showToast(`can not start service in state ${this.data.state}`);
        return;
      }

      if (this.data.targetId) {
        // prepare 后再 startPlay，保留log
        this.addLog('click start play');
      } else {
        // 直接 startPlay，先清掉
        this.setLog('click start play');
      }

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
                console.log(`[${this.id}]`, 'call play success', res);
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
    stopPlay(e) {
      if (e && e.currentTarget) {
        // 这是真的点击
        this.addLog('click stop play');
      } else {
        this.addLog('stop play');
      }

      if (this.data.needPlayer) {
        if (!this.data.playerCtx) {
          return;
        }
        // 这个会触发 onPlayerClose
        try {
          this.data.playerCtx.stop({
            success: (res) => {
              console.log(`[${this.id}]`, 'call stop success', res);
              this.addLog('==== call stop success');
            },
            fail: (res) => {
              console.log(`[${this.id}]`, 'call stop fail', res);
              this.addLog('==== call stop fail');
              this.showToast('call stop fail');
            },
          });
        } catch (err) {
          // 各种err
          console.log(`[${this.id}]`, 'call stop err', err);
          this.stopStream();
        }
      } else {
        this.stopStream();
      }
    },
    startVoice(e) {
      if (!this.data.targetId) {
        this.showToast('startVoice: invalid targetId');
        return;
      }

      if (this.data.voiceState === 'starting' || this.data.voiceState === 'sending') {
        this.showToast(`can not start voice in voiceState ${this.data.voiceState}`);
        return;
      }

      // 每种采样率有对应的编码码率范围有效值，设置不合法的采样率或编码码率会导致录音失败
      // 具体参考 https://developers.weixin.qq.com/miniprogram/dev/api/media/recorder/RecorderManager.start.html
      const [numberOfChannels, sampleRate, encodeBitRate] = e.currentTarget.dataset.recorderCfg
        .split('-')
        .map((v) => Number(v));
      const recorderOptions = {
        numberOfChannels, // 录音通道数
        sampleRate, // 采样率
        encodeBitRate, // 编码码率
      };

      console.log(`[${this.id}]`, 'startVoice', e.currentTarget.dataset, recorderOptions);
      this.setData({ voiceState: 'starting' });
      xp2pManager
        .startVoice(this.data.targetId, recorderOptions, {
          onPause: (res) => {
            console.log(`[${this.id}]`, 'voice onPause', res);
            // 简单点，recorder暂停就停止语音对讲
            this.stopVoice();
          },
          onStop: (res) => {
            console.log(`[${this.id}]`, 'voice onStop', res);
            if (res.willRestart) {
              // 如果是到时间触发的，插件会自动续期，不自动restart的才需要stopVoice
              this.stopVoice();
            }
          },
        })
        .then((res) => {
          console.log(`[${this.id}]`, 'startVoice success', res);
          this.setData({ voiceState: 'sending' });
        })
        .catch((res) => {
          console.log(`[${this.id}]`, 'startVoice fail', res);
          this.setData({ voiceState: '' });
          wx.showToast({
            title: res === Xp2pManagerErrorEnum.NoAuth ? '请授权小程序访问麦克风' : '发起语音对讲失败',
            icon: 'error',
          });
        });
    },
    stopVoice() {
      xp2pManager.stopVoice(this.data.targetId);
      this.setData({ voiceState: '' });
    },
    sendCommand(e) {
      if (!this.data.targetId) {
        this.showToast('sendCommand: invalid targetId');
        return;
      }

      let cmdDetail;
      const { cmd } = e.currentTarget.dataset;
      console.log(`[${this.id}]`, 'sendCommand', this.data.targetId, cmd);
      if (cmd) {
        // 内置信令
        if (!commandMap[cmd]) {
          this.showToast(`sendCommand: invalid cmd ${cmd}`);
          return;
        }
        cmdDetail = commandMap[cmd];
        xp2pManager
          .sendInnerCommand(this.data.targetId, cmdDetail)
          .then((res) => {
            console.log(`[${this.id}]`, 'sendInnerCommand res', res);
            wx.showModal({
              content: `sendInnerCommand res: ${JSON.stringify(res, null, 2)}`,
              showCancel: false,
            });
          })
          .catch((errmsg) => {
            console.error(`[${this.id}]`, 'sendInnerCommand error', errmsg);
            wx.showModal({
              content: errmsg,
              showCancel: false,
            });
          });
      } else {
        // 自定义信令
        if (!this.data.inputCommand) {
          this.showToast('sendCommand: please input command');
          return;
        }
        xp2pManager
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
      }
    },
    prepareService(serviceSuccessCallback) {
      if (!this.data.targetId) {
        console.log(`[${this.id}]`, 'prepareService: invalid targetId', this.data);
        this.showToast('prepareService: invalid targetId');
        return;
      }

      if (!this.data.flvUrl) {
        console.log(`[${this.id}]`, 'prepareService: invalid flvUrl', this.data);
        this.showToast('prepareService: invalid flvUrl');
        return;
      }

      if (this.data.state === PlayStateEnum.serviceStarted) {
        // 已经prepare过
        serviceSuccessCallback && serviceSuccessCallback();
        return;
      }

      if (this.data.state !== PlayStateEnum.playerReady) {
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
      this.setData({ state: PlayStateEnum.servicePreparing, 'serviceTimestamps.servicePreparing': start });

      xp2pManager
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
            this.setData({ state: PlayStateEnum.serviceStarted, 'serviceTimestamps.serviceStarted': now });
            serviceSuccessCallback && serviceSuccessCallback();
          } else {
            this.addLog('start service error');
            this.stopAll();
            wx.showModal({
              content: `startP2PService 失败, res=${res}`,
              showCancel: false,
            });
          }
        })
        .catch((errcode) => {
          console.error(`[${this.id}]`, 'startP2PService error', errcode);
          this.addLog('start service error');
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
          console.log(`[${this.id}]`, 'firstChunk', data.byteLength);
          this.addLog(`first chunk delay ${now - this.data.serviceTimestamps.clickStartPlay}`);
          this.setData({ state: PlayStateEnum.streamFirstChunk, 'serviceTimestamps.streamFirstChunk': now });
        }
        this.setData({
          totalBytes,
        });
      };
      if (this.data.needPlayer) {
        // 用player触发请求时
        const { playerComp } = this.data;
        dataCallback = (data) => {
          onlyDataCallback(data);
          playerComp.addChunk(data);
        };
      } else {
        // 只拉数据时
        dataCallback = onlyDataCallback;
      }

      this.prepareService(() => {
        if (!this.data.targetId || this.data.playing) {
          return;
        }

        let flv = null;
        if (this.data.mode === 'ipc') {
          flv = {
            filename: 'ipc.flv',
            params: this.data.inputFlvParams,
          };
          this.addLog(`start stream: ${flv.filename}?${flv.params || ''}`);
        } else {
          this.addLog('start stream');
        }

        const newTimestamps = this.clearStreamTimestamps();
        newTimestamps.streamPreparing = Date.now();
        this.setData({
          state: PlayStateEnum.streamPreparing,
          serviceTimestamps: newTimestamps,
          playing: true,
          totalBytes: 0,
        });

        xp2pManager
          .startStream(this.data.targetId, {
            flv,
            // msgCallback, // 不传 msgCallback 就是保持之前设置的
            dataCallback,
          })
          .then((res) => {
            console.log(`[${this.id}]`, 'startStream success', res);
            this.addLog('stream started');
            this.setData({
              state: PlayStateEnum.streamStarted,
              'serviceTimestamps.streamStarted': Date.now(),
            });
          })
          .catch((res) => {
            console.log(`[${this.id}]`, 'startStream fail', res);
            this.addLog('start stream error');
            this.setData({
              state: PlayStateEnum.serviceStarted,
              'serviceTimestamps.streamPreparing': 0,
              playing: false,
              totalBytes: 0,
            });
          });
      });
    },
    stopStream() {
      if (!this.data.targetId || !this.data.playing) {
        return;
      }

      this.addLog('stop stream');
      this.clearStreamTimestamps();
      this.setData({
        state: PlayStateEnum.serviceStarted,
        playing: false,
        totalBytes: 0,
      });

      xp2pManager.stopStream(this.data.targetId);
    },
    clearStreamTimestamps() {
      const newTimestamps = {};
      for (const key in this.data.serviceTimestamps) {
        if (!/^stream/.test(key)) {
          newTimestamps[key] = this.data.serviceTimestamps[key];
        }
      }
      this.setData({
        serviceTimestamps: newTimestamps,
      });
      return newTimestamps;
    },
    checkCanRetry(type, detail) {
      if (xp2pManager.networkChanged || xp2pManager.needResetLocalServer) {
        // 网络状态变化了，退出重来
        console.log(`[${this.id}]`, 'networkChanged or needResetLocalServer, trigger playError');
        this.stopAll();
        this.triggerEvent('playError', {
          errType: type,
          errMsg: xp2pManager.needResetLocalServer ? errMsgMap.localServerError : errMsgMap.p2pDisconnect,
          errDetail: detail,
          isFatalError: true,
        });
        return false;
      }
      return true;
    },
    // 处理播放错误
    handlePlayError(type, detail) {
      if (!this.checkCanRetry(type, detail)) {
        return;
      }

      // 能retry的才提示这个，不能retry的前面已经触发弹窗了
      this.triggerEvent('playError', {
        errType: type,
        errMsg: errMsgMap[type] || '播放失败',
        errDetail: detail,
      });
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
        case XP2PEventEnum.Notify:
          this.onP2PMessage_Notify(subtype, detail);
          break;

        case XP2PEventEnum.DevNotify:
          this.onP2PMessage_DevNotify(subtype, detail);
          break;

        case XP2PEventEnum.Log:
          console.log(`[${this.id}]`, 'onP2PMessage, Log', subtype, detail);
          break;

        default:
          console.log(`[${this.id}]`, 'onP2PMessage, unknown event', event, subtype);
      }
    },
    onP2PMessage_Notify(type, detail) {
      console.log(`[${this.id}]`, 'onP2PMessage_Notify', type, detail);
      this.addLog(`p2p notify ${type}`);
      const now = Date.now();
      switch (type) {
        case XP2PNotify_SubType.Connected:
          this.addLog(`connect delay ${now - this.data.serviceTimestamps.servicePreparing}`);
          // 注意不要修改state，Connected只在心跳保活时可能收到，不在关键路径上，只是记录一下
          this.setData({ 'serviceTimestamps.serviceConnected': now });
          break;
        case XP2PNotify_SubType.Request:
          this.setData({ state: PlayStateEnum.streamRequest, 'serviceTimestamps.streamRequest': now });
          break;
        case XP2PNotify_SubType.Parsed:
          // 数据传输开始
          this.addLog(`parsed delay ${now - this.data.serviceTimestamps.clickStartPlay}`);
          this.setData({ state: PlayStateEnum.streamHeaderParsed, 'serviceTimestamps.streamHeaderParsed': now });
          break;
        case XP2PNotify_SubType.Success:
        case XP2PNotify_SubType.Eof:
          // 数据传输正常结束
          if (
            this.data.state === PlayStateEnum.streamHeaderParsed
              || this.data.state === PlayStateEnum.streamFirstChunk
          ) {
            // dataParsed 之前的好像可以自动重试
            this.showToast('直播结束或断开');
          }
          this.stopStream();
          break;
        case XP2PNotify_SubType.Fail:
          // 数据传输出错
          this.showToast(`直播请求出错, errcode: ${detail.errcode}`);
          this.stopStream();
          break;
        case XP2PNotify_SubType.Close:
          // 用户主动关闭
          this.stopStream();
          break;
        case XP2PNotify_SubType.Disconnect:
          // p2p链路断开
          console.error(`[${this.id}]`, `XP2PNotify_SubType.Disconnect in state ${this.data.state}`, detail);
          this.stopAll();
          this.handlePlayError(PlayErrorEnum.p2pDisconnect, { msg: `p2pNotify: ${type} ${detail}` });
          break;
      }
    },
    onP2PMessage_DevNotify(type, detail) {
      switch (type) {
        case XP2PDevNotify_SubType.InnerUrl:
          this.setData({ innerUrl: detail });
          break;
        case XP2PDevNotify_SubType.Peerlist:
          this.setData({ peerlist: `${Date.now()} - ${detail}` });
          break;
        case XP2PDevNotify_SubType.Subscribe:
          this.addLog(detail);
          break;
      }
    },
  },
});

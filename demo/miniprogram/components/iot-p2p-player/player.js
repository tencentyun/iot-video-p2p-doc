import config from '../../config/config';
import { canUseP2P } from '../../utils';
import { getXp2pManager, Xp2pManagerErrorEnum } from '../../xp2pManager';

const xp2pManager = getXp2pManager();
const { XP2PEventEnum, XP2PNotify_SubType, XP2PDevNotify_SubType } = xp2pManager;

const { commandMap } = config;

// ts才能用enum，先这么处理吧
const PlayStateEnum = {
  unknown: 'unknown',
  playerReady: 'playerReady',
  playerError: 'playerError',
  servicePrearing: 'servicePrearing',
  serviceStarted: 'serviceStarted',
  // 这些全部 stream 开头，方便清理
  streamPreparing: 'streamPreparing',
  streamStarted: 'streamStarted',
  streamRequest: 'streamRequest',
  streamHeaderParsed: 'streamHeaderParsed',
  streamFirstChunk: 'streamFirstChunk',
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
    needPlayer: false,
    realReserve: false,

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
    serviceTimestamps: {},

    // 语音对讲
    voiceState: '',

    // 这些是控制player和p2p的
    hasPlayer: false, // needPlayer时才有效，出错销毁时设为false
    playerId: '',
    player: null,
    playerCtx: null,
    playerMsg: '',

    // 搞个方便操作的面板
    showPTZPanel: false,
    ptzBtns: [
      { name: 'up', cmd: 'ptz_up_press' },
      { name: 'down', cmd: 'ptz_down_press' },
      { name: 'left', cmd: 'ptz_left_press' },
      { name: 'right', cmd: 'ptz_right_press' }
    ],
    ptzCmd: '',
    releasePTZTimer: null,
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
      const onlyp2p = this.properties.onlyp2p || false;
      const reserve = this.properties.reserve || false;
      const realReserve = data.mode === 'ipc' && reserve;
      const needPlayer = !onlyp2p;
      const hasPlayer = needPlayer && canUseP2P;
      const playerId = needPlayer
        ? `${this.id || `iot-p2p-player-${Date.now()}-${Math.floor(Math.random() * 1000)}`}-player`
        : '';
      const playerMsg = needPlayer && !canUseP2P ? '您的微信基础库版本过低，请升级后再使用' : '';
      const realHost = data.host || this.getHostFromPeername(data.peername);
      const flvFile = `${data.flvPath}${data.flvParams ? `?${data.flvParams}` : ''}`;
      this.setData(
        {
          mode: data.mode,
          needPlayer,
          realReserve,
          hasPlayer,
          playerId,
          playerMsg,
          inputTargetId: data.targetId || '',
          inputProductId: data.productId || '',
          inputDeviceName: data.deviceName || '',
          inputXp2pInfo: data.peername || '',
          inputFlvFile: flvFile || '',
          inputCommand: data.command || '',
          inputCodeUrl: data.codeUrl || '',
          inputUrl: `http://${realHost}${data.basePath}${flvFile}`,
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
      // 解析flvFile
      let flvFile = this.data.inputFlvFile;
      const index = streamInfo.url.lastIndexOf('/');
      if (index >= 0) {
        flvFile = streamInfo.url.substr(index + 1) || flvFile;
      }
      this.setData(
        {
          targetId: nowService.id,
          inputUrl: streamInfo.url,
          flvUrl: streamInfo.url,
          inputProductId: streamInfo.productId || '',
          inputDeviceName: streamInfo.deviceName || '',
          inputXp2pInfo: streamInfo.xp2pInfo || '',
          inputFlvFile: flvFile || '',
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
          player: this.selectComponent(`#${this.data.playerId}`),
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
      wx.showModal({
        content: `player error: ${detail.error && detail.error.code}`,
        showCancel: false,
      });
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

      this.checkCanRetry('livePlayerError', detail);
    },
    // eslint-disable-next-line no-unused-vars, @typescript-eslint/no-unused-vars
    onLivePlayerStateChange({ detail }) {
      // console.log(`[${this.id}]`, '======== onLivePlayerStateChange', detail.code, detail.message);
      switch (detail.code) {
        case 2103: // 网络断连, 已启动自动重连
          console.error('==== onLivePlayerStateChange', detail.code, detail);
          if (detail.message.indexOf('errCode:-1004 ') >= 0) {
            // 无法连接服务器，就是本地server连不上
            if (!this.data.targetId) {
              return;
            }

            // 这时其实网络状态应该也变了，但是网络状态变化事件延迟较大，networkChanged不一定为true
            // 所以把 networkChanged 也设为true
            xp2pManager.networkChanged = true;

            this.addLog('==== onLivePlayerStateChange 2103 无法连接本地server');
            this.showToast('本地连接失败');
            this.stopAll();
            this.setData({ hasPlayer: false });
            this.triggerEvent('localServerError', {
              playerId: this.id,
              targetId: this.data.targetId,
              notifyDetail: detail,
            });
          }
          break;
        case -2301: // live-player断连，且经多次重连抢救无效，更多重试请自行重启播放
          console.error('==== onLivePlayerStateChange', detail.code, detail);
          // 到这里应该已经触发过 onPlayerClose 了
          if (!this.data.targetId) {
            return;
          }
          this.addLog('==== onLivePlayerStateChange -2301 多次重连抢救无效');
          this.stopPlay();
          this.checkCanRetry('livePlayerStateChange', detail);
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
        // log: '', // 保留log，开始新的时再清
        serviceTimestamps: {},
        showPTZPanel: false,
        ptzCmd: '',
        releasePTZTimer: null,
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

      // 不用等stopPlay的回调，先把流停掉
      this.stopStream();
      this.stopPlay();

      this.stopVoice();

      if (this.data.ptzCmd || this.data.releasePTZTimer) {
        this.controlDevicePTZ('ptz_release_pre');
      }

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
        console.log('stopAll but reserve');
      } else {
        // 不保留，全部停掉
        console.log('stopAll');
        const { targetId } = this.data;
        this.resetServiceData();
        xp2pManager.stopP2PService(targetId);
      }

      if (this.data.player || !this.data.needPlayer) {
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
          console.log('startVoice success', res);
          this.setData({ voiceState: 'sending' });
        })
        .catch((res) => {
          console.log('startVoice fail', res);
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
        // 常用信令
        if (!commandMap[cmd]) {
          this.showToast(`sendCommand: invalid cmd ${cmd}`);
          return;
        }
        cmdDetail = commandMap[cmd];
        xp2pManager
          .sendCommandByTopic(this.data.targetId, { cmd: cmdDetail })
          .then((res) => {
            console.log(`[${this.id}]`, 'sendCommandByTopic res', res);
            wx.showModal({
              content: `sendCommandByTopic res: ${JSON.stringify(res, null, 2)}`,
              showCancel: false,
            });
          })
          .catch((errmsg) => {
            console.error(`[${this.id}]`, 'sendCommandByTopic error', errmsg);
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
        console.log('prepareService: invalid targetId', this.data);
        this.showToast('prepareService: invalid targetId');
        return;
      }

      if (!this.data.flvUrl) {
        console.log('prepareService: invalid flvUrl', this.data);
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
      this.setData({ state: PlayStateEnum.servicePrearing, 'serviceTimestamps.servicePrearing': start });

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

        this.addLog(`start stream: ${filename} ${params || ''}`);

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
            flv: { filename, params },
            // msgCallback, // 不传 msgCallback 就是保持之前设置的
            dataCallback,
          })
          .then((res) => {
            console.log('startStream success', res);
            this.addLog('stream started');
            this.setData({
              state: PlayStateEnum.streamStarted,
              'serviceTimestamps.streamStarted': Date.now(),
            });
          })
          .catch((res) => {
            console.log('startStream fail', res);
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
      if (xp2pManager.networkChanged) {
        // 网络状态变化了，退出重来
        console.log('networkChanged, trigger disconnect');
        this.stopAll();
        this.triggerEvent('p2pDisconnect', {
          playerId: this.id,
          targetId: this.data.targetId,
          notifyType: type,
          notifyDetail: detail,
        });
        return false;
      }
      return true;
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
          this.addLog(`connect delay ${now - this.data.serviceTimestamps.servicePrearing}`);
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
          if (
            this.data.state
            && this.data.state !== PlayStateEnum.playerReady
            && this.data.state !== PlayStateEnum.unknown
          ) {
            this.showToast('连接失败或断开');
            this.stopAll();
            this.triggerEvent('p2pDisconnect', {
              playerId: this.id,
              targetId: this.data.targetId,
              notifyType: type,
              notifyDetail: detail,
            });
          }
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
    togglePTZPanel() {
      this.setData({ showPTZPanel: !this.data.showPTZPanel });
    },
    toggleVoice(e) {
      if (!this.data.targetId) {
        return;
      }

      const isSendingVoice = this.data.voiceState === 'sending';
      if (!isSendingVoice) {
        this.startVoice(e);
      } else {
        this.stopVoice();
      }
    },
    controlDevicePTZ(e) {
      if (!this.data.targetId) {
        return;
      }
      const cmd = e && e.currentTarget ? e.currentTarget.dataset.cmd : e;
      if (!cmd) {
        return;
      }
      console.log(`[${this.data.targetId}]`, 'controlDevicePTZ', cmd);

      if (this.data.releasePTZTimer) {
        clearTimeout(this.data.releasePTZTimer);
        this.setData({ releasePTZTimer: null });
      }

      if (cmd !== 'ptz_release_pre') {
        this.setData({ ptzCmd: cmd });
      } else {
        this.setData({ ptzCmd: '' });
      }

      const p2pId = this.data.targetId;
      const cmdDetail = {
        topic: 'ptz',
        data: {
          cmd,
        },
      };
      const start = Date.now();
      xp2pManager
        .sendCommandByTopic(p2pId, { cmd: cmdDetail })
        .then((res) => {
          console.log(`[${p2pId}] sendPTZCommand delay ${Date.now() - start}, res`, res);
        })
        .catch((err) => {
          console.error(`[${p2pId}] sendPTZCommand delay ${Date.now() - start}, error`, err);
        });
    },

    releasePTZBtn() {
      if (!this.data.targetId) {
        return;
      }
      console.log(`[${this.data.targetId}]`, 'releasePTZBtn');

      // 先把cmd清了，恢复按钮状态
      this.setData({ ptzCmd: '' });

      if (this.data.releasePTZTimer) {
        clearTimeout(this.data.releasePTZTimer);
        this.setData({ releasePTZTimer: null });
      }

      // 延迟发送release
      const releasePTZTimer = setTimeout(() => {
        this.controlDevicePTZ('ptz_release_pre');
      }, 500);
      this.setData({ releasePTZTimer });
    },
  },
});

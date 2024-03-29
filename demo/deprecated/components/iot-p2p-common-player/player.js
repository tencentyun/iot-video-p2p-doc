/* eslint-disable camelcase, @typescript-eslint/naming-convention */
import { canUseP2PIPCMode, canUseP2PServerMode, getParamValue, snapshotAndSave } from '../../utils';
import { getXp2pManager } from '../../lib/xp2pManager';
import { getRecordManager, MAX_FILE_SIZE_IN_M } from '../../lib/recordManager';
import { PlayerStateEnum, P2PStateEnum, StreamStateEnum, totalMsgMap, httpStatusErrorMsgMap, isLocalServerError, isCloseByLivePlayer } from './common';
import { PlayStepEnum, PlayStat } from './stat';

// 覆盖 console
const app = getApp();
const oriConsole = app.console;
const console = app.logger || oriConsole;

const xp2pManager = getXp2pManager();
const { XP2PServiceEventEnum, XP2PEventEnum, XP2PNotify_SubType } = xp2pManager;

const recordManager = getRecordManager('records');

const cacheIgnore = 500;

let playerSeq = 0;

Component({
  behaviors: ['wx://component-export'],
  properties: {
    playerClass: {
      type: String,
      value: '',
    },
    // 以下是 live-player 的属性
    mode: {
      type: String, // live / RTC
      value: 'live',
    },
    minCache: {
      type: Number,
      value: 0.2,
    },
    maxCache: {
      type: Number,
      value: 0.8,
    },
    muted: {
      type: Boolean,
      value: false,
    },
    orientation: {
      type: String, // vertical / horizontal
      value: 'vertical',
    },
    // 以下是自己的属性
    p2pMode: {
      type: String, // ipc / server
      value: '',
    },
    targetId: {
      type: String,
      value: '',
    },
    flvUrl: {
      type: String,
      value: '',
    },
    cacheThreshold: {
      type: Number,
      value: 0,
    },
    superMuted: {
      type: Boolean,
      value: false,
    },
    showControlRightBtns: {
      type: Boolean,
      value: true,
    },
    showLog: {
      type: Boolean,
      value: true,
    },
    // 以下 ipc 模式用
    productId: {
      type: String,
      value: '',
    },
    deviceName: {
      type: String,
      value: '',
    },
    xp2pInfo: {
      type: String,
      value: '',
    },
    liveStreamDomain: {
      type: String,
      value: '',
    },
    sceneType: {
      type: String,
      value: 'live',
    },
    // 以下 server 模式用
    codeUrl: {
      type: String,
      value: '',
    },
    // 不能直接传函数，只能在数据中包含函数，所以放在 checkFunctions 里
    /*
     checkFunctions: {
       checkIsFlvValid: ({ filename, params }) => boolean,
       checkCanStartStream: ({ filename, params }) => Promise,
     }
    */
    checkFunctions: {
      type: Object,
      value: {},
    },
    // 以下仅供调试，正式组件不需要
    onlyDebugInfo: {
      type: Boolean,
      value: false,
    },
    showDebugInfo: {
      type: Boolean,
      value: false,
    },
    onlyp2p: {
      type: Boolean,
      value: false,
    },
  },
  data: {
    innerId: '',
    p2pPlayerVersion: xp2pManager.P2PPlayerVersion,
    xp2pVersion: xp2pManager.XP2PVersion,
    xp2pUUID: xp2pManager.uuid,

    // 这是attached时就固定的
    streamExInfo: null,
    canUseP2P: false,
    needPlayer: false,

    // 当前flv
    flvFile: '',
    flvFilename: '',
    flvParams: '',
    streamType: '',

    // player状态
    hasPlayer: false, // needPlayer时才有效，出错销毁时设为false
    autoPlay: false,
    playerId: '', // 这是 p2p-player 组件的id，不是自己的id
    playerState: PlayerStateEnum.PlayerIdle,
    playerDenied: false,
    playerMsg: '',
    playerPaused: false, // false / true / 'stopped'
    needPauseStream: false, // 为true时不addChunk
    firstChunkDataInPaused: null,
    acceptLivePlayerEvents: {
      // 太多事件log了，只接收这几个
      error: true,
      statechange: true,
      netstatus: true,
      fullscreenchange: true,
      // audiovolumenotify: true,
    },

    // p2p状态
    currentP2PId: '',
    p2pState: P2PStateEnum.P2PIdle,
    p2pConnected: false,
    checkStreamRes: null,

    // stream状态
    streamState: StreamStateEnum.StreamIdle,
    playing: false,

    // 这些是播放相关信息
    livePlayerInfoStr: '',

    // debug用
    isSlow: false,
    isRecording: false,

    // 播放结果
    playResultStr: '',
    idrResultStr: '',

    // 控件
    soundMode: 'speaker',
  },
  observers: {
    superMuted(val) {
      this.console.info(`[${this.data.innerId}]`, 'superMuted changed', val);
      if (val) {
        // 打开pusher采集并关闭后，再打开recorder采集并关闭，player的soundMode就变成ear模式了，反馈给微信定位
        // 标记下次设为false时需要修复 soundMode
        this.userData.needFixSoundMode = true;
      } else {
        if (this.userData.needFixSoundMode) {
          // 已修复，清除标记
          this.userData.needFixSoundMode = false;
          this.console.info(`[${this.data.innerId}]`, 'fix soundMode');
          wx.nextTick(() => {
            this.setData({
              soundMode: 'ear',
            });
            wx.nextTick(() => {
              this.setData({
                soundMode: 'speaker',
              });
            });
          });
        }
      }
    },
    showDebugInfo(val) {
      if (val) {
        // 显示调试面板，把 livePlayerInfoStr 更新到最新
        this.refreshLivePlayerInfoStr();
      }
    },
  },
  pageLifetimes: {
    show() {
      const hideTime = this.userData.pageHideTimestamp ? Date.now() - this.userData.pageHideTimestamp : 0;
      this.console.log(`[${this.data.innerId}]`, '==== page show, hideTime', hideTime);
      this.userData.pageHideTimestamp = 0;
    },
    hide() {
      this.console.log(`[${this.data.innerId}]`, '==== page hide');
      this.userData.pageHideTimestamp = Date.now();
    },
  },
  lifetimes: {
    created() {
      // 在组件实例刚刚被创建时执行
      playerSeq++;
      this.setData({ innerId: `common-player-${playerSeq}` });

      // 渲染无关，不放在data里，以免影响性能
      this.userData = {
        isDetached: false,
        pageHideTimestamp: 0,
        playerComp: null,
        playerCtx: null,
        chunkTime: 0,
        chunkCount: 0,
        totalBytes: 0,
        livePlayerInfo: null,
        fileObj: null,
        needFixSoundMode: false,
      };

      this.console = console;

      wx.setInnerAudioOption({
        obeyMuteSwitch: false, // 即使是在静音模式下，也能播放声音
        speakerOn: true, // 用扬声器播放
        fail: (err) => {
          console.warn(`[${this.data.innerId}]`, 'setInnerAudioOption error', err);
        },
      });
    },
    attached() {
      // 在组件实例进入页面节点树时执行
      if (!this.properties.showLog) {
        // 不显示log
        this.console = {
          log: () => undefined,
          info: console.info.bind(console),
          warn: console.warn.bind(console),
          error: console.error.bind(console),
        };
      }
      this.console.log(`[${this.data.innerId}]`, '==== attached', this.id, {
        p2pMode: this.properties.p2pMode,
        targetId: this.properties.targetId,
        flvUrl: this.properties.flvUrl,
        mode: this.properties.mode,
      });

      const isP2PModeValid = this.properties.p2pMode === 'ipc' || this.properties.p2pMode === 'server';
      const canUseP2P = (this.properties.p2pMode === 'ipc' && canUseP2PIPCMode) || (this.properties.p2pMode === 'server' && canUseP2PServerMode);
      const flvFile = this.properties.flvUrl.split('/').pop();
      const [flvFilename = '', flvParams = ''] = flvFile.split('?');
      const streamType = flvFilename ? (getParamValue(flvParams, 'action') || 'live') : '';
      const onlyp2p = this.properties.onlyp2p || false;
      const needPlayer = !onlyp2p;
      const hasPlayer = needPlayer && canUseP2P;
      const playerId = `${this.data.innerId}-player`; // 这是 p2p-player 组件的id，不是自己的id
      let p2pState, playerState;
      let playerMsg = '';
      if (canUseP2P) {
        p2pState = P2PStateEnum.P2PIdle;
        playerState = PlayerStateEnum.PlayerIdle;
      } else {
        p2pState = P2PStateEnum.P2PLocalError;
        playerState = PlayerStateEnum.PlayerError;
        playerMsg = isP2PModeValid ? '您的微信基础库版本过低，请升级后再使用' : `无效的p2pType: ${this.properties.p2pMode}`;
      }

      // 统计用
      this.stat = new PlayStat({
        innerId: this.data.innerId,
        onPlayStepsChange: (params) => {
          const playSteps = {
            startAction: params.startAction,
            timeCost: Date.now() - params.startTimestamp,
            steps: params.steps.map((item, index) => `${index}: ${item.step} - ${item.timeCost}`),
          };
          this.setData({
            playResultStr: JSON.stringify(playSteps, null, 2),
          });
        },
        onPlayResultChange: (params) => {
          // 把 totalBytes 显示出来
          let result = params.result;
          if (this.userData.totalBytes) {
            result += ` (${this.userData.totalBytes} bytes)`;
          }
          const playResult = {
            result,
            startAction: params.startAction,
            timeCost: Date.now() - params.startTimestamp,
            steps: params.steps.map((item, index) => `${index}: ${item.step} - ${item.timeCost}`),
          };
          this.setData({
            playResultStr: JSON.stringify(playResult, null, 2),
          });
        },
        onIdrResultChange: (idrResult) => {
          this.setData({
            idrResultStr: `${PlayStepEnum.WaitIDR}: ${idrResult.timeCost} ms, ${this.userData.chunkCount} chunks, ${this.userData.totalBytes} bytes`,
          });
        },
      });
      this.makeResultParams({ startAction: 'enter', flvParams });

      this.changeState({
        flvFile,
        flvFilename,
        flvParams,
        streamType,
        streamExInfo: {
          productId: this.properties.productId,
          deviceName: this.properties.deviceName,
          xp2pInfo: this.properties.xp2pInfo,
          liveStreamDomain: this.properties.liveStreamDomain,
          codeUrl: this.properties.codeUrl,
        },
        canUseP2P,
        needPlayer,
        hasPlayer,
        playerId,
        playerState,
        playerMsg,
        p2pState,
      });

      if (!canUseP2P) {
        return;
      }
      this.createPlayer();
      this.initP2P();
    },
    ready() {
      // 在组件在视图层布局完成后执行
    },
    detached() {
      // 在组件实例被从页面节点树移除时执行
      this.console.log(`[${this.data.innerId}]`, '==== detached');
      this.userData.isDetached = true;
      this.stopAll();
      this.console.log(`[${this.data.innerId}]`, '==== detached end');
    },
    error() {
      // 每当组件方法抛出错误时执行
    },
  },
  export() {
    return {
      changeFlv: this.changeFlv.bind(this),
      stopAll: this.stopAll.bind(this),
      reset: this.reset.bind(this),
      retry: this.onClickRetry.bind(this),
      pause: this.pause.bind(this),
      resume: this.resume.bind(this),
      resumeStream: this.resumeStream.bind(this),
      startRecording: this.startRecording.bind(this),
      stopRecording: this.stopRecording.bind(this),
      cancelRecording: this.cancelRecording.bind(this),
      snapshot: this.snapshot.bind(this),
      snapshotAndSave: this.snapshotAndSave.bind(this),
    };
  },
  methods: {
    getPlayerMessage(overrideData) {
      if (!this.data.canUseP2P) {
        return '您的微信基础库版本过低，请升级后再使用';
      }

      if (!this.properties.targetId) {
        return 'targetId为空';
      }

      const realData = {
        playerState: this.data.playerState,
        p2pState: this.data.p2pState,
        streamState: this.data.streamState,
        ...overrideData,
      };

      let msg = '';
      if (realData.playerState === PlayerStateEnum.PlayerReady && realData.p2pState === P2PStateEnum.ServiceStarted) {
        // 都ready，显示streamState的提示
        msg = totalMsgMap[realData.streamState] || '';
      } else if (realData.playerState === PlayerStateEnum.PlayerReady) {
        // PlayerReady 之后显示 p2pState 对应状态
        msg = totalMsgMap[realData.p2pState] || '';
      } else {
        // PlayerReady 之前显示 playerState 对应状态
        msg = totalMsgMap[realData.playerState] || '';
      }
      return msg;
    },
    // 包一层，方便更新 playerMsg
    changeState(newData, callback) {
      this.stat.addStateTimestamp(newData.playerState);
      this.stat.addStateTimestamp(newData.p2pState);
      this.stat.addStateTimestamp(newData.streamState);

      if (newData.hasPlayer === false) {
        this.userData.playerComp = null;
        this.userData.playerCtx = null;
      }
      const oldPlayerState = this.data.playerState;
      const oldP2PState = this.data.p2pState;
      const oldStreamState = this.data.streamState;
      this.setData({
        ...newData,
        playerMsg: typeof newData.playerMsg === 'string' ? newData.playerMsg : this.getPlayerMessage(newData),
      }, callback);
      if (newData.playerState && newData.playerState !== oldPlayerState) {
        this.triggerEvent('playerStateChange', {
          playerState: newData.playerState,
        });
      }
      if (newData.p2pState && newData.p2pState !== oldP2PState) {
        this.triggerEvent('p2pStateChange', {
          p2pState: newData.p2pState,
        });
      }
      if (newData.streamState && newData.streamState !== oldStreamState) {
        this.triggerEvent('streamStateChange', {
          streamState: newData.streamState,
        });
      }
    },
    makeResultParams({ startAction, flvParams }) {
      this.stat.makeResultParams({ startAction, flvParams: flvParams || this.data.flvParams });
      this.setData({
        playResultStr: '',
        idrResultStr: '',
      });
    },
    createPlayer() {
      this.console.log(`[${this.data.innerId}]`, 'createPlayer', Date.now());
      if (this.data.playerState !== PlayerStateEnum.PlayerIdle) {
        this.console.error(`[${this.data.innerId}]`, 'can not createPlayer in playerState', this.data.playerState);
        return;
      }

      this.changeState({
        playerState: PlayerStateEnum.PlayerPreparing,
      });
    },
    onPlayerReady({ detail }) {
      this.console.log(`[${this.data.innerId}]`, '==== onPlayerReady in', this.data.playerState, this.data.p2pState, detail);

      // 收到这个说明本地server是正常的
      if (xp2pManager.needResetLocalServer) {
        xp2pManager.needResetLocalServer = false;
      }

      const oldPlayerState = this.data.playerState;
      if (oldPlayerState === PlayerStateEnum.PlayerReady) {
        this.console.warn(`[${this.data.innerId}] onPlayerReady again, playerCtx ${detail.livePlayerContext === this.userData.playerCtx ? 'same' : 'different'}`);
      }
      this.userData.playerComp = detail.playerExport;
      this.userData.playerCtx = detail.livePlayerContext;
      this.changeState({
        playerState: PlayerStateEnum.PlayerReady,
      });
      this.tryTriggerPlay(`${oldPlayerState} -> ${this.data.playerState}`);
    },
    onPlayerStartPull({ detail }) {
      this.console.log(
        `[${this.data.innerId}] ==== onPlayerStartPull in p2pState ${this.data.p2pState},`,
        `flvParams ${this.data.flvParams}, playerPaused ${this.data.playerPaused}, needPauseStream ${this.data.needPauseStream},`,
        detail,
      );

      // 收到这个说明本地server是正常的
      if (xp2pManager.needResetLocalServer) {
        xp2pManager.needResetLocalServer = false;
      }

      if (this.data.playerPaused && this.data.needPauseStream) {
        // ios暂停时不会断开连接，一段时间没收到数据就会触发startPull，但needPauseStream时不应该拉流
        // 注意要把playerPaused改成特殊的 'stopped'，否则resume会有问题，并且不能用 tryStopPlayer
        this.console.warn(`[${this.data.innerId}]`, 'onPlayerStartPull but player paused and need pause stream, stop player');
        try {
          this.userData.playerCtx.stop(params);
        } catch (err) {}
        this.setData({
          playerPaused: 'stopped',
        });
        return;
      }

      const checkIsFlvValid = this.properties.checkFunctions && this.properties.checkFunctions.checkIsFlvValid;
      if (checkIsFlvValid && !checkIsFlvValid({ filename: this.data.flvFilename, params: this.data.flvParams })) {
        this.console.warn(`[${this.data.innerId}]`, 'onPlayerStartPull but flv invalid, return');
        return;
      }

      if (this.data.p2pState !== P2PStateEnum.ServiceStarted) {
        // 因为各种各样的原因，player在状态不对的时候又触发播放了，停掉
        this.console.warn(`[${this.data.innerId}]`, `onPlayerStartPull but can not play in p2pState ${this.data.p2pState}, stop player`);
        this.tryStopPlayer();
        return;
      }

      if (this.data.streamState === StreamStateEnum.StreamDataPause) {
        // 临时停止拉流，重新拉流时直接 doStartStream
        const { livePlayerInfo } = this.userData;
        this.console.warn(`[${this.data.innerId}] onPlayerStartPull in ${this.data.streamState}, now cache: video ${livePlayerInfo?.videoCache}, audio ${livePlayerInfo?.audioCache}`);
        this.doStartStream();
        return;
      }

      // 收到pull
      this.changeState({
        streamState: StreamStateEnum.StreamReceivePull,
      });

      // 开始拉流
      this.startStream();
    },
    onPlayerClose({ detail }) {
      this.console.log(`[${this.data.innerId}]`, `==== onPlayerClose in p2pState ${this.data.p2pState}, playerPaused ${this.data.playerPaused}, needPauseStream ${this.data.needPauseStream}`, detail);

      let newStreamState = StreamStateEnum.StreamIdle;

      const isLivePlayerClose = isCloseByLivePlayer(detail);
      if (isLivePlayerClose && !this.data.playerPaused && !this.userData.pageHideTimestamp) {
        // live-player 断开请求，不是暂停也不是隐藏，可能是数据缓存太多播放器开始调控了
        const { livePlayerInfo } = this.userData;
        const cache = Math.max(livePlayerInfo?.videoCache || 0, livePlayerInfo?.audioCache || 0);
        if (cache > cacheIgnore) {
          // 播放器还有cache
          this.console.warn(`[${this.data.innerId}] onPlayerClose but player has cache: video ${livePlayerInfo?.videoCache}, audio ${livePlayerInfo?.audioCache}`, livePlayerInfo);
          // 当作是临时停止拉流
          newStreamState = StreamStateEnum.StreamDataPause;
        }
      }

      // 停止拉流
      this.stopStream(newStreamState);
    },
    onPlayerError({ detail }) {
      this.console.error(`[${this.data.innerId}]`, '==== onPlayerError', detail);
      const code = detail?.error?.code;
      let playerState = PlayerStateEnum.PlayerError;
      if (code === 'WECHAT_SERVER_ERROR') {
        playerState = PlayerStateEnum.LocalServerError;
        xp2pManager.needResetLocalServer = true;
        xp2pManager.networkChanged = true;
        this.stopAll(P2PStateEnum.P2PLocalNATChanged);
        this.changeState({
          hasPlayer: false,
          playerState,
        });
      } else {
        this.changeState({
          playerState,
        });
      }
      this.handlePlayError(playerState, { msg: `p2pPlayerError: ${code}` });
    },
    onLivePlayerError({ detail }) {
      // 参考：https://developers.weixin.qq.com/miniprogram/dev/component/live-player.html
      this.console.error(`[${this.data.innerId}]`, '==== onLivePlayerError', detail);
      const newData = {
        playerState: PlayerStateEnum.LivePlayerError,
      };
      if (detail.errMsg && detail.errMsg.indexOf('system permission denied') >= 0) {
        // 如果liveplayer是RTC模式，当微信没有系统录音权限时会出错，但是没有专用的错误码，微信侧建议先判断errMsg来兼容
        newData.playerDenied = true;
      }
      this.changeState(newData);
      this.handlePlayError(PlayerStateEnum.LivePlayerError, { msg: `livePlayerError: ${detail.errMsg}` });
    },
    // eslint-disable-next-line no-unused-vars, @typescript-eslint/no-unused-vars
    onLivePlayerStateChange({ detail }) {
      /*
        code说明参考：https://developers.weixin.qq.com/miniprogram/dev/component/live-player.html
        正常启播应该是
          ios: 2008 - 触发startPull - 2001 - 2004 - 2026 (- 2007 - 2004) * n - 2009 - 2003
          android: 触发startPull - 2001 - 2004 - 2026 - 2008 - 2009 - 2003 - 2032
        注意
          2001 已经连接服务器，不是连接到本地服务器，而是收到了数据，在 result 之后
          2008 解码器启动，在 ios/android 的出现顺序不同
      */
      if (this.data.p2pState !== P2PStateEnum.ServiceStarted) {
        // 已经停止p2pservice了，不再处理
        return;
      }
      switch (detail.code) {
        case 2005: // 视频播放进度
          // 不处理
          break;
        case 2006: // 视频播放结束
        case 6000: // 拉流被挂起
          this.console.log(`[${this.data.innerId}]`, '==== onLivePlayerStateChange', detail.code, detail.message, `streamState: ${this.data.streamState}`);
          break;
        case 2003: // 网络接收到首个视频数据包(IDR)
          this.console.log(`[${this.data.innerId}]`, '==== onLivePlayerStateChange', detail.code, detail.message, `totalBytes: ${this.userData.totalBytes}`);
          this.stat.receiveIDR();
          break;
        case 2103: // live-player断连, 已启动自动重连
          this.console.warn(`[${this.data.innerId}]`, '==== onLivePlayerStateChange', detail.code, detail.message, `streamState: ${this.data.streamState}`);
          // player插件 1.1.3 开始会触发 playerError WECHAT_SERVER_ERROR
          if (false && isLocalServerError(detail)) {
            // 无法连接本地服务器
            xp2pManager.needResetLocalServer = true;

            // 这时其实网络状态应该也变了，但是网络状态变化事件延迟较大，networkChanged不一定为true
            // 所以把 networkChanged 也设为true
            xp2pManager.networkChanged = true;

            this.stopAll(P2PStateEnum.P2PLocalNATChanged);
            this.changeState({
              hasPlayer: false,
              playerState: PlayerStateEnum.LocalServerError,
            });
            this.handlePlayError(PlayerStateEnum.LocalServerError, { msg: `livePlayerStateChange: ${detail.code} ${detail.message}` });
          } else {
            // 这里一般是一段时间没收到数据，或者数据不是有效的视频流导致的
            /*
             这里可以区分1v1/1v多做不同处理：
             - 1v1：网络变化后就不能再次连接上ipc，所以需要调用 checkCanRetry 检查，不能重试的就算播放失败
             - 1v多：网络变化但还是有连接时（比如 wifi->4g），重试可以成功，只是后续会一直从server拉流，无法切换到从其他节点拉流
               - 为了省流量，可以和1v1一样，调用 checkCanRetry 检查
               - 为了体验稳定，可以不特别处理，live-player 会继续重试
             这里为了简单统一处理
             */
            if (this.checkCanRetry()) {
              if (this.data.streamState !== StreamStateEnum.StreamIdle) {
                // 哪里有问题导致了重复发起请求，这应该是旧请求的消息，不处理了
                this.console.log(`[${this.data.innerId}]`, `livePlayer auto reconnect but streamState ${this.data.streamState}, ignore`);
                return;
              }

              this.stat.addStep(PlayStepEnum.AutoReconnect);

              // 前面收到playerStop的时候把streamState变成Idle了，这里再改成WaitPull
              this.console.log(`[${this.data.innerId}]`, `livePlayer auto reconnect, ${this.data.streamState} -> ${StreamStateEnum.StreamWaitPull}`);
              this.changeState({
                streamState: StreamStateEnum.StreamWaitPull,
              });
            }
          }
          break;
        case -2301: // live-player断连，且经多次重连抢救无效，需要提示出错，由用户手动重试
          // 到这里应该已经触发过 onPlayerClose 了
          this.console.error(`[${this.data.innerId}]`, '==== onLivePlayerStateChange', detail.code, detail.message);
          this.stat.addStep(PlayStepEnum.FinalStop, { isResult: true });
          this.changeState({
            playerState: xp2pManager.needResetLocalServer
              ? PlayerStateEnum.LocalServerError
              : PlayerStateEnum.LivePlayerStateError,
            streamState: xp2pManager.needResetLocalServer
              ? StreamStateEnum.StreamLocalServerError
              : StreamStateEnum.StreamIdle,
          });
          this.handlePlayError(PlayerStateEnum.LivePlayerStateError, { msg: `livePlayerStateChange: ${detail.code} ${detail.message}` });
          break;
        default:
          // 这些不特别处理，打个log
          if ((detail.code >= 2104 && detail.code < 2200) || detail.code < 0) {
            this.console.warn(`[${this.data.innerId}]`, 'onLivePlayerStateChange', detail.code, detail.message);
          } else {
            this.console.log(`[${this.data.innerId}]`, 'onLivePlayerStateChange', detail.code, detail.message);
          }
          break;
      }
    },
    // eslint-disable-next-line no-unused-vars, @typescript-eslint/no-unused-vars
    onLivePlayerNetStatus({ detail }) {
      // this.console.log(`[${this.data.innerId}]`, 'onLivePlayerNetStatus', detail.info);
      if (!detail.info) {
        return;
      }
      // 不是所有字段都有值，不能直接覆盖整个info，只更新有值的字段
      if (!this.userData.livePlayerInfo) {
        this.userData.livePlayerInfo = {};
      }
      const { livePlayerInfo } = this.userData;
      for (const key in detail.info) {
        if (detail.info[key] !== undefined) {
          livePlayerInfo[key] = detail.info[key];
        }
      }

      // 显示调试面板时才需要更新 livePlayerInfoStr
      this.data.showDebugInfo && this.refreshLivePlayerInfoStr();

      const cache = Math.max(livePlayerInfo?.videoCache || 0, livePlayerInfo?.audioCache || 0);
      if (this.properties.cacheThreshold > 0 && cache > this.properties.cacheThreshold) {
        // cache太多了，停止播放
        this.stopStreamAndReplay();
      }
    },
    onFullScreenChange({ detail }) {
      this.console.log(`[${this.data.innerId}]`, 'onFullScreenChange', detail);
      if (typeof detail.fullScreen === 'boolean') {
        this.setData({ fullScreen: detail.fullScreen });
      }
    },
    refreshLivePlayerInfoStr() {
      const { livePlayerInfo } = this.userData;
      if (!livePlayerInfo) {
        this.setData({ livePlayerInfoStr: '' });
        return;
      }
      this.setData({
        livePlayerInfoStr: [
          `size: ${livePlayerInfo.videoWidth}x${livePlayerInfo.videoHeight}, fps: ${livePlayerInfo.videoFPS?.toFixed(2)}`,
          `bitrate(kbps): video ${livePlayerInfo.videoBitrate}, audio ${livePlayerInfo.audioBitrate}`,
          `cache(ms): video ${livePlayerInfo.videoCache}, audio ${livePlayerInfo.audioCache}`,
        ].join('\n'),
      });
    },
    resetServiceData(newP2PState) {
      this.changeState({
        currentP2PId: '',
        p2pState: newP2PState,
        p2pConnected: false,
        checkStreamRes: null,
      });
    },
    resetStreamData(newStreamState) {
      this.dataCallback = null;
      this.clearStreamData();
      this.changeState({
        streamState: newStreamState,
        playing: false,
      });
    },
    clearStreamData() {
      if (this.userData) {
        this.userData.chunkTime = 0;
        this.userData.chunkCount = 0;
        this.userData.totalBytes = 0;
        this.userData.livePlayerInfo = null;
      }
      this.setData({
        firstChunkDataInPaused: null,
        livePlayerInfoStr: '',
      });
    },
    initP2P() {
      this.console.log(`[${this.data.innerId}]`, 'initP2P');
      if (this.data.p2pState !== P2PStateEnum.P2PIdle) {
        this.console.log(`[${this.data.innerId}]`, 'can not initP2P in p2pState', this.data.p2pState);
        return;
      }

      this.changeState({
        p2pState: P2PStateEnum.P2PIniting,
      });

      if (xp2pManager.isModuleActive) {
        this.changeState({
          p2pState: P2PStateEnum.P2PInited,
        });
        this.prepare();
        return;
      }

      this.console.log(`[${this.data.innerId}]`, 'initModule');

      xp2pManager
        .initModule()
        .then((res) => {
          this.console.log(`[${this.data.innerId}]`, '==== initModule res', res, 'in p2pState', this.data.p2pState);
          this.changeState({
            p2pState: P2PStateEnum.P2PInited,
          });
          this.prepare();
        })
        .catch((errcode) => {
          this.console.error(`[${this.data.innerId}]`, '==== initModule error', errcode, 'in p2pState', this.data.p2pState);
          xp2pManager.destroyModule();
          this.changeState({
            p2pState: P2PStateEnum.P2PInitError,
          });
          this.handlePlayError(P2PStateEnum.P2PInitError, { msg: `initModule err ${errcode}` });
        });
    },
    prepare() {
      this.console.log(`[${this.data.innerId}]`, 'prepare');
      if (this.data.p2pState !== P2PStateEnum.P2PInited
        && this.data.p2pState !== P2PStateEnum.ServiceStartError
        && this.data.p2pState !== P2PStateEnum.ServiceError
      ) {
        this.console.log(`can not start service in p2pState ${this.data.p2pState}`);
        return;
      }

      const { targetId } = this.properties;
      const { flvUrl, streamExInfo } = this.data;
      if (!targetId || !flvUrl) {
        this.console.log(`can not start service with invalid params: targetId ${targetId}, flvUrl ${flvUrl}`);
        return;
      }

      this.console.log(`[${this.data.innerId}]`, 'startP2PService', targetId, flvUrl, streamExInfo);

      const msgCallback = (event, subtype, detail) => {
        this.onP2PServiceMessage(targetId, event, subtype, detail);
      };

      this.changeState({
        currentP2PId: targetId,
        p2pState: P2PStateEnum.ServicePreparing,
      });

      xp2pManager
        .startP2PService(
          targetId,
          { url: flvUrl, ...streamExInfo },
          {
            msgCallback,
          },
        )
        .then((res) => {
          this.console.log(`[${this.data.innerId}]`, '==== startP2PService res', res);
          if (res === 0) {
            const oldP2PState = this.data.p2pState;
            this.changeState({
              p2pState: P2PStateEnum.ServiceStarted,
            });
            this.tryTriggerPlay(`${oldP2PState} -> ${this.data.p2pState}`);
          } else {
            this.stopAll(P2PStateEnum.ServiceStartError);
            this.handlePlayError(P2PStateEnum.ServiceStartError, { msg: `startP2PService res ${res}` });
          }
        })
        .catch((errcode) => {
          this.console.error(`[${this.data.innerId}]`, '==== startP2PService error', errcode);
          this.stopAll(P2PStateEnum.ServiceStartError);
          this.handlePlayError(P2PStateEnum.ServiceStartError, { msg: `startP2PService err ${errcode}` });
        });
    },
    startStream() {
      this.console.log(`[${this.data.innerId}]`, 'startStream');
      if (this.data.p2pState !== P2PStateEnum.ServiceStarted) {
        this.console.log(`[${this.data.innerId}]`, `can not start stream in p2pState ${this.data.p2pState}`);
        return;
      }
      if (this.data.playing) {
        this.console.log(`[${this.data.innerId}]`, 'already playing');
        return;
      }

      // 先检查能否拉流
      const checkCanStartStream = this.properties.checkFunctions && this.properties.checkFunctions.checkCanStartStream;
      this.console.log(`[${this.data.innerId}]`, 'need checkCanStartStream', !!checkCanStartStream, 'checkStreamRes', this.data.checkStreamRes);

      if (!checkCanStartStream || this.data.checkStreamRes) {
        // 不检查或已经检查成功，直接拉流
        this.doStartStream();
        return;
      }

      this.clearStreamData();
      this.changeState({
        streamState: StreamStateEnum.StreamChecking,
        playing: true,
      });

      checkCanStartStream({ filename: this.data.flvFilename, params: this.data.flvParams })
        .then(() => {
          if (!this.data.playing) {
            // 已经stop了
            return;
          }
          // 检查通过，开始拉流
          this.console.log(`[${this.data.innerId}]`, '==== checkCanStartStream success');
          this.changeState({
            streamState: StreamStateEnum.StreamCheckSuccess,
            checkStreamRes: true,
          });
          this.doStartStream();
        })
        .catch((errmsg) => {
          if (!this.data.playing) {
            // 已经stop了
            return;
          }
          // 检查失败，前面已经弹过提示了
          this.console.error(`[${this.data.innerId}]`, '==== checkCanStartStream error', errmsg);
          this.resetStreamData(StreamStateEnum.StreamCheckError);
          this.setData({ checkStreamRes: false });
          if (errmsg) {
            this.setData({ playerMsg: errmsg });
          }
          this.tryStopPlayer();
        });
    },
    doStartStream() {
      this.console.log(`[${this.data.innerId}]`, 'do startStream', this.properties.targetId, this.data.flvFilename, this.data.flvParams);

      const { targetId } = this.properties;
      const msgCallback = (event, subtype, detail) => {
        this.onP2PMessage(targetId, event, subtype, detail, { isStream: true });
      };

      const { playerComp } = this.userData;
      let chunkTime = 0;
      let chunkCount = 0;
      let totalBytes = 0;
      const dataCallback = (data) => {
        if (!data || !data.byteLength) {
          return;
        }

        if (this.data.isSlow) {
          // 模拟丢包
          return;
        }

        if (this.data.needPauseStream) {
          // 要暂停流，不发数据给player，但是header要记下来后面发。。。
          if (!chunkCount && !this.data.firstChunkDataInPaused) {
            this.console.log(`[${this.data.innerId}]`, '==== firstChunkDataInPaused', data.byteLength);
            this.setData({
              firstChunkDataInPaused: data,
            });
          }
          return;
        }

        chunkTime = Date.now();
        chunkCount++;
        totalBytes += data.byteLength;
        if (this.userData) {
          this.userData.chunkTime = chunkTime;
          this.userData.chunkCount = chunkCount;
          this.userData.totalBytes = totalBytes;
        }
        if (chunkCount === 1) {
          this.console.log(`[${this.data.innerId}]`, '==== firstChunk', data.byteLength);
          this.changeState({
            streamState: StreamStateEnum.StreamDataReceived,
          });
        }

        if (this.userData?.fileObj) {
          // 写录像文件
          const writeLen = recordManager.writeRecordFile(this.userData.fileObj, data);
          if (writeLen < 0) {
            // 写入失败，可能是超过限制了
            this.stopRecording();
          }
        }

        playerComp.addChunk(data);
      };

      this.clearStreamData();
      this.changeState({
        streamState: StreamStateEnum.StreamPreparing,
        playing: true,
      });

      xp2pManager
        .startStream(this.properties.targetId, {
          flv: {
            filename: this.data.flvFilename,
            params: this.data.flvParams,
          },
          msgCallback,
          dataCallback,
        })
        .then((res) => {
          if (!this.data.playing) {
            // 已经stop了
            return;
          }
          this.console.log(`[${this.data.innerId}]`, '==== startStream res', res);
          if (res === 0) {
            this.dataCallback = dataCallback;
            this.changeState({
              streamState: StreamStateEnum.StreamStarted,
            });
          } else {
            this.resetStreamData(StreamStateEnum.StreamStartError);
            this.tryStopPlayer();
            this.handlePlayError(StreamStateEnum.StreamStartError, { msg: `startStream res ${res}` });
          }
        })
        .catch((res) => {
          if (!this.data.playing) {
            // 已经stop了
            return;
          }
          this.console.error(`[${this.data.innerId}]`, '==== startStream error', res);
          this.resetStreamData(StreamStateEnum.StreamStartError);
          this.tryStopPlayer();
          this.handlePlayError(StreamStateEnum.StreamStartError, { msg: `startStream err ${res.errcode}` });
        });
    },
    stopStream(newStreamState = StreamStateEnum.StreamIdle) {
      this.console.log(`[${this.data.innerId}]`, `stopStream, ${this.data.streamState} -> ${newStreamState}`);

      // 记下来，因为resetStreamData会把这个改成false
      const needStopStream = this.data.playing;
      this.resetStreamData(newStreamState);

      if (needStopStream) {
        // 如果在录像，取消
        this.cancelRecording();

        // 拉流中的才需要 xp2pManager.stopStream
        this.console.log(`[${this.data.innerId}]`, 'do stopStream', this.properties.targetId, this.data.streamType);
        xp2pManager.stopStream(this.properties.targetId, this.data.streamType);
      }
    },
    changeFlv({ params = '' }) {
      this.console.log(`[${this.data.innerId}]`, 'changeFlv', params);
      const streamType = getParamValue(params, 'action') || 'live';
      this.setData(
        {
          flvFile: `${this.data.flvFilename}${params ? `?${params}` : ''}`,
          flvParams: params,
          streamType,
        },
        () => {
          // 停掉现在的的
          this.console.log(`[${this.data.innerId}]`, 'changeFlv, stop stream and player');
          this.stopStream();
          this.tryStopPlayer();

          const checkIsFlvValid = this.properties.checkFunctions && this.properties.checkFunctions.checkIsFlvValid;
          if (checkIsFlvValid && !checkIsFlvValid({ filename: this.data.flvFilename, params: this.data.flvParams })) {
            this.console.warn(`[${this.data.innerId}]`, 'flv invalid, return');
            // 无效，停止播放
            return;
          }

          // 有效，触发播放
          this.console.log(`[${this.data.innerId}]`, '==== trigger play', this.data.flvFilename, this.data.flvParams);
          this.makeResultParams({ startAction: 'changeFlv', flvParams: this.data.flvParams });
          this.tryTriggerPlay('changeFlv');
        },
      );
    },
    isP2PInErrorState(p2pState) {
      const checkState = p2pState || this.data.p2pState;
      return checkState === P2PStateEnum.P2PInitError
        || checkState === P2PStateEnum.P2PLocalNATChanged
        || checkState === P2PStateEnum.ServiceStartError
        || checkState === P2PStateEnum.ServiceError;
    },
    isStreamInErrorState(streamState) {
      const checkState = streamState || this.data.streamState;
      return checkState === StreamStateEnum.StreamLocalServerError
        || checkState === StreamStateEnum.StreamCheckError
        || checkState === StreamStateEnum.StreamStartError
        || checkState === StreamStateEnum.StreamError;
    },
    stopAll(newP2PState = P2PStateEnum.P2PUnkown) {
      if (!this.data.currentP2PId) {
        // 没prepare，或者已经stop了
        return;
      }

      this.console.log(`[${this.data.innerId}]`, 'stopAll', newP2PState);

      // 不用等stopPlay的回调，先把流停掉
      let newStreamState = StreamStateEnum.StreamIdle;
      if (xp2pManager.needResetLocalServer) {
        newStreamState = StreamStateEnum.LocalServerError;
      } else if (this.isP2PInErrorState(newP2PState)) {
        newStreamState = StreamStateEnum.StreamError;
      }
      this.stopStream(newStreamState);

      this.resetServiceData(newP2PState);
      xp2pManager.stopP2PService(this.properties.targetId);

      this.tryStopPlayer();
    },
    reset() {
      if (!this.data.canUseP2P) {
        // 不可用的不需要reset
        return;
      }

      this.console.log(`[${this.data.innerId}]`, 'reset in state', this.data.playerState, this.data.p2pState, this.data.streamState);

      // 一般是 isFatalError 之后重来，msg 保留
      const oldMsg = this.data.playerMsg;

      // 所有的状态都重置
      this.changeState({
        hasPlayer: false,
        playerDenied: false,
        playerState: PlayerStateEnum.PlayerIdle,
        p2pState: P2PStateEnum.P2PIdle,
        streamState: StreamStateEnum.StreamIdle,
        playerMsg: oldMsg,
      });
    },
    pause({ success, fail, complete, needPauseStream = false }) {
      this.console.log(`[${this.data.innerId}] pause, hasPlayerCrx: ${!!this.userData.playerCtx}, needPauseStream ${needPauseStream}`);
      if (!this.userData.playerCtx) {
        fail && fail({ errMsg: 'player not ready' });
        complete && complete();
        return;
      }

      if (!needPauseStream) {
        // 真的pause
        this.console.log(`[${this.data.innerId}] playerCtx.pause`);
        this.userData.playerCtx.pause({
          success: () => {
            this.console.log(`[${this.data.innerId}] playerCtx.pause success`);
            this.setData({
              playerPaused: true,
              needPauseStream: false,
            });
            success && success();
          },
          fail,
          complete,
        });
      } else {
        // android暂停后会断开请求，ios不会断开，但是在收不到数据几秒后会断开请求重试
        // 这里统一处理，needPauseStream时停掉player，保持后续逻辑一致
        // 注意要把playerPaused改成特殊的 'stopped'，否则resume会有问题，并且不能用 tryStopPlayer
        this.setData({
          playerPaused: 'stopped',
          needPauseStream: true,
        });
        this.console.log(`[${this.data.innerId}] playerCtx.stop`);
        this.userData.playerCtx.stop({
          complete: () => {
            this.console.log(`[${this.data.innerId}] playerCtx.stop success`);
            this.setData({
              playerPaused: 'stopped',
              needPauseStream: true,
            });
            success && success();
            complete && complete();
          },
        });
      }
    },
    resume({ success, fail, complete }) {
      this.console.log(`[${this.data.innerId}] resume, hasPlayerCrx: ${!!this.userData.playerCtx}`);
      if (!this.userData.playerCtx) {
        fail && fail({ errMsg: 'player not ready' });
        complete && complete();
        return;
      }
      const funcName = this.data.playerPaused === 'stopped' ? 'play' : 'resume';
      this.console.log(`[${this.data.innerId}] playerCtx.${funcName}`);
      this.userData.playerCtx[funcName]({
        success: () => {
          this.console.log(`[${this.data.innerId}] playerCtx.${funcName} success, needPauseStream ${this.data.needPauseStream}`);
          this.setData({
            playerPaused: false,
            // needPauseStream: false, // 还不能接收数据，seek之后才行，外层主动调用resumeStream修改
          });
          success && success();
        },
        fail,
        complete,
      });
    },
    resumeStream() {
      const { needPauseStream, firstChunkDataInPaused } = this.data;
      this.console.log(`[${this.data.innerId}] resumeStream, has first chunk data ${!!firstChunkDataInPaused}`);
      this.setData({
        needPauseStream: false,
        firstChunkDataInPaused: null,
      });
      if (this.data.streamState === StreamStateEnum.StreamHeaderParsed
        && needPauseStream
        && firstChunkDataInPaused
        && this.dataCallback
      ) {
        this.dataCallback(firstChunkDataInPaused);
      }
    },
    tryStopPlayer() {
      this.setData({
        playerPaused: false,
        needPauseStream: false,
      });
      if (!this.userData.playerCtx) {
        return Promise.resolve({});
      }
      return new Promise((resolve, reject) => {
        this.console.log(`[${this.data.innerId}] playerCtx.stop`);
        this.userData.playerCtx.stop({
          success: res => resolve(res),
          fail: err => reject(err),
        });
      });
    },
    tryTriggerPlay(reason) {
      this.console.log(
        `[${this.data.innerId}]`, '==== tryTriggerPlay',
        '\n  reason', reason,
        '\n  playerState', this.data.playerState,
        '\n  p2pState', this.data.p2pState,
        '\n  streamState', this.data.streamState,
      );

      // 这个要放在上面，否则回放时的统计不对
      if (this.data.p2pState === P2PStateEnum.ServiceStarted && this.data.playerState === PlayerStateEnum.PlayerReady) {
        this.stat.addStateTimestamp('bothReady', { onlyOnce: true });
      }

      const isP2PStateCanPlay = this.data.p2pState === P2PStateEnum.ServiceStarted;
      let isPlayerStateCanPlay = this.data.playerState === PlayerStateEnum.PlayerReady;
      if (!isPlayerStateCanPlay && reason === 'replay') {
        // 是重试，出错状态也可以触发play
        isPlayerStateCanPlay = this.data.playerState === PlayerStateEnum.LivePlayerError
          || this.data.playerState === PlayerStateEnum.LivePlayerStateError;
      }
      if (!isP2PStateCanPlay || !this.userData.playerCtx || !isPlayerStateCanPlay) {
        this.console.log(`[${this.data.innerId}]`, 'state can not play, return');
        return;
      }

      const checkIsFlvValid = this.properties.checkFunctions && this.properties.checkFunctions.checkIsFlvValid;
      if (checkIsFlvValid && !checkIsFlvValid({ filename: this.data.flvFilename, params: this.data.flvParams })) {
        this.console.warn(`[${this.data.innerId}]`, 'flv invalid, return');
        return;
      }

      // 都准备好了，触发播放，这个会触发 onPlayerStartPull
      this.changeState({
        streamState: StreamStateEnum.StreamWaitPull,
      });
      this.setData({
        playerPaused: false,
        needPauseStream: false,
      });
      if (this.data.needPlayer && !this.data.autoPlay) {
        // 用 autoPlay 是因为有时候成功调用了play，但是live-player实际并没有开始播放
        this.console.log(`[${this.data.innerId}]`, '==== trigger play by autoPlay');
        this.setData({ autoPlay: true });
      } else {
        this.console.log(`[${this.data.innerId}]`, '==== trigger play by playerCtx');
        this.userData.playerCtx.play({
          success: (res) => {
            this.console.log(`[${this.data.innerId}]`, 'call play success', res);
          },
          fail: (res) => {
            this.console.log(`[${this.data.innerId}]`, 'call play fail', res);
          },
        });
      }
    },
    checkCanRetry() {
      let errType;
      let isFatalError = false;
      let msg = '';
      if (this.data.playerState === PlayerStateEnum.PlayerError
        || this.data.playerState === PlayerStateEnum.LivePlayerError
      ) {
        // 初始化player失败
        errType = this.data.playerState;
        if (wx.getSystemInfoSync().platform === 'devtools') {
          // 开发者工具里不支持 live-player 和 TCPServer，明确提示
          msg = '不支持在开发者工具中创建p2p-player';
        } else if (this.data.playerDenied) {
          // 如果liveplayer是RTC模式，当微信没有系统录音权限时会出错
          msg = '请开启微信的系统录音权限';
        }
        isFatalError = true;
      } else if (this.data.p2pState === P2PStateEnum.P2PInitError) {
        // 初始化p2p失败
        errType = this.data.p2pState;
        msg = '请检查本地网络是否正常';
        isFatalError = true;
      } else if (xp2pManager.needResetLocalServer) {
        // 本地server出错
        errType = PlayerStateEnum.LocalServerError;
        msg = '系统网络服务可能被中断，请重置本地HttpServer';
        isFatalError = true;
      } else if (xp2pManager.networkChanged) {
        // 网络状态变化
        errType = P2PStateEnum.P2PLocalNATChanged;
        msg = '本地网络服务可能发生变化，请重置xp2p模块';
        isFatalError = true;
      }
      if (isFatalError) {
        // 不可恢复错误，断开p2p连接
        if (!this.isP2PInErrorState(this.data.p2pState)) {
          this.stopAll();
        }
        // 不可恢复错误，销毁player
        if (this.data.hasPlayer) {
          this.changeState({ hasPlayer: false });
        }
        this.console.error(`[${this.data.innerId}] ${errType} isFatalError, trigger playError`);
        this.triggerEvent('playError', {
          errType,
          errMsg: totalMsgMap[errType],
          errDetail: { msg },
          isFatalError: true,
        });
        return false;
      }
      return true;
    },
    async stopStreamAndReplay(newStreamState) {
      this.stopStream(newStreamState);

      await this.tryStopPlayer();

      this.changeState({
        streamState: StreamStateEnum.StreamWaitPull,
      });
      this.console.log(`[${this.data.innerId}]`, 'trigger replay');
      this.userData.playerCtx.play();
    },
    // 自动replay
    async checkNetworkAndReplay(newStreamState) {
      if (!this.checkCanRetry()) {
        return;
      }

      // 自动重新开始
      this.console.log(`[${this.data.innerId}]`, 'auto replay');
      this.stopStreamAndReplay(newStreamState);
    },
    // 手动retry
    onClickRetry() {
      if (!this.data.canUseP2P) {
        // 不可用的不需要reset
        return;
      }

      let needCreatePlayer;
      if (this.data.playerState !== PlayerStateEnum.PlayerReady) {
        if (this.data.needPlayer && this.data.canUseP2P && !this.data.hasPlayer
          && this.data.playerState === PlayerStateEnum.PlayerIdle
        ) {
          // reset了
          needCreatePlayer = true;
        } else {
          // player 没ready不能retry
          this.console.log(`[${this.data.innerId}]`, `can not retry in ${this.data.playerState}`);
          return;
        }
      }
      if (this.data.playing || this.data.streamState === StreamStateEnum.StreamWaitPull) {
        // 播放中不能retry
        this.console.log(`[${this.data.innerId}]`, `can not retry in ${this.data.playing ? 'playing' : this.data.streamState}`);
        return;
      }

      if (!this.checkCanRetry()) {
        return;
      }

      this.console.log(`[${this.data.innerId}]`, 'click retry');
      this.makeResultParams({ startAction: 'clickRetry' });
      if (needCreatePlayer) {
        this.changeState({
          hasPlayer: true,
        });
      }
      if (this.data.p2pState === P2PStateEnum.ServiceStarted) {
        this.tryTriggerPlay('clickRetry');
      } else if (this.data.p2pState === P2PStateEnum.P2PInited
        || this.data.p2pState === P2PStateEnum.ServiceStartError
        || this.data.p2pState === P2PStateEnum.ServiceError
      ) {
        this.prepare();
      } else if (this.data.p2pState === P2PStateEnum.P2PIdle) {
        this.initP2P();
      } else {
        this.console.log(`[${this.data.innerId}]`, `keep waiting in p2pState ${this.data.p2pState}`);
      }
    },
    // 处理播放错误
    handlePlayError(type, { msg, detail, isFatalError } = {}) {
      if (this.userData.isDetached) {
        this.console.info(`[${this.data.innerId}] handlePlayError after detached, ignore`);
        return;
      }

      this.console.error(`[${this.data.innerId}] handlePlayError`, type);

      if (!this.checkCanRetry()) {
        return;
      }

      if (isFatalError) {
        // 不可恢复错误，断开p2p连接
        if (!this.isP2PInErrorState(this.data.p2pState)) {
          this.stopAll();
        }
        // 不可恢复错误，销毁player
        if (this.data.hasPlayer) {
          this.console.error(`[${this.data.innerId}] ${errType} isFatalError, destroy player`);
          this.changeState({ hasPlayer: false });
        }
      }

      // 能retry的才提示这个，不能retry的前面已经触发弹窗了
      this.triggerEvent('playError', {
        errType: type,
        errMsg: totalMsgMap[type] || '播放失败',
        errDetail: { msg, detail, isFatalError },
        isFatalError,
      });
    },
    // 处理播放结束
    async handlePlayEnd(newStreamState, { msg, detail } = {}) {
      if (this.userData.isDetached) {
        this.console.info(`[${this.data.innerId}] handlePlayEnd after detached, ignore`);
        return;
      }

      this.console.info(`[${this.data.innerId}] handlePlayEnd`, newStreamState);

      this.stopStream(newStreamState);
      await this.tryStopPlayer();

      if (newStreamState === StreamStateEnum.StreamDataEnd) {
        // 推流结束
        this.triggerEvent('playEnd', {
          errType: newStreamState,
          errMsg: totalMsgMap[newStreamState] || '播放结束',
          errDetail: { msg, detail },
        });
        return;
      }

      if (this.properties.sceneType === 'live' && !this.userData.pageHideTimestamp) {
        // 自动重试
        this.checkNetworkAndReplay(newStreamState);
      } else {
        // 不自动重试的才抛出错误
        this.handlePlayError(newStreamState, { msg, detail });
      }
    },
    onP2PServiceMessage(targetId, event, subtype, detail) {
      if (targetId !== this.properties.targetId) {
        this.console.warn(
          `[${this.data.innerId}]`,
          `onP2PServiceMessage, targetId error, now ${this.properties.targetId}, receive`,
          targetId,
          event,
          subtype,
        );
        return;
      }

      switch (event) {
        case XP2PServiceEventEnum.ServiceNotify:
          this.onP2PServiceNotify(subtype, detail);
          break;

        default:
          this.console.warn(`[${this.data.innerId}]`, 'onP2PServiceMessage, unknown event', event, subtype);
      }
    },
    onP2PServiceNotify(type, detail) {
      this.console.info(`[${this.data.innerId}]`, 'onP2PServiceNotify', type, detail);
    },
    onP2PMessage(targetId, event, subtype, detail) {
      if (targetId !== this.properties.targetId) {
        this.console.warn(
          `[${this.data.innerId}]`,
          `onP2PMessage, targetId error, now ${this.properties.targetId}, receive`,
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
          this.triggerEvent('p2pDevNotify', { type: subtype, detail });
          break;

        case XP2PEventEnum.Log:
          this.triggerEvent('p2pLog', { type: subtype, detail });
          break;

        default:
          this.console.warn(`[${this.data.innerId}]`, 'onP2PMessage, unknown event', event, subtype);
      }
    },
    onP2PMessage_Notify(type, detail) {
      this.console.info(`[${this.data.innerId}] onP2PMessage_Notify ${type}, playing ${this.data.playing}`, detail);
      if (!this.data.playing && type !== XP2PNotify_SubType.Close) {
        // 退出播放时 stopStream 会触发 close 事件，是正常的，其他事件才 warn
        this.console.warn(`[${this.data.innerId}] receive onP2PMessage_Notify when not playing`, type, detail);
      }
      switch (type) {
        case XP2PNotify_SubType.Connected:
          // stream连接成功，注意不要修改state，Connected只在心跳保活时可能收到，不在关键路径上，只是记录一下
          this.setData({
            p2pConnected: true,
          });
          this.stat.addStateTimestamp('p2pConnected', { onlyOnce: true });
          break;
        case XP2PNotify_SubType.Request:
          this.changeState({
            streamState: StreamStateEnum.StreamRequest,
          });
          break;
        case XP2PNotify_SubType.Parsed:
          if (!detail || detail.status === 200) {
            // 数据传输开始
            this.changeState({
              streamState: StreamStateEnum.StreamHeaderParsed,
            });
          } else {
            if (detail.status >= 500) {
              // 连接错误
              this.console.error(`[${this.data.innerId}] HttpStatus ${detail.status}`, detail);
              this.setData({
                p2pConnected: false,
              });
              this.stopAll(P2PStateEnum.ServiceError);
              const msg = `httpStatus: ${detail.status}\n${httpStatusErrorMsgMap[detail.status]}`;
              this.handlePlayError(P2PStateEnum.ServiceError, { msg, detail });
            } else {
              // 其他非连接错误
              this.resetStreamData(StreamStateEnum.StreamHttpStatusError);
              this.tryStopPlayer();
              const msg = `httpStatus: ${detail.status}\n${httpStatusErrorMsgMap[detail.status]}`;
              this.handlePlayError(StreamStateEnum.StreamHttpStatusError, { msg, detail });
            }
          }
          break;
        case XP2PNotify_SubType.Success:
        case XP2PNotify_SubType.Eof:
          {
            // 数据传输正常结束
            this.console.log(
              `[${this.data.innerId}]`,
              `==== Notify ${type} in p2pState ${this.data.p2pState}, chunkCount ${this.userData.chunkCount}, time after last chunk ${Date.now() - this.userData.chunkTime}`,
              detail,
            );
            const { livePlayerInfo } = this.userData;
            const cache = Math.max(livePlayerInfo?.videoCache || 0, livePlayerInfo?.audioCache || 0);
            if (cache > cacheIgnore) {
              // 播放器还有cache，先不处理，打个log
              this.console.warn(`[${this.data.innerId}] data end but player has cache: video ${livePlayerInfo?.videoCache}, audio ${livePlayerInfo?.audioCache}`, livePlayerInfo);
            }
            this.handlePlayEnd(StreamStateEnum.StreamDataEnd);
          }
          break;
        case XP2PNotify_SubType.Fail:
          // 数据传输出错，当作结束，直播场景可以自动重试
          this.console.error(`[${this.data.innerId}]`, `==== Notify ${type} in p2pState ${this.data.p2pState}`, detail);
          this.handlePlayEnd(StreamStateEnum.StreamError);
          break;
        case XP2PNotify_SubType.Close:
          {
            if (!this.data.playing) {
              // 用户主动关闭，或者因为隐藏等原因挂起了，都会收到 onPlayerClose
              return;
            }
            // 播放中收到了Close，当作播放失败
            this.console.error(`[${this.data.innerId}] ==== Notify ${type}`, detail);
            const detailMsg = typeof detail === 'string' ? detail : (detail && detail.type);
            this.handlePlayError(StreamStateEnum.StreamError, { msg: `p2pNotify: ${type}, ${detailMsg}`, detail });
          }
          break;
        case XP2PNotify_SubType.Disconnect:
          {
            // p2p流断开
            this.console.error(`[${this.data.innerId}]`, `XP2PNotify_SubType.Disconnect in p2pState ${this.data.p2pState}`, detail);
            this.setData({
              p2pConnected: false,
            });
            this.stopAll(P2PStateEnum.ServiceError);
            const detailMsg = typeof detail === 'string' ? detail : (detail && detail.type);
            this.handlePlayError(P2PStateEnum.ServiceError, { msg: `p2pNotify: ${type}, ${detailMsg}`, detail });
          }
          break;
      }
    },
    // 以下是播放器控件相关的
    changeMuted() {
      this.setData({
        muted: !this.data.muted,
      });
    },
    changeSoundMode() {
      this.setData({
        soundMode: this.data.soundMode === 'ear' ? 'speaker' : 'ear',
      });
    },
    changeOrientation() {
      this.setData({
        orientation: this.data.orientation === 'horizontal' ? 'vertical' : 'horizontal',
      });
    },
    changeFullScreen() {
      if (!this.userData.playerCtx) {
        return;
      }
      if (!this.data.fullScreen) {
        this.userData.playerCtx.requestFullScreen({
          direction: 90,
          success: (res) => {
            this.console.log(`[${this.data.innerId}]`, 'requestFullScreen success', res);
            this.setData({
              fullScreen: true,
            });
          },
          fail: (res) => {
            this.console.warn(`[${this.data.innerId}]`, 'requestFullScreen fail', res);
          },
        });
      } else {
        this.userData.playerCtx.exitFullScreen({
          success: (res) => {
            this.console.log(`[${this.data.innerId}]`, 'exitFullScreen success', res);
            this.setData({
              fullScreen: false,
            });
          },
          fail: (res) => {
            this.console.warn(`[${this.data.innerId}]`, 'exitFullScreen fail', res);
          },
        });
      }
    },
    snapshotAndSave() {
      this.console.log(`[${this.data.innerId}]`, 'snapshotAndSave');
      snapshotAndSave({
        snapshot: this.snapshot.bind(this),
      });
    },
    snapshot() {
      this.console.log(`[${this.data.innerId}]`, 'snapshot');
      if (!this.userData.playerCtx) {
        return Promise.reject({ errMsg: 'player not ready' });
      }
      return new Promise((resolve, reject) => {
        this.userData.playerCtx.snapshot({
          quality: 'raw',
          success: (res) => {
            this.console.log(`[${this.data.innerId}]`, 'snapshot success', res);
            resolve(res);
          },
          fail: (err) => {
            this.console.error(`[${this.data.innerId}]`, 'snapshot fail', err);
            reject(err);
          },
        });
      });
    },
    // 以下是调试面板相关的
    toggleDebugInfo() {
      this.setData({ showDebugInfo: !this.data.showDebugInfo });
    },
    toggleSlow() {
      this.setData({ isSlow: !this.data.isSlow });
    },
    toggleRecording() {
      if (this.data.isRecording) {
        this.stopRecording();
      } else {
        this.startRecording();
      }
    },
    async startRecording(recordFilename) {
      if (this.data.isRecording || this.userData.fileObj) {
        // 已经在录像
        return;
      }

      const modalRes = await wx.showModal({
        title: '确定开始录像吗？',
        content: `录像需要重新拉流，并且可能影响播放性能，请谨慎操作。\n仅保留最新的1个录像，最大支持 ${MAX_FILE_SIZE_IN_M}MB。`,
      });
      if (!modalRes || !modalRes.confirm) {
        return;
      }
      this.console.log(`[${this.data.innerId}] confirm startRecording`);

      // 保存录像文件要有flv头，停掉重新拉流
      if (this.data.playing) {
        this.stopStream();
      }
      this.tryStopPlayer();

      // 准备录像文件，注意要在 stopStream 之后
      let realRecordFilename = recordFilename;
      if (!realRecordFilename) {
        if (this.data.p2pMode === 'ipc') {
          const streamType = getParamValue(this.data.flvParams, 'action') || 'live';
          realRecordFilename = `${this.data.p2pMode}-${this.properties.productId}-${this.properties.deviceName}-${streamType}`;
        } else {
          realRecordFilename = `${this.data.p2pMode}-${this.data.flvFilename}`;
        }
      }
      const fileObj = recordManager.openRecordFile(realRecordFilename);
      this.userData.fileObj = fileObj;
      this.setData({
        isRecording: !!fileObj,
      });
      this.console.log(`[${this.data.innerId}] record fileName ${fileObj && fileObj.fileName}`);

      // 重新play
      this.changeState({
        streamState: StreamStateEnum.StreamWaitPull,
      });
      this.console.log(`[${this.data.innerId}]`, 'trigger record play');
      this.userData.playerCtx.play();
    },
    async stopRecording() {
      if (!this.data.isRecording || !this.userData.fileObj) {
        // 没在录像
        return;
      }

      this.console.log(`[${this.data.innerId}]`, `stopRecording, ${this.userData.fileObj.fileName}`);
      const { fileObj } = this.userData;
      this.userData.fileObj = null;
      this.setData({
        isRecording: false,
      });

      const fileRes = recordManager.saveRecordFile(fileObj);
      this.console.log(`[${this.data.innerId}]`, 'saveRecordFile res', fileRes);

      if (!fileRes) {
        wx.showToast({
          title: '录像失败',
          icon: 'error',
        });
        return;
      }

      // 保存到相册
      try {
        await recordManager.saveVideoToAlbum(fileRes.fileName);
        wx.showModal({
          title: '录像已保存到相册',
          showCancel: false,
        });
      } catch (err) {
        wx.showModal({
          title: '保存录像到相册失败',
          content: err.errMsg,
          showCancel: false,
        });
      }
    },
    cancelRecording() {
      if (!this.data.isRecording || !this.userData.fileObj) {
        // 没在录像
        return;
      }

      this.console.log(`[${this.data.innerId}]`, `cancelRecording, ${this.userData.fileObj.fileName}`);
      const { fileObj } = this.userData;
      this.userData.fileObj = null;
      this.setData({
        isRecording: false,
      });

      recordManager.closeRecordFile(fileObj);
    },
  },
});

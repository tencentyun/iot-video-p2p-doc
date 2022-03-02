import { canUseP2PIPCMode, canUseP2PServerMode } from '../../utils';
import { getXp2pManager } from '../../xp2pManager';

const xp2pManager = getXp2pManager();
const { XP2PEventEnum, XP2PNotify_SubType } = xp2pManager;

// ts才能用enum，先这么处理吧
const PlayerStateEnum = {
  PlayerIdle: 'PlayerIdle',
  PlayerPreparing: 'PlayerPreparing',
  PlayerReady: 'PlayerReady',
  PlayerError: 'PlayerError',
  LivePlayerError: 'LivePlayerError',
  LivePlayerStateError: 'LivePlayerStateError',
  LocalServerError: 'LocalServerError',
};
const P2PStateEnum = {
  P2PIdle: 'P2PIdle',
  P2PUnkown: 'P2PUnkown',
  P2PIniting: 'P2PIniting',
  P2PInited: 'P2PInited',
  P2PInitError: 'P2PInitError',
  P2PLocalNATChanged: 'P2PLocalNATChanged',
  ServicePreparing: 'ServicePreparing',
  ServiceStarted: 'ServiceStarted',
  ServiceStartError: 'ServiceStartError',
  ServiceError: 'ServiceError',
};
const StreamStateEnum = {
  StreamIdle: 'StreamIdle',
  StreamWaitPull: 'StreamWaitPull',
  StreamChecking: 'StreamChecking',
  StreamCheckSuccess: 'StreamCheckSuccess',
  StreamCheckError: 'StreamCheckError',
  StreamPreparing: 'StreamPreparing',
  StreamStarted: 'StreamStarted',
  StreamError: 'StreamError',
  StreamRequest: 'StreamRequest',
  StreamHeaderParsed: 'StreamHeaderParsed',
  StreamDataReceived: 'StreamDataReceived',
  StreamDataEnd: 'StreamDataEnd',
};

const totalMsgMap = {
  [PlayerStateEnum.PlayerPreparing]: '正在创建播放器...',
  [PlayerStateEnum.PlayerReady]: '创建播放器成功',
  [PlayerStateEnum.PlayerError]: '创建播放器失败',
  [PlayerStateEnum.LivePlayerError]: '播放失败',
  [PlayerStateEnum.LivePlayerStateError]: '播放失败',
  [PlayerStateEnum.LocalServerError]: '播放器错误',

  [P2PStateEnum.P2PUnkown]: 'P2PUnkown',
  [P2PStateEnum.P2PIniting]: '正在初始化p2p模块...',
  [P2PStateEnum.P2PInited]: '初始化p2p模块完成',
  [P2PStateEnum.P2PInitError]: '初始化p2p模块失败',
  [P2PStateEnum.P2PLocalNATChanged]: '本地NAT发生变化',
  [P2PStateEnum.ServicePreparing]: '正在启动p2p服务...',
  [P2PStateEnum.ServiceStarted]: '启动p2p服务完成',
  [P2PStateEnum.ServiceStartError]: '启动p2p服务失败',
  [P2PStateEnum.ServiceError]: '连接失败或断开',

  [StreamStateEnum.StreamWaitPull]: '加载中...',
  [StreamStateEnum.StreamChecking]: '加载中...',
  [StreamStateEnum.StreamCheckSuccess]: '加载中...',
  [StreamStateEnum.StreamCheckError]: '设备正忙，请稍后重试',
  [StreamStateEnum.StreamPreparing]: '加载中...',
  [StreamStateEnum.StreamStarted]: '加载中...',
  [StreamStateEnum.StreamError]: '播放失败',
  [StreamStateEnum.StreamRequest]: '加载中...',
  [StreamStateEnum.StreamHeaderParsed]: '加载中...',
  [StreamStateEnum.StreamDataReceived]: '',
  [StreamStateEnum.StreamDataEnd]: '播放结束',
};

// 统计用
// 启播步骤
const PlayStepEnum = {
  CreatePlayer: 'StepCreatePlayer',
  InitModule: 'StepInitModule',
  StartP2PService: 'StepStartP2PService',
  // WaitBothReady: 'StepWaitBothReady',
  // WaitTriggerPlay: 'StepWaitTriggerPlay', // 回放时等待选择录像的时间，不需要了，回放从选择录像开始计时
  ConnectLocalServer: 'StepConnectLocalServer',
  WaitStream: 'StepWaitStream',
  CheckStream: 'StepCheckStream',
  StartStream: 'StepStartStream',
  WaitHeader: 'StepWaitHeader',
  WaitData: 'StepWaitData',
  WaitIDR: 'StepWaitIDR',
};
const state2StepConfig = {
  // player
  [PlayerStateEnum.PlayerReady]: {
    step: PlayStepEnum.CreatePlayer,
    fromState: PlayerStateEnum.PlayerPreparing,
    toState: PlayerStateEnum.PlayerReady,
  },
  [PlayerStateEnum.PlayerError]: {
    step: PlayStepEnum.CreatePlayer,
    fromState: PlayerStateEnum.PlayerPreparing,
    toState: PlayerStateEnum.PlayerError,
    isResult: true,
  },

  // p2p
  [P2PStateEnum.P2PInited]: {
    step: PlayStepEnum.InitModule,
    fromState: P2PStateEnum.P2PIniting,
    toState: P2PStateEnum.P2PInited,
  },
  [P2PStateEnum.P2PInitError]: {
    step: PlayStepEnum.InitModule,
    fromState: P2PStateEnum.P2PIniting,
    toState: P2PStateEnum.P2PInitError,
    isResult: true,
  },
  [P2PStateEnum.ServiceStarted]: {
    step: PlayStepEnum.StartP2PService,
    fromState: P2PStateEnum.ServicePreparing,
    toState: P2PStateEnum.ServiceStarted,
  },
  [P2PStateEnum.ServiceStartError]: {
    step: PlayStepEnum.StartP2PService,
    fromState: P2PStateEnum.ServicePreparing,
    toState: P2PStateEnum.ServiceStartError,
    isResult: true,
  },
  [P2PStateEnum.ServiceError]: {
    step: PlayStepEnum.WaitStream,
    fromState: P2PStateEnum.ServiceStarted,
    toState: P2PStateEnum.ServiceError,
    isResult: true,
  },

  // stream
  [StreamStateEnum.StreamCheckSuccess]: {
    step: PlayStepEnum.CheckStream,
    fromState: StreamStateEnum.StreamChecking,
    toState: StreamStateEnum.StreamCheckSuccess,
  },
  [StreamStateEnum.StreamCheckError]: {
    step: PlayStepEnum.CheckStream,
    fromState: StreamStateEnum.StreamChecking,
    toState: StreamStateEnum.StreamCheckError,
    isResult: true,
  },
  [StreamStateEnum.StreamStarted]: {
    step: PlayStepEnum.StartStream,
    fromState: StreamStateEnum.StreamPreparing,
    toState: StreamStateEnum.StreamStarted,
  },
  [StreamStateEnum.StreamError]: {
    step: PlayStepEnum.StartStream,
    fromState: StreamStateEnum.StreamPreparing,
    toState: StreamStateEnum.StreamError,
    isResult: true,
  },
  [StreamStateEnum.StreamHeaderParsed]: {
    step: PlayStepEnum.WaitHeader,
    fromState: StreamStateEnum.StreamStarted,
    toState: StreamStateEnum.StreamHeaderParsed,
  },
  [StreamStateEnum.StreamDataReceived]: {
    step: PlayStepEnum.WaitData,
    fromState: StreamStateEnum.StreamHeaderParsed,
    toState: StreamStateEnum.StreamDataReceived,
    isResult: true,
  },
};

let playerSeq = 0;

Component({
  behaviors: ['wx://component-export'],
  properties: {
    mode: {
      type: String,
    },
    targetId: {
      type: String,
    },
    flvUrl: {
      type: String,
    },
    autoReplay: {
      type: Boolean,
      value: false,
    },
    // 以下是 live-player 的属性
    muted: {
      type: Boolean,
      value: false,
    },
    orientation: {
      type: String,
      value: 'vertical',
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
    },
    // 以下仅供调试，正式组件不需要
    onlyp2p: {
      type: Boolean,
      value: false,
    },
  },
  data: {
    innerId: '',
    xp2pVersion: xp2pManager.XP2PVersion,
    p2pPlayerVersion: xp2pManager.P2PPlayerVersion,

    // page相关
    pageHideTimestamp: 0,

    // 这是onLoad时就固定的
    streamExInfo: null,
    canUseP2P: false,
    needPlayer: false,

    // 当前flv
    flvFile: '',
    flvFilename: '',
    flvParams: '',

    // player状态
    hasPlayer: false, // needPlayer时才有效，出错销毁时设为false
    autoPlay: false,
    playerId: '', // 这是 p2p-player 组件的id，不是自己的id
    playerState: PlayerStateEnum.PlayerIdle,
    playerComp: null,
    playerCtx: null,
    playerMsg: '',

    // p2p状态
    p2pState: P2PStateEnum.P2PIdle,
    p2pConnected: false,

    // stream状态
    streamState: StreamStateEnum.StreamIdle,
    playing: false,
    chunkCount: 0,
    totalBytes: 0,

    // 这些是播放相关信息，清空时机同 totalBytes
    livePlayerInfo: '',

    // debug用
    showDebugInfo: false,
    isSlow: false,

    // 统计用
    playResultParams: null,
    playResultStr: '',
    hasReceivedIDR: false,
    idrResultParams: null,
    idrResultStr: '',
  },
  pageLifetimes: {
    show() {
      const hideTime = this.data.pageHideTimestamp ? Date.now() - this.data.pageHideTimestamp : 0;
      console.log(`[${this.data.innerId}]`, '==== page show, hideTime', hideTime);
      this.setData({
        pageHideTimestamp: 0,
      });
    },
    hide() {
      console.log(`[${this.data.innerId}]`, '==== page hide');
      this.setData({
        pageHideTimestamp: Date.now(),
      });
    },
  },
  lifetimes: {
    created() {
      // 在组件实例刚刚被创建时执行
      playerSeq++;
      this.setData({ innerId: `common-player-${playerSeq}` });
      console.log(`[${this.data.innerId}]`, '==== created');
    },
    attached() {
      // 在组件实例进入页面节点树时执行
      console.log(`[${this.data.innerId}]`, '==== attached', this.id, this.properties);

      const canUseP2P = (this.properties.mode === 'ipc' && canUseP2PIPCMode) || (this.properties.mode === 'server' && canUseP2PServerMode);
      const flvFile = this.properties.flvUrl.split('/').pop();
      const [flvFilename = '', flvParams = ''] = flvFile.split('?');
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
        p2pState = P2PStateEnum.P2PInitError;
        playerState = PlayerStateEnum.PlayerError;
        playerMsg = '您的微信基础库版本过低，请升级后再使用';
      }

      // 统计用
      this.makeResultParams({ startAction: 'enter', flvParams });

      this.changeState({
        flvFile,
        flvFilename,
        flvParams,
        streamExInfo: {
          productId: this.properties.productId,
          deviceName: this.properties.deviceName,
          xp2pInfo: this.properties.xp2pInfo,
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
      console.log(`[${this.data.innerId}]`, '==== detached');
      this.stopAll();
      console.log(`[${this.data.innerId}]`, '==== detached end');
    },
    error() {
      // 每当组件方法抛出错误时执行
    },
  },
  export() {
    return {
      changeFlv: this.changeFlv.bind(this),
      stopAll: this.stopAll.bind(this),
      pause: this.pause.bind(this),
      resume: this.resume.bind(this),
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
      this.addStateTimestamp(newData.playerState);
      this.addStateTimestamp(newData.p2pState);
      this.addStateTimestamp(newData.streamState);

      const oldP2PState = this.data.p2pState;
      const oldStreamState = this.data.streamState;
      this.setData({ ...newData, playerMsg: this.getPlayerMessage(newData) }, callback);
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
      const now = Date.now();
      const playResultParams = {
        startAction,
        flvParams: flvParams || this.data.flvParams,
        timestamp: now,
        lastTimestamp: now,
        playTimestamps: {},
        steps: [],
        firstChunkBytes: 0,
      };
      this.setData({
        playResultParams,
        playResultStr: '',
        hasReceivedIDR: false,
        idrResultParams: null,
        idrResultStr: '',
      });
      console.log(`[${this.data.innerId}]`, '==== start new play', startAction, flvParams);
    },
    addStateTimestamp(state) {
      if (!state || !this.data.playResultParams) {
        return;
      }
      this.data.playResultParams.playTimestamps[state] = Date.now();
      const stepCfg = state2StepConfig[state];
      if (stepCfg) {
        this.addStep(stepCfg.step, stepCfg);
      }
    },
    addStep(step, { fromState, toState, isResult } = {}) {
      if (!step || !this.data.playResultParams) {
        return;
      }
      const now = Date.now();
      const { playTimestamps } = this.data.playResultParams;
      let fromTime = 0;
      let toTime = 0;
      if (fromState) {
        if (!playTimestamps[fromState]) {
          console.log(`[${this.data.innerId}]`, 'addStep', step, 'but no fromState', fromState);
          return;
        }
        fromTime = playTimestamps[fromState];
      } else {
        fromTime = this.data.playResultParams.lastTimestamp;
      }
      if (toState) {
        if (!playTimestamps[toState]) {
          console.log(`[${this.data.innerId}]`, 'addStep', step, 'but no toState', toState);
          return;
        }
        toTime = playTimestamps[toState];
      } else {
        toTime = now;
      }

      const timeCost = toTime - fromTime;
      console.log(`[${this.data.innerId}]`, 'addStep', step, timeCost, fromState ? `${fromState} -> ${toState || 'now'}` : '');
      this.data.playResultParams.lastTimestamp = now;
      this.data.playResultParams.steps.push({
        step,
        timeCost,
      });
      if (isResult) {
        const { startAction, timestamp, firstChunkBytes, steps } = this.data.playResultParams;
        const timeCost = now - timestamp;
        console.log(`[${this.data.innerId}]`, '==== play result', startAction, step, toState, timeCost, this.data.playResultParams);
        const byteStr = firstChunkBytes > 0 ? `(${firstChunkBytes} bytes)` : '';
        const playResultStr = JSON.stringify({
          result: `${toState} ${byteStr}`,
          timeCost,
          startAction,
          steps: steps.map((item, index) => `${index}: ${item.step} - ${item.timeCost}`),
        }, null, 2);
        this.setData({
          playResultParams: null,
          playResultStr,
        });
      }
    },
    createPlayer() {
      console.log(`[${this.data.innerId}]`, 'createPlayer', Date.now());
      if (this.data.playerState !== PlayerStateEnum.PlayerIdle) {
        console.error(`[${this.data.innerId}]`, 'can not createPlayer in playerState', this.data.playerState);
        return;
      }

      this.changeState({
        playerState: PlayerStateEnum.PlayerPreparing,
      });

      if (!this.data.needPlayer) {
        // mock 一个
        const playerExport = {
          addChunk: () => {},
        };
        const livePlayerContext = {
          isPlaying: false, // play/stop 用
          isPaused: false, // pause/resume 用
          play: ({ success, fail, complete } = {}) => {
            if (livePlayerContext.isPlaying) {
              fail && fail({ errMsg: 'already playing' });
              complete && complete();
              return;
            }
            livePlayerContext.isPlaying = true;
            livePlayerContext.isPaused = false;
            setTimeout(() => {
              this.onPlayerStartPull({});
              success && success();
              complete && complete();
            }, 0);
          },
          stop: ({ success, fail, complete } = {}) => {
            if (!livePlayerContext.isPlaying) {
              fail && fail({ errMsg: 'not playing' });
              complete && complete();
              return;
            }
            livePlayerContext.isPlaying = false;
            livePlayerContext.isPaused = false;
            // 这个是立刻调用的
            this.onPlayerClose({ detail: { error: { code: 'USER_CLOSE' } } });
            setTimeout(() => {
              success && success();
              complete && complete();
            }, 0);
          },
          pause: ({ success, fail, complete } = {}) => {
            if (!livePlayerContext.isPlaying) {
              fail && fail({ errMsg: 'not playing' });
              complete && complete();
              return;
            }
            if (livePlayerContext.isPaused) {
              fail && fail({ errMsg: 'already paused' });
              complete && complete();
              return;
            }
            livePlayerContext.isPaused = true;
            setTimeout(() => {
              success && success();
              complete && complete();
              this.onPlayerClose({ detail: { error: { code: 'LIVE_PLAYER_CLOSED' } } });
            }, 0);
          },
          resume: ({ success, fail, complete } = {}) => {
            if (!livePlayerContext.isPlaying) {
              fail && fail({ errMsg: 'not playing' });
              complete && complete();
              return;
            }
            if (!livePlayerContext.isPaused) {
              fail && fail({ errMsg: 'not paused' });
              complete && complete();
              return;
            }
            livePlayerContext.isPaused = false;
            setTimeout(() => {
              success && success();
              complete && complete();
              this.onPlayerStartPull({});
            }, 0);
          },
        };
        this.onPlayerReady({
          detail: {
            playerExport,
            livePlayerContext,
          },
        });
      }
    },
    onPlayerReady({ detail }) {
      console.log(`[${this.data.innerId}]`, '==== onPlayerReady in', this.data.playerState, this.data.p2pState, detail);
      const oldPlayerState = this.data.playerState;
      this.changeState({
        playerState: PlayerStateEnum.PlayerReady,
        playerComp: detail.playerExport,
        playerCtx: detail.livePlayerContext,
      });
      this.tryTriggerPlay(`${oldPlayerState} -> ${this.data.playerState}`);
    },
    onPlayerStartPull({ detail }) {
      console.log(`[${this.data.innerId}]`, `==== onPlayerStartPull in p2pState ${this.data.p2pState}, pageHide ${!!this.data.pageHideTimestamp}`, detail);
      if (this.data.p2pState !== P2PStateEnum.ServiceStarted) {
        // 因为各种各样的原因，player在状态不对的时候又触发播放了，停掉
        console.warn(`[${this.data.innerId}]`, `onPlayerStartPull in p2pState ${this.data.p2pState}, stop player`);
        try {
          this.data.playerCtx.stop();
        } catch (err) {}
        return;
      }

      this.addStep(PlayStepEnum.ConnectLocalServer, { fromState: StreamStateEnum.StreamWaitPull });

      // 开始拉流
      this.startStream();
    },
    onPlayerClose({ detail }) {
      console.log(`[${this.data.innerId}]`, `==== onPlayerClose in p2pState ${this.data.p2pState}, pageHide ${!!this.data.pageHideTimestamp}`, detail);
      // 停止拉流
      this.stopStream();
    },
    onPlayerError({ detail }) {
      console.log(`[${this.data.innerId}]`, '==== onPlayerError', detail);
      this.changeState({
        playerState: PlayerStateEnum.PlayerError,
      });
      this.handlePlayError(PlayerStateEnum.PlayerError, { msg: `p2pPlayerError: ${detail.error.code}` });
    },
    // eslint-disable-next-line no-unused-vars, @typescript-eslint/no-unused-vars
    onLivePlayerError({ detail }) {
      console.error(`[${this.data.innerId}]`, '==== onLivePlayerError', detail);
      this.changeState({
        playerState: PlayerStateEnum.LivePlayerError,
      });
      if (detail.errMsg && detail.errMsg.indexOf('system permission denied') >= 0) {
        // 如果liveplayer是RTC模式，当微信没有系统录音权限时会出错，但是没有专用的错误码，微信侧建议先判断errMsg来兼容
        this.triggerEvent('systemPermissionDenied', detail);
        return;
      }
      // TODO 什么情况会走到这里？
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
          console.log(`[${this.data.innerId}]`, '==== onLivePlayerStateChange', detail.code, detail, `streamState: ${this.data.streamState}`);
          break;
        case 2003: // 网络接收到首个视频数据包(IDR)
          console.log(`[${this.data.innerId}]`, '==== onLivePlayerStateChange', detail.code, detail, `totalBytes: ${this.data.totalBytes}`);
          if (!this.data.hasReceivedIDR && this.data.idrResultParams) {
            const timeCost = Date.now() - this.data.idrResultParams.playSuccTime;
            this.data.idrResultParams.timeCost = timeCost;
            this.setData({
              hasReceivedIDR: true,
              idrResultStr: `${PlayStepEnum.WaitIDR}: ${timeCost} ms, ${this.data.chunkCount} chunks, ${this.data.totalBytes} bytes`,
            });
          }
          break;
        case 2103: // 网络断连, 已启动自动重连
          console.error(`[${this.data.innerId}]`, '==== onLivePlayerStateChange', detail.code, detail);
          if (/errCode:-1004(\D|$)/.test(detail.message) || /Failed to connect to/.test(detail.message)) {
            // 无法连接本地服务器
            xp2pManager.needResetLocalServer = true;

            // 这时其实网络状态应该也变了，但是网络状态变化事件延迟较大，networkChanged不一定为true
            // 所以把 networkChanged 也设为true
            xp2pManager.networkChanged = true;

            this.stopAll(P2PStateEnum.ServiceError);
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
            this.checkCanRetry();
          }
          break;
        case -2301: // live-player断连，且经多次重连抢救无效，需要提示出错，由用户手动重试
          console.error(`[${this.data.innerId}]`, '==== onLivePlayerStateChange', detail.code, detail);
          // 到这里应该已经触发过 onPlayerClose 了
          this.changeState({
            playerState: xp2pManager.needResetLocalServer
              ? PlayerStateEnum.LocalServerError
              : PlayerStateEnum.LivePlayerStateError,
          });
          this.handlePlayError(PlayerStateEnum.LivePlayerStateError, { msg: `livePlayerStateChange: ${detail.code} ${detail.message}` });
          break;
        default:
          // 这些不特别处理，打个log
          console.log(`[${this.data.innerId}]`, 'onLivePlayerStateChange', detail.code, detail);
          break;
      }
    },
    // eslint-disable-next-line no-unused-vars, @typescript-eslint/no-unused-vars
    onLivePlayerNetStatusChange({ detail }) {
      // console.log(`[${this.data.innerId}]`, 'onLivePlayerNetStatusChange', detail.info);
      if (!detail.info) {
        return;
      }
      this.setData({
        livePlayerInfo: [
          `size: ${detail.info.videoWidth}x${detail.info.videoHeight}, fps: ${detail.info.videoFPS}`,
          `bitrate(kbps): video ${detail.info.videoBitrate}, audio ${detail.info.audioBitrate}`,
          `cache(ms): video ${detail.info.videoCache}, audio ${detail.info.audioCache}`,
        ].join('\n'),
      });
    },
    resetServiceData(newP2PState) {
      this.clearStreamData();
      this.changeState({
        p2pState: newP2PState,
        p2pConnected: false,
        streamState: StreamStateEnum.StreamIdle,
        playing: false,
      });
    },
    resetStreamData(newStreamState) {
      this.clearStreamData();
      this.changeState({
        streamState: newStreamState,
        playing: false,
      });
    },
    clearStreamData() {
      this.setData({
        chunkCount: 0,
        totalBytes: 0,
        livePlayerInfo: '',
      });
    },
    initP2P() {
      console.log(`[${this.data.innerId}]`, 'initP2P');
      if (this.data.p2pState !== P2PStateEnum.P2PIdle) {
        console.log(`[${this.data.innerId}]`, 'can not initP2P in p2pState', this.data.p2pState);
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

      console.log(`[${this.data.innerId}]`, 'initModule');

      xp2pManager
        .initModule()
        .then((res) => {
          console.log(`[${this.data.innerId}]`, '==== initModule res', res, 'in p2pState', this.data.p2pState);
          if (res === 0) {
            this.changeState({
              p2pState: P2PStateEnum.P2PInited,
            });
            this.prepare();
          } else {
            xp2pManager.destroyModule();
            this.changeState({
              p2pState: P2PStateEnum.P2PInitError,
            });
            this.handlePlayError(P2PStateEnum.P2PInitError, { msg: `initModule res ${res}` });
          }
        })
        .catch((errcode) => {
          console.error(`[${this.data.innerId}]`, '==== initModule error', errcode, 'in p2pState', this.data.p2pState);
          xp2pManager.destroyModule();
          this.changeState({
            p2pState: P2PStateEnum.P2PInitError,
          });
          this.handlePlayError(P2PStateEnum.P2PInitError, { msg: `initModule err ${errcode}` });
        });
    },
    prepare() {
      console.log(`[${this.data.innerId}]`, 'prepare');
      if (this.data.p2pState !== P2PStateEnum.P2PInited
        && this.data.p2pState !== P2PStateEnum.ServiceStartError
        && this.data.p2pState !== P2PStateEnum.ServiceError
      ) {
        console.log(`can not start service in p2pState ${this.data.p2pState}`);
        return;
      }

      const { targetId } = this.properties;
      const { flvUrl, streamExInfo } = this.data;
      console.log(`[${this.data.innerId}]`, 'startP2PService', targetId, flvUrl, streamExInfo);

      const msgCallback = (event, subtype, detail) => {
        this.onP2PMessage(targetId, event, subtype, detail);
      };

      this.changeState({
        p2pState: P2PStateEnum.ServicePreparing,
      });

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
          console.log(`[${this.data.innerId}]`, '==== startP2PService res', res);
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
          console.error(`[${this.data.innerId}]`, '==== startP2PService error', errcode);
          this.stopAll(P2PStateEnum.ServiceStartError);
          this.handlePlayError(P2PStateEnum.ServiceStartError, { msg: `startP2PService err ${errcode}` });
        });
    },
    startStream() {
      console.log(`[${this.data.innerId}]`, 'startStream');
      if (this.data.p2pState !== P2PStateEnum.ServiceStarted) {
        console.log(`[${this.data.innerId}]`, `can not start stream in p2pState ${this.data.p2pState}`);
        return;
      }
      if (this.data.playing) {
        console.log(`[${this.data.innerId}]`, 'already playing');
        return;
      }

      // 先检查能否拉流
      const checkCanStartStream = this.properties.checkFunctions && this.properties.checkFunctions.checkCanStartStream;
      console.log(`[${this.data.innerId}]`, 'need checkCanStartStream', !!checkCanStartStream);

      if (!checkCanStartStream) {
        // 不检查，直接拉流
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
          console.log(`[${this.data.innerId}]`, '==== checkCanStartStream success');
          this.changeState({
            streamState: StreamStateEnum.StreamCheckSuccess,
          });
          this.doStartStream();
        })
        .catch((errmsg) => {
          if (!this.data.playing) {
            // 已经stop了
            return;
          }
          // 检查失败，前面已经弹过提示了
          console.log(`[${this.data.innerId}]`, '==== checkCanStartStream fail', errmsg);
          this.resetStreamData(StreamStateEnum.StreamCheckError);
          if (errmsg) {
            this.setData({ playerMsg: errmsg });
          }
          if (this.data.playerCtx) {
            try {
              this.data.playerCtx.stop();
            } catch (err) {
              // 重复stop可能会报错，不用处理
            }
          }
        });
    },
    doStartStream() {
      console.log(`[${this.data.innerId}]`, 'do startStream', this.properties.targetId, this.data.flvFilename, this.data.flvParams);

      const { playerComp } = this.data;
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

        chunkCount++;
        totalBytes += data.byteLength;
        if (chunkCount === 1) {
          console.log(`[${this.data.innerId}]`, '==== firstChunk', data.byteLength);
          if (this.data.playResultParams) {
            this.data.playResultParams.firstChunkBytes = data.byteLength;
            this.setData({
              hasReceivedIDR: false,
              idrResultParams: {
                playSuccTime: Date.now(),
              },
              idrResultStr: '',
            });
          }
          this.changeState({
            streamState: StreamStateEnum.StreamDataReceived,
          });
        }
        this.setData({
          chunkCount,
          totalBytes,
        });
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
          // msgCallback, // 不传 msgCallback 就是保持之前设置的
          dataCallback,
        })
        .then((res) => {
          console.log(`[${this.data.innerId}]`, '==== startStream success', res);
          this.changeState({
            streamState: StreamStateEnum.StreamStarted,
          });
        })
        .catch((res) => {
          console.log(`[${this.data.innerId}]`, '==== startStream fail', res);
          this.resetStreamData(StreamStateEnum.StreamError);
          if (this.data.playerCtx) {
            try {
              this.data.playerCtx.stop();
            } catch (err) {
              // 重复stop可能会报错，不用处理
            }
          }
        });
    },
    stopStream(newStreamState = StreamStateEnum.StreamIdle) {
      console.log(`[${this.data.innerId}]`, 'stopStream');
      if (!this.data.playing) {
        console.log(`[${this.data.innerId}]`, 'not playing');
        return;
      }

      console.log(`[${this.data.innerId}]`, 'do stopStream', this.properties.targetId);

      this.resetStreamData(newStreamState);

      xp2pManager.stopStream(this.properties.targetId);
    },
    changeFlv({ filename = '', params = '' }) {
      console.log(`[${this.data.innerId}]`, 'changeFlv', filename, params);
      this.setData(
        {
          flvFile: `${filename}${params ? `?${params}` : ''}`,
          flvFilename: filename,
          flvParams: params,
        },
        () => {
          const checkIsFlvValid = this.properties.checkFunctions && this.properties.checkFunctions.checkIsFlvValid;
          if (checkIsFlvValid && !checkIsFlvValid({ filename: this.data.flvFilename, params: this.data.flvParams })) {
            console.log(`[${this.data.innerId}]`, 'flv invalid, stopStream');
            // 无效，停止播放
            this.stopStream();
            if (this.data.playerCtx) {
              try {
                this.data.playerCtx.stop();
              } catch (err) {}
            }
            return;
          }
          if (!this.data.playing) {
            this.makeResultParams({ startAction: 'changeFlv', flvParams: params });
            this.tryTriggerPlay('changeFlv');
            return;
          }
          this.stopStream();
          if (this.data.playerCtx) {
            this.data.playerCtx.stop({
              success: () => {
                console.log(`[${this.data.innerId}]`, '==== trigger play', this.data.flvFilename, this.data.flvParams);
                this.makeResultParams({ startAction: 'changeFlv', flvParams: params });
                this.changeState({
                  streamState: StreamStateEnum.StreamWaitPull,
                });
                this.data.playerCtx.play();
              },
            });
          }
        },
      );
    },
    stopAll(newP2PState = P2PStateEnum.P2PUnkown) {
      console.log(`[${this.data.innerId}]`, 'stopAll', newP2PState);

      // 不用等stopPlay的回调，先把流停掉
      if (this.data.playing) {
        this.stopStream();
      }

      this.resetServiceData(newP2PState);
      xp2pManager.stopP2PService(this.properties.targetId);

      if (this.data.playerCtx) {
        try {
          this.data.playerCtx.stop();
        } catch (err) {
          // 重复stop可能会报错，不用处理
        }
      }
    },
    pause({ success, fail, complete }) {
      if (!this.data.playerCtx) {
        fail && fail({ errMsg: 'player not ready' });
        complete && complete();
      }
      this.data.playerCtx.pause({ success, fail, complete });
    },
    resume({ success, fail, complete }) {
      if (!this.data.playerCtx) {
        fail && fail({ errMsg: 'player not ready' });
        complete && complete();
      }
      this.data.playerCtx.resume({ success, fail, complete });
    },
    tryTriggerPlay(reason) {
      const isReplay = reason === 'replay';
      console.log(
        `[${this.data.innerId}]`, '==== tryTriggerPlay',
        '\n  reason', reason,
        '\n  playerState', this.data.playerState,
        '\n  p2pState', this.data.p2pState,
        '\n  streamState', this.data.streamState,
      );

      // 这个要放在上面，否则回放时的统计不对
      if (this.data.p2pState === P2PStateEnum.ServiceStarted && this.data.playerState === PlayerStateEnum.PlayerReady
        && !this.data.playResultParams.playTimestamps.bothReady) {
        this.addStateTimestamp('bothReady');
      }

      const isP2PStateCanPlay = this.data.p2pState === P2PStateEnum.ServiceStarted;
      let isPlayerStateCanPlay = this.data.playerState === PlayerStateEnum.PlayerReady;
      if (!isPlayerStateCanPlay && isReplay) {
        // 是重试，出错状态也可以触发play
        isPlayerStateCanPlay = this.data.playerState === PlayerStateEnum.LivePlayerError
          || this.data.playerState === PlayerStateEnum.LivePlayerStateError;
      }
      if (!isP2PStateCanPlay || !this.data.playerCtx || !isPlayerStateCanPlay) {
        console.log(`[${this.data.innerId}]`, 'state can not play, return');
        return;
      }

      const checkIsFlvValid = this.properties.checkFunctions && this.properties.checkFunctions.checkIsFlvValid;
      if (checkIsFlvValid && !checkIsFlvValid({ filename: this.data.flvFilename, params: this.data.flvParams })) {
        console.log(`[${this.data.innerId}]`, 'flv invalid, return');
        return;
      }

      // 都准备好了，触发播放，这个会触发 onPlayerStartPull
      this.changeState({
        streamState: StreamStateEnum.StreamWaitPull,
      });
      if (this.data.needPlayer && !this.data.autoPlay) {
        // 用 autoPlay 是因为有时候成功调用了play，但是live-player实际并没有开始播放
        console.log(`[${this.data.innerId}]`, '==== trigger play by autoPlay');
        this.setData({ autoPlay: true });
      } else {
        console.log(`[${this.data.innerId}]`, '==== trigger play by playerCtx');
        this.data.playerCtx.play({
          success: (res) => {
            console.log(`[${this.data.innerId}]`, 'call play success', res);
          },
          fail: (res) => {
            console.log(`[${this.data.innerId}]`, 'call play fail', res);
          },
        });
      }
    },
    checkCanRetry(type, detail) {
      if (type === P2PStateEnum.P2PInitError) {
        // 初始化失败，退出重来
        console.log(`[${this.data.innerId}]`, 'P2PInitError, trigger playError');
        this.stopAll();
        this.triggerEvent('playError', {
          errType: type,
          errMsg: totalMsgMap[type],
          errDetail: detail,
          isFatalError: true,
        });
        return false;
      }
      if (xp2pManager.networkChanged || xp2pManager.needResetLocalServer) {
        // 网络状态变化了，退出重来
        console.log(`[${this.data.innerId}]`, 'networkChanged or needResetLocalServer, trigger playError');
        this.stopAll(P2PStateEnum.P2PLocalNATChanged);
        this.triggerEvent('playError', {
          errType: type,
          errMsg: xp2pManager.needResetLocalServer
            ? totalMsgMap[PlayerStateEnum.LocalServerError]
            : totalMsgMap[P2PStateEnum.P2PLocalNATChanged],
          errDetail: detail,
          isFatalError: true,
        });
        return false;
      }
      return true;
    },
    // 自动replay
    checkNetworkAndReplay(newStreamState) {
      if (!this.checkCanRetry()) {
        return;
      }

      // 自动重新开始
      console.log(`[${this.data.innerId}]`, 'auto replay');
      this.stopStream(newStreamState);
      if (this.data.playerCtx) {
        this.data.playerCtx.stop({
          success: () => {
            this.changeState({
              streamState: StreamStateEnum.StreamWaitPull,
            });
            console.log(`[${this.data.innerId}]`, 'trigger replay');
            this.data.playerCtx.play();
          },
        });
      }
    },
    // 手动retry
    onClickRetry() {
      if (this.data.playerState !== PlayerStateEnum.PlayerReady) {
        // player 没ready不能retry
        return;
      }
      if (this.data.playing || this.data.streamState !== StreamStateEnum.StreamIdle) {
        // 播放中不能retry
        return;
      }

      if (!this.checkCanRetry()) {
        return;
      }

      console.log(`[${this.data.innerId}]`, 'click retry');
      this.makeResultParams({ startAction: 'clickRetry' });
      if (this.data.p2pState === P2PStateEnum.ServiceStarted) {
        this.tryTriggerPlay('clickRetry');
      } else if (this.data.p2pState === P2PStateEnum.P2PInited
        || this.data.p2pState === P2PStateEnum.ServiceStartError
        || this.data.p2pState === P2PStateEnum.ServiceError
      ) {
        this.prepare();
      } else if (this.data.p2pState === P2PStateEnum.P2PIdle) {
        this.initP2P();
      }
    },
    // 处理播放错误
    handlePlayError(type, detail) {
      if (!this.checkCanRetry(type, detail)) {
        return;
      }

      // 能retry的才提示这个，不能retry的前面已经触发弹窗了
      this.triggerEvent('playError', {
        errType: type,
        errMsg: totalMsgMap[type] || '播放失败',
        errDetail: detail,
      });
    },
    // 处理播放结束
    handlePlayEnd(newStreamState) {
      if (this.properties.autoReplay) {
        this.checkNetworkAndReplay(newStreamState);
      } else {
        this.stopStream(newStreamState);
        if (this.data.playerCtx) {
          try {
            this.data.playerCtx.stop();
          } catch (err) {}
        }
      }
    },
    onP2PMessage(targetId, event, subtype, detail) {
      if (targetId !== this.properties.targetId) {
        console.warn(
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
          console.log(`[${this.data.innerId}]`, 'onP2PMessage, unknown event', event, subtype);
      }
    },
    onP2PMessage_Notify(type, detail) {
      console.log(`[${this.data.innerId}]`, 'onP2PMessage_Notify', type, detail);
      switch (type) {
        case XP2PNotify_SubType.Connected:
          // 注意不要修改state，Connected只在心跳保活时可能收到，不在关键路径上，只是记录一下
          this.setData({
            p2pConnected: true,
          });
          if (!this.data.playResultParams.playTimestamps.p2pConnected) {
            this.addStateTimestamp('p2pConnected');
          }
          break;
        case XP2PNotify_SubType.Request:
          this.changeState({
            streamState: StreamStateEnum.StreamRequest,
          });
          break;
        case XP2PNotify_SubType.Parsed:
          // 数据传输开始
          this.changeState({
            streamState: StreamStateEnum.StreamHeaderParsed,
          });
          break;
        case XP2PNotify_SubType.Success:
        case XP2PNotify_SubType.Eof:
          // 数据传输正常结束
          console.log(`[${this.data.innerId}]`, `==== Notify ${type} in p2pState ${this.data.p2pState}`);
          this.handlePlayEnd(StreamStateEnum.StreamDataEnd);
          break;
        case XP2PNotify_SubType.Fail:
          // 数据传输出错
          console.error(`[${this.data.innerId}]`, `==== Notify ${type} in p2pState ${this.data.p2pState}`, detail);
          this.handlePlayEnd(StreamStateEnum.StreamError);
          break;
        case XP2PNotify_SubType.Close:
          if (!this.data.playing) {
            // 用户主动关闭，或者因为隐藏等原因挂起了，都会收到 onPlayerClose
            return;
          }
          // 播放中收到了Close，当作播放失败
          this.handlePlayError(StreamStateEnum.StreamError, { msg: `p2pNotify: ${type} ${detail}` });
          break;
        case XP2PNotify_SubType.Disconnect:
          // p2p链路断开
          console.error(`[${this.data.innerId}]`, `XP2PNotify_SubType.Disconnect in p2pState ${this.data.p2pState}`, detail);
          this.setData({
            p2pConnected: false,
          });
          this.stopAll(P2PStateEnum.ServiceError);
          this.handlePlayError(P2PStateEnum.ServiceError, { msg: `p2pNotify: ${type} ${detail}` });
          break;
      }
    },
    changeMuted() {
      this.setData({
        muted: !this.data.muted,
      });
    },
    changeOrientation() {
      this.setData({
        orientation: this.data.orientation === 'horizontal' ? 'vertical' : 'horizontal',
      });
    },
    // 以下是调试面板里的
    toggleDebugInfo() {
      this.setData({ showDebugInfo: !this.data.showDebugInfo });
    },
    toggleSlow() {
      this.setData({ isSlow: !this.data.isSlow });
    },
  },
});

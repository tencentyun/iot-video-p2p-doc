import { canUseP2PIPCMode, canUseP2PServerMode, getParamValue } from '../../utils';
import { getXp2pManager } from '../../lib/xp2pManager';
import { getRecordManager, MAX_FILE_SIZE_IN_M } from '../../lib/recordManager';

const xp2pManager = getXp2pManager();
const { XP2PEventEnum, XP2PNotify_SubType } = xp2pManager;

const recordManager = getRecordManager();

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
  StreamReceivePull: 'StreamReceivePull',
  StreamLocalServerError: 'StreamLocalServerError',
  StreamChecking: 'StreamChecking',
  StreamCheckSuccess: 'StreamCheckSuccess',
  StreamCheckError: 'StreamCheckError',
  StreamPreparing: 'StreamPreparing',
  StreamStarted: 'StreamStarted',
  StreamStartError: 'StreamStartError',
  StreamRequest: 'StreamRequest',
  StreamHeaderParsed: 'StreamHeaderParsed',
  StreamDataReceived: 'StreamDataReceived',
  StreamDataEnd: 'StreamDataEnd',
  StreamError: 'StreamError',
};

const totalMsgMap = {
  [PlayerStateEnum.PlayerPreparing]: '正在创建播放器...',
  [PlayerStateEnum.PlayerReady]: '创建播放器成功',
  [PlayerStateEnum.PlayerError]: '创建播放器失败',
  [PlayerStateEnum.LivePlayerError]: 'LivePlayer错误',
  [PlayerStateEnum.LivePlayerStateError]: '播放失败',
  [PlayerStateEnum.LocalServerError]: '本地HttpServer错误',

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
  [StreamStateEnum.StreamReceivePull]: '加载中...',
  [StreamStateEnum.StreamLocalServerError]: '本地HttpServer错误',
  [StreamStateEnum.StreamChecking]: '加载中...',
  [StreamStateEnum.StreamCheckSuccess]: '加载中...',
  [StreamStateEnum.StreamCheckError]: '设备正忙，请稍后重试',
  [StreamStateEnum.StreamPreparing]: '加载中...',
  [StreamStateEnum.StreamStarted]: '加载中...',
  [StreamStateEnum.StreamStartError]: '启动拉流失败',
  [StreamStateEnum.StreamRequest]: '加载中...',
  [StreamStateEnum.StreamHeaderParsed]: '加载中...',
  [StreamStateEnum.StreamDataReceived]: '',
  [StreamStateEnum.StreamDataEnd]: '播放中断或结束',
  [StreamStateEnum.StreamError]: '播放失败',
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
  AutoReconnect: 'StepAutoReconnect', // 没正常播放，liveplayer自动重连，2103
  FinalStop: 'StepFinalStop', // 多次重连抢救无效，-2301
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

  // stream
  [StreamStateEnum.StreamReceivePull]: {
    step: PlayStepEnum.ConnectLocalServer,
    fromState: StreamStateEnum.StreamWaitPull,
    toState: StreamStateEnum.StreamReceivePull,
  },
  [StreamStateEnum.StreamLocalServerError]: {
    step: PlayStepEnum.ConnectLocalServer,
    fromState: StreamStateEnum.StreamWaitPull,
    toState: StreamStateEnum.StreamLocalServerError,
  },
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
  [StreamStateEnum.StreamStartError]: {
    step: PlayStepEnum.StartStream,
    fromState: StreamStateEnum.StreamPreparing,
    toState: StreamStateEnum.StreamStartError,
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
  [StreamStateEnum.StreamError]: {
    step: PlayStepEnum.WaitStream,
    fromState: StreamStateEnum.StreamStarted,
    toState: StreamStateEnum.StreamError,
    isResult: true,
  },
};

let playerSeq = 0;

Component({
  behaviors: ['wx://component-export'],
  properties: {
    mode: {
      type: String,
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
    liveStreamDomain: {
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
    playerPaused: false, // false / true / 'stopped'
    needPauseStream: false, // 为true时不addChunk
    firstChunkDataInPaused: null,

    // p2p状态
    currentP2PId: '',
    p2pState: P2PStateEnum.P2PIdle,
    p2pConnected: false,

    // stream状态
    streamState: StreamStateEnum.StreamIdle,
    playing: false,
    chunkTime: 0,
    chunkCount: 0,
    totalBytes: 0,

    // 这些是播放相关信息，清空时机同 totalBytes
    livePlayerInfo: null,
    livePlayerInfoStr: '',

    // debug用
    showDebugInfo: false,
    isSlow: false,
    isRecording: false,
    fileObj: null,

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

      const isModeValid = this.properties.mode === 'ipc' || this.properties.mode === 'server';
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
        playerMsg = isModeValid ? '您的微信基础库版本过低，请升级后再使用' : `无效的mode: ${this.properties.mode}`;
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
          liveStreamDomain: this.properties.liveStreamDomain,
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
      resumeStream: this.resumeStream.bind(this),
      startRecording: this.startRecording.bind(this),
      stopRecording: this.stopRecording.bind(this),
      cancelRecording: this.cancelRecording.bind(this),
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
      let playerDetail;
      if (newData.hasPlayer === false) {
        playerDetail = {
          playerComp: null,
          playerCtx: null,
        };
      }
      this.setData({
        ...newData,
        ...playerDetail,
        playerMsg: this.getPlayerMessage(newData),
      }, callback);
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

      const { startAction, timestamp, firstChunkBytes, steps } = this.data.playResultParams;
      const totalTimeCost = now - timestamp;
      if (isResult) {
        console.log(`[${this.data.innerId}]`, '==== play result', startAction, step, toState, totalTimeCost, this.data.playResultParams);
        const byteStr = firstChunkBytes > 0 ? `(${firstChunkBytes} bytes)` : '';
        const playResultStr = JSON.stringify({
          result: `${toState} ${byteStr}`,
          startAction,
          timeCost: totalTimeCost,
          steps: steps.map((item, index) => `${index}: ${item.step} - ${item.timeCost}`),
        }, null, 2);
        this.setData({
          playResultParams: null,
          playResultStr,
        });
      } else {
        const playResultStr = JSON.stringify({
          startAction,
          timeCost: totalTimeCost,
          steps: steps.map((item, index) => `${index}: ${item.step} - ${item.timeCost}`),
        }, null, 2);
        this.setData({
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
            // livePlayerContext.isPaused = false;
            setTimeout(() => {
              success && success();
              complete && complete();
              !livePlayerContext.isPaused && this.onPlayerStartPull({});
            }, 0);
          },
          stop: ({ success, fail, complete } = {}) => {
            if (!livePlayerContext.isPlaying) {
              fail && fail({ errMsg: 'not playing' });
              complete && complete();
              return;
            }
            livePlayerContext.isPlaying = false;
            // livePlayerContext.isPaused = false;
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
      console.log(`[${this.data.innerId}]`, `==== onPlayerStartPull in p2pState ${this.data.p2pState}, flvParams ${this.data.flvParams}, playerPaused ${this.data.playerPaused}, needPauseStream ${this.data.needPauseStream}`, detail);

      if (this.data.playerPaused && this.data.needPauseStream) {
        // ios暂停时不会断开连接，一段时间没收到数据就会触发startPull，但needPauseStream时不应该拉流
        // 注意要把playerPaused改成特殊的 'stopped'，否则resume会有问题，并且不能用 tryStopPlayer
        console.warn(`[${this.data.innerId}]`, 'onPlayerStartPull but player paused and need pause stream, stop player');
        try {
          this.data.playerCtx.stop(params);
        } catch (err) {}
        this.setData({
          playerPaused: 'stopped',
        });
        return;
      }

      const checkIsFlvValid = this.properties.checkFunctions && this.properties.checkFunctions.checkIsFlvValid;
      if (this.data.p2pState !== P2PStateEnum.ServiceStarted
        || (checkIsFlvValid && !checkIsFlvValid({ filename: this.data.flvFilename, params: this.data.flvParams }))
      ) {
        // 因为各种各样的原因，player在状态不对的时候又触发播放了，停掉
        console.warn(`[${this.data.innerId}]`, 'onPlayerStartPull but can not play, stop player');
        this.tryStopPlayer();
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
      console.log(`[${this.data.innerId}]`, `==== onPlayerClose in p2pState ${this.data.p2pState}, playerPaused ${this.data.playerPaused}, needPauseStream ${this.data.needPauseStream}`, detail);
      // 停止拉流
      this.stopStream();
    },
    onPlayerError({ detail }) {
      console.log(`[${this.data.innerId}]`, '==== onPlayerError', detail);
      const code = detail && detail.error && detail.error.code;
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
      // 其他错误，比如没有开通live-player组件权限
      // 参考：https://developers.weixin.qq.com/miniprogram/dev/component/live-player.html
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
        case 2103: // live-player断连, 已启动自动重连
          console.log(`[${this.data.innerId}]`, '==== onLivePlayerStateChange', detail.code, detail, `streamState: ${this.data.streamState}`);
          if (/errCode:-1004(\D|$)/.test(detail.message) || /Failed to connect to/.test(detail.message)) {
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
                console.log(`[${this.data.innerId}]`, `livePlayer auto reconnect but streamState ${this.data.streamState}, ignore`);
                return;
              }

              this.addStep(PlayStepEnum.AutoReconnect);

              // 前面收到playerStop的时候把streamState变成Idle了，这里再改成WaitPull
              console.log(`[${this.data.innerId}]`, `livePlayer auto reconnect, ${this.data.streamState} -> ${StreamStateEnum.StreamWaitPull}`);
              this.changeState({
                streamState: StreamStateEnum.StreamWaitPull,
              });
            }
          }
          break;
        case -2301: // live-player断连，且经多次重连抢救无效，需要提示出错，由用户手动重试
          // 到这里应该已经触发过 onPlayerClose 了
          console.log(`[${this.data.innerId}]`, '==== onLivePlayerStateChange', detail.code, detail);
          this.addStep(PlayStepEnum.FinalStop, { isResult: true });
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
      // 不是所有字段都有值，不能直接覆盖整个info，只更新有值的字段
      const livePlayerInfo = { ...this.data.livePlayerInfo };
      for (const key in detail.info) {
        if (detail.info[key] !== undefined) {
          livePlayerInfo[key] = detail.info[key];
        }
      }
      this.setData({
        livePlayerInfo,
        livePlayerInfoStr: [
          `size: ${detail.info.videoWidth}x${detail.info.videoHeight}, fps: ${detail.info.videoFPS}`,
          `bitrate(kbps): video ${detail.info.videoBitrate}, audio ${detail.info.audioBitrate}`,
          `cache(ms): video ${detail.info.videoCache}, audio ${detail.info.audioCache}`,
        ].join('\n'),
      });
    },
    resetServiceData(newP2PState) {
      this.changeState({
        currentP2PId: '',
        p2pState: newP2PState,
        p2pConnected: false,
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
      this.setData({
        firstChunkDataInPaused: null,
        chunkTime: 0,
        chunkCount: 0,
        totalBytes: 0,
        livePlayerInfo: null,
        livePlayerInfoStr: '',
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
        currentP2PId: targetId,
        p2pState: P2PStateEnum.ServicePreparing,
      });

      console.log('=-=------------------------------');
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
          console.log(`[${this.data.innerId}]`, '==== checkCanStartStream error', errmsg);
          this.resetStreamData(StreamStateEnum.StreamCheckError);
          if (errmsg) {
            this.setData({ playerMsg: errmsg });
          }
          this.tryStopPlayer();
        });
    },
    doStartStream() {
      console.log(`[${this.data.innerId}]`, 'do startStream', this.properties.targetId, this.data.flvFilename, this.data.flvParams);

      const { playerComp } = this.data;
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
            console.log(`[${this.data.innerId}]`, '==== firstChunkDataInPaused', data.byteLength);
            this.setData({
              firstChunkDataInPaused: data,
            });
          }
          return;
        }

        chunkTime = Date.now();
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
          chunkTime,
          chunkCount,
          totalBytes,
        });
        if (this.data.fileObj) {
          // 写录像文件
          const writeLen = recordManager.writeRecordFile(this.data.fileObj, data);
          if (writeLen < 0) {
            // 写入失败，可能是超过限制了
            stopRecording();
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
          // msgCallback, // 不传 msgCallback 就是保持之前设置的
          dataCallback,
        })
        .then((res) => {
          if (!this.data.playing) {
            // 已经stop了
            return;
          }
          console.log(`[${this.data.innerId}]`, '==== startStream res', res);
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
          console.log(`[${this.data.innerId}]`, '==== startStream error', res);
          this.resetStreamData(StreamStateEnum.StreamStartError);
          this.tryStopPlayer();
          this.handlePlayError(StreamStateEnum.StreamStartError, { msg: `startStream err ${errcode}` });
        });
    },
    stopStream(newStreamState = StreamStateEnum.StreamIdle) {
      console.log(`[${this.data.innerId}]`, `stopStream, ${this.data.streamState} -> ${newStreamState}`);

      // 记下来，因为resetStreamData会把这个改成false
      const needStopStream = this.data.playing;
      this.resetStreamData(newStreamState);

      if (needStopStream) {
        // 如果在录像，取消
        this.cancelRecording();

        // 拉流中的才需要 xp2pManager.stopStream
        console.log(`[${this.data.innerId}]`, 'do stopStream', this.properties.targetId);
        xp2pManager.stopStream(this.properties.targetId);
      }
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
          // 停掉现在的的
          console.log(`[${this.data.innerId}]`, 'changeFlv, stop stream and player');
          this.stopStream();
          this.tryStopPlayer();

          const checkIsFlvValid = this.properties.checkFunctions && this.properties.checkFunctions.checkIsFlvValid;
          if (checkIsFlvValid && !checkIsFlvValid({ filename: this.data.flvFilename, params: this.data.flvParams })) {
            console.log(`[${this.data.innerId}]`, 'flv invalid, return');
            // 无效，停止播放
            return;
          }

          // 有效，触发播放
          console.log(`[${this.data.innerId}]`, '==== trigger play', this.data.flvFilename, this.data.flvParams);
          this.makeResultParams({ startAction: 'changeFlv', flvParams: params });
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

      console.log(`[${this.data.innerId}]`, 'stopAll', newP2PState);

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
    pause({ success, fail, complete, needPauseStream = false }) {
      console.log(`[${this.data.innerId}] pause, hasPlayerCrx: ${!!this.data.playerCtx}, needPauseStream ${needPauseStream}`);
      if (!this.data.playerCtx) {
        fail && fail({ errMsg: 'player not ready' });
        complete && complete();
        return;
      }

      if (!needPauseStream) {
        // 真的pause
        console.log(`[${this.data.innerId}] playerCtx.pause`);
        this.data.playerCtx.pause({
          success: () => {
            console.log(`[${this.data.innerId}] playerCtx.pause success`);
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
        console.log(`[${this.data.innerId}] playerCtx.stop`);
        this.data.playerCtx.stop({
          complete: () => {
            console.log(`[${this.data.innerId}] playerCtx.stop success`);
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
      console.log(`[${this.data.innerId}] resume, hasPlayerCrx: ${!!this.data.playerCtx}`);
      if (!this.data.playerCtx) {
        fail && fail({ errMsg: 'player not ready' });
        complete && complete();
        return;
      }
      const funcName = this.data.playerPaused === 'stopped' ? 'play' : 'resume';
      console.log(`[${this.data.innerId}] playerCtx.${funcName}`);
      this.data.playerCtx[funcName]({
        success: () => {
          console.log(`[${this.data.innerId}] playerCtx.${funcName} success, needPauseStream ${this.data.needPauseStream}`);
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
      console.log(`[${this.data.innerId}] resumeStream, has first chunk data ${!!firstChunkDataInPaused}`);
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
    tryStopPlayer(params) {
      this.setData({
        playerPaused: false,
        needPauseStream: false,
      });
      if (this.data.playerCtx) {
        try {
          this.data.playerCtx.stop(params);
        } catch (err) {}
      }
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
        && this.data.playResultParams
        && !this.data.playResultParams.playTimestamps.bothReady
      ) {
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
      this.setData({
        playerPaused: false,
        needPauseStream: false,
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
    checkCanRetry() {
      let errType;
      let isFatalError = false;
      let msg = '';
      if (this.data.playerState === PlayerStateEnum.PlayerError) {
        // 初始化player失败
        errType = this.data.playerState;
        if (wx.getSystemInfoSync().platform === 'devtools') {
          // 开发者工具里不支持 live-player 和 TCPServer，明确提示
          msg = '不支持在开发者工具中创建p2p-player';
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
        // 不可恢复错误，退出重来
        console.log(`[${this.data.innerId}] ${errType} isFatalError, trigger playError`);
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
    // 自动replay
    checkNetworkAndReplay(newStreamState) {
      if (!this.checkCanRetry()) {
        return;
      }

      // 自动重新开始
      console.log(`[${this.data.innerId}]`, 'auto replay');
      this.stopStream(newStreamState);

      this.tryStopPlayer({
        success: () => {
          this.changeState({
            streamState: StreamStateEnum.StreamWaitPull,
          });
          console.log(`[${this.data.innerId}]`, 'trigger replay');
          this.data.playerCtx.play();
        },
      });
    },
    // 手动retry
    onClickRetry() {
      if (this.data.playerState !== PlayerStateEnum.PlayerReady) {
        // player 没ready不能retry
        console.log(`[${this.data.innerId}]`, `can not retry in ${this.data.playerState}`);
        return;
      }
      if (this.data.playing || this.data.streamState === StreamStateEnum.StreamWaitPull) {
        // 播放中不能retry
        console.log(`[${this.data.innerId}]`, `can not retry in ${this.data.playing ? 'playing' : this.data.streamState}`);
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
    // 处理播放错误，detail: { msg: string }
    handlePlayError(type, detail) {
      if (!this.checkCanRetry()) {
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
        this.tryStopPlayer();
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
      let detailMsg;
      switch (type) {
        case XP2PNotify_SubType.Connected:
          // 注意不要修改state，Connected只在心跳保活时可能收到，不在关键路径上，只是记录一下
          this.setData({
            p2pConnected: true,
          });
          if (this.data.playResultParams && !this.data.playResultParams.playTimestamps.p2pConnected) {
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
          console.log(`[${this.data.innerId}]`,
            `==== Notify ${type} in p2pState ${this.data.p2pState}, chunkCount ${this.data.chunkCount}, time after last chunk ${Date.now() - this.data.chunkTime}`,
            detail,
          );
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
          detailMsg = typeof detail === 'string' ? detail : (detail && detail.type);
          this.handlePlayError(StreamStateEnum.StreamError, { msg: `p2pNotify: ${type}, ${detailMsg}`, detail });
          break;
        case XP2PNotify_SubType.Disconnect:
          // p2p链路断开
          console.error(`[${this.data.innerId}]`, `XP2PNotify_SubType.Disconnect in p2pState ${this.data.p2pState}`, detail);
          this.setData({
            p2pConnected: false,
          });
          this.stopAll(P2PStateEnum.ServiceError);
          detailMsg = typeof detail === 'string' ? detail : (detail && detail.type);
          this.handlePlayError(P2PStateEnum.ServiceError, { msg: `p2pNotify: ${type}, ${detailMsg}`, detail });
          break;
      }
    },
    // 以下是播放器控件相关的
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
      if (this.data.isRecording || this.data.fileObj) {
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
      console.log(`[${this.data.innerId}] confirm startRecording`);

      // 保存录像文件要有flv头，停掉重新拉流
      if (this.data.playing) {
        this.stopStream();
      }
      this.tryStopPlayer();

      // 准备录像文件，注意要在 stopStream 之后
      let realRecordFilename = recordFilename;
      if (!realRecordFilename) {
        if (this.data.mode === 'ipc') {
          const streamType = getParamValue(this.data.flvParams, 'action') || 'live';
          realRecordFilename = `${this.data.mode}-${this.properties.productId}-${this.properties.deviceName}-${streamType}`;
        } else {
          realRecordFilename = `${this.data.mode}-${this.data.flvFilename}`;
        }
      }
      const fileObj = recordManager.openRecordFile(realRecordFilename);
      this.setData({
        isRecording: !!fileObj,
        fileObj,
      });
      console.log(`[${this.data.innerId}] record fileName ${fileObj && fileObj.fileName}`);

      // 重新play
      this.changeState({
        streamState: StreamStateEnum.StreamWaitPull,
      });
      console.log(`[${this.data.innerId}]`, 'trigger record play');
      this.data.playerCtx.play();
    },
    async stopRecording() {
      if (!this.data.isRecording || !this.data.fileObj) {
        // 没在录像
        return;
      }

      console.log(`[${this.data.innerId}]`, `stopRecording, ${this.data.fileObj.fileName}`);
      const { fileObj } = this.data;
      this.setData({
        isRecording: false,
        fileObj: null,
      });

      const fileRes = recordManager.saveRecordFile(fileObj);
      console.log(`[${this.data.innerId}]`, 'saveRecordFile res', fileRes);

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
      if (!this.data.isRecording || !this.data.fileObj) {
        // 没在录像
        return;
      }

      console.log(`[${this.data.innerId}]`, `cancelRecording, ${this.data.fileObj.fileName}`);
      const { fileObj } = this.data;
      this.setData({
        isRecording: false,
        fileObj: null,
      });

      recordManager.closeRecordFile(fileObj);
    },
  },
});

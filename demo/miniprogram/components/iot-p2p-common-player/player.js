import { canUseP2P, toTimeString } from '../../utils';
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
  ServicePreparing: 'ServicePreparing',
  ServiceStarted: 'ServiceStarted',
  ServiceError: 'ServiceError',
};
const StreamStateEnum = {
  StreamIdle: 'StreamIdle',
  StreamChecking: 'StreamChecking',
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
  [P2PStateEnum.ServicePreparing]: '正在启动p2p服务...',
  [P2PStateEnum.ServiceStarted]: '启动p2p服务完成',
  [P2PStateEnum.ServiceError]: '连接失败或断开',

  [StreamStateEnum.StreamChecking]: '加载中...',
  [StreamStateEnum.StreamCheckError]: '设备正忙，请稍后重试',
  [StreamStateEnum.StreamPreparing]: '加载中...',
  [StreamStateEnum.StreamStarted]: '加载中...',
  [StreamStateEnum.StreamError]: '播放失败',
  [StreamStateEnum.StreamRequest]: '加载中...',
  [StreamStateEnum.StreamHeaderParsed]: '加载中...',
  [StreamStateEnum.StreamDataReceived]: '',
  [StreamStateEnum.StreamDataEnd]: '播放结束',
};

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
    // 这是onLoad时就固定的
    streamExInfo: null,
    needPlayer: false,

    // 当前flv
    flvFile: '',
    flvFilename: '',
    flvParams: '',

    // player状态
    hasPlayer: false, // needPlayer时才有效，出错销毁时设为false
    autoPlay: false,
    playerId: '',
    playerState: PlayerStateEnum.PlayerIdle,
    playerComp: null,
    playerCtx: null,
    playerMsg: '',

    // p2p状态
    p2pState: P2PStateEnum.P2PIdle,

    // stream状态
    streamState: StreamStateEnum.StreamIdle,
    playing: false,
    totalBytes: 0,

    // 这些是播放相关信息，清空时机同 totalBytes
    firstChunkTime: '',
    livePlayerInfo: '',

    // debug用
    showDebugInfo: false,
  },
  lifetimes: {
    created() {
      // 在组件实例刚刚被创建时执行
    },
    attached() {
      // 在组件实例进入页面节点树时执行
      console.log(`[${this.id}]`, '==== attached', this.id, this.properties);
      const flvFile = this.properties.flvUrl.split('/').pop();
      const [flvFilename = '', flvParams = ''] = flvFile.split('?');
      const onlyp2p = this.properties.onlyp2p || false;
      const needPlayer = !onlyp2p;
      const hasPlayer = needPlayer && canUseP2P;
      const playerId = `${this.id || `common-player-${Date.now()}-${Math.floor(Math.random() * 1000)}`}-player`;
      let p2pState, playerState, playerComp, playerCtx, playerMsg;
      if (canUseP2P) {
        p2pState = P2PStateEnum.P2PIdle;
        if (needPlayer) {
          playerState = PlayerStateEnum.PlayerPreparing;
        } else {
          // mock 一个
          playerState = PlayerStateEnum.PlayerReady;
          playerComp = {
            addChunk: () => {},
          };
          playerCtx = {
            play: ({ success, _fail, complete } = {}) => {
              playerCtx.isPlaying = true;
              setTimeout(() => {
                this.onPlayerStartPull({});
                success && success();
                complete && complete();
              }, 0);
            },
            stop: ({ success, _fail, complete } = {}) => {
              playerCtx.isPlaying = false;
              setTimeout(() => {
                this.onPlayerClose({});
                success && success();
                complete && complete();
              }, 0);
            },
          };
        }
      } else {
        p2pState = P2PStateEnum.P2PInitError;
        playerState = PlayerStateEnum.PlayerError;
        playerMsg = '您的微信基础库版本过低，请升级后再使用';
      }

      this.changeState(
        {
          flvFile,
          flvFilename,
          flvParams,
          streamExInfo: {
            productId: this.properties.productId,
            deviceName: this.properties.deviceName,
            xp2pInfo: this.properties.xp2pInfo,
            codeUrl: this.properties.codeUrl,
          },
          needPlayer,
          hasPlayer,
          playerId,
          playerState,
          playerComp,
          playerCtx,
          playerMsg,
          p2pState,
        },
        () => {
          if (!canUseP2P) {
            return;
          }
          this.initP2P();
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
      changeFlv: this.changeFlv.bind(this),
      stopAll: this.stopAll.bind(this),
    };
  },
  methods: {
    getPlayerMessage(overrideData) {
      if (!canUseP2P) {
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
      const oldP2PState = this.data.p2pState;
      this.setData({ ...newData, playerMsg: this.getPlayerMessage(newData) }, callback);
      if (newData.p2pState && newData.p2pState !== oldP2PState) {
        this.triggerEvent('p2pStateChange', {
          playerId: this.id,
          p2pState: newData.p2pState,
        });
      }
    },
    onPlayerReady({ detail }) {
      console.log(`[${this.id}]`, '==== onPlayerReady in', this.data.playerState, this.data.p2pState, detail);
      const oldPlayerState = this.data.playerState;
      this.changeState({
        playerState: PlayerStateEnum.PlayerReady,
        playerComp: this.selectComponent(`#${this.data.playerId}`),
        playerCtx: detail.livePlayerContext,
      });
      this.tryTriggerPlay(`${oldPlayerState} -> ${this.data.playerState}`);
    },
    onPlayerStartPull({ detail }) {
      console.info(`[${this.id}]`, `==== onPlayerStartPull in p2pState ${this.data.p2pState}`, detail);
      if (this.data.p2pState !== P2PStateEnum.ServiceStarted) {
        // 因为各种各样的原因，player在状态不对的时候又触发播放了，停掉
        console.warn(`onPlayerStartPull in p2pState ${this.data.p2pState}, stop player`);
        try {
          this.data.playerCtx.stop();
        } catch (err) {}
        return;
      }
      // 开始拉流
      this.startStream();
    },
    onPlayerClose({ detail }) {
      console.info(`[${this.id}]`, `==== onPlayerClose in p2pState ${this.data.p2pState}`, detail);
      // 停止拉流
      this.stopStream();
    },
    onPlayerError({ detail }) {
      console.log(`[${this.id}]`, '==== onPlayerError', detail);
      this.changeState({
        playerState: PlayerStateEnum.PlayerError,
      });
      this.handlePlayError(PlayerStateEnum.PlayerError, detail);
    },
    // eslint-disable-next-line no-unused-vars, @typescript-eslint/no-unused-vars
    onLivePlayerError({ detail }) {
      console.error(`[${this.id}]`, '==== onLivePlayerError', detail);
      this.changeState({
        playerState: PlayerStateEnum.LivePlayerError,
      });
      if (detail.errMsg && detail.errMsg.indexOf('system permission denied') >= 0) {
        // 如果liveplayer是RTC模式，当微信没有系统录音权限时会出错，但是没有专用的错误码，微信侧建议先判断errMsg来兼容
        this.triggerEvent('systemPermissionDenied', detail);
        return;
      }
      // TODO 什么情况会走到这里？
      this.handlePlayError(PlayerStateEnum.LivePlayerError, detail);
    },
    // eslint-disable-next-line no-unused-vars, @typescript-eslint/no-unused-vars
    onLivePlayerStateChange({ detail }) {
      // console.log(`[${this.id}]`, '==== onLivePlayerStateChange', detail.code, detail.message);
      if (this.data.p2pState !== P2PStateEnum.ServiceStarted) {
        // 已经停止p2pservice了，不再处理
        return;
      }
      // code说明参考：https://developers.weixin.qq.com/miniprogram/dev/component/live-player.html
      switch (detail.code) {
        case 2005: // 视频播放进度
          // 不处理
          break;
        case 2103: // 网络断连, 已启动自动重连
          console.error('==== onLivePlayerStateChange', detail.code, detail);
          if (detail.message.indexOf('errCode:-1004 ') >= 0) {
            // 无法连接服务器，就是本地server连不上
            xp2pManager.needResetLocalServer = true;

            // 这时其实网络状态应该也变了，但是网络状态变化事件延迟较大，networkChanged不一定为true
            // 所以把 networkChanged 也设为true
            xp2pManager.networkChanged = true;

            this.stopAll(P2PStateEnum.ServiceError);
            this.changeState({
              hasPlayer: false,
              playerState: PlayerStateEnum.LocalServerError,
            });
            this.handlePlayError(PlayerStateEnum.LocalServerError, detail);
          }
          break;
        case -2301: // live-player断连，且经多次重连抢救无效，更多重试请自行重启播放
          console.error('==== onLivePlayerStateChange', detail.code, detail);
          // 到这里应该已经触发过 onPlayerClose 了
          this.changeState({
            playerState: xp2pManager.needResetLocalServer
              ? PlayerStateEnum.LocalServerError
              : PlayerStateEnum.LivePlayerStateError,
          });
          this.handlePlayError(PlayerStateEnum.LivePlayerStateError, detail);
          break;
        default:
          // 这些不特别处理，打个log
          console.log('onLivePlayerStateChange', detail.code, detail);
          break;
      }
    },
    // eslint-disable-next-line no-unused-vars, @typescript-eslint/no-unused-vars
    onLivePlayerNetStatusChange({ detail }) {
      // console.log(`[${this.id}]`, 'onLivePlayerNetStatusChange', detail.info);
      if (!detail.info) {
        return;
      }
      this.setData({
        livePlayerInfo: [
          `size: ${detail.info.videoWidth}x${detail.info.videoHeight}`,
          `cache: video ${detail.info.videoCache}, audio ${detail.info.audioCache}`,
          `fps: ${detail.info.videoFPS}`,
        ].join('\n'),
      });
    },
    resetServiceData(newP2PState) {
      this.changeState({
        p2pState: newP2PState,
        streamState: StreamStateEnum.StreamIdle,
        playing: false,
        totalBytes: 0,
        firstChunkTime: '',
        livePlayerInfo: '',
      });
    },
    initP2P() {
      console.log(`[${this.id}]`, 'initP2P');
      if (this.data.p2pState !== P2PStateEnum.P2PIdle) {
        console.log('can not initP2P in p2pState', this.data.p2pState);
        return;
      }

      console.log(`[${this.id}]`, 'initModule', Date.now());

      this.changeState({
        p2pState: P2PStateEnum.P2PIniting,
      });

      xp2pManager
        .initModule()
        .then((res) => {
          console.log(`[${this.id}]`, '==== initModule res', res, 'in p2pState', this.data.p2pState);
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
            this.handlePlayError(P2PStateEnum.P2PInitError, res);
          }
        })
        .catch((err) => {
          console.error(`[${this.id}]`, '==== initModule error', err, 'in p2pState', this.data.p2pState);
          xp2pManager.destroyModule();
          this.changeState({
            p2pState: P2PStateEnum.P2PInitError,
          });
          this.handlePlayError(P2PStateEnum.P2PInitError, err);
        });
    },
    prepare() {
      console.log(`[${this.id}]`, 'prepare');
      if (this.data.p2pState !== P2PStateEnum.P2PInited) {
        console.log(`can not start service in p2pState ${this.data.p2pState}`);
        return;
      }

      const { targetId } = this.properties;
      const { flvUrl, streamExInfo } = this.data;
      console.log(`[${this.id}]`, 'startP2PService', targetId, flvUrl, streamExInfo);

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
          console.log(`[${this.id}]`, '==== startP2PService res', res);
          if (res === 0) {
            const oldP2PState = this.data.p2pState;
            this.changeState({
              p2pState: P2PStateEnum.ServiceStarted,
            });
            this.tryTriggerPlay(`${oldP2PState} -> ${this.data.p2pState}`);
          } else {
            this.stopAll(P2PStateEnum.ServiceError);
            this.handlePlayError(P2PStateEnum.ServiceError, res);
          }
        })
        .catch((errcode) => {
          console.error(`[${this.id}]`, '==== startP2PService error', errcode);
          this.stopAll(P2PStateEnum.ServiceError);
          this.handlePlayError(P2PStateEnum.ServiceError, errcode);
        });
    },
    startStream() {
      console.log(`[${this.id}]`, 'startStream');
      if (this.data.p2pState !== P2PStateEnum.ServiceStarted) {
        console.log(`can not start stream in p2pState ${this.data.p2pState}`);
        return;
      }
      if (this.data.playing) {
        console.log('already playing');
        return;
      }

      const checkCanStartStream = this.properties.checkFunctions && this.properties.checkFunctions.checkCanStartStream;
      console.log('need checkCanStartStream', !!checkCanStartStream);

      if (!checkCanStartStream) {
        // 不检查，直接拉流
        this.doStartStream();
        return;
      }

      // 先检查能否拉流
      this.changeState({
        streamState: StreamStateEnum.StreamChecking,
        playing: true,
        totalBytes: 0,
        firstChunkTime: '',
        livePlayerInfo: '',
      });

      checkCanStartStream({ filename: this.data.flvFilename, params: this.data.flvParams })
        .then(() => {
          if (!this.data.playing) {
            // 已经stop了
            return;
          }
          // 检查通过，开始拉流
          console.log(`[${this.id}]`, '==== checkCanStartStream success');
          this.doStartStream();
        })
        .catch((errmsg) => {
          if (!this.data.playing) {
            // 已经stop了
            return;
          }
          // 检查失败，前面已经弹过提示了
          console.log(`[${this.id}]`, '==== checkCanStartStream fail', errmsg);
          this.changeState({
            streamState: StreamStateEnum.StreamCheckError,
            playing: false,
            totalBytes: 0,
            firstChunkTime: '',
            livePlayerInfo: '',
          });
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
      console.log(`[${this.id}]`, 'do startStream', this.properties.targetId, this.data.flvFilename, this.data.flvParams);

      let dataCallback;
      let chunkCount = 0;
      let totalBytes = 0;
      const onlyDataCallback = (data) => {
        chunkCount++;
        totalBytes += data.byteLength;
        if (chunkCount === 1) {
          console.log(`[${this.id}]`, '==== firstChunk', data.byteLength);
          const date = new Date();
          this.changeState({
            streamState: StreamStateEnum.StreamDataReceived,
            firstChunkTime: `${date.getTime()} ${toTimeString(date)}`,
          });
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

      this.changeState({
        streamState: StreamStateEnum.StreamPreparing,
        playing: true,
        totalBytes: 0,
        firstChunkTime: '',
        livePlayerInfo: '',
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
          console.log(`[${this.id}]`, '==== startStream success', res);
          this.changeState({
            streamState: StreamStateEnum.StreamStarted,
          });
        })
        .catch((res) => {
          console.log(`[${this.id}]`, '==== startStream fail', res);
          this.changeState({
            streamState: StreamStateEnum.StreamError,
            playing: false,
            totalBytes: 0,
            firstChunkTime: '',
            livePlayerInfo: '',
          });
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
      console.log(`[${this.id}]`, 'stopStream');
      if (!this.data.playing) {
        console.log('not playing');
        return;
      }

      console.log(`[${this.id}]`, 'do stopStream', this.properties.targetId);

      this.changeState({
        streamState: newStreamState,
        playing: false,
        totalBytes: 0,
        firstChunkTime: '',
        livePlayerInfo: '',
      });

      xp2pManager.stopStream(this.properties.targetId);
    },
    changeFlv({ filename = '', params = '' }) {
      console.log(`[${this.id}]`, 'changeFlv', filename, params);
      this.setData(
        {
          flvFile: `${filename}${params ? `?${params}` : ''}`,
          flvFilename: filename,
          flvParams: params,
        },
        () => {
          const checkIsFlvValid = this.properties.checkFunctions && this.properties.checkFunctions.checkIsFlvValid;
          if (checkIsFlvValid && !checkIsFlvValid({ filename: this.data.flvFilename, params: this.data.flvParams })) {
            console.log('flv invalid, stopStream');
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
            this.tryTriggerPlay('changeFlv');
            return;
          }
          this.stopStream();
          if (this.data.playerCtx) {
            this.data.playerCtx.stop({
              success: () => {
                console.log('==== trigger play', this.data.flvFilename, this.data.flvParams);
                this.data.playerCtx.play();
              },
            });
          }
        },
      );
    },
    stopAll(newP2PState = P2PStateEnum.P2PUnkown) {
      console.log(`[${this.id}]`, 'stopAll', newP2PState);

      // 不用等stopPlay的回调，先把流停掉
      this.stopStream();

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
    tryTriggerPlay(reason) {
      const isReplay = reason === 'replay';
      console.log(
        `[${this.id}]`, '==== tryTriggerPlay',
        '\n  reason', this.data.playerState,
        '\n  playerState', this.data.playerState,
        '\n  p2pState', this.data.p2pState,
        '\n  streamState', this.data.streamState,
      );

      const checkIsFlvValid = this.properties.checkFunctions && this.properties.checkFunctions.checkIsFlvValid;
      if (checkIsFlvValid && !checkIsFlvValid({ filename: this.data.flvFilename, params: this.data.flvParams })) {
        console.log('flv invalid, return');
        return;
      }

      let isPlayerStateCanPlay = this.data.playerState === PlayerStateEnum.PlayerReady;
      if (!isPlayerStateCanPlay && isReplay) {
        // 是重试，出错状态也可以触发play
        isPlayerStateCanPlay = this.data.playerState === PlayerStateEnum.LivePlayerError
          || this.data.playerState === PlayerStateEnum.LivePlayerStateError;
      }
      if (this.data.p2pState === P2PStateEnum.ServiceStarted && this.data.playerCtx && isPlayerStateCanPlay) {
        // 都准备好了，触发播放，这个会触发 onPlayerStartPull
        if (this.data.needPlayer && !this.data.autoPlay) {
          // 用 autoPlay 是因为有时候成功调用了play，但是live-player实际并没有开始播放
          console.log('==== trigger play by autoPlay');
          this.setData({ autoPlay: true });
        } else {
          console.log('==== trigger play by playerCtx');
          this.data.playerCtx.play({
            success: (res) => {
              console.log('call play success', res);
            },
            fail: (res) => {
              console.log('call play fail', res);
            },
          });
        }
      }
    },
    checkCanRetry(type, detail) {
      if (type === P2PStateEnum.P2PInitError) {
        // 初始化失败，退出重来
        console.log('P2PInitError, trigger playError');
        this.stopAll();
        this.triggerEvent('playError', {
          playerId: this.id,
          errType: type,
          errMsg: totalMsgMap[type],
          errDetail: detail,
          isFatalError: true,
        });
        return false;
      }
      if (xp2pManager.networkChanged || xp2pManager.needResetLocalServer) {
        // 网络状态变化了，退出重来
        console.log('networkChanged or needResetLocalServer, trigger playError');
        this.stopAll();
        this.triggerEvent('playError', {
          playerId: this.id,
          errType: type,
          errMsg: xp2pManager.needResetLocalServer
            ? totalMsgMap[PlayerStateEnum.LocalServerError]
            : totalMsgMap[P2PStateEnum.ServiceError],
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
      console.log('auto replay');
      this.stopStream(newStreamState);
      if (this.data.playerCtx) {
        this.data.playerCtx.stop({
          success: () => {
            console.log('trigger replay');
            this.data.playerCtx.play();
          },
        });
      }
    },
    // 处理播放错误
    handlePlayError(type, detail) {
      if (!this.checkCanRetry(type, detail)) {
        return;
      }

      // 能retry的才提示这个，不能retry的前面已经触发弹窗了
      this.triggerEvent('playError', {
        playerId: this.id,
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
          `[${this.id}]`,
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
          console.log(`[${this.id}]`, 'onP2PMessage, unknown event', event, subtype);
      }
    },
    onP2PMessage_Notify(type, detail) {
      console.log(`[${this.id}]`, 'onP2PMessage_Notify', type, detail);
      switch (type) {
        case XP2PNotify_SubType.Connected:
          // 注意不要修改state，Connected只在心跳保活时可能收到，不在关键路径上，只是记录一下
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
          console.log(`[${this.id}]`, `==== Notify ${type} in p2pState ${this.data.p2pState}`);
          this.handlePlayEnd(StreamStateEnum.StreamDataEnd);
          break;
        case XP2PNotify_SubType.Fail:
          // 数据传输出错
          console.error(`[${this.id}]`, `==== Notify ${type} in p2pState ${this.data.p2pState}`, detail);
          this.handlePlayEnd(StreamStateEnum.StreamError);
          break;
        case XP2PNotify_SubType.Close:
          // 用户主动关闭
          this.stopStream(StreamStateEnum.StreamIdle);
          break;
        case XP2PNotify_SubType.Disconnect:
          // p2p链路断开
          console.error(`[${this.id}]`, `XP2PNotify_SubType.Disconnect in p2pState ${this.data.p2pState}`, detail);
          this.stopAll(P2PStateEnum.ServiceError);
          this.handlePlayError(P2PStateEnum.ServiceError, detail);
          break;
      }
    },
    toggleDebugInfo() {
      this.setData({ showDebugInfo: !this.data.showDebugInfo });
    },
  },
});

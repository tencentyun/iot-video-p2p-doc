import { arrayBufferToHex } from '../../utils';
import { getXp2pManager } from '../../lib/xp2pManager';
import { PusherStateEnum, totalMsgMap, livePusherErrMsgMap } from './common';

// 覆盖 console
const app = getApp();
const oriConsole = app.console;
const console = app.logger || oriConsole;

const xp2pManager = getXp2pManager();

const printBuffer = (buffer) => {
  if (buffer.byteLength <= 32) {
    const bufferHex = arrayBufferToHex(buffer, undefined, undefined, ' ');
    console.log(`< ${bufferHex} >`);
  } else {
    const bufferHex = arrayBufferToHex(buffer, 0, 32, ' ');
    console.log(`< ${bufferHex} ... >`);
  }
};

let pusherSeq = 0;

Component({
  behaviors: ['wx://component-export'],
  properties: {
    // 以下是 live-pusher 的属性
    mode: {
      type: String, // RTC / SD / HD / FHD
      value: 'RTC',
    },
    enableCamera: {
      type: Boolean,
      value: true,
    },
    enableMic: {
      type: Boolean,
      value: true,
    },
    enableAgc: {
      type: Boolean,
      value: true,
    },
    enableAns: {
      type: Boolean,
      value: true,
    },
    audioQuality: {
      type: String,
      value: 'low',
    },
    // 以下是 p2p-pusher 的属性
    ignoreEmptyAudioTag: {
      type: Boolean,
      value: false,
    },
    // 以下是自己的属性
    needLivePusherInfo: {
      type: Boolean,
      value: false,
    },
  },
  data: {
    innerId: '',

    // pusher
    hasPusher: false, // 出错销毁时设为false
    pusherId: '', // 这是 p2p-pusher 组件的id，不是自己的id
    pusherState: PusherStateEnum.PusherIdle,
    pusherMsg: '',
    acceptLivePusherEvents: {
      // 太多事件log了，只接收这几个
      error: true,
      statechange: true,
      netstatus: false, // attached 时根据 needLivePusherInfo 赋值
      // audiovolumenotify: true,
    },
    flvFunctions: null,

    // 有writer才能推流
    hasWriter: false,

    // 是否推流中
    isPushing: false,

    // stream状态
    livePusherInfoStr: '',

    // controls
    remoteMirror: true,
    localMirror: 'enable',
  },
  lifetimes: {
    created() {
      // 在组件实例刚刚被创建时执行
      pusherSeq++;
      this.setData({ innerId: `common-pusher-${pusherSeq}` });
      console.log(`[${this.data.innerId}]`, '==== created');

      // 渲染无关，不放在data里，以免影响性能
      this.userData = {
        pusherComp: null,
        pusherCtx: null,
        writer: null,
        livePlayerInfo: null,
        flvTagStat: null,
      };
    },
    attached() {
      // 在组件实例进入页面节点树时执行
      console.log(`[${this.data.innerId}]`, '==== attached', this.id, {
        mode: this.properties.mode,
      });

      const pusherId = `${this.data.innerId}-pusher`; // 这是 p2p-pusher 组件的id，不是自己的id
      this.setData({
        hasPusher: true,
        pusherId,
        acceptLivePusherEvents: {
          ...this.data.acceptLivePusherEvents,
          netstatus: this.properties.needLivePusherInfo || false,
        },
        flvFunctions: {
          onFlvHeader: this.handleFlvHeader.bind(this), // 不直接用 handleFlvChunk 是为了打个log
          onFlvAudioTag: detail => this.handleFlvTag(detail, 'audioTag'),
          onFlvVideoTag: detail => this.handleFlvTag(detail, 'videoTag'),
          onFlvDataTag: detail => this.handleFlvTag(detail, 'dataTag'),
        },
      });

      this.createPusher();
    },
    detached() {
      // 在组件实例被从页面节点树移除时执行
      console.log(`[${this.data.innerId}]`, '==== detached');
      this.stop();
      console.log(`[${this.data.innerId}]`, '==== detached end');
    },
  },
  export() {
    return {
      start: this.start.bind(this),
      stop: this.stop.bind(this),
    };
  },
  methods: {
    getPusherMessage(overrideData) {
      const realData = {
        pusherState: this.data.pusherState,
        ...overrideData,
      };

      if (realData.pusherState === PusherStateEnum.PusherReady) {
        return this.userData?.writer ? totalMsgMap.PusherPushing : '';
      }

      return totalMsgMap[realData.pusherState] || '';
    },
    // 包一层，方便更新 pusherMsg
    changeState(newData, callback) {
      if (newData.hasPusher === false) {
        this.userData.pusherComp = null;
        this.userData.pusherCtx = null;
      }
      const oldPusherState = this.data.pusherState;
      this.setData({
        ...newData,
        pusherMsg: this.getPusherMessage(newData),
      }, callback);
      if (newData.pusherState && newData.pusherState !== oldPusherState) {
        this.triggerEvent('pusherStateChange', {
          pusherState: newData.pusherState,
        });
      }
    },
    createPusher() {
      console.log(`[${this.data.innerId}]`, 'createPusher', Date.now());
      if (this.data.pusherState !== PusherStateEnum.PusherIdle) {
        console.error(`[${this.data.innerId}]`, 'can not createPusher in pusherState', this.data.pusherState);
        return;
      }

      this.changeState({
        pusherState: PusherStateEnum.PusherPreparing,
      });
    },
    onPusherReady({ detail }) {
      console.log(`[${this.data.innerId}]`, '==== onPusherReady in', this.data.pusherState, detail);

      // 收到这个说明本地server是正常的
      if (xp2pManager.needResetLocalRtmpServer) {
        xp2pManager.needResetLocalRtmpServer = false;
      }

      this.userData.pusherComp = detail.pusherExport;
      this.userData.pusherCtx = detail.livePusherContext;
      this.changeState({
        pusherState: PusherStateEnum.PusherReady,
      });
    },
    onPusherStartPush({ type, detail }) {
      console.log(`[${this.data.innerId}]`, '==== onPusherStartPush', detail);

      // 收到这个说明本地server是正常的
      if (xp2pManager.needResetLocalRtmpServer) {
        xp2pManager.needResetLocalRtmpServer = false;
      }

      if (!this.userData.writer) {
        // 现在不能push
        console.warn(`[${this.data.innerId}]`, 'onPusherStartPush but can not push without writer, stop pusher');
        this.tryStopPusher();
        return;
      }
      this.clearStreamData();
      this.userData.flvTagStat = {
        headerTime: 0,
        startClock: 0,
        startTime: 0,
        tagCount: 0,
      };
      this.setData({ isPushing: true });
      this.triggerEvent(type, detail);
    },
    handleFlvHeader(detail) {
      const headerTime = Date.now();
      console.log(`[${this.data.innerId}] ==== handleFlvHeader, ${detail.data?.byteLength}B, headerTime ${headerTime}`);
      printBuffer(detail.data);
      if (this.userData.flvTagStat) {
        this.userData.flvTagStat.headerTime = headerTime;
      }
      this.handleFlvChunk(detail);
    },
    handleFlvTag(detail, tagType) {
      if (this.userData.flvTagStat) {
        const { flvTagStat } = this.userData;
        flvTagStat.tagCount++;
        if (flvTagStat.tagCount === 1) {
          flvTagStat.startClock = detail.clock;
          flvTagStat.startTime = Date.now();
          console.log(
            `[${this.data.innerId}] ==== first tag, ${tagType} ${detail.data.byteLength}B,`,
            `tagClock ${flvTagStat.startClock}, localTime ${flvTagStat.startTime}, afterHeader ${flvTagStat.startTime - flvTagStat.headerTime}`,
            detail.params,
          );
        } else if (flvTagStat.tagCount <= 20 || flvTagStat.tagCount % 100 === 0) {
          const date = new Date();
          const tagClockAfterStart = detail.clock - flvTagStat.startClock;
          const localTimeAfterStart = date.getTime() - flvTagStat.startTime;
          const localDelay = localTimeAfterStart - tagClockAfterStart;
          console.log(
            `[${this.data.innerId}] ==== tag ${flvTagStat.tagCount}, ${tagType} ${detail.data.byteLength}B,`,
            `tagClockAfterStart ${tagClockAfterStart}, localTimeAfterStart ${localTimeAfterStart}, diff ${localDelay}`,
          );
        }
      }
      this.handleFlvChunk(detail);
    },
    handleFlvChunk(detail) {
      this.addChunkInner && this.addChunkInner(detail.data, detail.params);
    },
    onPusherClose({ type, detail }) {
      console.log(`[${this.data.innerId}]`, '==== onPusherClose', detail);
      this.userData.flvTagStat = null;
      this.setData({ isPushing: false });
      this.triggerEvent(type, detail);
    },
    onPusherError({ detail }) {
      console.error(`[${this.data.innerId}]`, '==== onPusherError', detail);
      const code = detail?.error?.code;
      let pusherState = PusherStateEnum.PusherError;
      if (code === 'WECHAT_SERVER_ERROR') {
        pusherState = PusherStateEnum.LocalServerError;
        xp2pManager.needResetLocalRtmpServer = true;
        this.stop();
        this.changeState({
          hasPusher: false,
          pusherState,
        });
      } else {
        this.changeState({
          pusherState,
        });
      }
      this.handlePushError(pusherState, { msg: `p2pPusherError: ${code}` });
    },
    onLivePusherError({ detail }) {
      if (detail.errCode === 10003 || detail.errCode === 10004) {
        // 没设置背景图，ios正常但是android会提示 10004 背景图加载失败
        // 非关键问题不用处理
        console.warn(`[${this.data.innerId}]`, 'onLivePusherError', detail);
        return;
      }
      console.error(`[${this.data.innerId}]`, '==== onLivePusherError', detail);
      const pusherState = PusherStateEnum.LivePusherError;
      this.changeState({
        pusherState,
      });
      // 其他错误，比如没有开通live-pusher组件权限
      // 参考：https://developers.weixin.qq.com/miniprogram/dev/component/live-pusher.html
      this.handlePushError(pusherState, { msg: livePusherErrMsgMap[detail.errCode] || `livePusherError: ${detail.errMsg}`, detail });
    },
    onLivePusherStateChange({ detail }) {
      if (!this.userData.writer) {
        // 现在不能push
        return;
      }
      switch (detail.code) {
        case 1102: // live-pusher断连, 已启动自动重连
          console.warn(`[${this.data.innerId}]`, '==== onLivePusherStateChange', detail.code, detail.message);
          break;
        /*
        case 3002: // 连接本地RTMP服务器失败，player插件里已经处理了，会抛出 pusherError, { error: { code: 'WECHAT_SERVER_ERROR' } }
          console.error(`[${this.data.innerId}]`, '==== onLivePusherStateChange', detail.code, detail.message);
          // 本地server连不上，标记一下
          xp2pManager.needResetLocalRtmpServer = true;

          this.stop();
          this.changeState({
            hasPusher: false,
            pusherState: PusherStateEnum.LocalServerError,
          });
          this.handlePushError(PusherStateEnum.LocalServerError, {
            msg: `livePusherStateChange: ${detail.code} ${detail.message}`,
            detail,
          });
          break;
        */
        case -1307: // live-pusher断连，且经多次重连抢救无效，更多重试请自行重启推流
          // 到这里应该已经触发过 onPusherClose 了
          console.error(`[${this.data.innerId}]`, '==== onLivePusherStateChange', detail.code, detail.message);
          this.changeState({
            pusherState: PusherStateEnum.LivePusherStateError,
          });
          this.handlePushError(PusherStateEnum.LivePusherStateError, {
            msg: `livePusherStateChange: ${detail.code} ${detail.message}`,
            detail,
          });
          break;
        default:
          // 这些不特别处理，打个log
          if ((detail.code >= 1101 && detail.code < 1200)
            || (detail.code >= 3001 && detail.code < 3100)
            || detail.code < 0
          ) {
            console.warn(`[${this.data.innerId}]`, 'onLivePusherStateChange', detail.code, detail.message);
          } else {
            console.log(`[${this.data.innerId}]`, 'onLivePusherStateChange', detail.code, detail.message);
          }
      }
    },
    onLivePusherNetStatus({ detail }) {
      // console.log('onLivePusherNetStatus', detail);
      if (!this.userData.writer || !detail.info) {
        return;
      }
      // 不是所有字段都有值，不能直接覆盖整个info，只更新有值的字段
      const livePusherInfo = { ...this.data.livePusherInfo };
      for (const key in detail.info) {
        if (detail.info[key] !== undefined) {
          livePusherInfo[key] = detail.info[key];
        }
      }
      this.setData({
        livePusherInfo,
        livePusherInfoStr: [
          `size: ${livePusherInfo.videoWidth}x${livePusherInfo.videoHeight}, fps: ${livePusherInfo.videoFPS?.toFixed(2)}, gop: ${livePusherInfo.videoGOP?.toFixed(2)}`,
          `bitrate(kbps): video ${livePusherInfo.videoBitrate}, audio ${livePusherInfo.audioBitrate}`,
          `cache(frames): video ${livePusherInfo.videoCache}, audio ${livePusherInfo.audioCache}`,
        ].join('\n'),
      });
    },
    clearStreamData() {
      this.setData({
        livePusherInfo: null,
        livePusherInfoStr: '',
      });
    },
    checkCanRetry() {
      let errType;
      let isFatalError = false;
      let msg = '';
      if (this.data.pusherState === PusherStateEnum.PusherError
        || this.data.pusherState === PusherStateEnum.LivePusherError
      ) {
        // 初始化pusher失败
        errType = this.data.pusherState;
        if (wx.getSystemInfoSync().platform === 'devtools') {
          // 开发者工具里不支持 TCPServer，明确提示
          msg = '不支持在开发者工具中创建p2p-pusher';
        }
        isFatalError = true;
      } else if (xp2pManager.needResetLocalRtmpServer) {
        // 本地server出错
        errType = PusherStateEnum.LocalServerError;
        msg = '系统网络服务可能被中断，请重置本地RtmpServer';
        isFatalError = true;
      }
      if (isFatalError) {
        // 不可恢复错误，销毁pusher
        if (this.data.hasPusher) {
          this.changeState({ hasPusher: false });
        }
        this.triggerEvent('pushError', {
          errType,
          errMsg: totalMsgMap[errType],
          errDetail: { msg },
          isFatalError: true,
        });
        return false;
      }
      return true;
    },
    handlePushError(type, detail) {
      if (!this.checkCanRetry()) {
        return;
      }

      // 能retry的才提示这个，不能retry的前面已经触发弹窗了
      this.triggerEvent('pushError', {
        errType: type,
        errMsg: totalMsgMap[type] || '推流失败',
        errDetail: detail,
      });
    },
    start({ writer, success, fail, complete } = {}) {
      console.log(`[${this.data.innerId}] start, hasPusherCtx: ${!!this.userData.pusherCtx}, hasWriter: ${!!this.userData.writer}`);
      if (!writer || !writer.addChunk) {
        fail && fail({ errMsg: 'writer invalid' });
        complete && complete();
        return;
      }
      if (!this.userData.pusherCtx) {
        fail && fail({ errMsg: 'pusher not ready' });
        complete && complete();
        return;
      }

      if (this.userData.writer) {
        fail && fail({ errMsg: 'already started' });
        complete && complete();
        return;
      }

      const addChunkInner = (data, _params) => {
        if (!data || !data.byteLength) {
          return;
        }

        writer.addChunk(data);
      };

      this.clearStreamData();
      this.userData.writer = writer;
      this.addChunkInner = addChunkInner;
      this.setData({ hasWriter: true });

      console.log(`[${this.data.innerId}] pusherCtx.start`);
      this.userData.pusherCtx.start({
        success,
        fail: (err) => {
          console.log(`[${this.data.innerId}] pusherCtx.start fail`, err);
          this.userData.writer = null;
          this.addChunkInner = null;
          this.setData({ hasWriter: false });
          fail && fail(err);
        },
        complete,
      });
    },
    stop({ success, fail, complete } = {}) {
      console.log(`[${this.data.innerId}] stop, hasPusherCtx: ${!!this.userData.pusherCtx}, hasWriter: ${!!this.userData.writer}`);
      if (!this.userData.pusherCtx) {
        fail && fail({ errMsg: 'pusher not ready' });
        complete && complete();
        return;
      }

      if (!this.userData.writer) {
        fail && fail({ errMsg: 'not started' });
        complete && complete();
        return;
      }

      this.clearStreamData();
      this.userData.writer = null;
      this.addChunkInner = null;
      this.setData({ hasWriter: false, isPushing: false });

      this.tryStopPusher({ success, fail, complete });
    },
    tryStopPusher(params) {
      if (this.userData.pusherCtx) {
        try {
          console.log(`[${this.data.innerId}] pusherCtx.stop`);
          this.userData.pusherCtx.stop(params);
        } catch (err) {}
      }
    },
    // 以下是pusher控件相关的
    changeEnableCamera() {
      this.setData({
        enableCamera: !this.data.enableCamera,
      });
    },
    changeEnableMic() {
      this.setData({
        enableMic: !this.data.enableMic,
      });
    },
    changeRemoteMirror() {
      const remoteMirror = !this.data.remoteMirror;
      this.setData({
        remoteMirror,
        localMirror: remoteMirror ? 'enable' : 'disable',
      });
    },
    // 以下是调试面板相关的
    toggleDebugInfo() {
      this.setData({ showDebugInfo: !this.data.showDebugInfo });
    },
  },
});

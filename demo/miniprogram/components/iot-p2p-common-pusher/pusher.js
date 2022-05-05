import { getXp2pManager } from '../../lib/xp2pManager';

const xp2pManager = getXp2pManager();

// ts才能用enum，先这么处理吧
const PusherStateEnum = {
  PusherIdle: 'PusherIdle',
  PusherPreparing: 'PusherPreparing',
  PusherReady: 'PusherReady',
  PusherError: 'PusherError',
  LivePusherError: 'LivePusherError',
  LivePusherStateError: 'LivePusherStateError',
  LocalServerError: 'LocalServerError',
};

const totalMsgMap = {
  [PusherStateEnum.PusherPreparing]: '正在创建Pusher...',
  [PusherStateEnum.PusherReady]: '创建Pusher成功',
  [PusherStateEnum.PusherError]: '创建Pusher失败',
  [PusherStateEnum.LivePusherError]: 'LivePusher错误',
  [PusherStateEnum.LivePusherStateError]: '推流失败',
  [PusherStateEnum.LocalServerError]: '本地RtmpServer错误',
  PusherPushing: '推流中...',
};

let pusherSeq = 0;

Component({
  behaviors: ['wx://component-export'],
  properties: {
    // 以下是 live-pusher 的属性
    enableCamera: {
      type: Boolean,
      value: true,
    },
    enableMic: {
      type: Boolean,
      value: true,
    },
  },
  data: {
    innerId: '',

    // pusher
    hasPusher: false, // 出错销毁时设为false
    pusherId: '', // 这是 p2p-pusher 组件的id，不是自己的id
    pusherState: PusherStateEnum.PusherIdle,
    pusherComp: null,
    pusherCtx: null,
    pusherMsg: '',

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
        writer: null,
        livePlayerInfo: null,
      };
    },
    attached() {
      // 在组件实例进入页面节点树时执行
      console.log(`[${this.data.innerId}]`, '==== attached', this.id, this.properties);
      const pusherId = `${this.data.innerId}-pusher`; // 这是 p2p-pusher 组件的id，不是自己的id
      this.setData({
        hasPusher: true,
        pusherId,
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
      const oldPusherState = this.data.pusherState;
      let pusherDetail;
      if (newData.hasPusher === false) {
        pusherDetail = {
          pusherComp: null,
          pusherCtx: null,
        };
      }
      this.setData({
        ...newData,
        ...pusherDetail,
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
      this.changeState({
        pusherState: PusherStateEnum.PusherReady,
        pusherComp: detail.pusherExport,
        pusherCtx: detail.livePusherContext,
      });
    },
    onPusherStartPush({ type, detail }) {
      console.log(`[${this.data.innerId}]`, '==== onPusherStartPush', detail);
      if (!this.userData.writer) {
        // 现在不能push
        console.warn(`[${this.data.innerId}]`, 'onPusherStartPush but can not push, stop pusher');
        this.tryStopPusher();
        return;
      }
      this.clearStreamData();
      this.setData({ isPushing: true });
      this.triggerEvent(type, detail);
    },
    onPusherFlvHeader({ detail }) {
      console.log(`[${this.data.innerId}]`, '==== onPusherFlvHeader', detail);
      this.addChunkInner && this.addChunkInner(detail.data, detail.params);
    },
    onPusherFlvTag({ detail }) {
      this.addChunkInner && this.addChunkInner(detail.data, detail.params);
    },
    onPusherClose({ type, detail }) {
      console.log(`[${this.data.innerId}]`, '==== onPusherClose', detail);
      this.setData({ isPushing: false });
      this.triggerEvent(type, detail);
    },
    onPusherError({ detail }) {
      console.error(`[${this.data.innerId}]`, '==== onPusherError', detail);
      const code = detail && detail.error && detail.error.code;
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
        // 非关键问题不管了
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
      this.handlePushError(pusherState, { msg: `livePusherError: ${detail.errMsg}` });
    },
    onLivePusherStateChange({ detail }) {
      // console.log('onLivePusherStateChange', detail);
      if (!this.userData.writer) {
        // 现在不能push
        return;
      }
      switch (detail.code) {
        case 1001: // 已经连接推流服务器
          console.log(`[${this.data.innerId}]`, '==== onLivePusherStateChange', detail.code, detail);
          break;
        case 1002: // 已经与服务器握手完毕,开始推流
          console.log(`[${this.data.innerId}]`, '==== onLivePusherStateChange', detail.code, detail);
          break;
        // case 1007: // 首帧画面采集完成
        //   console.log(`[${this.data.innerId}]`, '==== onLivePusherStateChange', detail.code, detail);
        //   break;
        case 1102: // live-pusher断连, 已启动自动重连
          console.log(`[${this.data.innerId}]`, '==== onLivePusherStateChange', detail.code, detail);
          break;
        case 3002: // 连接本地RTMP服务器失败
          console.log(`[${this.data.innerId}]`, '==== onLivePusherStateChange', detail.code, detail);
          // 本地server连不上，标记一下
          xp2pManager.needResetLocalRtmpServer = true;

          this.stop();
          this.changeState({
            hasPusher: false,
            pusherState: PusherStateEnum.LocalServerError,
          });
          this.handlePushError(PusherStateEnum.LocalServerError, { msg: `livePusherStateChange: ${detail.code} ${detail.message}` });
          break;
        case -1307: // live-pusher断连，且经多次重连抢救无效，更多重试请自行重启推流
          // 到这里应该已经触发过 onPusherClose 了
          console.log(`[${this.data.innerId}]`, '==== onLivePusherStateChange', detail.code, detail);
          this.changeState({
            pusherState: PusherStateEnum.LivePusherStateError,
          });
          this.handlePushError(PusherStateEnum.LivePusherStateError, { msg: `livePusherStateChange: ${detail.code} ${detail.message}` });
          break;
        default:
          // 这些不特别处理，打个log
          console.log(`[${this.data.innerId}]`, 'onLivePusherStateChange', detail.code, detail);
      }
    },
    onLivePusherNetStatusChange({ detail }) {
      // console.log('onLivePusherNetStatusChange', detail);
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
      if (this.data.pusherState === PusherStateEnum.PusherError) {
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
        // 不可恢复错误，退出重来
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
      console.log(`[${this.data.innerId}] start, hasPusherCtx: ${!!this.data.pusherCtx}, hasWriter: ${!!this.userData.writer}`);
      if (!writer || !writer.addChunk) {
        fail && fail({ errMsg: 'writer invalid' });
        complete && complete();
        return;
      }
      if (!this.data.pusherCtx) {
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
      this.data.pusherCtx.start({
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
      console.log(`[${this.data.innerId}] stop, hasPusherCtx: ${!!this.data.pusherCtx}, hasWriter: ${!!this.userData.writer}`);
      if (!this.data.pusherCtx) {
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
      if (this.data.pusherCtx) {
        try {
          console.log(`[${this.data.innerId}] pusherCtx.stop`);
          this.data.pusherCtx.stop(params);
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

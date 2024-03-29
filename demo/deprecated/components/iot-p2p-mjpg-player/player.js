import { getParamValue, snapshotAndSave } from '../../utils';
import { getXp2pManager } from '../../lib/xp2pManager';
import { getRecordManager } from '../../lib/recordManager';
import { StreamStateEnum, isStreamPlaying, httpStatusErrorMsgMap } from '../iot-p2p-common-player/common';

// 覆盖 console
const app = getApp();
const oriConsole = app.console;
const console = app.logger || oriConsole;

const xp2pManager = getXp2pManager();
const { XP2PEventEnum, XP2PNotify_SubType } = xp2pManager;

const recordManager = getRecordManager('mjpgs');
const snapshotManager = getRecordManager('snapshots');

const MjpgPlayerStateEnum = {
  MjpgPlayerIdle: 'MjpgPlayerIdle',
  MjpgPlayerPreparing: 'MjpgPlayerPreparing',
  MjpgPlayerReady: 'MjpgPlayerReady',
  MjpgPlayerError: 'MjpgPlayerError',
  MjpgImageError: 'MjpgImageError',
  LocalServerError: 'LocalServerError',
};

const totalMsgMap = {
  [MjpgPlayerStateEnum.MjpgPlayerPreparing]: '正在创建图片流播放器...',
  [MjpgPlayerStateEnum.MjpgPlayerReady]: '创建图片流播放器成功',
  [MjpgPlayerStateEnum.MjpgPlayerError]: '图片流播放器错误',
  [MjpgPlayerStateEnum.MjpgImageError]: '播放图片流失败',
  [MjpgPlayerStateEnum.LocalServerError]: '本地HttpServer错误',
};

let playerSeq = 0;

Component({
  behaviors: ['wx://component-export'],
  properties: {
    targetId: {
      type: String,
      value: '',
    },
    playerClass: {
      type: String,
      value: '',
    },
    productId: {
      type: String,
      value: '',
    },
    deviceName: {
      type: String,
      value: '',
    },
    mainStreamType: {
      type: String,
      value: '',
    },
    mainStreamState: {
      type: String,
      value: '',
    },
    mainStreamErrMsg: {
      type: String,
      value: '',
    },
    mjpgFile: {
      type: String,
      value: '',
    },
    muted: {
      type: Boolean,
      value: false,
    },
    showControlRightBtns: {
      type: Boolean,
      value: true,
    },
    // TODO 透传 image 的属性
    // 以下仅供调试，正式组件不需要
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
    needPlayer: false,

    flvFilename: '',
    flvParams: '',
    streamType: '',

    // player状态
    hasPlayer: false,
    playerId: '', // 这是 p2p-mjpg-player 组件的id，不是自己的id
    playerState: MjpgPlayerStateEnum.MjpgPlayerIdle,
    playerMsg: '',

    // 主流状态，需要和主流的播放同步
    isMainStreamPlaying: false,

    // 自己的播放状态
    isPlaying: false,
    playResult: '',
    imgInfoStr: '',

    // debug用
    showDebugInfo: false,
    isRecording: false,
  },
  observers: {
    mainStreamState(val) {
      // console.log(`[${this.data.innerId}]`, 'mainStreamState changed', val);
      const isMainStreamPlaying = isStreamPlaying(val);
      if (isMainStreamPlaying === this.data.isMainStreamPlaying) {
        return;
      }
      this.changeState({ isMainStreamPlaying });
    },
    isMainStreamPlaying(val) {
      console.log(`[${this.data.innerId}]`, 'isMainStreamPlaying changed', val);
      if (val) {
        console.log(`[${this.data.innerId}]`, 'trigger play, reason: mainStream playing');
        this.play();
      } else {
        console.log(`[${this.data.innerId}]`, 'trigger stop, reason: mainStream not playing');
        this.stop();
      }
    },
    isPlaying(val) {
      console.log(`[${this.data.innerId}]`, 'isPlaying changed', val);
    },
    mainStreamErrMsg(val) {
      console.log(`[${this.data.innerId}]`, 'mainStreamErrMsg changed', val);
      if (this.properties.targetId && this.properties.mjpgFile && !this.data.isMainStreamPlaying) {
        this.setData({ playerMsg: this.properties.mainStreamErrMsg || '加载中...' });
      }
    },
  },
  lifetimes: {
    created() {
      // 在组件实例刚刚被创建时执行
      playerSeq++;
      this.setData({ innerId: `mjpg-player-${playerSeq}` });
      console.log(`[${this.data.innerId}]`, '==== created');

      // 渲染无关，不放在data里，以免影响性能
      this.userData = {
        playerComp: null,
        playerCtx: null,
        imgInfo: null,
        fileObj: null,
      };
    },
    attached() {
      // 在组件实例进入页面节点树时执行
      console.log(`[${this.data.innerId}]`, '==== attached', this.id);
      oriConsole.log(this.properties);

      const [flvFilename = '', flvParams = ''] = this.properties.mjpgFile.split('?');
      const streamType = flvFilename ? getParamValue(flvParams, 'action') : '';
      const onlyp2p = this.properties.onlyp2p || false;
      const needPlayer = !onlyp2p;
      const hasPlayer = needPlayer && this.properties.targetId && this.properties.mjpgFile && streamType;
      const playerId = `${this.data.innerId}-player`; // 这是 p2p-mjpg-player 组件的id，不是自己的id
      this.setData({
        flvFilename,
        flvParams,
        streamType,
        needPlayer,
        hasPlayer,
        playerId,
      });

      this.createPlayer();
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
      play: this.play.bind(this),
      stop: this.stop.bind(this),
      snapshot: this.snapshot.bind(this),
      snapshotAndSave: this.snapshotAndSave.bind(this),
    };
  },
  methods: {
    getPlayerMessage(overrideData) {
      if (!this.properties.targetId) {
        return 'targetId为空';
      }

      if (!this.properties.mjpgFile) {
        return 'mjpgFile为空';
      }

      const realData = {
        playerState: this.data.playerState,
        isMainStreamPlaying: this.data.isMainStreamPlaying,
        isPlaying: this.data.isPlaying,
        playResult: this.data.playResult,
        ...overrideData,
      };

      if (!realData.isMainStreamPlaying) {
        return this.properties.mainStreamErrMsg || '加载中...'; // 'mainStream未播放';
      }

      let msg = '';
      if (realData.playerState === MjpgPlayerStateEnum.MjpgPlayerReady) {
        if (realData.isPlaying) {
          msg = realData.playResult === 'success' ? '' : '加载中...';
        } else {
          msg = realData.playResult === 'error' ? '播放图片流失败' : '';
        }
      } else {
        msg = totalMsgMap[realData.playerState];
      }
      return msg;
    },
    // 包一层，方便更新 playerMsg
    changeState(newData, callback) {
      if (newData.hasPlayer === false) {
        this.userData.playerComp = null;
        this.userData.playerCtx = null;
      }
      const oldPlayerState = this.data.playerState;
      this.setData({
        ...newData,
        playerMsg: this.getPlayerMessage(newData),
      }, callback);
      if (newData.playerState && newData.playerState !== oldPlayerState) {
        this.triggerEvent('playerStateChange', {
          playerState: newData.playerState,
        });
      }
    },
    createPlayer() {
      console.log(`[${this.data.innerId}]`, 'createMjpgPlayer');
      if (this.data.playerState !== MjpgPlayerStateEnum.MjpgPlayerIdle) {
        console.error(`[${this.data.innerId}]`, 'can not createMjpgPlayer in playerState', this.data.playerState);
        return;
      }

      this.changeState({
        playerState: MjpgPlayerStateEnum.MjpgPlayerPreparing,
      });
    },
    onPlayerReady({ detail }) {
      console.log(`[${this.data.innerId}]`, '==== onPlayerReady in', this.data.playerState, detail);
      this.userData.playerComp = detail.playerExport;
      this.userData.playerCtx = detail.mjpgPlayerContext;
      this.changeState({
        playerState: MjpgPlayerStateEnum.MjpgPlayerReady,
      });

      if (this.data.isMainStreamPlaying) {
        console.log(`[${this.data.innerId}]`, 'trigger play, reason: player ready');
        this.play();
      }
    },
    onPlayerStartPull({ detail }) {
      console.log(`[${this.data.innerId}]`, '==== onPlayerStartPull', detail);
      // 开始拉流
      this.startStream();
    },
    onPlayerClose({ detail }) {
      console.log(`[${this.data.innerId}]`, '==== onPlayerClose', detail);
      // 停止拉流
      this.stopStream();
    },
    onPlayerError({ detail }) {
      console.error(`[${this.data.innerId}]`, '==== onPlayerError', detail);
      // 停止拉流
      this.stopStream();

      const code = detail?.error?.code;
      let playerState = MjpgPlayerStateEnum.MjpgPlayerError;
      if (code === 'WECHAT_SERVER_ERROR') {
        playerState = MjpgPlayerStateEnum.LocalServerError;
        this.changeState({
          hasPlayer: false,
          playerState,
        });
      } else {
        this.changeState({
          playerState,
        });
      }
      this.handlePlayError(playerState, { msg: `mjpgPlayerError: ${code}` });
    },
    onImageLoad({ detail }) {
      console.log(`[${this.data.innerId}]`, '==== onImageLoad', detail);
      if (!this.data.isPlaying) {
        return;
      }
      this.userData.imgInfo = detail;
      this.setData({
        imgInfoStr: JSON.stringify(detail),
      });
    },
    onImageError({ detail }) {
      console.error(`[${this.data.innerId}]`, '==== onImageError', detail);
      if (!this.data.isPlaying) {
        return;
      }
      // 停止拉流
      this.stopStream();

      const playerState = MjpgPlayerStateEnum.MjpgImageError;
      this.changeState({
        playerState,
        isPlaying: false,
        playResult: 'error',
        imgInfoStr: '',
      });
      this.handlePlayError(playerState, { msg: 'mjpgImageError' });
    },
    resetStreamData() {
      this.dataCallback = null;
      this.clearStreamData();
      this.changeState({
        isPlaying: false,
      });
    },
    clearStreamData() {
      this.userData.imgInfo = null;
      this.changeState({
        playResult: '',
        imgInfoStr: '',
      });
    },
    play({ success, fail, complete } = {}) {
      if (!this.userData.playerCtx) {
        console.log(`[${this.data.innerId}]`, 'call play but mjpg player not ready');
        fail && fail({ errMsg: 'mjpg player not ready' });
        complete && complete();
        return;
      }

      this.clearStreamData();

      console.log(`[${this.data.innerId}]`, 'call play');
      this.userData.playerCtx.play({ success, fail, complete });
    },
    stop({ success, fail, complete } = {}) {
      if (!this.userData.playerCtx) {
        console.log(`[${this.data.innerId}]`, 'call play but mjpg player not ready');
        fail && fail({ errMsg: 'mjpg player not ready' });
        complete && complete();
        return;
      }

      this.clearStreamData();

      console.log(`[${this.data.innerId}]`, 'call stop');
      this.userData.playerCtx.stop({ success, fail, complete });
    },
    startStream() {
      console.log(`[${this.data.innerId}]`, 'startStream', this.properties.targetId);
      if (!this.data.isMainStreamPlaying) {
        console.log(`[${this.data.innerId}]`, 'can not start stream when main stream not playing');
        return;
      }
      if (this.data.isPlaying) {
        console.log(`[${this.data.innerId}]`, 'already playing');
        return;
      }

      const { targetId } = this.properties;
      const msgCallback = (event, subtype, detail) => {
        this.onP2PMessage(targetId, event, subtype, detail, { isStream: true });
      };

      const { playerComp } = this.userData;
      let hasFirstChunk = false;
      const dataCallback = (data) => {
        if (!data || !data.byteLength) {
          return;
        }

        if (!hasFirstChunk) {
          hasFirstChunk = true;
          console.log(`[${this.data.innerId}]`, '==== firstChunk', data.byteLength);
          this.changeState({
            playResult: 'success',
          });
        }

        if (this.userData.fileObj) {
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
        isPlaying: true,
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
          if (!this.data.isPlaying) {
            // 已经stop了
            return;
          }
          console.log(`[${this.data.innerId}]`, '==== startStream res', res);
          if (res === 0) {
            this.dataCallback = dataCallback;
          } else {
            this.resetStreamData();
            this.stop();
            this.handlePlayError(StreamStateEnum.StreamStartError, { msg: `startStream res ${res}` });
          }
        })
        .catch((res) => {
          if (!this.data.isPlaying) {
            // 已经stop了
            return;
          }
          console.log(`[${this.data.innerId}]`, '==== startStream error', res);
          this.resetStreamData();
          this.stop();
          this.handlePlayError(StreamStateEnum.StreamStartError, { msg: `startStream err ${errcode}` });
        });
    },
    stopStream() {
      console.log(`[${this.data.innerId}]`, 'stopStream', this.properties.targetId);

      // 记下来，因为resetStreamData会把这个改成false
      const needStopStream = this.data.isPlaying;
      this.resetStreamData();

      if (needStopStream) {
        // 拉流中的才需要 xp2pManager.stopStream
        console.log(`[${this.data.innerId}]`, 'do stopStream', this.properties.targetId, this.data.streamType);
        xp2pManager.stopStream(this.properties.targetId, this.data.streamType);
      }
    },
    onP2PMessage(targetId, event, subtype, detail) {
      if (targetId !== this.properties.targetId) {
        return;
      }

      if (event !== XP2PEventEnum.Notify) {
        return;
      }

      console.log(`[${this.data.innerId}]`, 'onP2PMessage_Notify', subtype, detail);
      switch (subtype) {
        case XP2PNotify_SubType.Parsed:
          if (!detail || detail.status === 200) {
            // 收到 headers
            if (detail?.headers) {
              this.userData.playerComp.setHeaders(detail.headers);
            }
          } else {
            this.resetStreamData();
            this.stop();
            const msg = httpStatusErrorMsgMap[detail.status] || `httpStatus: ${detail.status}`;
            this.handlePlayError(StreamStateEnum.StreamHttpStatusError, { msg, detail });
          }
          break;
      }
    },
    checkCanRetry() {
      let errType;
      let isFatalError = false;
      let msg = '';
      if (this.data.playerState === MjpgPlayerStateEnum.MjpgPlayerError) {
        // 初始化失败
        errType = this.data.playerState;
        if (wx.getSystemInfoSync().platform === 'devtools') {
          // 开发者工具里不支持 TCPServer，明确提示
          msg = '不支持在开发者工具中创建p2p-mjpg-player';
        }
        isFatalError = true;
      } else if (this.data.playerState === MjpgPlayerStateEnum.LocalServerError) {
        // 本地server出错
        errType = this.data.playerState;
        msg = '系统网络服务可能被中断，请重置本地RtmpServer';
        isFatalError = true;
      }
      if (isFatalError) {
        // 不可恢复错误，退出重来
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
    // 处理播放错误，detail: { msg: string }
    handlePlayError(type, detail) {
      if (!this.checkCanRetry()) {
        return;
      }

      // 能retry的才提示这个，不能retry的前面已经触发弹窗了
      this.triggerEvent('playError', {
        errType: type,
        errMsg: totalMsgMap[type] || '播放图片流失败',
        errDetail: detail,
      });
    },
    // 手动retry
    onClickRetry() {
      console.log(`[${this.data.innerId}]`, 'onClickRetry', this.data);
      this.triggerEvent('clickRetry');
    },
    // 以下是播放器控件相关的
    changeMuted() {
      // 要通知外部
      this.triggerEvent('changeMuted', { muted: !this.data.muted });
    },
    snapshotAndSave() {
      console.log(`[${this.data.innerId}]`, 'snapshotAndSave');
      snapshotAndSave({
        snapshot: this.snapshot.bind(this),
      });
    },
    snapshot() {
      console.log(`[${this.data.innerId}]`, 'snapshot');
      if (!this.userData.playerCtx) {
        return Promise.reject({ errMsg: 'player not ready' });
      }
      if (!this.userData.playerCtx.snapshot) {
        return Promise.reject({ errMsg: 'player not support snapshot' });
      }
      return new Promise((resolve, reject) => {
        this.userData.playerCtx.snapshot({
          quality: 'raw',
          success: (res) => {
            console.log(`[${this.data.innerId}]`, 'snapshot success', res?.data?.byteLength);
            // mpeg-player 截图返回的是 ArrayBuffer，自己写file，保持对外接口一致
            const streamType = getParamValue(this.data.flvParams, 'action') || 'live-mjpg';
            const filePath = snapshotManager.prepareFile(`ipc-${this.properties.productId}-${this.properties.deviceName}-${streamType}.jpg`);
            const fileSystem = wx.getFileSystemManager();
            fileSystem.writeFile({
              filePath,
              data: res.data,
              encoding: 'binary',
              success: (res) => {
                console.log(`[${this.data.innerId}]`, 'snapshot writeFile success', res);
                resolve({
                  tempImagePath: filePath,
                });
              },
              fail: (err) => {
                console.error(`[${this.data.innerId}]`, 'snapshot writeFile fail', err);
                reject(err);
              },
            });
          },
          fail: (err) => {
            console.error(`[${this.data.innerId}]`, 'snapshot fail', err);
            reject(err);
          },
        });
      });
    },
    // 以下是调试面板相关的
    toggleDebugInfo() {
      this.setData({ showDebugInfo: !this.data.showDebugInfo });
    },
    toggleRecording() {
      if (this.data.isRecording) {
        this.stopRecording();
      } else {
        this.startRecording();
      }
    },
    startRecording(recordFilename) {
      if (this.data.isRecording || this.userData.fileObj) {
        // 已经在录像
        return;
      }

      // 保存录像文件要从头开始，停掉重新拉流
      if (this.data.isPlaying) {
        this.stopStream();
      }
      this.stop();

      // 准备录像文件，注意要在 stopStream 之后
      let realRecordFilename = recordFilename;
      if (!realRecordFilename) {
        const streamType = getParamValue(this.data.flvParams, 'action') || 'live-mjpg';
        realRecordFilename = `ipc-${this.properties.productId}-${this.properties.deviceName}-${streamType}`;
      }
      const fileObj = recordManager.openRecordFile(realRecordFilename, 'mjpg');
      this.userData.fileObj = fileObj;
      this.setData({
        isRecording: !!fileObj,
      });
      console.log(`[${this.data.innerId}] record fileName ${fileObj && fileObj.fileName}`);

      // 重新play
      console.log(`[${this.data.innerId}]`, 'trigger record play');
      this.play();
    },
    stopRecording() {
      if (!this.data.isRecording || !this.userData.fileObj) {
        // 没在录像
        return;
      }

      console.log(`[${this.data.innerId}]`, `stopRecording, ${this.userData.fileObj.fileName}`);
      const { fileObj } = this.userData;
      this.userData.fileObj = null;
      this.setData({
        isRecording: false,
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

      wx.showModal({
        title: '录像已保存为本地用户文件',
        showCancel: false,
      });
    },
    cancelRecording() {
      if (!this.data.isRecording || !this.userData.fileObj) {
        // 没在录像
        return;
      }

      console.log(`[${this.data.innerId}]`, `cancelRecording, ${this.userData.fileObj.fileName}`);
      const { fileObj } = this.userData;
      this.userData.fileObj = null;
      this.setData({
        isRecording: false,
      });

      recordManager.closeRecordFile(fileObj);
    },
  },
});

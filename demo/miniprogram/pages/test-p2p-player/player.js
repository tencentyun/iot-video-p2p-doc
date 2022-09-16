/* eslint-disable no-unused-vars, @typescript-eslint/no-unused-vars */
import { getXp2pManager } from '../../lib/xp2pManager';
import { getRecordManager } from '../../lib/recordManager';

const xp2pManager = getXp2pManager();

Page({
  data: {
    systemInfo: {},
    playerPluginVersion: '',
    localRecordName: '',
    dataReady: false,
    playerId: '',
    autoplay: false,
    playerReady: false,
    playStatus: '', // '' | 'playing' | 'ending'
    canWrite: false, // 能否写数据，比如播放暂时中断时不能写
    livePlayerInfoStr: '',
    log: '',
  },
  onLoad(query) {
    this.userData = {
      // 渲染无关的尽量放这里
      playerComp: null,
      playerCtx: null,
      timestamps: null,
      recordManager: null,
      livePlayerInfo: null,
    };

    const systemInfo = wx.getSystemInfoSync() || {};
    this.setData({
      systemInfo,
      playerPluginVersion: xp2pManager.P2PPlayerVersion,
    });

    if (query.dirname && query.filename) {
      const recordManager = getRecordManager(query.dirname);
      this.userData.recordManager = recordManager;
      this.setData({
        localRecordName: query.filename,
      });
    }

    if (this.data.localRecordName) {
      // 拉取本地录像
      this.addLog('正在读取本地录像...');
      this.userData.recordManager
        .readFile(this.data.localRecordName)
        .then((res) => {
          this.addLog(`读取本地录像成功, size: ${res.data.byteLength}`);
          this.setData({
            dataReady: true,
            fileData: res.data,
          });

          // 自动创建、播放
          this.bindCreatePlayer();
        })
        .catch((err) => {
          this.addLog(`读取本地录像失败，errMsg: ${err.errMsg}`);
        });
    } else {
      // 拉取网络视频
      this.addLog('未指定本地录像文件');
    }
  },
  onUnload() {
    this.data.playerId && this.bindDestroyPlayer();
  },
  setUserData(userData) {
    this.userData && Object.assign(this.userData, userData);
  },
  showToast(content) {
    wx.showToast({
      title: content,
      icon: 'none',
    });
  },
  addLog(str) {
    this.setData({ log: `${this.data.log}${Date.now()} - ${str}\n` });
  },
  clearLog() {
    this.setData({ log: '' });
  },
  clearFlvData() {
    this.setUserData({
      livePlayerInfo: null,
    });
    this.setData({
      livePlayerInfoStr: '',
    });
  },
  onPlayerReady({ detail }) {
    console.log('==== onPlayerReady', detail);
    this.addLog(`==== onPlayerReady, delay ${detail.delay}`);
    this.userData.playerComp = detail.playerExport;
    this.userData.playerCtx = detail.livePlayerContext;
    this.setData({
      playerReady: true,
    });

    // 自动播放
    this.bindPlay({ type: 'autoplay' });
  },
  onPlayerStartPull({ detail }) {
    console.log('==== onPlayerStartPull', detail);
    if (!this.data.playStatus) {
      console.log('start pull but not playing');
      this.userData.playerCtx.stop();
      return;
    }
    if (this.data.playStatus === 'ending') {
      // 在播cache
      const { livePlayerInfo } = this.userData;
      const cache = livePlayerInfo
        ? Math.max(livePlayerInfo.videoCache, livePlayerInfo.audioCache)
        : 0;
      console.log(`start pull when ending, cache: ${cache}`);
      console.log('now info', livePlayerInfo);
      if (cache < 500) {
        console.log('start pull and cache end, stop', livePlayerInfo);
        this.bindStop();
      }
      return;
    }
    this.userData.timestamps.startPull = Date.now();
    const delay = this.userData.timestamps.startPull - this.userData.timestamps.triggerPlay;
    console.log('==== wait pull delay', delay);
    this.addLog(`==== onPlayerStartPull, delay ${delay}`);
    this.clearFlvData();
    this.setData({
      canWrite: true,
    });

    // 模拟拉流
    this.pullFileVideo();
  },
  onPlayerClose({ detail }) {
    console.log('==== onPlayerClose', detail);
    if (!this.data.playStatus) {
      console.log('close but not playing');
      return;
    }
    if (this.data.playStatus === 'ending') {
      // 在播cache
      const { livePlayerInfo } = this.userData;
      const cache = livePlayerInfo
        ? Math.max(livePlayerInfo.videoCache, livePlayerInfo.audioCache)
        : 0;
      console.log(`is ending, cache: ${cache}`);
      return;
    }
    this.userData.timestamps = null;
    const code = detail && detail.error && detail.error.code;
    this.addLog(`==== onPlayerClose, code: ${code}`);
    this.setData({
      canWrite: false,
    });
    if (code === 'MEDIA_FINISH') {
      // 数据传完了，但是还有cache没播完，不能马上stop，记录一下
      this.setData({
        playStatus: 'ending',
      });
    }
  },
  onPlayerError({ detail }) {
    console.error('==== onPlayerError', detail);
    const code = detail && detail.error && detail.error.code;
    this.addLog(`==== onPlayerError, code: ${code}`);
    this.userData.playerComp = null;
    this.userData.playerCtx = null;
    this.setData({
      playerReady: false,
      playStatus: '',
      canWrite: false,
    });
    this.bindDestroyPlayer();

    if (code === 'WECHAT_SERVER_ERROR') {
      xp2pManager.needResetLocalServer = true;
      this.addLog(`set needResetLocalServer ${xp2pManager.needResetLocalServer}`);
    }
    wx.showModal({
      content: `player错误: ${code}`,
      showCancel: false,
    });
  },
  onLivePlayerError({ detail }) {
    console.error('==== onLivePlayerError', detail);
    this.addLog(`==== onLivePlayerError, ${detail.errMsg}`);
    this.userData.playerComp = null;
    this.userData.playerCtx = null;
    this.setData({
      playerReady: false,
      playStatus: '',
      canWrite: false,
    });
    this.bindDestroyPlayer();
  },
  onLivePlayerStateChange({ detail }) {
    // console.log('onLivePlayerStateChange', detail);
    switch (detail.code) {
      case 2003: // 网络接收到首个视频数据包(IDR)
        console.log('==== onLivePlayerStateChange', detail.code, detail);
        this.userData.timestamps.recvIDR = Date.now();
        console.log('==== wait IDR delay', this.userData.timestamps.recvIDR - this.userData.timestamps.recvHeader);
        this.addLog('==== receive first IDR');
        break;
      case 2103: // 网络断连, 已启动自动重连
        console.warn('==== onLivePlayerStateChange', detail.code, detail);
        this.addLog(`==== onLivePlayerStateChange ${detail.code}`);
        if (/errCode:-1004(\D|$)/.test(detail.message) || /Failed to connect to/.test(detail.message)) {
          // 无法连接本地服务器
          xp2pManager.needResetLocalServer = true;
          this.addLog(`set needResetLocalServer ${xp2pManager.needResetLocalServer}`);
          this.bindDestroyPlayer();
          wx.showModal({
            content: `播放失败: ${detail.code}, ${detail.message}`,
            showCancel: false,
          });
        }
        break;
      case -2301: // live-player断连，且经多次重连抢救无效，更多重试请自行重启播放
        console.error('==== onLivePlayerStateChange', detail.code, detail);
        if (this.data.playStatus === 'ending') {
          // 在播cache
          const { livePlayerInfo } = this.userData;
          const cache = livePlayerInfo
            ? Math.max(livePlayerInfo.videoCache, livePlayerInfo.audioCache)
            : 0;
          console.log(`is ending, cache: ${cache}`);
          return;
        }
        this.addLog(`==== onLivePlayerStateChange ${detail.code}, final error, needResetLocalServer ${xp2pManager.needResetLocalServer}`);
        // 到这里应该已经触发过 onPlayerClose 了
        this.setData({
          playStatus: '',
          canWrite: false,
        });
        if (xp2pManager.needResetLocalServer) {
          this.bindDestroyPlayer();
        }
        wx.showModal({
          content: `播放失败: ${detail.code}, ${detail.message}`,
          showCancel: false,
        });
        break;
      default:
        console.log('==== onLivePlayerStateChange', detail.code, detail);
    }
  },
  onLivePlayerNetStatus({ detail }) {
    // console.log('onLivePlayerNetStatus', detail);
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
    if (livePlayerInfo.videoCache > 0 || livePlayerInfo.audioCache > 0) {
      livePlayerInfo.hasCacheData = true;
    }
    this.setData({
      livePlayerInfoStr: (
        detail.info
          ? [
            `size: ${livePlayerInfo.videoWidth}x${livePlayerInfo.videoHeight}, fps: ${livePlayerInfo.videoFPS?.toFixed(2)}`,
            `bitrate(kbps): video ${livePlayerInfo.videoBitrate}, audio ${livePlayerInfo.audioBitrate}`,
            `cache(ms): video ${livePlayerInfo.videoCache}, audio ${livePlayerInfo.audioCache}`,
          ].join('\n')
          : ''
      ),
    });
    if (this.data.playStatus === 'ending' && livePlayerInfo.hasCacheData) {
      // 在播cache
      const cache = Math.max(livePlayerInfo.videoCache, livePlayerInfo.audioCache);
      if (cache < 500) {
        console.log('net status and cache end, stop', livePlayerInfo);
        this.bindStop();
      }
    }
  },
  bindCreatePlayer() {
    if (this.data.playerId) {
      console.log('already existed');
      return;
    }

    if (xp2pManager.needResetLocalServer) {
      this.addLog('xp2pManager.needResetLocalServer');
      xp2pManager.resetLocalServer();
    }

    this.addLog('create player');
    this.setData({
      playerId: 'player-demo',
      autoplay: false,
    });
  },
  bindDestroyPlayer() {
    if (!this.data.playerId) {
      console.log('not existed');
      return;
    }
    this.data.playStatus && this.bindStop();

    this.addLog('destroy player');
    this.clearFlvData();
    this.userData.playerComp = null;
    this.userData.playerCtx = null;
    this.setData({
      playerId: '',
      autoplay: false,
      playerReady: false,
      playStatus: '',
      canWrite: false,
    });
  },
  bindPlay({ type } = {}) {
    if (!this.data.playerReady) {
      console.log('start play but player not ready');
      return;
    }
    if (this.data.playStatus) {
      console.log('start play but already playing');
      return;
    }
    this.addLog(`start play, type ${type}`);
    this.clearFlvData();
    this.userData.timestamps = {
      triggerPlay: Date.now(),
    };
    this.setData({
      playStatus: 'playing',
    });
    // 这个会触发 onPlayerStartPull
    if (type === 'autoplay') {
      this.setData({ autoplay: true });
    } else {
      this.userData.playerCtx.play({
        success: (res) => {
          this.addLog('play success');
        },
        fail: (res) => {
          this.addLog('play fail');
        },
      });
    }
  },
  bindStop() {
    if (!this.data.playerReady) {
      console.log('stop play but player not ready');
      return;
    }
    if (!this.data.playStatus) {
      console.log('stop play but not playing');
      return;
    }
    this.addLog('stop play');
    this.userData.timestamps = null;
    this.setData({
      playStatus: '',
      canWrite: false,
    });
    // 这个会触发 onPlayerClose
    this.userData.playerCtx.stop({
      success: (res) => {
        this.addLog('stop success');
      },
      fail: (res) => {
        this.addLog('stop fail');
      },
    });
  },
  loopWrite(data, offset = 0, addChunkCBK = null, chunkSize, chunkInterval, loopCount = 1) {
    if (!this.data.canWrite) {
      // 不能写
      return;
    }
    if (offset >= data.byteLength) {
      loopCount--;
      this.addLog(`loopWrite end, ${loopCount} left`);
      if (loopCount > 0) {
        offset = 0;
      } else {
        this.userData.playerComp.finishMedia();
        return;
      }
    }
    const chunkLen = Math.min(data.byteLength - offset, chunkSize);
    const videoData = data.slice(offset, offset + chunkLen);
    addChunkCBK && addChunkCBK(videoData);
    setTimeout(() => {
      this.loopWrite(data, offset + chunkLen, addChunkCBK, chunkSize, chunkInterval, loopCount);
    }, chunkInterval);
  },
  pullFileVideo() {
    const chunkSize = 10 * 1024;
    const chunkInterval = 25;
    if (this.data.fileData) {
      this.userData.timestamps.recvHeader = Date.now();
      console.log('==== wait header delay', this.userData.timestamps.recvHeader - this.userData.timestamps.startPull);
      this.addLog('start loopWrite');
      this.loopWrite(
        this.data.fileData,
        0,
        this.userData.playerComp.addChunk,
        chunkSize,
        chunkInterval,
      );
    } else {
      console.error('pullFileVideo error', err);
      this.userData.playerComp.abortMedia(err);
    }
  },
});

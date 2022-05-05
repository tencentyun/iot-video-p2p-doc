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
    playerReady: false,
    playerComp: null,
    playerCtx: null,
    playStatus: '', // '' | 'playing' | 'ending'
    canWrite: false, // 能否写数据，比如播放暂时中断时不能写
    livePlayerInfoStr: '',
    log: '',
  },
  onLoad(query) {
    this.userData = {
      // 渲染无关的尽量放这里
      recordManager: null,
      livePlayerInfo: null,
    };

    const systemInfo = wx.getSystemInfoSync() || {};
    this.setData({
      systemInfo,
      playerPluginVersion: xp2pManager.P2PPlayerVersion,
    });

    const recordManager = getRecordManager(query.dirname);
    this.userData.recordManager = recordManager;
    this.setData({
      localRecordName: query.filename,
    });

    if (this.data.localRecordName) {
      // 拉取本地录像
      this.addLog('正在读取本地录像...');
      recordManager
        .readFile(this.data.localRecordName)
        .then((res) => {
          this.addLog(`读取本地录像成功, size: ${res.data.byteLength}`);
          this.setData({
            dataReady: true,
            fileData: res.data,
          });
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
  onPlayerReady({ detail, currentTarget }) {
    console.log('==== onPlayerReady', currentTarget.id, detail);
    this.addLog(`==== onPlayerReady, id: ${currentTarget.id}, innerId: ${detail.playerInnerId}`);
    this.setData({
      playerReady: true,
      playerComp: detail.playerExport,
      playerCtx: detail.livePlayerContext,
    });
  },
  onPlayerStartPull({ detail, currentTarget }) {
    console.log('==== onPlayerStartPull', currentTarget.id, detail);
    this.addLog('==== onPlayerStartPull');
    if (!this.data.playStatus) {
      this.addLog('not playing');
      this.data.playerCtx.stop();
      return;
    }
    if (this.data.playStatus === 'ending') {
      // 在播cache
      const { livePlayerInfo } = this.userData;
      const cache = livePlayerInfo
        ? Math.max(livePlayerInfo.videoCache, livePlayerInfo.audioCache)
        : 0;
      this.addLog(`is ending, cache: ${cache}`);
      console.log('now info', livePlayerInfo);
      if (cache < 200) {
        this.bindStop();
      }
      return;
    }
    this.clearFlvData();
    this.setData({
      canWrite: true,
    });

    // 模拟拉流
    this.pullFileVideo();
  },
  onPlayerClose({ detail, currentTarget }) {
    console.log('==== onPlayerClose', currentTarget.id, detail);
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
  onPlayerError({ detail, currentTarget }) {
    console.error('==== onPlayerError', currentTarget.id, detail);
    const code = detail && detail.error && detail.error.code;
    this.addLog(`==== onPlayerError, code: ${code}`);
    this.setData({
      playerReady: false,
      playerComp: null,
      playerCtx: null,
      playStatus: '',
    });
    if (code === 'WECHAT_SERVER_ERROR') {
      xp2pManager.needResetLocalServer = true;
      this.addLog(`set needResetLocalServer ${xp2pManager.needResetLocalServer}`);
      this.bindDestroyPlayer();
    }
    wx.showModal({
      content: `player错误: ${code}`,
      showCancel: false,
    });
  },
  onLivePlayerError({ detail }) {
    console.error('==== onLivePlayerError', detail);
    this.addLog(`==== onLivePlayerError, ${detail.errMsg}`);
    this.setData({
      playStatus: '',
    });
  },
  onLivePlayerStateChange({ detail }) {
    // console.log('onLivePlayerStateChange', detail);
    switch (detail.code) {
      case 2003: // 网络接收到首个视频数据包(IDR)
        console.log('==== onLivePlayerStateChange', detail.code, detail);
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
        this.addLog(`==== onLivePlayerStateChange ${detail.code}, final error, needResetLocalServer ${xp2pManager.needResetLocalServer}`);
        // 到这里应该已经触发过 onPlayerClose 了
        this.setData({
          playStatus: '',
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
  onLivePlayerNetStatusChange({ detail }) {
    // console.log('onLivePlayerNetStatusChange', detail);
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
    if (typeof detail.info.videoCache === 'number' && this.data.playStatus === 'ending') {
      // 在播cache
      const cache = Math.max(detail.info.videoCache, detail.info.audioCache);
      if (cache < 200) {
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
    });
  },
  bindDestroyPlayer() {
    if (!this.data.playerId) {
      console.log('not existed');
      return;
    }
    this.bindStop();

    this.addLog('destroy player');
    this.clearFlvData();
    this.setData({
      playerId: '',
      playerReady: false,
      playerComp: null,
      playerCtx: null,
      playStatus: '',
    });
  },
  bindPlay() {
    if (!this.data.playerReady) {
      console.log('player not ready');
      return;
    }
    if (this.data.playStatus) {
      console.log('already playing');
      return;
    }
    this.addLog('start play');
    this.clearFlvData();
    this.setData({
      playStatus: 'playing',
    });
    // 这个会触发 onPlayerStartPull
    this.data.playerCtx.play({
      success: (res) => {
        this.addLog('play success');
      },
      fail: (res) => {
        this.addLog('play fail');
      },
    });
  },
  bindStop() {
    if (!this.data.playerReady) {
      console.log('player not ready');
      return;
    }
    if (!this.data.playStatus) {
      console.log('not playing');
      return;
    }
    this.addLog('stop play');
    this.setData({
      playStatus: '',
    });
    // 这个会触发 onPlayerClose
    this.data.playerCtx.stop({
      success: (res) => {
        this.addLog('stop success');
      },
      fail: (res) => {
        this.addLog('stop fail');
      },
    });
  },
  loopWrite(data, offset = 0, addChunkCBK = null, chunkSize, chunkInterval) {
    if (!this.data.canWrite) {
      // 不能写
      return;
    }
    if (offset >= data.byteLength) {
      this.addLog('loopWrite end');
      this.data.playerComp.finishMedia();
      return;
    }
    const chunkLen = Math.min(data.byteLength - offset, chunkSize);
    const videoData = data.slice(offset, offset + chunkLen);
    addChunkCBK && addChunkCBK(videoData);
    setTimeout(() => {
      this.loopWrite(data, offset + chunkLen, addChunkCBK, chunkSize, chunkInterval);
    }, chunkInterval);
  },
  pullFileVideo() {
    const chunkSize = 200 * 1024;
    const chunkInterval = 200;
    if (this.data.fileData) {
      this.addLog('start loopWrite');
      this.loopWrite(
        this.data.fileData,
        0,
        this.data.playerComp.addChunk,
        chunkSize,
        chunkInterval,
      );
    } else {
      console.error('pullFileVideo error', err);
      this.data.playerComp.abortMedia(err);
    }
  },
});

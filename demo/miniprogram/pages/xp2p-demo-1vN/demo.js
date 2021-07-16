import config from '../../config';

const xp2pPlugin = requirePlugin('xp2p');
const playerPlugin = requirePlugin('wechat-p2p-player');

const enetExports = xp2pPlugin.enet;
const p2pExports = xp2pPlugin.p2p;
const { PlayerCloseType } = playerPlugin;

const delay = (duration) => new Promise((resolve) => setTimeout(resolve, duration));

const defaultData = {
  ipc: {
    mode: 'ipc',
    ...config.ipc['v1.3'],
    id: 'iamipcid',
    peername: '25QPD2ozyZoHmxkCNW',
  },
  xntp: {
    mode: 'server-xntp',
    ...config.server.xntp,
    id: '6e0b2be040a943489ef0b9bb344b96b8',
    flvPath: '6e0b2be040a943489ef0b9bb344b96b8.hd.flv',
  },
  tcp: {
    mode: 'server-tcp',
    ...config.server.tcp,
    id: '6e0b2be040a943489ef0b9bb344b96b8',
    flvPath: '6e0b2be040a943489ef0b9bb344b96b8.hd.flv',
  },
  tcp80: {
    mode: 'server-tcp',
    ...config.server.tcp80,
    id: '6e0b2be040a943489ef0b9bb344b96b8',
    flvPath: '6e0b2be040a943489ef0b9bb344b96b8.hd.flv',
  },
};

Page({
  data: {
    // 这是onLoad时就固定的
    mode: '',
    onlyp2p: false,
    needPlayer: false,

    // ipc用的
    peername: '',
    basePath: '',
    flvPath: '',
    flvParams: '',

    // 这些是不同的流
    inputId: '',
    inputUrl: '',

    // 这些是p2p状态
    state: '',
    localPeername: '',
    id: '',
    flvUrl: '',
    totalBytes: 0,
    peerlist: '',
    log: '',

    // 这些是控制player和p2p的
    playerId: 'p2p-player-1',
    playerCtx: null,
    xp2pApp: null,
  },
  onLoad(query) {
    console.log('enetExports', enetExports);
    console.log('p2pExports', p2pExports);

    console.log('onLoad', query);
    const data = (query.mode && defaultData[query.mode]) || defaultData.tcp;
    const onlyp2p = !!parseInt(query.onlyp2p, 10);
    const realHost = data.host || `${data.peername}.xnet`;
    this.setData({
      mode: data.mode,
      onlyp2p,
      needPlayer: !onlyp2p,
      inputId: data.id,
      inputUrl: `http://${realHost}${data.basePath}${data.flvPath}${data.flvParams ? `?${data.flvParams}` : ''}`,
    });
    if (this.data.mode == 'ipc') {
      this.setData(
        {
          peername: data.peername,
          basePath: data.basePath,
          flvPath: data.flvPath,
          flvParams: data.flvParams,
        },
        () => {
          console.log('data=======', this.data);
        },
      );
    }

    // 监听网络变化
    wx.onNetworkStatusChange((res) => {
      console.error('network changed, now state: ', this.data.state);
      console.log(res);
      if (this.data.state == 'dataParsed') {
        this.stopStream();
        if (res.isConnected) {
          this.resetP2P();
          this.startPlay();
        }
      }
    });

    enetExports.enableHttpLog(true);
    enetExports.enableNetLog(false);
  },
  onUnload() {
    console.log('onUnload');
    this.destroyModule();

    if (this.data.xp2pApp) {
      this.data.xp2pApp.stop();
      this.data.xp2pApp.destruct();
      this.setData({
        xp2pApp: null,
      });
    }
  },
  showToast(content) {
    wx.showToast({
      title: content,
      icon: 'none',
    });
  },
  inputPeername(e) {
    this.setData({
      peername: e.detail.value,
    });
  },
  onPlayerReady({ detail }) {
    console.log('onPlayerReady', detail);
    this.playerCtx = detail.livePlayerContext;
    this.setData({
      playerCtx: detail.livePlayerContext,
    });
  },
  onPlayerStartPull() {
    console.info('======onPlayerStartPull======');
    // 如果player请求断掉再恢复，持续的流无法播放，暂时p2p先重新拉流处理
    this.startStream();
  },
  onPlayerClose({ detail }) {
    console.info('=====livePlayerClose====');
    if (detail.error?.code === PlayerCloseType.LIVE_PLAYER_CLOSED) {
      console.error('player close, now state: ', this.data.state);
      // 拉流过程中停止
      if (this.data.state === 'dataParsed' || this.data.state === 'request') {
        // 因为player会自动重试，触发startPull回调，这里只是停止拉流即可。
        this.stopStream();
      }
    }
  },
  inputStreamId(e) {
    this.setData({
      inputId: e.detail.value,
    });
  },
  inputStreamUrl(e) {
    this.setData({
      inputUrl: e.detail.value,
    });
  },
  resetXP2PData() {
    this.setData({ state: '', localPeername: '', id: '', flvUrl: '', totalBytes: 0, peerlist: '', log: '' });
  },
  initModule() {
    if (this.data.state) {
      this.showToast('p2pModule already running');
      return;
    }
    this.setData({ state: 'init' });

    p2pExports
      .init({
        appParams: config.appParams,
        source: this.data.mode === 'ipc' ? p2pExports.XP2PSource.IPC : p2pExports.XP2PSource.IoTP2PServer,
      })
      .then((res) => {
        console.log('init res', res);

        if (res === 0) {
          const localPeername = p2pExports.getLocalXp2pInfo();
          console.log('localPeername', localPeername);
          this.setData({ state: 'inited', localPeername });
        } else {
          this.resetXP2PData();
          wx.showModal({
            content: `init 失败, res=${res}`,
            showCancel: false,
          });
        }
      })
      .catch((errcode) => {
        console.error('init error', errcode);

        this.resetXP2PData();
        wx.showModal({
          content: `init 失败, errcode: ${errcode}`,
          showCancel: false,
        });
      });
  },
  destroyModule() {
    console.log('destroyModule');

    if (!this.data.state) {
      console.log('p2pModule not running');
      return;
    }

    this.stopStream();

    this.resetXP2PData();
    p2pExports.destroy();
  },
  destroyModuleAsync() {
    delay(10).then(() => {
      this.destroyModule();
    });
  },
  resetP2P() {
    if (!this.data.state) {
      console.log('p2pModule not running');
      return;
    }

    this.setData({ state: 'resetP2P', localPeername: '' });
    p2pExports
      .resetP2P()
      .then((res) => {
        console.log('resetP2P res', res);
        if (res === 0) {
          const localPeername = p2pExports.getLocalXp2pInfo();
          console.log('localPeername', localPeername);
          this.setData({ state: 'inited', localPeername });
        } else {
          this.destroyModule();
          wx.showModal({
            content: `resetP2P 失败, res=${res}`,
            showCancel: false,
          });
        }
      })
      .catch((errcode) => {
        console.error('reset error', errcode);
        this.destroyModule();
        wx.showModal({
          content: `reset 失败, errcode: ${errcode}`,
          showCancel: false,
        });
      });
  },
  stopPlayer() {
    if (this.data.playerCtx) {
      console.log('playerCtx.stop');
      this.data.playerCtx.stop({
        success: (res) => {
          console.log('stop success');
        },
        fail: (res) => {
          console.log('stop fail');
        },
      });
    }
  },
  stopPlay() {
    this.stopPlayer();
    this.stopStream();
  },
  startPlay() {
    this.playerCtx.play();
  },
  startStream() {
    if (this.data.mode === 'ipc' && !this.data.peername) {
      this.showToast('please input peername');
      return;
    }

    if (!this.data.inputId || !this.data.inputUrl) {
      this.showToast('please input id and url');
      return;
    }

    if (this.data.state !== 'inited') {
      this.showToast('can not start service in state', this.data.state);
      return;
    }
    this.setData({ state: 'startStream' });
    this.addLog('start stream');

    const id = this.data.inputId;
    const msgCallback = (event, subtype, detail) => {
      this.onP2PMessage(id, event, subtype, detail);
    };
    if (this.data.onlyp2p) {
      let chunkCount = 0;
      let totalBytes = 0;
      // 直接开始p2p
      p2pExports
        .startP2PService(
          id,
          { url: this.data.inputUrl },
          {
            msgCallback,
            dataCallback: (data) => {
              chunkCount++;
              totalBytes += data.byteLength;
              this.setData({
                totalBytes,
              });
            },
          },
        )
        .then((res) => {
          console.log('startP2PService res', res);
          if (res === 0) {
            this.setData({ state: 'serviceReady', id });
            this.addLog('stream service ready');
          } else {
            this.stopStream();
            wx.showModal({
              content: `startP2PService 失败, res=${res}`,
              showCancel: false,
            });
          }
        })
        .catch((errcode) => {
          console.error('startP2PService error', errcode);
          this.stopStream();
          wx.showModal({
            content: `startP2PService 失败, errcode: ${errcode}`,
            showCancel: false,
          });
        });
      return;
    }

    // const funcName = this.data.mode === 'ipc' ? 'startServiceWithIPCStreamUrl' : 'startServiceWithServerStreamUrl';
    const player = this.selectComponent(`#${this.data.playerId}`);
    // 用player触发
    p2pExports
      .startP2PService(
        id,
        { url: this.data.inputUrl },
        {
          msgCallback,
          dataCallback: (data) => {
            player.addChunk(data);
          },
        },
      )
      .then((res) => {
        console.log('startServiceWithStreamUrl res', res);

        if (res === 0) {
          this.setData({ state: 'serviceReady', id });
          this.addLog('stream service ready');
          const flvUrl = p2pExports.getHttpFlvUrl(id);
          console.log('set flvUrl', flvUrl);
          this.setData({ flvUrl });
        } else {
          this.stopStream();
          wx.showModal({
            content: `startServiceWithStreamUrl 失败, res=${res}`,
            showCancel: false,
          });
        }
      })
      .catch((errcode) => {
        console.error('startServiceWithStreamUrl error', errcode);

        this.stopStream();
        wx.showModal({
          content: `startServiceWithStreamUrl 失败, errcode: ${errcode}`,
          showCancel: false,
        });
      });
  },
  stopStream() {
    if (this.data.flvUrl) {
      console.log('clear flvUrl');
      this.setData({
        flvUrl: '',
      });
    }
    if (this.data.id) {
      const streamId = this.data.id;
      this.setData({
        id: '',
        flvUrl: '',
        totalBytes: 0,
        peerlist: '',
        log: '',
      });
      p2pExports.stopServiceById(streamId);
    }
    if (this.data.localPeername) {
      this.setData({
        state: 'inited',
      });
    } else {
      this.setData({
        state: 'unknown', // 不应该到这里
      });
    }
  },
  onP2PMessage(id, event, subtype, detail) {
    if (id !== this.data.id) {
      console.warn(`onP2PMessage, id error, now ${this.data.id}, receive`, id, event, subtype);
      return;
    }

    switch (event) {
      case p2pExports.XP2PEventEnum.Notify:
        this.onP2PMessage_Notify(subtype, detail);
        break;

      case p2pExports.XP2PEventEnum.DevNotify:
        this.onP2PMessage_DevNotify(subtype, detail);
        break;

      case p2pExports.XP2PEventEnum.Log:
        console.log('onP2PMessage, Log', subtype, detail);
        break;

      default:
        console.log('onP2PMessage, unknown event', event, subtype);
    }
  },
  onP2PMessage_Notify(type, detail) {
    switch (type) {
      case p2pExports.XP2PNotify_SubType.Request:
        console.log('XP2PNotify_SubType.Request', detail);
        this.setData({ state: 'request' });
        this.addLog('receive request');
        break;
      case p2pExports.XP2PNotify_SubType.Parsed:
        // 数据传输开始
        console.log('XP2PNotify_SubType.Parsed', detail);
        this.setData({ state: 'dataParsed' });
        this.addLog('receive data');
        break;
      case p2pExports.XP2PNotify_SubType.Close:
        // 数据传输结束
        console.log('XP2PNotify_SubType.Close', detail);
        if (this.data.state === 'dataParsed') {
          // dataParsed 之前的好像可以自动重试
          wx.showModal({
            content: '直播结束',
            showCancel: false,
          });
        }
        this.stopStream();
        break;
      case p2pExports.XP2PNotify_SubType.Disconnect:
        // p2p链路断开
        console.error('XP2PNotify_SubType.Disconnect', detail);
        wx.showModal({
          content: '连接断开',
          confirmText: '重置P2P',
          success: (result) => {
            if (result.confirm) {
              // 重置P2P
              this.resetP2P();
            }
          },
        });
        this.stopStream();
        break;
    }
  },
  onP2PMessage_DevNotify(type, detail) {
    if (type === p2pExports.XP2PDevNotify_SubType.Peerlist) {
      this.setData({ peerlist: `${Date.now()} - ${detail}` });
    } else if (type === p2pExports.XP2PDevNotify_SubType.Subscribe) {
      this.addLog(detail);
    }
  },
  addLog(str) {
    this.setData({ log: `${this.data.log}${Date.now()} - ${str}\n` });
  },
});

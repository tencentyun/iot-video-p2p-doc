import config from '../config/config';
import { checkAuthorize } from '../utils';

// ts才能用enum，先这么处理吧
export const Xp2pManagerErrorEnum = {
  NoPlugin: -1,
  ParamError: -2,
  ModuleNotInited: -3,
  Timeout: -4,
  NoAuth: -5,
};

const { appParams } = config;

const xp2pPlugin = requirePlugin('xp2p');
const p2pExports = xp2pPlugin.p2p;
const p2pTimeout = 6000;

let playerPlugin;

const parseCommandResData = (data) => {
  let jsonStr = data;
  const pos = jsonStr.search(/\0/);
  if (pos >= 0) {
    // 兼容有 \0 结束符的情况，1.0.1之前需要，1.0.2开始已在插件内处理
    jsonStr = jsonStr.substr(0, pos);
    console.log(`data length: ${data.length}, fixed length: ${jsonStr.length}`);
  }
  return JSON.parse(jsonStr);
};

class Xp2pManager {
  get P2PPlayerVersion() {
    return playerPlugin.Version;
  }

  get XP2PVersion() {
    return p2pExports.XP2PVersion;
  }

  get XP2PLocalEventEnum() {
    return p2pExports.XP2PLocalEventEnum;
  }

  get XP2PEventEnum() {
    return p2pExports.XP2PEventEnum;
  }

  // eslint-disable-next-line camelcase
  get XP2PNotify_SubType() {
    return p2pExports.XP2PNotify_SubType;
  }

  // eslint-disable-next-line camelcase
  get XP2PDevNotify_SubType() {
    return p2pExports.XP2PDevNotify_SubType;
  }

  get uuid() {
    return p2pExports.getUUID();
  }

  get promise() {
    return this._promise;
  }

  get state() {
    return this._state;
  }

  get localPeername() {
    return this._localPeername;
  }

  get networkChanged() {
    return !!this._networkChanged;
  }

  set networkChanged(v) {
    this._networkChanged = v ? { timestamp: Date.now() } : null;
  }

  get needResetLocalServer() {
    return this._needResetLocalServer;
  }

  set needResetLocalServer(v) {
    this._needResetLocalServer = v;
  }

  get needResetLocalRtmpServer() {
    return this._needResetLocalRtmpServer;
  }

  set needResetLocalRtmpServer(v) {
    this._needResetLocalRtmpServer = v;
  }

  get isModuleActive() {
    return this._state === 'inited'
      && !this.networkChanged;
  }

  constructor() {
    this._promise = null;
    this._state = '';
    this._localPeername = '';
    this._networkType = '';
    this._networkChanged = null;
    this._needResetLocalServer = false;
    this._needResetLocalRtmpServer = false;
    this._appHideTimestamp = 0;

    // 自定义信令用
    this._msgSeq = 0;

    console.log('Xp2pManager: XP2PVersion', this.XP2PVersion);

    if (!playerPlugin) {
      playerPlugin = requirePlugin('wechat-p2p-player');
    }
    console.log('Xp2pManager: P2PPlayerVersion', this.P2PPlayerVersion);

    wx.getNetworkType({
      success: (res) => {
        console.log('Xp2pManager: getNetworkType res', res);
        this._networkType = res.networkType;
      },
    });

    // 监听网络变化
    wx.onNetworkStatusChange((res) => {
      console.log('Xp2pManager: onNetworkStatusChange', this._networkType, '->', res.networkType, res);

      const timestamp = Date.now();
      if (this._appHideTimestamp) {
        console.log(`Xp2pManager: networkChanged after appHide ${timestamp - this._appHideTimestamp}`);
      }

      // 仅记录
      this._networkType = res.networkType;
      this._networkChanged = { detail: res, timestamp };
    });

    // 退后台打个log
    wx.onAppHide(() => {
      this._appHideTimestamp = Date.now();
      console.log('Xp2pManager: onAppHide');
    });
    wx.onAppShow(() => {
      if (!this._appHideTimestamp) {
        return;
      }
      const hideTime = Date.now() - this._appHideTimestamp;
      this._appHideTimestamp = 0;
      console.log(`Xp2pManager: onAppShow, hideTime: ${hideTime}`);
    });
  }

  getXp2pPluginInfo() {
    try {
      return xp2pPlugin.getPluginInfo && xp2pPlugin.getPluginInfo();
    } catch (err) {
      // 低版本插件没有这个接口
      console.error('getXp2pPluginInfo error', err);
    }
  }

  getPlayerPluginInfo() {
    try {
      return playerPlugin.getPluginInfo && playerPlugin.getPluginInfo();
    } catch (err) {
      // 低版本插件没有这个接口
      console.error('getPlayerPluginInfo error', err);
    }
  }

  checkReset() {
    console.log('Xp2pManager: checkReset');

    if (this._networkChanged) {
      try {
        this.resetP2P();
      } catch (err) {}
    }

    if (this._needResetLocalServer) {
      try {
        this.resetLocalServer();
      } catch (err) {}
    }

    if (this._needResetLocalRtmpServer) {
      try {
        this.resetLocalRtmpServer();
      } catch (err) {}
    }
  }

  resetLocalServer() {
    console.log('Xp2pManager: resetLocalServer');
    this._needResetLocalServer = false;

    try {
      playerPlugin.reset();
    } catch (err) {
      // 低版本插件没有 reset，保护一下
      console.error('playerPlugin.reset error', err);
    }
  }

  resetLocalRtmpServer() {
    console.log('Xp2pManager: resetLocalRtmpServer');
    this._needResetLocalRtmpServer = false;

    try {
      playerPlugin.resetRtmp();
    } catch (err) {
      // 低版本插件没有 reset，保护一下
      console.error('playerPlugin.resetRtmp error', err);
    }
  }

  initModule() {
    console.log('Xp2pManager: initModule in state', this._state);

    if (this._networkChanged) {
      console.log('Xp2pManager: networkChanged, destoryModule first');
      this.destroyModule();
    }

    if (this._state === 'inited') {
      // 已经初始化好了
      console.log('Xp2pManager: p2pModule already inited');
      return Promise.resolve(0);
    }

    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    if (this._promise) {
      // 正在初始化
      return this._promise;
    }

    const start = Date.now();
    this._state = 'initing';
    this._networkChanged = null;

    const promise = new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        clearTimeout(timer);
        if (this._promise !== promise) {
          return;
        }
        console.error('Xp2pManager: init timeout');

        this.destroyModule();
        return reject(Xp2pManagerErrorEnum.Timeout);
      }, p2pTimeout);

      p2pExports
        .init({
          appParams,
          eventHandler: this._eventHandler.bind(this), // 需要xp2p插件1.1.1以上版本
        })
        .then((res) => {
          clearTimeout(timer);
          if (this._promise !== promise) {
            return;
          }
          console.log('Xp2pManager: init res', res, 'delay', Date.now() - start);

          if (res === 0) {
            const localPeername = p2pExports.getLocalXp2pInfo();
            console.log('Xp2pManager: localPeername', localPeername);
            this._state = 'inited';
            this._localPeername = localPeername;
            this._promise = null;
          } else {
            this._resetXP2PData();
          }

          return resolve(res);
        })
        .catch((errcode) => {
          clearTimeout(timer);
          if (this._promise !== promise) {
            return;
          }
          console.error('Xp2pManager: init error', errcode);

          this._resetXP2PData();
          return reject(errcode);
        });
    });

    return this._promise = promise;
  }

  destroyModule() {
    console.log('Xp2pManager: destroyModule in state', this._state);

    if (!this._state) {
      console.log('Xp2pManager: p2pModule not running');
      return;
    }

    this._resetXP2PData();
    p2pExports.destroy();
  }

  resetP2P() {
    console.log('Xp2pManager: resetP2P in state', this._state);

    if (this._state !== 'inited') {
      console.log('Xp2pManager: p2pModule not inited');
      return Promise.reject(Xp2pManagerErrorEnum.ModuleNotInited);
    }

    const start = Date.now();
    this._state = 'reseting';
    this._networkChanged = null;

    const promise = new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        clearTimeout(timer);
        if (this._promise !== promise) {
          return;
        }
        console.error('Xp2pManager: resetP2P timeout');

        this.destroyModule();
        return reject(Xp2pManagerErrorEnum.Timeout);
      }, p2pTimeout);

      p2pExports
        .resetP2P()
        .then((res) => {
          clearTimeout(timer);
          if (this._promise !== promise) {
            return;
          }
          console.log('Xp2pManager: resetP2P res', res, 'delay', Date.now() - start);

          if (res === 0) {
            const localPeername = p2pExports.getLocalXp2pInfo();
            console.log('Xp2pManager: localPeername', localPeername);
            this._state = 'inited';
            this._localPeername = localPeername;
            this._promise = null;
          } else {
            this.destroyModule();
          }

          return resolve(res);
        })
        .catch((errcode) => {
          clearTimeout(timer);
          if (this._promise !== promise) {
            return;
          }
          console.error('Xp2pManager: resetP2P error', errcode);

          this.destroyModule();
          return reject(errcode);
        });
    });

    return this._promise = promise;
  }

  startP2PService(targetId, streamInfo, callbacks) {
    console.log('Xp2pManager: startP2PService', targetId, streamInfo, callbacks);
    return p2pExports.startP2PService(targetId, streamInfo, callbacks);
  }

  stopP2PService(targetId) {
    console.log('Xp2pManager: stopP2PService', targetId);
    return p2pExports.stopP2PService(targetId);
  }

  getServiceInitInfo(targetId) {
    return p2pExports.getServiceInitInfo(targetId);
  }

  updateServiceCallbacks(targetId, callbacks) {
    console.log('Xp2pManager: updateP2PServiceCallbacks', targetId, callbacks);
    return p2pExports.updateServiceCallbacks(targetId, callbacks);
  }

  startStream(targetId, { flv, dataCallback }) {
    console.log('Xp2pManager: startStream', targetId);
    return p2pExports.startStream(targetId, { flv, dataCallback });
  }

  stopStream(targetId) {
    console.log('Xp2pManager: stopStream', targetId);
    return p2pExports.stopStream(targetId);
  }

  startVoice(targetId, options, callbacks) {
    console.log('Xp2pManager: startVoice', targetId, options);

    return new Promise((resolve, reject) => {
      this.checkRecordAuthorize()
        .then(() => {
          console.log('checkRecordAuthorize success');

          // 语音对讲需要recorderManager
          const recorderManager = wx.getRecorderManager();

          p2pExports
            .startVoice(targetId, recorderManager, options, callbacks)
            .then((res) => {
              resolve(res);
            })
            .catch((error) => {
              reject(error);
            });
        })
        .catch((error) => {
          console.log('checkRecordAuthorize error', error);
          reject(error);
        });
    });
  }

  startVoiceData(targetId, options, callbacks) {
    console.log('Xp2pManager: startVoiceData', targetId, options);
    return p2pExports.startVoiceData(targetId, options, callbacks);
  };

  stopVoice(targetId) {
    console.log('Xp2pManager: stopVoice', targetId);
    return p2pExports.stopVoice(targetId);
  }

  // 本地下载
  startLocalDownload(targetId, options, callbacks) {
    console.log('Xp2pManager: startLocalDownload', targetId);
    return p2pExports.startLocalDownload(targetId, options, callbacks);
  }

  stopLocalDownload(targetId) {
    console.log('Xp2pManager: stopLocalDownload', targetId);
    return p2pExports.stopLocalDownload(targetId);
  }

  sendCommand(targetId, command, options = { responseType: 'text' }) {
    console.log('Xp2pManager: sendCommand', targetId, command, options);
    return p2pExports.sendCommand(targetId, command, options);
  }

  // 内部信令，参考 https://cloud.tencent.com/document/product/1131/61744
  sendInnerCommand(targetId, { channel = 0, cmd, params }) {
    console.log('Xp2pManager: sendInnerCommand', targetId, channel, cmd, params);

    let cmdStr = `action=inner_define&channel=${channel || 0}&cmd=${cmd}`;
    if (params) {
      for (const key in params) {
        cmdStr += `&${key}=${encodeURIComponent(params[key])}`;
      }
    }

    const start = Date.now();
    return new Promise((resolve, reject) => {
      this.sendCommand(targetId, cmdStr)
        .then((res) => {
          console.log(`Xp2pManager: sendInnerCommand res ${res.type} ${res.data && res.data.length}, delay`, Date.now() - start);
          if (res.type === 'success') {
            try {
              const obj = parseCommandResData(res.data);
              resolve(obj);
            } catch (error) {
              console.error('Xp2pManager: parseCommandResData err', res.data);
              reject(`解析信令失败：${error}`);
            }
            return;
          }

          reject(res.errmsg || `发送信令失败：${res.status} ${res.errcode}`);
        })
        .catch((error) => {
          console.error('Xp2pManager: sendInnerCommand err, delay', Date.now() - start);
          reject(`发送信令失败：${error}`);
        });
    });
  }

  // 用户自定义信令
  sendUserCommand(targetId, { channel = 0, cmd }) {
    console.log('Xp2pManager: sendUserCommand', targetId, channel, cmd);

    this._msgSeq++;
    const cmdObj = { ...cmd, message_id: this._msgSeq };

    const start = Date.now();
    return new Promise((resolve, reject) => {
      this.sendCommand(targetId, `action=user_define&channel=${channel || 0}&cmd=${JSON.stringify(cmdObj)}`)
        .then((res) => {
          console.log(`Xp2pManager: sendUserCommand res ${res.type} ${res.data && res.data.length}, delay`, Date.now() - start);
          if (res.type === 'success') {
            try {
              const obj = parseCommandResData(res.data);
              resolve(obj);
            } catch (error) {
              console.error('Xp2pManager: parseCommandResData err', res.data);
              reject(`解析信令失败：${error}`);
            }
            return;
          }

          reject(res.errmsg || `发送信令失败：${res.status} ${res.errcode}`);
        })
        .catch((error) => {
          console.error('Xp2pManager: sendUserCommand err, delay', Date.now() - start);
          reject(`发送信令失败：${error}`);
        });
    });
  }

  _resetXP2PData() {
    this._promise = null;
    this._state = '';
    this._localPeername = '';
    this._networkChanged = null;
    this._msgSeq = 0;
  }

  _eventHandler(type, detail) {
    console.log('Xp2pManager: _eventHandler', type, detail);
    const timestamp = Date.now();
    switch (type) {
      case this.XP2PLocalEventEnum.NATChanged:
      case this.XP2PLocalEventEnum.NATError:
        if (this._appHideTimestamp) {
          console.log(`Xp2pManager: ${type} after appHide ${timestamp - this._appHideTimestamp}`);
        }
        // 仅记录
        this._networkChanged = { detail, timestamp };
        break;
    }
  }

  checkRecordAuthorize() {
    return checkAuthorize('scope.record');
  }
}

let xp2pManager = null;
export const getXp2pManager = () => {
  if (!xp2pManager) {
    p2pExports.enableHttpLog(false);
    p2pExports.enableNetLog(false);
    p2pExports.enableXNTPLog(false);
    xp2pManager = new Xp2pManager();
  }
  return xp2pManager;
};

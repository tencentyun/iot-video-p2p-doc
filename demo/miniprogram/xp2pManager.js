import config from './config/config';

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

const playerPlugin = requirePlugin('wechat-p2p-player');

const parseCommandResData = (data) => {
  let jsonStr = data;
  const pos = jsonStr.search(/\0/);
  if (pos >= 0) {
    // 兼容有 \0 结束符的情况
    jsonStr = jsonStr.substr(0, pos);
    console.log(`data length: ${data.length}, fixed length: ${jsonStr.length}\n`, jsonStr);
  }
  return JSON.parse(jsonStr);
};

class Xp2pManager {
  get XP2PVersion() {
    return p2pExports?.XP2PVersion;
  }

  get XP2PEventEnum() {
    return p2pExports?.XP2PEventEnum;
  }

  get XP2PNotify_SubType() {
    return p2pExports?.XP2PNotify_SubType;
  }

  get XP2PDevNotify_SubType() {
    return p2pExports?.XP2PDevNotify_SubType;
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
  constructor() {
    this._promise = null;
    this._state = '';
    this._localPeername = '';
    this._networkType = '';
    this._networkChanged = null;
    this._needResetLocalServer = false;

    // 自定义信令用
    this._msgSeq = 0;

    console.log('Xp2pManager: XP2PVersion', this.XP2PVersion);

    wx.getNetworkType({
      success: (res) => {
        console.log('Xp2pManager: getNetworkType res', res);
        this._networkType = res.networkType;
      },
    });

    // 监听网络变化
    wx.onNetworkStatusChange((res) => {
      console.warn('Xp2pManager: onNetworkStatusChange', this._networkType, '->', res);

      // 仅记录
      this._networkType = res.networkType;
      this._networkChanged = { detail: res, timestamp: Date.now() };
    });
  }

  resetLocalServer() {
    console.log('Xp2pManager: resetLocalServer');
    this._needResetLocalServer = false;

    try {
      playerPlugin.reset();
    } catch (err) {
      // 低版本插件没有 reset，保护一下
      console.log('playerPlugin.reset error', err);
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
      console.log('p2pModule already inited');
      return Promise.resolve(0);
    }

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
      }, 3000);

      p2pExports
        .init({
          appParams,
        })
        .then((res) => {
          clearTimeout(timer);
          if (this._promise !== promise) {
            return;
          }
          console.log('Xp2pManager: init res', res, 'delay', Date.now() - start);

          if (res === 0) {
            const localPeername = p2pExports.getLocalXp2pInfo();
            console.log('localPeername', localPeername);
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
      console.log('p2pModule not running');
      return;
    }

    this._resetXP2PData();
    p2pExports.destroy();
  }

  resetP2P() {
    console.log('Xp2pManager: resetP2P in state', this._state);

    if (this._state !== 'inited') {
      console.log('p2pModule not inited');
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
      }, 3000);

      p2pExports
        .resetP2P()
        .then((res) => {
          clearTimeout(timer);
          if (this._promise !== promise) {
            return;
          }
          console.log('Xp2pManager: resetP2P res', res);

          if (res === 0) {
            const now = Date.now();
            console.log('resetP2P delay', now - start);
            const localPeername = p2pExports.getLocalXp2pInfo();
            console.log('localPeername', localPeername);
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
    return p2pExports.stopServiceById(targetId);
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
    return p2pExports.startP2PStream(targetId, { flv, dataCallback });
  }

  stopStream(targetId) {
    console.log('Xp2pManager: stopStream', targetId);
    return p2pExports.stopP2PStream(targetId);
  }

  startVoice(targetId, options, callbacks) {
    console.log('Xp2pManager: startVoice', targetId, options);

    return new Promise((resolve, reject) => {
      this._checkRecordAuthorize()
        .then((result) => {
          console.log('checkRecordAuthorize res', result);

          // 语音对讲需要recorderManager
          const recorderManager = wx.getRecorderManager();

          p2pExports
            .startVoiceService(targetId, recorderManager, options, callbacks)
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

  stopVoice(targetId) {
    console.log('Xp2pManager: stopVoice', targetId);
    return p2pExports.stopVoiceService(targetId);
  }

  sendCommand(targetId, command) {
    console.log('Xp2pManager: sendCommand', targetId, command);
    return p2pExports.sendCommand(targetId, command);
  }

  // 内部信令，参考 https://cloud.tencent.com/document/product/1131/61744
  sendInnerCommand(targetId, { channel, cmd, params }) {
    console.log('Xp2pManager: sendInnerCommand', targetId, channel, cmd, params);

    let cmdStr = `action=inner_define&channel=${channel || 0}&cmd=${cmd}`;
    if (params) {
      for (const key in params) {
        cmdStr += `&${key}=${encodeURIComponent(params[key])}`;
      }
    }

    return new Promise((resolve, reject) => {
      this.sendCommand(targetId, cmdStr)
        .then((res) => {
          if (res.type === 'success') {
            console.log(`sendInnerCommand success, length: ${res.data.length}\n`, res.data);
            resolve(parseCommandResData(res.data));
            return;
          }

          reject(res.errmsg || `发送信令失败：${res.status} ${res.errcode}`);
        })
        .catch((error) => {
          reject(`发送信令失败：${error}`);
        });
    });
  }

  // 用户自定义信令
  sendUserCommand(targetId, { channel, cmd }) {
    console.log('Xp2pManager: sendUserCommand', targetId, channel, cmd);

    this._msgSeq++;
    const cmdObj = { ...cmd, message_id: this._msgSeq };

    return new Promise((resolve, reject) => {
      this.sendCommand(targetId, `action=user_define&channel=${channel || 0}&cmd=${JSON.stringify(cmdObj)}`)
        .then((res) => {
          if (res.type === 'success') {
            console.log(`sendUserCommand success, length: ${res.data.length}\n`, res.data);
            resolve(parseCommandResData(res.data));
            return;
          }

          reject(res.errmsg || `发送信令失败：${res.status} ${res.errcode}`);
        })
        .catch((error) => {
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

  _checkRecordAuthorize() {
    return new Promise((resolve, reject) => {
      wx.getSetting({
        success(res) {
          console.log('wx.getSetting res', res);
          if (!res.authSetting['scope.record']) {
            wx.authorize({
              scope: 'scope.record',
              success() {
                // 用户已经同意小程序使用录音功能，后续调用 wx.startRecord 接口不会弹窗询问
                resolve(0);
              },
              fail() {
                reject(Xp2pManagerErrorEnum.NoAuth);
              },
            });
          } else {
            resolve(0);
          }
        },
      });
    });
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

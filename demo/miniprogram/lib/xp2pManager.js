/* eslint-disable camelcase, @typescript-eslint/naming-convention */
import config from '../config/config';
import { checkAuthorize } from '../utils';

// 覆盖 console
const app = getApp();
const oriConsole = app.console;
const console = app.logger || oriConsole;

// ts才能用enum，先这么处理吧
export const Xp2pManagerErrorEnum = {
  NoPlugin: -1,
  ParamError: -2,
  ModuleNotInited: -3,
  Timeout: -4,
  NoAuth: -5,
};

const { appParams } = config;

const p2pTimeout = 10000;

let p2pExports;
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
    return playerPlugin?.Version;
  }

  get XP2PVersion() {
    return p2pExports.XP2PVersion;
  }

  get XP2PLocalEventEnum() {
    return p2pExports.XP2PLocalEventEnum;
  }

  get XP2PServiceEventEnum() {
    return p2pExports.XP2PServiceEventEnum;
  }

  get XP2PEventEnum() {
    return p2pExports.XP2PEventEnum;
  }

  get XP2PNotify_SubType() {
    return p2pExports.XP2PNotify_SubType;
  }

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

  get localPeername2() {
    return this._localPeername2;
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

    if (!p2pExports) {
      const xp2pPlugin = requirePlugin('xp2p');
      p2pExports = xp2pPlugin.p2p;

      oriConsole.log('p2pExports', p2pExports.XP2PVersion, p2pExports);
      // p2pExports.enableHttpLog(true);
      // p2pExports.enableNetLog(true);
      // p2pExports.enableXNTPLog(true);
      // p2pExports.enableADP2PLog(true); // 1v多log
      p2pExports.enableAPP_P2PLog(true); // IoT应用层log
    }
    console.log('Xp2pManager: XP2PVersion', this.XP2PVersion);

    if (!playerPlugin) {
      playerPlugin = requirePlugin('wechat-p2p-player');

      oriConsole.log('playerPlugin', playerPlugin);
      // playerPlugin.enableHttpLog(true);
      // playerPlugin.enableRtmpLog(true);
      playerPlugin.initHttp && playerPlugin.initHttp({
        errorCallback: this._localHttpErrorHandler.bind(this),
      });
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
      return p2pExports.getPluginInfo && p2pExports.getPluginInfo();
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

      Promise.all([
        p2pExports
          .init({
            appParams,
            initParams: {
              deviceP2PVersion: p2pExports.DeviceVersion.Device_2_3,
              eventHandler: this._eventHandler.bind(this), // 需要xp2p插件1.1.1以上版本
            },
          })
          .then((singleRes) => {
            console.log('Xp2pManager: init 2.3 delay', Date.now() - start);
            return singleRes;
          }),
        p2pExports
          .init({
            appParams,
            initParams: {
              deviceP2PVersion: p2pExports.DeviceVersion.Device_2_4,
              eventHandler: this._eventHandler.bind(this), // 需要xp2p插件1.1.1以上版本
            },
          })
          .then((singleRes) => {
            console.log('Xp2pManager: init 2.4 delay', Date.now() - start);
            return singleRes;
          }),
      ])
        .then((res) => {
          clearTimeout(timer);
          if (this._promise !== promise) {
            return;
          }
          console.log('Xp2pManager: init delay', Date.now() - start);

          this._state = 'inited';
          this._localPeername = res[0].localXp2pInfo;
          this._localPeername2 = res[1].localXp2pInfo;
          this._promise = null;
          console.log('Xp2pManager: init res', this._localPeername, this._localPeername2);

          return resolve(0);
        })
        .catch((err) => {
          clearTimeout(timer);
          if (this._promise !== promise) {
            return;
          }
          console.error('Xp2pManager: init error', err);

          this._resetXP2PData();
          return reject(err);
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

      Promise.all([
        p2pExports
          .getModule(p2pExports.DeviceVersion.Device_2_3)
          .reset()
          .then((singleRes) => {
            console.log('Xp2pManager: reset 2.3 delay', Date.now() - start);
            return singleRes;
          }),
        p2pExports
          .getModule(p2pExports.DeviceVersion.Device_2_4)
          .reset()
          .then((singleRes) => {
            console.log('Xp2pManager: reset 2.4 delay', Date.now() - start);
            return singleRes;
          }),
      ])
        .then((res) => {
          clearTimeout(timer);
          if (this._promise !== promise) {
            return;
          }
          console.log('Xp2pManager: resetP2P delay', Date.now() - start);

          this._state = 'inited';
          this._localPeername = res[0].localXp2pInfo;
          this._localPeername2 = res[1].localXp2pInfo;
          this._promise = null;
          console.log('Xp2pManager: resetP2P res', this._localPeername, this._localPeername2);

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
    console.log('Xp2pManager: startP2PService', targetId, streamInfo);
    return p2pExports.startP2PService(targetId, streamInfo, callbacks);
  }

  stopP2PService(targetId) {
    console.log('Xp2pManager: stopP2PService', targetId);
    return p2pExports.stopP2PService(targetId);
  }

  getServiceInitInfo(targetId) {
    return p2pExports.getServiceInitInfo(targetId);
  }

  startStream(targetId, { flv, msgCallback, dataCallback }) {
    console.log('Xp2pManager: startStream', targetId, flv);
    return p2pExports.startStream(targetId, { flv, msgCallback, dataCallback });
  }

  stopStream(targetId, streamType) {
    console.log('Xp2pManager: stopStream', targetId, streamType);
    return p2pExports.stopStream(targetId, streamType);
  }

  startVoice(targetId, options, callbacks) {
    console.log('Xp2pManager: startVoice', targetId, options);

    return new Promise((resolve, reject) => {
      this.checkRecordAuthorize()
        .then(() => {
          console.log('checkRecordAuthorize success');

          // 语音对讲需要recorderManager
          const recorderManager = wx.getRecorderManager();

          console.log('Xp2pManager: do startVoice', targetId, options);
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

  _localHttpErrorHandler(err) {
    console.log('Xp2pManager: _localHttpErrorHandler', err);
    const timestamp = Date.now();
    if (err?.errNum === 53) {
      // ios 退后台一段时间后，如果没有网络传输，系统会中断网络服务，xp2p插件未通知出来，player插件能通过 TCPServer 检测到，errNum 53
      if (this._appHideTimestamp) {
        console.log(`Xp2pManager: http errNum ${err?.errNum} after appHide ${timestamp - this._appHideTimestamp}`);
      }
      // 仅记录，再次触发播放时会reset
      this._networkChanged = { detail: err, timestamp };
    }
  }

  checkRecordAuthorize() {
    return checkAuthorize('scope.record');
  }
}

let xp2pManager = null;
export const getXp2pManager = () => {
  if (!xp2pManager) {
    xp2pManager = new Xp2pManager();

    console.log('Xp2pManager: pre initModule');
    xp2pManager.initModule();

    // uuid不用等init结果
    console.log('Xp2pManager: uuid', xp2pManager.uuid);
  }
  return xp2pManager;
};

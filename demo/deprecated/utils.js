/* eslint-disable camelcase, @typescript-eslint/naming-convention */
import config from './config/config';

export function compareVersion(ver1, ver2) {
  const v1 = ver1.split('.');
  const v2 = ver2.split('.');
  const len = Math.max(v1.length, v2.length);

  while (v1.length < len) {
    v1.push('0');
  }
  while (v2.length < len) {
    v2.push('0');
  }

  for (let i = 0; i < len; i++) {
    const num1 = parseInt(v1[i]);
    const num2 = parseInt(v2[i]);

    if (num1 > num2) {
      return 1;
    } else if (num1 < num2) {
      return -1;
    }
  }

  return 0;
}

export const sysInfo = wx.getSystemInfoSync();
export const isDevTools = sysInfo.platform === 'devtools';
export const canUseP2PIPCMode = compareVersion(sysInfo.SDKVersion, '2.19.3') >= 0;
export const canUseP2PServerMode = compareVersion(sysInfo.SDKVersion, '2.20.2') >= 0;

export const getParamValue = (params, key) => {
  const reg = new RegExp(`(^|\\?|&)${key}=([^&]*)(&|$)`);
  const result = params.match(reg);
  if (result) {
    return decodeURIComponent(result[2]);
  }
  return null;
};

function pad(v, l) {
  let val = String(v);
  const len = l || 2;
  while (val.length < len) {
    val = `0${val}`;
  }
  return val;
}
export const toDateString = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
export const toTimeString = (date) => `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
export const toTimeMsString = (date) => `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}:${pad(date.getMilliseconds(), 3)}`;
export const toDateTimeString = (date) => `${toDateString(date)} ${toTimeString(date)}`;
export const toDateTimeMsString = (date) => `${toDateString(date)} ${toTimeMsString(date)}`;
export const toDateTimeFilename = (date) => `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;

export const isPeername = (xp2pInfo) => /^\w+$/.test(xp2pInfo) && !/^XP2P/.test(xp2pInfo);

// 兼容直接填 peername 的情况
export const adjustXp2pInfo = (xp2pInfo) => (isPeername(xp2pInfo) ? `XP2P${xp2pInfo}` : xp2pInfo);

const deviceFlagNameMap = {
  m: 'mjpg', // 图片流
};
export const getDeviceFlags = (xp2pInfo) => {
  const tmp = xp2pInfo?.split('%') || [];
  const chs = (tmp[1] || '').replace(/^[\d.]+/, '').split('');
  const flags = {};
  chs.forEach((ch) => {
    const flagName = deviceFlagNameMap[ch];
    if (flagName) {
      flags[flagName] = true;
    }
  });
  return flags;
};

export const getPlayerProperties = (cfg, opts) => {
  const cfgData = cfg && config.totalData[cfg];
  if (!cfgData) {
    return null;
  }

  let flvFile = '';
  let mjpgFile = '';
  let flvUrl = '';
  if (cfgData.p2pMode === 'ipc') {
    flvFile = `ipc.flv?${cfgData.liveParams}`;
    mjpgFile = `ipc.flv?${cfgData.liveMjpgParams}`;
  } else {
    flvUrl = cfgData.flvUrl;
  }

  return {
    p2pMode: cfgData.p2pMode,
    targetId: cfgData.targetId,
    productId: cfgData.productId || '',
    deviceName: cfgData.deviceName || '',
    xp2pInfo: adjustXp2pInfo(cfgData.xp2pInfo || cfgData.peername || ''), // 兼容直接填 peername 的情况
    liveStreamDomain: cfgData.liveStreamDomain || '',
    sceneType: 'live',
    flvFile: flvFile || '',
    mjpgFile: mjpgFile || '',
    codeUrl: cfgData.codeUrl || '',
    flvUrl: flvUrl || '',
    options: cfgData.options,
    onlyp2pMap: {
      flv: isDevTools,
      mjpg: isDevTools,
    },
    onlyp2p: isDevTools,
    ...opts,
  };
};

export const checkAuthorize = (scope) =>
  new Promise((resolve, reject) => {
    wx.getSetting({
      success(res) {
        if (!res.authSetting[scope]) {
          wx.authorize({
            scope,
            success() {
              resolve();
            },
            fail(err) {
              reject(err);
            },
          });
        } else {
          resolve();
        }
      },
    });
  });

export function stringToUint8Array(str) {
  const encodedString = unescape(encodeURIComponent(str || ''));
  const unit8Arr = [];
  const len = encodedString.length;
  for (let i = 0; i < len; i++) {
    unit8Arr.push(encodedString.charAt(i).charCodeAt(0));
  }
  return new Uint8Array(unit8Arr);
}

export function stringToArrayBuffer(str) {
  return stringToUint8Array(str).buffer;
}

export function uint8ArrayToString(unit8Arr) {
  const encodedString = String.fromCharCode.apply(null, unit8Arr);
  const decodedString = decodeURIComponent(encodeURIComponent(encodedString));
  return decodedString;
}

export function arrayBufferToString(buffer, offset = undefined, len = undefined) {
  return uint8ArrayToString(new Uint8Array(buffer, offset, len));
}

export function arrayBufferToHex(input, offset, len, separator) {
  const uint8Arr = new Uint8Array(input, offset, len);
  const arr = [];
  let ch;
  uint8Arr.forEach(v => {
    ch = v.toString(16).toUpperCase();
    if (ch.length === 1) {
      ch = `0${ch}`;
    }
    arr.push(ch);
  });
  return arr.join(separator || '');
}

export async function snapshotAndSave({ snapshot }) {
  // 先检查权限
  try {
    await checkAuthorize('scope.writePhotosAlbum');
  } catch (err) {
    console.log('snapshot checkAuthorize fail', err);
    const modalRes = await wx.showModal({
      title: '',
      content: '拍照需要您授权小程序访问相册',
      confirmText: '去授权',
    });
    if (modalRes.confirm) {
      wx.openSetting();
    }
    return;
  }

  let timer;
  const endSnapshot = (params) => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    wx.hideLoading();
    wx.showModal({ showCancel: false, ...params });
  };

  timer = setTimeout(() => {
    console.error('snapshot timeout');
    endSnapshot({
      title: '拍照超时',
    });
  }, 5000);

  wx.showLoading({
    title: '拍照中',
  });

  console.log('do snapshot');
  let snapshotRes = null;
  try {
    snapshotRes = await snapshot();
    console.log('snapshot success', snapshotRes);
  } catch (err) {
    console.error('snapshot fail', err);
    endSnapshot({
      title: '拍照失败',
      content: err.errMsg,
    });
    return;
  }

  console.log('do saveImageToPhotosAlbum');
  try {
    const saveRes = await wx.saveImageToPhotosAlbum({
      filePath: snapshotRes.tempImagePath,
    });
    console.log('saveImageToPhotosAlbum success', saveRes);
    endSnapshot({
      isSuccess: true,
      title: '已保存到相册',
    });
  } catch (err) {
    console.log('saveImageToPhotosAlbum fail', err);
    endSnapshot({
      title: '保存到相册失败',
      content: ~err.errMsg.indexOf('auth deny') ? '请授权小程序访问相册' : err.errMsg,
    });
  }
}

console.log('zzzzz: ', { wx, uni, sys: wx.getSystemInfoSync() });


export const sysInfo = wx.getSystemInfoSync() || {};
export const isDevTool = sysInfo.platform === 'devtools';

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

export const getParamValue = (params, key) => {
  const reg = new RegExp(`(^|\\?|&)${key}=([^&]*)(&|$)`);
  const result = params.match(reg);
  if (result) {
    return decodeURIComponent(result[2]);
  }
  return null;
};

export function pad(v, l = 2) {
  let val = String(v);
  const len = l || 2;
  while (val.length < len) {
    val = `0${val}`;
  }
  return val;
}
export const toMonthString = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
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

export const checkAndAuthorize = (scope) =>
  new Promise((resolve, reject) => {
    wx.getSetting({
      success(res) {
        console.log(`checkAndAuthorize ${scope}, wx.getSetting success`, res);
        if (!res.authSetting[scope]) {
          wx.authorize({
            scope,
            success() {
              console.log(`wx.authorize ${scope} success`);
              resolve({ errMsg: 'success' });
            },
            fail(err) {
              console.error(`wx.authorize ${scope} fail`, err);
              reject(err);
            },
          });
        } else {
          resolve({ errMsg: 'success' });
        }
      },
      fail: (err) => {
        console.error(`checkAndAuthorize ${scope}, wx.getSetting fail`, err);
        reject(err);
      },
    });
  });

export function stringToUint8Array(str) {
  const encodedString = unescape(encodeURIComponent(str || ''));
  const unit8Arr: any[] = [];
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
  const arr: any[] = [];
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

const userIdKey = 'userId';
// demo 随机生成一个userId，正式小程序请使用自己用户系统的用户id
export const getUserId = () => {
  let userId = wx.getStorageSync(userIdKey);
  if (userId) {
    return userId;
  }
  const accountInfo = wx.getAccountInfoSync();
  userId = `demo_${accountInfo.miniProgram.appId}_${pad(Math.floor(Math.random() * 10000), 4)}`;
  wx.setStorageSync(userIdKey, userId);
  return userId;
};

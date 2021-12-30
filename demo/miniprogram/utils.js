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

const sysInfo = wx.getSystemInfoSync();
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
export const toDateTimeString = (date) => `${toDateString(date)} ${toTimeString(date)}`;

export const isPeername = (xp2pInfo) => /^\w+$/.test(xp2pInfo) && !/^XP2P/.test(xp2pInfo);

// 兼容直接填 peername 的情况
export const adjustXp2pInfo = (xp2pInfo) => (isPeername(xp2pInfo) ? `XP2P${xp2pInfo}` : xp2pInfo);

export const getPlayerProperties = (cfg, opts) => {
  const cfgData = cfg && config.totalData[cfg];
  if (!cfgData) {
    return null;
  }

  let flvUrl = '';
  if (cfgData.mode === 'ipc') {
    flvUrl = `http://XP2P_INFO.xnet/ipc.p2p.com/ipc.flv?${cfgData.liveParams}`;
  } else {
    flvUrl = cfgData.flvUrl;
  }

  return {
    mode: cfgData.mode,
    targetId: cfgData.targetId,
    flvUrl: flvUrl || '',
    productId: cfgData.productId || '',
    deviceName: cfgData.deviceName || '',
    xp2pInfo: adjustXp2pInfo(cfgData.xp2pInfo || cfgData.peername || ''), // 兼容直接填 peername 的情况
    codeUrl: cfgData.codeUrl || '',
    ...opts,
  };
};

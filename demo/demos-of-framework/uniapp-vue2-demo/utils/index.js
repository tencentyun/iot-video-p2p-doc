export const isDevTools = () => {
  return uni.getSystemInfoSync().platform === 'devtools';
};

export const wait = (time = 1000) => new Promise(resolve => setTimeout(resolve, time));
// 控制当前页面是否打印日志
export const PAGE_SHOW_LOG = {
  live: true,
  replay: true,
  command: true,
  intercom: true,
};
export const getUserId = () => {
  return uni.getStorageSync('userId') || 'demo';
};

export function pad(v, l) {
  let val = String(v);
  const len = l || 2;
  while (val.length < len) {
    val = `0${val}`;
  }
  return val;
}
// 检查是否有权限 没则发起授权
export const checkAndAuthorize = scope =>
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
      fail: err => {
        console.error(`checkAndAuthorize ${scope}, wx.getSetting fail`, err);
        reject(err);
      },
    });
  });
export const toDateTimeFilename = date =>
  `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(
    date.getMinutes(),
  )}${pad(date.getSeconds())}`;

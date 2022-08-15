// ts才能用enum，先这么处理吧
export const PusherStateEnum = {
  PusherIdle: 'PusherIdle',
  PusherPreparing: 'PusherPreparing',
  PusherReady: 'PusherReady',
  PusherError: 'PusherError',
  LivePusherError: 'LivePusherError',
  LivePusherStateError: 'LivePusherStateError',
  LocalServerError: 'LocalServerError',
};

export const totalMsgMap = {
  [PusherStateEnum.PusherPreparing]: '正在创建Pusher...',
  [PusherStateEnum.PusherReady]: '创建Pusher成功',
  [PusherStateEnum.PusherError]: '创建Pusher失败',
  [PusherStateEnum.LivePusherError]: 'LivePusher错误',
  [PusherStateEnum.LivePusherStateError]: '推流失败',
  [PusherStateEnum.LocalServerError]: '本地RtmpServer错误',
  PusherPushing: '推流中...',
};

export const livePusherErrMsgMap = {
  10002: '对讲需要您授权小程序使用麦克风', // 用户禁止使用录音
};

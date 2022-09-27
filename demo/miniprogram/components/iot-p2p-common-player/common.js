// ts才能用enum，先这么处理吧
export const PlayerStateEnum = {
  PlayerIdle: 'PlayerIdle',
  PlayerPreparing: 'PlayerPreparing',
  PlayerReady: 'PlayerReady',
  PlayerError: 'PlayerError',
  LivePlayerError: 'LivePlayerError',
  LivePlayerStateError: 'LivePlayerStateError',
  LocalServerError: 'LocalServerError',
};

export const P2PStateEnum = {
  P2PIdle: 'P2PIdle',
  P2PUnkown: 'P2PUnkown',
  P2PLocalError: 'P2PLocalError',
  P2PLocalNATChanged: 'P2PLocalNATChanged',
  P2PIniting: 'P2PIniting',
  P2PInited: 'P2PInited',
  P2PInitError: 'P2PInitError',
  ServicePreparing: 'ServicePreparing',
  ServiceStarted: 'ServiceStarted',
  ServiceStartError: 'ServiceStartError',
  ServiceError: 'ServiceError',
};

export const StreamStateEnum = {
  StreamIdle: 'StreamIdle',
  StreamWaitPull: 'StreamWaitPull',
  StreamReceivePull: 'StreamReceivePull',
  StreamLocalServerError: 'StreamLocalServerError',
  StreamChecking: 'StreamChecking',
  StreamCheckSuccess: 'StreamCheckSuccess',
  StreamCheckError: 'StreamCheckError',
  StreamPreparing: 'StreamPreparing',
  StreamStarted: 'StreamStarted',
  StreamStartError: 'StreamStartError',
  StreamRequest: 'StreamRequest',
  StreamHeaderParsed: 'StreamHeaderParsed',
  StreamHttpStatusError: 'StreamHttpStatusError',
  StreamDataReceived: 'StreamDataReceived',
  StreamDataPause: 'StreamDataPause',
  StreamDataEnd: 'StreamDataEnd',
  StreamError: 'StreamError',
};

export const totalMsgMap = {
  [PlayerStateEnum.PlayerPreparing]: '正在创建播放器...',
  [PlayerStateEnum.PlayerReady]: '创建播放器成功',
  [PlayerStateEnum.PlayerError]: '播放器错误',
  [PlayerStateEnum.LivePlayerError]: 'LivePlayer错误',
  [PlayerStateEnum.LivePlayerStateError]: '播放失败',
  [PlayerStateEnum.LocalServerError]: '本地HttpServer错误',

  [P2PStateEnum.P2PUnkown]: 'P2PUnkown',
  [P2PStateEnum.P2PLocalError]: 'P2PLocalError',
  [P2PStateEnum.P2PLocalNATChanged]: '本地NAT发生变化',
  [P2PStateEnum.P2PIniting]: '正在初始化p2p模块...',
  [P2PStateEnum.P2PInited]: '初始化p2p模块完成',
  [P2PStateEnum.P2PInitError]: '初始化p2p模块失败',
  [P2PStateEnum.ServicePreparing]: '正在启动p2p服务...',
  [P2PStateEnum.ServiceStarted]: '启动p2p服务完成',
  [P2PStateEnum.ServiceStartError]: '启动p2p服务失败',
  [P2PStateEnum.ServiceError]: '连接失败或断开',

  [StreamStateEnum.StreamWaitPull]: '加载中...',
  [StreamStateEnum.StreamReceivePull]: '加载中...',
  [StreamStateEnum.StreamLocalServerError]: '本地HttpServer错误',
  [StreamStateEnum.StreamChecking]: '加载中...',
  [StreamStateEnum.StreamCheckSuccess]: '加载中...',
  [StreamStateEnum.StreamCheckError]: '设备正忙，请稍后重试',
  [StreamStateEnum.StreamPreparing]: '加载中...',
  [StreamStateEnum.StreamStarted]: '加载中...',
  [StreamStateEnum.StreamStartError]: '启动拉流失败',
  [StreamStateEnum.StreamRequest]: '加载中...',
  [StreamStateEnum.StreamHeaderParsed]: '加载中...',
  [StreamStateEnum.StreamHttpStatusError]: '拉流失败',
  [StreamStateEnum.StreamDataReceived]: '',
  [StreamStateEnum.StreamDataPause]: '',
  [StreamStateEnum.StreamDataEnd]: '播放中断或结束',
  [StreamStateEnum.StreamError]: '播放失败',
};

export const httpStatusErrorMsgMap = {
  404: '拉流地址错误，请检查拉流参数',
  503: '连接数过多，请稍后再试',
};

export const isStreamPlaying = (streamState) => [
  StreamStateEnum.StreamPreparing,
  StreamStateEnum.StreamStarted,
  StreamStateEnum.StreamRequest,
  StreamStateEnum.StreamHeaderParsed,
  StreamStateEnum.StreamDataReceived,
  StreamStateEnum.StreamDataPause,
].indexOf(streamState) >= 0;

export const isStreamEnd = (streamState) => streamState === StreamStateEnum.StreamDataEnd;

export const isStreamError = (streamState) => [
  StreamStateEnum.StreamLocalServerError,
  StreamStateEnum.StreamCheckError,
  StreamStateEnum.StreamStartError,
  StreamStateEnum.StreamHttpStatusError,
  StreamStateEnum.StreamError,
].indexOf(streamState) >= 0;

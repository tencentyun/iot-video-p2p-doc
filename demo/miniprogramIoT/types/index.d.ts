declare interface XP2PDeviceInfo {
  deviceId: string;
  productId: string;
  deviceName: string;
  isMjpgDevice: boolean;
}

declare interface XP2PStartIPCServiceParams {
  p2pMode: 'ipc';
  deviceInfo: XP2PDeviceInfo;
  caller: string;
  xp2pInfo?: string; // ipc模式用
  liveStreamDomain?: string; // ipc模式用，1vN向server拉流的域名. 填写代表开启1v1转1vn
}

declare interface XP2PStartServerServiceParams {
  p2pMode: 'server';
  deviceInfo: XP2PDeviceInfo;
  caller: string;
  flvUrl?: string; // server模式用
}

declare type XP2PStartServiceParams = XP2PStartIPCServiceParams | XP2PStartServerServiceParams;

declare enum XP2PManagerEvent {
  XP2P_STATE_CHANGE = 'xp2pStateChange',
  XP2P_NAT_EVENT = 'xp2pNatEvent',
  XP2P_LOCAL_HTTP_SERVER_ERROR = 'xp2pLocalHttpServerError',
  XP2P_LOCAL_RTMP_SERVER_ERROR = 'xp2pLocalRtmpServerError',
}

declare enum XP2PServiceEvent {
  SERVICE_STATE_CHANGE = 'serviceStateChange',
}

declare type XP2PEventListener = (...args) => any;

declare interface IXp2pManager {
  // 整体
  P2PPlayerVersion: string;
  XP2PVersion: string;
  uuid: string;
  moduleState: string;
  checkReset: () => void;
  addEventListener: (evtName: XP2PManagerEvent, listener: XP2PEventListener) => void;
  removeEventListener: (evtName: XP2PManagerEvent, listener: XP2PEventListener) => void;

  // p2p连接，一个设备只能有一个连接，多个页面可以共用一个连接（比如监控页和回放页），用caller区分
  startP2PService: (params: XP2PStartServiceParams) => Promise<IoTResult>;
  stopP2PService: (deviceId: string, caller: string) => void;
  addP2PServiceEventListener: (deviceId: string, evtName: XP2PServiceEvent, listener: XP2PEventListener) => void;
  removeP2PServiceEventListener: (deviceId: string, evtName: XP2PServiceEvent, listener: XP2PEventListener) => void;
  isP2PServiceStarted: (deviceId: string, params?: { xp2pInfo: string }) => boolean;
  isP2PServiceError: (deviceId: string) => boolean;

  // 拉流和对讲封装在组件里，不用另外提供接口

  // 下载，一个连接同时段只能下载一个文件
  startDownloadFile: (
    deviceId: string,
    fileInfo: { channel?: number, file_name: string; offset?: number },
    callbacks: {
      onHeadersReceived: (result: { status: number; headers: any }) => void;
      onChunkReceived: (chunk: ArrayBuffer) => void;
      onSuccess?: (res: XP2PRequestResult) => void;
      onFailure?: (res: XP2PRequestResult) => void;
      onError?: (res: XP2PRequestResult) => void;
      onComplete?: () => void;
    },
  ) => Promise<any>;
  stopDownloadFile: (deviceId: string) => void;

  // p2p信令，一个连接可以并行多个的信令
  // 如果没有特殊需求，建议调用封装过的业务信令
  sendCommand: (
    deviceId: string,
    cmdStr: string,
    options?: { responseType?: 'text' | 'arraybuffer'; addLog?: boolean },
  ) => Promise<any>;

  // 内部信令/topic风格用户信令：sendCommand + 解析json
  // 如果没有特殊需求，建议调用封装过的业务信令
  sendInnerCommand: (
    deviceId: string,
    params: { cmd: string; params?: any },
    options?: { addLog?: boolean },
  ) => Promise<any>;
  sendUserCommand: (
    deviceId: string,
    params: { cmd: { topic: string; data?: any } },
    options?: { addLog?: boolean },
  ) => Promise<any>;

  // 封装过的业务信令
  sendPTZCommand: (deviceId: string, params: { ptzCmd: string }) => Promise<{ apex?: 'yes' | 'no' }>;
  getRecordDatesInMonth: (deviceId: string, params: { month: string }) => Promise<{ date_list: number[] }>;
  getRecordVideosInDate: (deviceId: string, params: { date: string }) => Promise<{
    video_list: { start_time: number; end_time: number }[];
  }>;
  getFilesInDate: (deviceId: string, params: { date: string; type?: string }) => Promise<{
    file_list: { start_time: number; end_time: number; file_size: number }[];
  }>;
}

declare interface DeviceInfo {
  deviceId: string;
  productId: string;
  deviceName: string;
  isMjpgDevice: boolean;
}

declare type EventListener = (...args) => any;

declare enum Xp2pManagerEvent {
  XP2P_STATE_CHANGE = 'xp2pStateChange',
}

declare enum XP2PServiceEvent {
  SERVICE_STATE_CHANGE = 'serviceStateChange',
}

declare interface IXp2pManager {
  // 整体
  P2PPlayerVersion: string;
  XP2PVersion: string;
  uuid: string;
  moduleState: string;
  checkReset: () => void;
  addEventListener: (evtName: Xp2pManagerEvent, listener: EventListener) => void;
  removeEventListener: (evtName: Xp2pManagerEvent, listener: EventListener) => void;

  // p2p连接，一个设备只能有一个连接，多个页面可以共用一个连接（比如监控页和回放页），用caller区分
  startP2PService: (params: {
    p2pMode: 'ipc' | 'server';
    deviceInfo: DeviceInfo;
    caller: string;
    xp2pInfo?: string; // ipc模式用
    liveStreamDomain?: string; // ipc模式用，1vN向server拉流的域名. 填写代表开启1v1转1vn
    flvUrl?: string; // server模式用
  }) => Promise<IoTResult>;
  stopP2PService: (deviceId: string, caller: string) => void;
  addP2PServiceEventListener: (deviceId: string, evtName: XP2PServiceEvent, listener: EventListener) => void;
  removeP2PServiceEventListener: (deviceId: string, evtName: XP2PServiceEvent, listener: EventListener) => void;

  // 拉流和对讲封装在组件里，不用另外提供接口

  // 下载，一个设备同时段只能下载一个文件
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
  sendPTZCommand: (deviceId: string, params: { ptzCmd: string }) => Promise<any>;
  getRecordDatesInMonth: (deviceId: string, params: { month: string }) => Promise<{ date_list: number[] }>
  getRecordVideosInDate: (deviceId: string, params: { date: string }) => Promise<{ video_list: any[] }>
  getFilesInDate: (deviceId: string, params: { date: string; type?: string }) => Promise<{ file_list: any[] }>
}

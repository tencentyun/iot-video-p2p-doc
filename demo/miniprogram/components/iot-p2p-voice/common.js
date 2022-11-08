// ts才能用enum，先这么处理吧
export const VoiceTypeEnum = {
  Recorder: 'Recorder',
  Pusher: 'Pusher',
  DuplexAudio: 'DuplexAudio',
  DuplexVideo: 'DuplexVideo',
};

export const VoiceOpEnum = {
  None: 'none',
  Mute: 'mute',
  Pause: 'pause',
};

export const voiceConfigMap = {
  [VoiceTypeEnum.Recorder]: {
    needPusher: false,
    needDuplex: false,
    voiceOp: VoiceOpEnum.Mute,
    options: {
      numberOfChannels: 1, // 录音通道数
      sampleRate: 8000, // 采样率
      encodeBitRate: 16000, // 编码码率
    },
  },
  [VoiceTypeEnum.Pusher]: {
    needPusher: true,
    needDuplex: false,
  },
  [VoiceTypeEnum.DuplexAudio]: {
    needPusher: true,
    needDuplex: true,
    options: { urlParams: 'calltype=audio' },
  },
  [VoiceTypeEnum.DuplexVideo]: {
    needPusher: true,
    needDuplex: true,
    options: { urlParams: 'calltype=video' },
  },
};

export const VoiceStateEnum = {
  creating: 'creating', // 创建pusher
  authChecking: 'authChecking', // 检查权限
  deviceChecking: 'deviceChecking', // 检查设备状态
  preparing: 'preparing', // 发起voice请求
  starting: 'starting', // 启动pusher
  sending: 'sending', // 发送语音数据(包括等待pusher推流)
  error: 'error',
};

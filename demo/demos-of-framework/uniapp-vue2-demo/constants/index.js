// 视频对讲水位
export const intercomP2PWaterMark = {
  low: 0,
  high: 500 * 1024, // 高水位字节数，可根据码率和可接受延迟自行调整
};
// 视频对讲水位码率，默认高码率，需要流控用低码率
export const intercomBirateMap = {
  low: {
    fps: 10,
    minBitrate: 200,
    maxBitrate: 400,
  },
  high: {
    fps: 15,
    minBitrate: 200,
    maxBitrate: 600,
  },
};
// flv 录制配置
export const recordFlvOptions = {
  maxFileSize: 100 * 1024 * 1024, // 单个flv文件的最大字节数，默认 100 * 1024 * 1024
  needAutoStartNextIfFull: false, // 当文件大小达到 maxFileSize 时，是否自动开始下一个文件，但是中间可能会丢失一部分数据，默认 false
  needSaveToAlbum: true, // 是否保存到相册，设为 true 时插件内实现转mp4再保存，默认 false
  needKeepFile: wx.getAccountInfoSync().miniProgram.envVersion === 'develop', // 是否保留flv文件，设为 true 时需要自行清理文件，默认 false
  showLog: true,
};

export const DEFAULT_DEVICE_INFO = {
  productId: "XOCLFIHUCU",
  deviceName: "feedback_eric01",
  deviceId: "2QV6H3EMGH/d1",
  xp2pInfo: "XP2PTmt7R2EZy5UEOjpibOoMtw==%2.4.43"
}
// 画面方向
export const ORIENTATION_MAP = {
  vertical: "竖直",
  horizontal: "	水平"
}
export const orientationOptions = Object.entries(ORIENTATION_MAP).map(([key, value]) => ({
  label: value,
  value: key,
  name: value
}))
// 填充方式
export const OBJECT_FIT_ENUM = {
  contain: "填充",
  fillCrop: "铺满"
}
export const objectFitOptions = Object.entries(OBJECT_FIT_ENUM).map(([key, value]) => ({
  label: value,
  value: key,
  name: value
}))

export const DEFINEITION_MAP = {
  standard: "标清",
  high: "高清",
  super: "超清",
}
export const definitionOptions = Object.entries(DEFINEITION_MAP).map(([key, value]) => ({
  label: value,
  value: key,
  name: value
}))

export const INTERCOM_MODE_MAP = {
  voice: '语音',
  intercom: "视频"
}
export const intercomModeOptions = Object.entries(INTERCOM_MODE_MAP).map(([key, value]) => ({
  label: value,
  value: key,
  name: value
}))


// 视频通话信令
export const INTERCOM_COMMAND_ENUM = {
  call_answer: "call_answer", // 接听
  call_timeout: "call_timeout", // 呼叫超时
  call_hang_up: "call_hang_up", // 挂断
  call_reject: "call_reject", // 拒绝接听
  call_busy: "call_busy", // 忙线
  call_cancel: "call_cancel", // 设备端取消
}
export const INTERCOM_COMMAND_MAP = {
  [INTERCOM_COMMAND_ENUM.call_answer]: "接听",
  [INTERCOM_COMMAND_ENUM.call_timeout]: "呼叫超时",
  [INTERCOM_COMMAND_ENUM.call_hang_up]: "挂断",
  [INTERCOM_COMMAND_ENUM.call_reject]: "拒绝接听",
  [INTERCOM_COMMAND_ENUM.call_busy]: "忙线",
  [INTERCOM_COMMAND_ENUM.call_cancel]: "设备端取消",
}


// 最大写入block量
export const WRITE_BLOCK_SIZE = 1 * 1024 * 1024 // 1M
// 最大文件下载量
export const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50M
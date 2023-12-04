import { toDateString, toDateTimeFilename, toDateTimeMsString } from '../utils';
import { XP2P_BASE_DIR } from './recordManager';

const fileSystem = wx.getFileSystemManager();
const logBaseDir = `${XP2P_BASE_DIR}/logs`;
const maxLogFileNum = 50;

const formatItem = (v) => {
  const type = typeof v;
  if (type === 'string') {
    return v;
  }
  if (type === 'object' && v instanceof Error) {
    return v.stack;
  }
  return JSON.stringify(v, null, 2);
};

export class Logger {
  constructor({ logManagePage } = {}) {
    if (!logManagePage) {
      throw 'please set logManagePage';
    }
    this.logManagePage = logManagePage;
    this.createLogFile();
  }

  reset(reason = 'reset') {
    this.createLogFile(reason);
  }

  log(...data) {
    console.log(...data);
    this.writeLogFile('[LOG]', ...data);
  }

  info(...data) {
    console.info(...data);
    this.writeLogFile('[INFO]', ...data);
  }

  warn(...data) {
    console.warn(...data);
    this.writeLogFile('[WARN]', ...data);
  }

  error(...data) {
    console.error(...data);
    this.writeLogFile('[ERROR]', ...data);
  }

  createLogFile(reason = 'create') {
    const lastLogDate = wx.getStorageSync('iot-log-date');
    const today = toDateString(new Date());
    if (lastLogDate && today !== lastLogDate) {
      // 有之前log，删掉，只保留当天的
      try {
        fileSystem.rmdirSync(logBaseDir, true);
      } catch (err) {
        console.error('logger: rmdirSync error', err);
      }
    }
    wx.setStorageSync('iot-log-date', today);

    try {
      fileSystem.accessSync(logBaseDir);
    } catch (err) {
      if (~err.message.indexOf('fail no such file or directory')) {
        fileSystem.mkdirSync(logBaseDir, true);
      }
    }

    const date = new Date();
    const logFileName = `demolog-${toDateTimeFilename(date)}.log`;
    this.logFilePath = `${logBaseDir}/${logFileName}`;
    console.log('logger: logFilePath', this.logFilePath);

    try {
      fileSystem.writeFileSync(this.logFilePath, `${logFileName}\n${toDateTimeMsString(date)} ---- ${reason}\n`, 'utf-8');
      this.canWrite = true;
    } catch (err) {
      console.error('logger: writeFileSync error', err);
      this.canWrite = false;
    }

    const systemInfo = wx.getSystemInfoSync();
    this.log('SystemInfo', {
      Brand: systemInfo.brand,
      Model: systemInfo.model,
      System: systemInfo.system,
      Platform: systemInfo.platform,
      WXVer: systemInfo.version,
      WXSdkVer: systemInfo.SDKVersion,
    });
    const { miniProgram } = wx.getAccountInfoSync();
    this.log('MPAccountInfo', {
      MPAppId: miniProgram.appId,
      MPEnvVersion: miniProgram.envVersion,
      MPVersion: miniProgram.version,
    });

    this.checkLogFiles();
  }

  writeLogFile(...data) {
    if (!this.canWrite) {
      return;
    }
    try {
      const log = `${[toDateTimeMsString(new Date()), '----', ...data.map(v => formatItem(v))].join(' ')}\n`;
      fileSystem.appendFileSync(this.logFilePath, log, 'utf-8');
    } catch (err) {}
  }

  async checkLogFiles() {
    try {
      const files = fileSystem.readdirSync(logBaseDir);
      console.log('logger: log file number', files.length);
      if (files.length > maxLogFileNum) {
        // 一天只提醒1次
        const lastRemindDate = wx.getStorageSync('iot-remind-clear-logs');
        const today = toDateString(new Date());
        if (today === lastRemindDate) {
          return;
        }
        wx.setStorageSync('iot-remind-clear-logs', today);

        const modalRes = await wx.showModal({
          title: 'log过多，是否前往清理？',
        });
        if (!modalRes || !modalRes.confirm) {
          return;
        }
        wx.navigateTo({
          url: this.logManagePage,
        });
      }
    } catch (err) {}
  }
}

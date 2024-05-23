import { Logger } from './lib/logger';
import { getUserId, compareVersion } from './utils';

App({
  onLaunch(options) {
    this.console = console;
    console.warn('【注意】开启 Logger 会影响运行性能，请避免频繁写入');
    this.logger = new Logger({
      logManagePage: '/pages/user-files/files?name=logs',
    });
    this.pluginLogger = {
      log: (...args) => this.logger.log('[Plugin]', ...args),
      info: (...args) => this.logger.info('[Plugin]', ...args),
      warn: (...args) => this.logger.warn('[Plugin]', ...args),
      error: (...args) => this.logger.error('[Plugin]', ...args),
    };

    this.logger.log('App: onLaunch', options);

    this.userId = getUserId();
    this.logger.log('App: userId', this.userId);
  },
  onShow(options) {
    this.logger.log('App: onShow', options);
  },
  onHide() {
    this.logger.log('App: onHide');
  },
  restart() {
    if (compareVersion(wx.getSystemInfoSync().SDKVersion, '3.0.1') >= 0) {
      wx.restartMiniProgram({
        path: '/pages/index/index',
      });
    } else {
      wx.exitMiniProgram({
        fail: (err) => {
          console.error('exitMiniProgram fail', err);
        },
      });
    }
  },
});

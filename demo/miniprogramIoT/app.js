import { Logger } from './lib/logger';

App({
  onLaunch() {
    console.log('App: onLaunch');

    this.console = console;
    if (wx.getAccountInfoSync().miniProgram.envVersion === 'develop') {
      console.error('【注意】开启 Logger 会影响运行性能，请避免频繁写入');
      this.logger = new Logger({
        logManagePage: '/pages/user-files/files?name=logs',
      });
      this.pluginLogger = {
        log: (...args) => this.logger.log('[Plugin]', ...args),
        info: (...args) => this.logger.info('[Plugin]', ...args),
        warn: (...args) => this.logger.warn('[Plugin]', ...args),
        error: (...args) => this.logger.error('[Plugin]', ...args),
      };
    }

    this.pluginReporter = {
      reportInfo: (evtName, params) => console.log('reportInfo', evtName, params),
      reportWarn: (evtName, params) => console.log('reportWarn', evtName, params),
      reportError: (evtName, params) => console.log('reportError', evtName, params),
    };
  },
});

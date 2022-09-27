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
  },

  preInitP2P() {
    if (this.xp2pManager) {
      // 已经加载过了
      this.logger.log('app: preload xp2pManager, already has xp2pManager');
      return Promise.resolve(this.xp2pManager);
    }

    return new Promise((resolve, reject) => {
      this.logger.log('app: preload xp2pManager');
      require.async('./libs/xp2pManager.js').then(pkg => {
        this.logger.log(`app: preload xp2pManager success, now xp2pManager ${!!this.xp2pManager}`);
        resolve(this.xp2pManager);
      }).catch(({mod, errMsg}) => {
        this.logger.error(`app: preload xp2pManager fail, path: ${mod}, ${errMsg}`);
        reject({mod, errMsg});
      });
    });
  },
});

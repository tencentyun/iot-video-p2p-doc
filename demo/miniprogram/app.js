import { Logger } from './lib/logger';

App({
  onLaunch() {
    console.log('App: onLaunch');

    this.console = console;
    if (wx.getAccountInfoSync().miniProgram.envVersion === 'develop') {
      console.error('【注意】开启 Logger 会影响运行性能，请避免频繁写入');
      this.logger = new Logger({
        logManagePage: '/pages/xp2p-records/records?name=logs',
      });
    }
  },
});

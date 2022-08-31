import { Logger } from './lib/logger';

App({
  onLaunch() {
    console.log('App: onLaunch');

    this.console = console;
    this.logger = new Logger({
      logManagePage: '/pages/xp2p-records/records?name=logs',
    });
  },
});

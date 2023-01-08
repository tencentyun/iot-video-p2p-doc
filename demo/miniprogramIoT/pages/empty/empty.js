// 覆盖 console
const app = getApp();
const oriConsole = app.console;
const console = app.logger || oriConsole;

Page({
  onLoad(query) {
    console.log('empty: onLoad', query);
  },
  onUnload() {
    console.log('empty: onUnload');
  },
});

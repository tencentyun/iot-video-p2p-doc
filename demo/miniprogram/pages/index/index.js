import devices from '../../config/devices';
import { getXp2pManager } from '../../xp2pManager';

const xp2pManager = getXp2pManager();

Page({
  data: {
    // 这些控制p2p的
    controlId: 'iot-p2p-main-control',
    p2pControl: null,
    dirty: false,

    // 这些是监控页入口
    listBtn: [],
    listNav: [],
  },
  onLoad() {
    const p2pControl = this.selectComponent(`#${this.data.controlId}`);
    this.setData({ p2pControl });

    const listBtn = [];
    const listNav = [];
    for (const key in devices) {
      const item = devices[key];
      const navItem = {
        mode: 'ipc',
        cfg: key,
        ...item,
      };
      item.showInHomePageBtn && listBtn.push(navItem);
      item.showInHomePageNav && listNav.push(navItem);
    }
    this.setData({ listBtn, listNav });
  },
  onUnload() {},
  onShow() {
    // 再显示时同步一下状态，应该用事件通知，先简单处理吧
    if (!this.data.dirty || !this.data.p2pControl) {
      return;
    }
    this.data.p2pControl.refreshState();
    this.setData({ dirty: false });

    if (xp2pManager.networkChanged) {
      console.log('index: networkChanged, resetP2P');
      this.data.p2pControl.resetP2P();
    }
  },
  onHide() {
    this.setData({ dirty: true });
  },
  onP2PModuleStateChange({ detail }) {
    console.log('index: onP2PModuleStateChange', detail);
  },
  gotoDemoPage(e) {
    const { url } = e.currentTarget.dataset;
    wx.navigateTo({ url });
  },
});

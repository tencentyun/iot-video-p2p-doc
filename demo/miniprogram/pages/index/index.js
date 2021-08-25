import devices from '../../devices';

Page({
  data: {
    listBtn: [],
    listNav: [],
  },
  onLoad() {
    const listBtn = [];
    const listNav = [];
    for (const key in devices) {
      const item = devices[key];
      item.showInHomePageBtn &&
        listBtn.push({
          mode: 'ipc',
          cfg: key,
          ...item,
        });
      item.showInHomePageNav &&
        listNav.push({
          mode: 'ipc',
          cfg: key,
        });
    }
    this.setData({ listBtn, listNav });
  },
  onUnload() {},
  gotoDemoPage(e) {
    const { cfg } = e.currentTarget.dataset;
    wx.navigateTo({
      url: `/pages/xp2p-demo-1vN/demo?mode=${cfg}`,
    });
  },
});

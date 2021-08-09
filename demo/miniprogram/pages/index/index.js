import devices from '../../devices';

Page({
  data: {
    listBtn: [],
  },
  onLoad() {
    const listBtn = [];
    for (const key in devices) {
      const item = devices[key];
      item.showInHomePageBtn &&
        listBtn.push({
          mode: 'ipc',
          cfg: key,
          ...item,
        });
    }
    this.setData({ listBtn });
  },
  onUnload() {},
  gotoDemoPage(e) {
    const { cfg } = e.currentTarget.dataset;
    wx.navigateTo({
      url: `/pages/xp2p-demo-1vN/demo?mode=${cfg}`,
    });
  },
});

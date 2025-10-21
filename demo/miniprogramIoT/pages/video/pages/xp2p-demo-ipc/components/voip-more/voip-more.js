// components/p2p-live.js
Page({
  /**
   * 页面的初始数据
   */
  data: {
    deviceInfo: {
      deviceId: 'XOCLFIHUCU/feedback_eric01',
      productId: 'XOCLFIHUCU',
      deviceName: 'feedback_eric01',
      isMjpgDevice: false,
      xp2pInfo: 'XP2PTmt7R2EZy5UEOjpibOoMtw==%2.4.43',
      p2pMode: 'ipc',
      sceneType: 'live',
    },
    xp2pInfo: 'XP2PTmt7R2EZy5UEOjpibOoMtw==%2.4.43',
    acceptPlayerEvents: {},
    onlyp2pMap: {
      flv: false,
      mjpg: false,
    },
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(_options) {
    wx.showToast({
      title: 'p2p-live'
    });
  },

  /**
   * 生命周期函数--监听页面初次渲染完成
   */
  onReady() {},

  /**
   * 生命周期函数--监听页面显示
   */
  onShow() {},

  /**
   * 生命周期函数--监听页面隐藏
   */
  onHide() {},

  /**
   * 生命周期函数--监听页面卸载
   */
  onUnload() {},

  /**
   * 页面相关事件处理函数--监听用户下拉动作
   */
  onPullDownRefresh() {},

  /**
   * 页面上拉触底事件的处理函数
   */
  onReachBottom() {},

  /**
   * 用户点击右上角分享
   */
  onShareAppMessage() {},

  onPlayStateChange({ currentTarget: { dataset }, detail }) {
    const channel = Number(dataset.channel);
    console.log(`demo: onPlayStateChange, channel ${channel}`, detail);

    // if (
    //   detail.type === "playsuccess" &&
    //   !this.userData.hasCreateOtherComponents
    // ) {
    //   // 播放成功，创建其他组件
    //   this.createOtherComponents();
    // }
  },
});

Page({
  data: {
    sendResult: {},
    compInstance: null,
    sendResultCodeMap: {
      failure: '失败',
      error: '错误',
      success: '成功',
      timeout: '超时',
    },
  },
  onLoad() {
    wx.lin.initValidateForm(this);
  },
  async submit({ detail }) {
    const player =  this.selectComponent('#ipc-live-player');
    const { cmd, payload } = detail.values;

    const res = await player.onSendCommandSubmit(cmd, payload);
    console.log('sendResult', res);
    this.setData({
      sendResult: res,
    });
  },
});

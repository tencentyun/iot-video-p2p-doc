// components/demo-basicinfo/index.js
Component({

  /**
   * 组件的属性列表
   */
  properties: {

  },

  /**
   * 组件的初始数据
   */
  data: {

  },
  lifetimes: {
    attached() {
      this.showPolicyModal();
    },
  },

  /**
   * 组件的方法列表
   */
  methods: {
    showPolicyModal() {
      const key = 'PRIVATE_POLICY_MODAL_SHOWED';
      const value = wx.getStorageSync(key);

      if (!value) {
        wx.setStorageSync(key, true);
        wx.showModal({
          title: '隐私政策',
          content: '我们严格按照《小程序服务声明》向您提供服务，不会收集和处理您的个人信息。如您对《小程序服务声明》有任何疑问或建议，可以通过声明内的联系方式向我们反馈。',
          confirmText: '我已知晓',
          cancelText: '查看声明',
          success(res) {
            if (!res.confirm) {
              console.log('res.confirm');
              wx.navigateTo({
                url: '/pages/private-policy/private-policy',
              });
            }
          },
        });
      }
    },
    async copyDocUrl(e) {
      const { doc } = e.currentTarget.dataset;
      if (!doc) {
        return;
      }
      await wx.setClipboardData({
        data: doc,
      });
      wx.showToast({ title: '文档地址已复制到剪贴板', icon: 'none' });
    },
    gotoPage(e) {
      const { url, checkPlatform } = e.currentTarget.dataset;
      if (checkPlatform && !['ios', 'android', 'devtools'].includes(sysInfo.platform)) {
        wx.showToast({ title: `不支持当前平台: ${sysInfo.platform}`, icon: 'error' });
        return;
      }
      wx.navigateTo({ url });
    },
    openSetting() {
      wx.openSetting({
        success() { /** */ },
        fail() {
          wx.showToast({ title: '打开失败！' });
        },
      });
    },
  }
});

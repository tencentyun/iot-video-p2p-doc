
wx.cloud.init({
  env: 'cloud1-9gy10gzb2687fd99',
});
const app = getApp();
const oriConsole = app.console;
const console = app.logger || oriConsole;

const wmpfVoip = requirePlugin('wmpf-voip').default;
console.log(wmpfVoip); // 有结果即表示引入插件成功

// sn:F2TL8I8UFD-iot_100624161_1
Page({
  data: {
    snTicket: '',
    sn: '',
    modelId: 'DYEbVE9kfjAONqnWsOhXgw',
    openId: '',
    voipToken: '',

    // 新加的数据～
    deviceId: '',
  },
  onLoad(query) {
    try {
      const snTicket = wx.getStorageSync('snTicket') || '';
      const openId = wx.getStorageSync('openId') || '';
      const voipToken = wx.getStorageSync('voipToken') || '';
      const sn = wx.getStorageSync('sn') || '5379-deviceid_2';
      this.setData({
        voipToken,
        openId,
        snTicket,
        sn,
      });
      console.log('[voip.data]', this.data);
    } catch (e) {
      console.error(e);
    }
    console.log('user-files: onLoad', query);
    if (!query?.name) {
      return;
    }
  },
  bindKeyInputToken(e) {
    const voipToken = e.detail.value;
    this.setData({ voipToken });
    wx.setStorage({
      key: 'voipToken',
      data: voipToken,
    });
  },
  bindKeyInputSn(e) {
    const sn = e.detail.value;
    this.setData({ sn });
    wx.setStorage({
      key: 'sn',
      data: sn,
    });
  },
  copyData(e) {
    const { type: key } = e.currentTarget.dataset;
    const value = this.data[key];
    if (!value) return;
    wx.setClipboardData({ data: value });
  },
  async getSnTicket() {
    if (!this.data.sn) {
      wx.showToast({ title: '请先输入设备 sn' });
      return;
    }
    return new Promise((resolve) => {
      wx.cloud.callFunction({
        name: 'getSnTicket',
        data: {
          sn: this.data.sn,
        },
        complete: (res) => {
          console.log('callFunction getSnTicket req: sn = ', this.data.sn);
          console.log({
            res,
            code: res.errCode,
            Msg: res.errMsg,
          });
          console.log('callFunction getSnTicket result: ', res.result?.snTicket);
          if (!res.result?.snTicket) {
            wx.showToast({ title: `拉取失败，errCode: ${res?.errCode}`, icon: 'error' });
            resolve(false);
            return;
          }
          this.setData({
            snTicket: res.result.snTicket,
            openId: res.result.OPENID,
          });
          wx.setStorage({
            key: 'snTicket',
            data: res.result.snTicket,
          });
          wx.setStorage({
            key: 'openId',
            data: res.result.OPENID,
          });

          wx.showToast({ title: '拉取成功', icon: 'success' });
          resolve(true);
        },
      });
    });
  },

  // 获取系统授权
  async getAuth() {
    try {
      const res = await wx.getSetting();
      let hasRecord = false;
      let hasCamera = false;
      if (!res.authSetting['scope.record']) {
        await wx.authorize({
          scope: 'scope.record',
        });
      } else {
        hasRecord = true;
      }
      if (!res.authSetting['scope.camera']) {
        await wx.authorize({
          scope: 'scope.camera',
        });
      } else {
        hasCamera = true;
      }
      if (hasRecord && hasCamera) {
        wx.showToast({
          title: '已经授权record和camera权限',
          icon: 'success',
        });
      } else {
        if (hasRecord) {
          wx.showToast({
            title: '已经授权record权限',
            icon: 'success',
          });
        }
        if (hasCamera) {
          wx.showToast({
            title: '已经授权camera权限',
            icon: 'success',
          });
        }
      }
    } catch (e) {
      console.error(e);
      wx.showToast({ title: e.errMsg, icon: 'none' });
    }
  },
  // 订阅设备提醒
  async requestPermission() {
    // await this.getSnTicket();
    wx.requestDeviceVoIP({
      sn: this.data.sn, // 向用户发起通话的设备 sn，需要与 4.2 中注册设备时一致
      snTicket: this.data.snTicket, // 获取的 snTicket
      modelId: this.data.modelId, // 2.3 设备接入获取的 model_id
      deviceName: '测试设备', // 设备名称，用于授权时显示给用户看
      success(res) {
        console.log('requestDeviceVoIP success:', res);
        wx.showToast({ title: '绑定成功', icon: 'success' });
      },
      fail(err) {
        console.error('requestDeviceVoIP fail:', err);
        if (err.errCode === 10001) {
          wx.showToast({
            title: '已经绑定了',
            icon: 'error',
          });
        }
        if (err.errCode === 10008) {
          wx.showToast({
            title: 'snTicket错误',
            icon: 'error',
          });
        }
        wx.showToast({
          title: err.errMsg,
          icon: 'none',
        });
      },
    });
  },
  async waitCall() {
    // 获取 groupId
    const roomType = 'video';
    const { groupId, isSuccess } = await wmpfVoip.initByCaller({
      caller: {
        // 参见 https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/login.html 获取
        id: this.data.openId, // 接听方 用户 openId
        name: '测试设备', // 接听方名字，仅显示用
      },
      listener: {
        id: this.data.sn, // 设备 SN
      },
      roomType, // 房间类型。voice: 音频房间；video: 音视频房间
      businessType: 1, // 1 为设备拨打手机微信
      voipToken: this.data.voipToken, // 4.2 中从 voip SDK 获取的 caller_ticket
      miniprogramState: 'developer',
    });

    if (isSuccess) {
      // 跳转到插件的通话页面
      const callPagePlugin = 'plugin-private://wxf830863afde621eb/pages/call-page-plugin/call-page-plugin';
      wx.redirectTo({
        url: `${callPagePlugin}?isCaller=1&roomType=${roomType}&groupId=${groupId}`,
      });
    } else {
      wx.showToast({
        title: '播打失败',
        icon: 'error',
      });
    }
  },
  async getVoipAuth() {
    // 先获取微信授权
    await this.getAuth();

    try {
      const res = await wmpfVoip.getIotBindContactList({
        sn: this.data.sn,
        model_id: this.data.modelId,
        openid_list: [this.data.openId], // 传入需要验证的openid列表
      });
      console.log('[getIotBindContactList]:', this.data.sn, this.data.modelId, res.contact_list);
      if (res.contact_list?.[0]?.status === 1) {
        wx.showToast({
          title: '已经绑定了',
          icon: 'error',
        });
      } else {
        wx.showToast({
          title: '未绑定',
          icon: 'error',
        });
      }
    } catch (e) {
      console.error(e);
    }
  },
  async startCall() {
    const roomType = 'video';
    const { groupId, isSuccess } = await wmpfVoip.initByCaller({
      caller: {
        // 参见 https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/login.html 获取
        id: this.data.openId, // 接听方 用户 openId
        name: '测试设备', // 接听方名字，仅显示用
      },
      listener: {
        id: this.data.sn, // 设备 SN
      },
      roomType, // 房间类型。voice: 音频房间；video: 音视频房间
      businessType: 2, // 2 为手机微信拨打设备
      voipToken: this.data.voipToken, // 从设备获取的 pushToken
      miniprogramState: 'developer', // 指定接听方使用的小程序版本。formal/正式版（默认）；trial/体验版；developer/开发版
    });

    if (isSuccess) {
      // 跳转到插件的通话页面
      const callPagePlugin = 'plugin-private://wxf830863afde621eb/pages/call-page-plugin/call-page-plugin';
      wx.redirectTo({
        url: `${callPagePlugin}?isCaller=1&roomType=${roomType}&groupId=${groupId}`,
      });
    } else {
      wx.showToast({
        title: '播打失败',
        icon: 'error',
      });
    }
  },
});

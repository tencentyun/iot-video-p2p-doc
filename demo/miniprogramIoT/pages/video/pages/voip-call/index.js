import { getRandomId, getClientToken, splitByFirstUnderscore } from '../../utils/index';
import { VOIP_EVENT_STATUS } from './constant';
const pagePrefix = '[voip-call]';
const VOIP_CALL_STORAGE_KEY = 'voipCallData';
const wmpfVoip = requirePlugin('wmpf-voip').default;
// 确保voipEvent回调只绑定一次
let isBindVoipEvent = false;

wmpfVoip.setCustomBtnText('more');
wmpfVoip.setVoipEndPagePath({
  url: '/pages/index/index',
  key: 'Call',
  routeType: 'switchTab',
});

wx.cloud.init({
  env: 'cloud1-9gy10gzb2687fd99',
});
Page({
  data: {
    form: {
      // appKey: 'mDlhRpAfMtjyLCXKP',
      // appSecret: 'iKMZvmIoRIJIRevOnYXE',
      // sn: 'XOCLFIHUCU_camera_eric04',
      appKey: 'mIJZdrxRqhdtyCPkh',
      appSecret: 'MokbekSWizfAqBlGquby',
      sn: 'VR8UC23ATA_004',
      modelId: 'DYEbVE9kfjAONqnWsOhXgw',
      callType: 'video',
    },
    isCalling: false,
  },
  onInput(e) {
    const { target, detail } = e;
    this.setData({
      form: {
        ...this.data.form,
        [target.dataset.name]: detail.value,
      },
    });
  },
  onClear(e) {
    const { target } = e;
    this.setData({
      form: {
        ...this.data.form,
        [target.dataset.name]: '',
      },
    });
  },
  onCallTypeChange(e) {
    const { detail } = e;
    this.setData({
      form: {
        ...this.data.form,
        callType: detail.key,
      },
    });
  },
  async onSubmit() {
    wx.setStorageSync(VOIP_CALL_STORAGE_KEY, JSON.stringify(this.data.form));
    const { appKey, appSecret, sn, callType, modelId } = this.data.form;
    if (this.data.isCalling) {
      this.setData({ isCalling: false });
      wmpfVoip.forceHangUpVoip();
      return;
    }
    console.log(pagePrefix, 'onSubmit=> form', this.data.form);
    try {
      this.setData({ isCalling: true });
      const res = await wx.cloud.callFunction({
        name: 'getAccessToken',
        data: {
          appKey,
          appSecret,
        },
      });
      const token = res.result.token;
      console.log(pagePrefix, '调用云函数getAccessToken成功 token =>', token);
      const callDeviceParams = {
        roomType: callType,
        sn,
        modelId,
        isCloud: true,
        payload: '{}',
        nickName: 'jin的手机',
        encodeVideoFixedLength: 320,
        encodeVideoRotation: 1,
        encodeVideoRatio: 0,
        encodeVideoMaxFPS: 15,
      };
      console.log('开始呼叫callDevice params=>', callDeviceParams);
      const { roomId } = await wmpfVoip.callDevice(callDeviceParams);
      const [productId, deviceName] = splitByFirstUnderscore(sn);
      const params = {
        AccessToken: token,
        RequestId: getRandomId(),
        Action: 'AppPublishMessage',
        ProductId: productId,
        DeviceName: deviceName,
        Topic: `$twecall/down/service/${productId}/${deviceName}`,
        Payload: JSON.stringify({
          version: '1.0',
          method: 'voip_join',
          clientToken: getClientToken(),
          timestamp: Math.floor(Date.now() / 1000),
          params: {
            roomId,
          },
        }),
      };
      // 同步voipdata的数据
      this.voipData = {
        ...this.voipData,
        token,
        productId,
        deviceName,
      };
      wx.request({
        method: 'POST',
        url: 'https://iot.cloud.tencent.com/api/exploreropen/tokenapi',
        data: params,
        success(res) {
          console.log(pagePrefix, '调用AppPublishMessage成功', res);
          wx.redirectTo({
            url: wmpfVoip.CALL_PAGE_PATH,
          });
        },
        fail(err) {
          console.log(pagePrefix, '调用AppPublishMessage失败', err);
        },
      });
    } catch (err) {
      console.log(pagePrefix, '调用云函数getAccessToken失败', err);
    } finally {
      this.setData({ isCalling: false });
    }
  },
  onLoad() {
    console.log(pagePrefix, 'onLoad call');
    this.voipData = {};
    // 从缓存中获取voip数据
    const voipFormData = wx.getStorageSync(VOIP_CALL_STORAGE_KEY);
    if (!!voipFormData) {
      this.setData({
        form: {
          ...this.data.form,
          ...JSON.parse(voipFormData)
        }
      });
    }
  },

  onReady() {
    if (!isBindVoipEvent) {
      isBindVoipEvent = true;
      const unsubscribeFn = wmpfVoip.onVoipEvent(event => {
        console.info(pagePrefix, 'onVoipEvent', event);
        if (event.eventName === VOIP_EVENT_STATUS.rejectVoip) {
          console.info(pagePrefix, '通话被拒接了', event);
        } else if (event.eventName === VOIP_EVENT_STATUS.busy) {
          console.info(pagePrefix, '设备端繁忙', event);
        } else if (event.eventName === VOIP_EVENT_STATUS.cancelVoip) {
          const params = {
            AccessToken: this.voipData.token,
            RequestId: getRandomId(),
            Action: 'AppPublishMessage',
            ProductId: this.voipData.productId,
            DeviceName: this.voipData.deviceName,
            Topic: `$twecall/down/service/${this.voipData.productId}/${this.voipData.deviceName}`,
            Payload: JSON.stringify({
              version: '1.0',
              method: 'voip_cancel',
              clientToken: getClientToken(),
              timestamp: Math.floor(Date.now() / 1000),
              params: {
                roomId: event.roomId,
                status: event.data.status
              },
            }),
          };
          console.log('发送cancelVoip params=>', params);
          wx.request({
            method: 'POST',
            url: 'https://iot.cloud.tencent.com/api/exploreropen/tokenapi',
            data: params,
            success(res) {
              console.log(pagePrefix, '发送cancelVoip成功', res);
            },
            fail(err) {
              console.log(pagePrefix, '发送cancelVoip失败', err);
            },
            complete() {
              isBindVoipEvent = false;
              unsubscribeFn();
            }
          });
        }
      });
    }
  },
  onUnload() {
    console.log(pagePrefix, 'onUnload call');
  },
  onHide() {
    console.log(pagePrefix, 'onHide call');
  },
});

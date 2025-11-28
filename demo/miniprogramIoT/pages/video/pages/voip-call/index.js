import { getRandomId, getClientToken, splitByFirstUnderscore, appendSignature } from '../../utils/index';
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
      appKey: 'mdyumoCfOFqquLALj',
      appSecret: 'mYPZgDBPvDtUmsTwHKvg',
      sn: 'BF5VFDTXKE_1',
      modelId: 'DYEbVE9kfjAONqnWsOhXgw',
      callType: 'video',
      publishMessagePayload: '',
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
  onPublishMessagePayload(e) {
    try {
      console.log('onPublishMessagePayload json => ', JSON.parse(e.detail.value));
    } catch (_error) {
      // ignore
    }
    this.setData({ publishMessagePayload: e.detail.value });
  },
  async onSubmit() {
    let outerPayload = {};
    try {
      outerPayload = JSON.parse(this.data.publishMessagePayload);
    } catch (_e) { /** ignore error */ };

    wx.setStorageSync(VOIP_CALL_STORAGE_KEY, JSON.stringify(this.data.form));
    const { sn, callType, modelId } = this.data.form;
    if (this.data.isCalling) {
      this.setData({ isCalling: false });
      wmpfVoip.forceHangUpVoip();
      return;
    }
    console.log(pagePrefix, 'onSubmit=> form', this.data.form);
    try {
      const callDeviceParams = {
        roomType: callType,
        sn,
        modelId,
        isCloud: true,
        payload: '{}',
        nickName: 'xp2p Demo 小程序',
        deviceName: 'xp2p Demo 小程序',
        // NOTE 支持用户手动传递这几个参数，如果有的话也会自动传递给设备端
        // 这里的逻辑就是：
        // 1. 如果用户传递了这几个参数，则使用用户传递的值
        // 2. 小程序呼叫设备的这几个参数最好跟设备上行的参数一致，所以这里传给设备端
        // ---> 小程序呼叫的参数和设备端传给小程序音视频参数一致了，黑边问题同时就解决了
        /**
         * p2p player 小程 voip 呼叫设备 payload 填写示例:
        {
          "encodeVideoFixedLength": 320,
          "encodeVideoRotation": 1,
          "encodeVideoRatio": 0,
          "encodeVideoMaxFPS": 15,
          "others-key-1": "others-value-1",
          "others-key-2": "others-value-2",
          ...
        }
         */
        encodeVideoFixedLength: outerPayload.encodeVideoFixedLength || 320,
        encodeVideoRotation: outerPayload.encodeVideoRotation || 1,
        encodeVideoRatio: outerPayload.encodeVideoRatio || 0,
        encodeVideoMaxFPS: outerPayload.encodeVideoMaxFPS || 15,
      };
      this.setData({ isCalling: true });
      console.log('开始呼叫callDevice params=>', callDeviceParams);
      const { roomId } = await wmpfVoip.callDevice(callDeviceParams);

      const payload = JSON.stringify({
        version: '1.0',
        method: 'voip_join',
        clientToken: getClientToken(),
        timestamp: Math.floor(Date.now() / 1000),
        params: {
          // NOTE method 为 voip_xxx 时，roomId 为必传参数
          roomId,
          // NOTE 如果需要传递其他参数给到设备端，在这里扩展 kv 就好了
          /** custom_data_key: custom_data_value, */
          openId: wx.getStorageSync('wx:openId') || wx.getStorageSync('openId') || '',
          ...outerPayload,
        },
      });
      this.publishMessage(payload)
        .then((res) => {
          console.log(pagePrefix, '发送voipJoin成功', res);
          wx.redirectTo({
            url: wmpfVoip.CALL_PAGE_PATH,
          });
        })
        .catch((err) => {
          console.error(pagePrefix, '发送voipJoin失败', err);
          wmpfVoip.forceHangUpVoip(roomId);
        });
    } catch (err) {
      console.error(pagePrefix, 'call error', err);
    } finally {
      this.setData({ isCalling: false });
    }
  },
  async publishMessage(payload) {
    console.log(pagePrefix, '调用publishMessage函数 payload=>', payload);
    return new Promise((resolve, reject) => {
      const { appKey, appSecret, sn } = this.data.form;
      const [productId, deviceName] = splitByFirstUnderscore(sn);
      const params = {
        Action: 'AppApiPublishMessage',
        RequestId: getRandomId(),
        AppKey: appKey,
        AppSecret: appSecret,
        Timestamp: Math.floor(Date.now() / 1000),
        Nonce: Math.floor(10000 * Math.random()) + 1,
        ProductId: productId,
        DeviceName: deviceName,
        Topic: `$twecall/down/service/${productId}/${deviceName}`,
        Payload: payload,
        Qos: 1,
      };
      const pararmsWithSignature = appendSignature({
        ...params
      });
      console.log('调用AppApiPublishMessage params=>', pararmsWithSignature);
      wx.request({
        method: 'POST',
        url: 'https://iot.cloud.tencent.com/api/exploreropen/appapi',
        data: pararmsWithSignature,
        success(res) {
          console.log(pagePrefix, '调用AppApiPublishMessage完成', res);
          if (res.data.code !== 0) {
            wx.showToast({
              icon: 'error',
              title: res.data.msg,
            });
            reject(new Error(res.data.msg));
          }
          resolve(res);
        },
        fail(err) {
          reject(err);
        }
      });
    });
  },
  importFromClipboard() {
    wx.getClipboardData()
      .then(res => {
        const arr = res.data
          .split(/\r\n|\n|\r/)                // 支持 \n, \r\n, \r
          .map(s => s.trim().replace(/^"+|"+$/g, '')) // trim 并去掉首尾的 "（若存在）
          .filter(s => s.length > 0);        // 过滤掉空行
        if (arr.length !== 4) {
          return wx.showToast({
            icon: 'error',
            title: '格式错误，为4行'
          });
        }
        this.setData({
          form: {
            ...this.data.form,
            appKey: arr[0],
            appSecret: arr[1],
            sn: arr[2],
            modelId: arr[3],
          }
        });
        console.log(arr);
      })
      .catch(() => {
        wx.showToast({
          icon: 'error',
          title: '获取剪切板内容失败'
        });
      });
  },
  onLoad() {
    console.log(pagePrefix, 'onLoad call');
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
    console.log(pagePrefix, 'onReady call');
    if (!isBindVoipEvent) {
      isBindVoipEvent = true;
      const unsubscribeFn = wmpfVoip.onVoipEvent(event => {
        console.info(pagePrefix, 'onVoipEvent', event);
        if (event.eventName === VOIP_EVENT_STATUS.rejectVoip) {
          console.info(pagePrefix, '通话被拒接了', event);
        } else if (event.eventName === VOIP_EVENT_STATUS.busy) {
          console.info(pagePrefix, '设备端繁忙', event);
        } else if (event.eventName === VOIP_EVENT_STATUS.cancelVoip) {
          const payload = JSON.stringify({
            version: '1.0',
            method: 'voip_cancel',
            clientToken: getClientToken(),
            timestamp: Math.floor(Date.now() / 1000),
            params: {
              roomId: event.roomId,
              status: event.data.status
            },
          });
          this.publishMessage(payload)
            .then(res => {
              console.log(pagePrefix, '发送cancelVoip成功', res);
            })
            .catch(err => {
              console.error(pagePrefix, '发送cancelVoip失败', err);
            })
            .finally(() => {
              isBindVoipEvent = false;
              unsubscribeFn();
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

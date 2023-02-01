import { presetDevices } from '../../config/config';

// 覆盖 console
const app = getApp();
const oriConsole = app.console;
const console = app.logger || oriConsole;

const pageName = 'demo-page-ipc-playback-cloudvideo';
let pageSeq = 0;

Page({
  data: {
    // 这是onLoad时就固定的
    cfg: '',

    // 这些是控制player和p2p的
    playerId: 'iot-cloud-player',

    // 设备信息，在input组件里填
    targetId: '',
    deviceInfo: null,
  },
  onLoad(query) {
    pageSeq++;
    const pageId = `${pageName}-${pageSeq}`;
    console.log('demo: onLoad', pageId, query);

    this.userData = {
      pageId,
      deviceId: '',
    };

    const cfg = query.cfg || '';
    this.setData({
      cfg,
      deviceMsg: 'loading...',
    });

    const cfgData = cfg && presetDevices[cfg];
    if (!cfgData) {
      this.setData({
        deviceMsg: 'no cfgData',
      });
      return null;
    }

    const detail = {
      targetId: cfg,
      deviceInfo: {
        deviceId: `${cfgData.productId}/${cfgData.deviceName}`,
        productId: cfgData.productId,
        deviceName: cfgData.deviceName,
        isMjpgDevice: cfgData.isMjpgDevice,
      },
      cloudRecords: cfgData.cloudRecords,
    };
    this.onStartPlayer({ detail });
  },
  onShow() {
    console.log('demo: onShow');
  },
  onHide() {
    console.log('demo: onHide');
  },
  onUnload() {
    console.log('demo: onUnload');
    this.hasExited = true;

    console.log('demo: onUnload end');
  },
  onStartPlayer({ detail }) {
    console.log('demo: onStartPlayer', detail);
    if (detail.deviceInfo.isMjpgDevice) {
      // info 不匹配
      console.log('demo: info error');
      this.setData({
        targetId: detail.targetId,
        deviceInfo: detail.deviceInfo,
      });
      return;
    }

    this.userData.deviceId = detail.deviceInfo.deviceId;

    this.setData(detail);

    // 直接用 video 组件播放
  },
});

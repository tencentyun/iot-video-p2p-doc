import { getUserId, toDateTimeMsString } from '../../../../utils';

const sysInfo = wx.getSystemInfoSync();
const accountInfo = wx.getAccountInfoSync();
const miniProgramInfo = accountInfo.miniProgram;

// components/demo-basicinfo/index.js
Component({
  /**
   * 组件的属性列表
   */
  properties: {
    playerVersion: String,
    xp2pVersion: String,

    tcpFirst: Boolean,
    canToggleTcpFirst: Boolean,
    stunPort: String,
    useDeliveryConfig: Boolean,
    streamCrypto: Boolean,

    // crossStunTurn
    crossStunTurn: Boolean,
    canToggleCrossStunTurn: Boolean,
    canTogglePort: Boolean,
    canToggleUseDeliveryConfig: Boolean,
    canToggleStreamCrypto: Boolean,

    xp2pUuid: String,
    xp2pState: String,
    xp2pStateTime: Number,
    xp2pLocalPeername: String,
    xp2pNatEvent: String,
    xp2pNatEventTime: String,
  },

  /**
   * 组件的初始数据
   */
  data: {
    wxVersion: sysInfo.version,
    wxSDKVersion: sysInfo.SDKVersion,
    hostInfo: `${miniProgramInfo.appId}-${miniProgramInfo.envVersion}`,
    sysInfo: `${sysInfo.platform} / ${sysInfo.system}`,
    userId: getUserId(),
    xp2pNatEventTimeStr: '',
  },

  observers: {
    xp2pNatEventTime(val) {
      this.setData({
        xp2pNatEventTimeStr: toDateTimeMsString(new Date(val)),
      });
    },
  },

  /**
   * 组件的方法列表
   */
  methods: {
    toggleTcpFirst() {
      const app = getApp();
      if (!app.restart) app.restart = restart;
      if (typeof app.toggleTcpFirst !== 'function') {
        return;
      }
      app.toggleTcpFirst();
    },
    toggleCrossStunTurn() {
      const app = getApp();
      if (!app.toggleCrossStunTurn) {
        return;
      }
      app.toggleCrossStunTurn();
    },
    // 切换端口函数
    togglePort() {
      const app = getApp();
      const portList = ['80', '443', '8000', '20000', '20002'];
      if (!app.togglePort) {
        return;
      }
      wx.showActionSheet({
        itemList: portList,
        success: ({ tapIndex }) => {
          const currentPort = portList[tapIndex];
          app.togglePort(currentPort);
        },
      });
    },
    // 切换配置跟随函数
    toggleUseDeliveryConfig() {
      const app = getApp();
      if (!app.toggleUseDeliveryConfig) {
        return;
      }
      app.toggleUseDeliveryConfig();
    },
    // 切换xp2p流加密
    toggleStreamCrypto() {
      const app = getApp();
      if (!app.toggleStreamCrypto) {
        return;
      }
      app.toggleStreamCrypto();
    },

    copyData(e) {
      const { value } = e.currentTarget.dataset;
      wx.setClipboardData({
        data: value,
        success: () => {
          wx.showToast({
            title: '复制成功',
            icon: 'none',
          });
        },
      });
    },
  },
});

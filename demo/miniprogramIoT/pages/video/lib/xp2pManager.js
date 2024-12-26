// 接口参考 types/index.d.ts 里的 IXp2pManager
import { getUserId, compareVersion } from '../../../utils';

let xp2pManager = null;
export const getXp2pManager = () => {
  if (!xp2pManager) {
    const xp2pPlugin = requirePlugin('xp2p');
    console.log('xp2pPlugin', xp2pPlugin);

    const iotExports = xp2pPlugin.iot;
    const app = getApp();

    // 用户id，微信用户在此小程序中的唯一标识，一般在小程序界面中可以看到，方便反馈问题时提供
    iotExports?.setUserId?.(getUserId() || 'demo');

    // 开发版才打插件log
    if (app.pluginLogger && wx.getAccountInfoSync().miniProgram.envVersion === 'develop') {
      iotExports?.setPluginLogger?.(app.pluginLogger);
    }

    // 设置优先使用的打洞协议
    if (compareVersion(wx.getSystemInfoSync().SDKVersion, '3.4.1') >= 0 && xp2pPlugin.p2p.setTcpFirst) {
      const tcpFirstKey = 'tcpFirst';
      const tcpFirstTime = parseInt(wx.getStorageSync(tcpFirstKey), 10);
      const tcpFirst = !!(tcpFirstTime && (Date.now() - tcpFirstTime < 3600000 * 24)); // 24小时内有效
      console.log('tcpFirst', tcpFirst);
      xp2pPlugin.p2p.setTcpFirst(tcpFirst);

      // 给index页用，方便测试时调整tcpFirst
      app.tcpFirst = tcpFirst;
      app.toggleTcpFirst = async () => {
        const modalRes = await wx.showModal({
          title: '确定切换 tcpFirst 吗？',
          content: '切换后需要重新进入小程序',
        });
        if (!modalRes || !modalRes.confirm) {
          return;
        }
        wx.setStorageSync(tcpFirstKey, tcpFirst ? '' : Date.now());
        app.restart();
      };
    }

    // 设置是否连接对端stun
    if (xp2pPlugin.p2p.setCrossStunTurn) {
      const crossStunTurnKey = 'crossStunTurn';
      const crossStunTurnTime = parseInt(wx.getStorageSync(crossStunTurnKey), 10);
      const crossStunTurn = !!(crossStunTurnTime && (Date.now() - crossStunTurnTime < 3600000 * 24)); // 24小时内有效
      console.log('crossStunTurn', crossStunTurn);
      xp2pPlugin.p2p.setCrossStunTurn(crossStunTurn);

      // 给index页用，方便测试时调整crossStunTurn
      app.crossStunTurn = crossStunTurn;
      app.toggleCrossStunTurn = async () => {
        const modalRes = await wx.showModal({
          title: '确定切换 crossStunTurn 吗？',
          content: '切换后需要重新进入小程序',
        });
        if (!modalRes || !modalRes.confirm) {
          return;
        }
        wx.setStorageSync(crossStunTurnKey, crossStunTurn ? '' : Date.now());
        app.restart();
      };
    }

    xp2pManager = iotExports.getXp2pManager();
    app.logger?.log('xp2pManager', {
      P2PPlayerVersion: xp2pManager.P2PPlayerVersion,
      XP2PVersion: xp2pManager.XP2PVersion,
      // uuid，插件随机生成的id，存储在小程序本地，删除小程序后会重新生成
      uuid: xp2pManager.uuid,
    });
  }
  return xp2pManager;
};

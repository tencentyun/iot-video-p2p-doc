// 接口参考 types/index.d.ts 里的 IXp2pManager
import { getUserId } from '../../../utils';

let xp2pManager = null;
export const getXp2pManager = () => {
  if (!xp2pManager) {
    const xp2pPlugin = requirePlugin('xp2p');
    console.log('xp2pPlugin', xp2pPlugin);

    const iotExports = xp2pPlugin.iot;
    const app = getApp();

    // 用户id
    iotExports?.setUserId?.(getUserId() || 'demo');

    // 开发版才打插件log
    if (app.pluginLogger && wx.getAccountInfoSync().miniProgram.envVersion === 'develop') {
      iotExports?.setPluginLogger?.(app.pluginLogger);
    }

    xp2pManager = iotExports.getXp2pManager();
    app.logger?.log('xp2pManager', {
      P2PPlayerVersion: xp2pManager.P2PPlayerVersion,
      XP2PVersion: xp2pManager.XP2PVersion,
      uuid: xp2pManager.uuid,
    });
  }
  return xp2pManager;
};

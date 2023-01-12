export const Xp2pManagerEvent = {
  XP2P_STATE_CHANGE: 'xp2pStateChange',
};

let xp2pManager = null;
export const getXp2pManager = () => {
  if (!xp2pManager) {
    const xp2pPlugin = requirePlugin('xp2p');
    console.log('xp2pPlugin', xp2pPlugin);

    const iotExports = xp2pPlugin.iot;

    // 开发版才打插件log
    if (wx.getAccountInfoSync().miniProgram.envVersion === 'develop') {
      const app = getApp();
      app.pluginLogger && iotExports.setPluginLogger(app.pluginLogger);
    }

    xp2pManager = iotExports.getXp2pManager();
  }
  return xp2pManager;
};

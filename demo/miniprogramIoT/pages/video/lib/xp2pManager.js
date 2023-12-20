// 接口参考 types/index.d.ts 里的 IXp2pManager

let xp2pManager = null;
export const getXp2pManager = () => {
  if (!xp2pManager) {
    const xp2pPlugin = requirePlugin('xp2p');
    console.log('xp2pPlugin', xp2pPlugin);

    const iotExports = xp2pPlugin.iot;
    const app = getApp();

    // 开发版才打插件log
    if (app.pluginLogger && wx.getAccountInfoSync().miniProgram.envVersion === 'develop') {
      iotExports?.setPluginLogger?.(app.pluginLogger);
    }

    if (app.pluginReporter) {
      iotExports?.setPluginReporter?.(app.pluginReporter);
    }

    xp2pManager = iotExports.getXp2pManager();
  }
  return xp2pManager;
};

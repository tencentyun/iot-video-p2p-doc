const appParams = {
  appid: 1253131157,
  appOauthId: '600a4206062556e21befdc98',
  appKey: 'pMqRNpU3M4wOA2BY',
  appSecretKey: 'b62XcOoDcvJOgnibM8iKFVgVsXcdxNda',
  appPackage: 'ios.test.com',
};

module.exports = {
  wx,
  getXp2pAppParams() {
    return appParams;
  },
  getXp2pConfig() {
    return {
      enableCrypto: true, // p2p传输是否加密，不传默认开启
      // enableDeviceSig: true, // 是否开启设备签名
    };
  },
  getPlayerPlugin() {
    return requirePlugin('wechat-p2p-player');
  },
};

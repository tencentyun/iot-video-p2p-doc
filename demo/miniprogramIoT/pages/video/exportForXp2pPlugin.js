const appParams = {
  appid: 123,
  appOauthId: 'xxx',
  appKey: 'xxx',
  appSecretKey: 'xxx',
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
    };
  },
  getPlayerPlugin() {
    return requirePlugin('wechat-p2p-player');
  },
};

const appParams = {
	appid: "xx",
	appOauthId: "xx",
	appKey: "xx",
	appSecretKey: "xx",
	appPackage: "xx.com",
}

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

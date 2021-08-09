// 这些是和设备无关的配置
const config = {
  ipc: {
    old: {
      basePath: '/ipc.p2p.com/',
      flvPath: 'ipc.flv',
      flvParams: 'action=live',
    },
    'v1.3': {
      basePath: '/ipc.p2p.com/',
      flvPath: 'ipc.flv',
      flvParams: 'action=live',
    },
  },
  server: {
    xntp: {
      host: '25QWpIISwMaH6wru24.xnet',
      basePath: '/iot.p2p.com/openlive/',
      // codeUrl: 'https://dev.ad.qvb.qcloud.com/code', // TODO 有问题，带code拉不到流
    },
    tcp: {
      host: '106.52.41.74:12680',
      // basePath: '/test-server/', // 这个不支持加密，后面都用 openlive
      basePath: '/openlive/',
      codeUrl: 'https://dev.ad.qvb.qcloud.com/code',
    },
    tcp80: {
      host: '106.52.41.74',
      basePath: '/openlive/',
      codeUrl: 'https://dev.ad.qvb.qcloud.com/code',
    },
  },
  appParams: {
    appOauthId: '600a4206062556e21befdc98',
    appKey: 'pMqRNpU3M4wOA2BY',
    appSecretKey: 'b62XcOoDcvJOgnibM8iKFVgVsXcdxNda',
    appPackage: 'ios.test.com',
  },
};

export default config;

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
    },
    tcp: {
      host: '106.52.41.74:12680',
      basePath: '/test-server/',
    },
    tcp80: {
      host: 'dev.ad.qvb.qcloud.com',
      basePath: '/test-server/',
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

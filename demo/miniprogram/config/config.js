import devices from './devices';
import serverStreams from './streams';

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
      host: 'dev.ad.qvb.qcloud.com:12680',
      // basePath: '/test-server/', // 这个不支持加密，后面都用 openlive
      basePath: '/openlive/',
      codeUrl: 'https://dev.ad.qvb.qcloud.com/code',
    },
  },
  appParams: {
    appid: 1253131157,
    appOauthId: '600a4206062556e21befdc98',
    appKey: 'pMqRNpU3M4wOA2BY',
    appSecretKey: 'b62XcOoDcvJOgnibM8iKFVgVsXcdxNda',
    appPackage: 'ios.test.com',
  },
};

const totalData = {};

// server流都加进去
for (const key in serverStreams) {
  const streamCfg = serverStreams[key];
  const serverBaseData = {
    mode: 'server',
    ...config.server[streamCfg.serverName]
  };
  totalData[key] = {
    ...serverBaseData,
    ...streamCfg,
    targetId: key,
  };
}

// ipc设备都加进去
const ipcBaseData = {
  mode: 'ipc',
  ...config.ipc['v1.3'],
};
for (const key in devices) {
  totalData[key] = {
    ...ipcBaseData,
    ...devices[key],
    targetId: key,
  };
}

console.log('totalData', totalData);
config.totalData = totalData;

export default config;

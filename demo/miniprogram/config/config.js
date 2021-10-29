import devices from './devices';
import serverStreams from './streams';

const getThisMonth = () => {
  const now = new Date();
  const year = now.getFullYear();
  let month = String(now.getMonth() + 1);
  if (month.length < 2) {
    month = `0${month}`;
  }
  return `${year}${month}`;
};

// 这些是和设备无关的配置
const config = {
  ipc: {
    old: {
      basePath: '/ipc.p2p.com/',
      flvFile: 'ipc.flv?action=live',
    },
    'v1.3': {
      basePath: '/ipc.p2p.com/',
      flvFile: 'ipc.flv?action=live',
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
  commandMap: {
    getLiveStatus: {
      cmd: 'get_device_st',
      params: {
        type: 'live',
        quality: 'super',
      },
    },
    getVoiceStatus: {
      cmd: 'get_device_st',
      params: {
        type: 'voice',
      },
    },
    getRecordDates: {
      cmd: 'get_month_record',
      params: {
        time: getThisMonth(), // yyyymm
      },
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

# 腾讯云IoT Video X-P2P插件P2P开发指南

## 插件CHANGELOG

| 版本号 | 发布时间  | 描述                             |
| ------ | --------- | -------------------------------- |
| v1.0.0beta | 2021.7.19 | 支持小程序P2P初版，支持1V多P2P和1V1P2P观看摄像头实时监控流的内存beta版本 |

## 介绍

传统的多人观看场景，观看端向云端发送HTTP请求获取数据。在腾讯云IoT Video 1V多 P2P服务中，观看端和云端建立一个共享P2P网络，本插件就是这个P2P网络的一个小程序Peer，客户小程序利用 [P2P-Player插件](https://github.com/tencentyun/iot-video-p2p-doc/blob/master/IoT%20Video%20P2P-Player%E6%8F%92%E4%BB%B6%E5%BC%80%E5%8F%91%E6%8C%87%E5%8D%97.md) 将live-player的请求发送至本插件，本插件从云端或其他P2P节点获取数据并持续返回，客户小程序再将数据持续推送至 P2P-Player插件，就能实现P2P直播功能。通过P2P，客户可以互相分享数据，从而大幅降低云端流量，节省相关成本。

支持的流媒体：http-flv。

## 准备工作

使用本插件需要：

- 接入腾讯云 IoT Video P2P 服务，获取访问密钥
- 有使用 live-player 的权限，详见[官方文档](https://developers.weixin.qq.com/miniprogram/dev/component/live-player.html)

## 微信版本限制

微信 8.0.7以上 基础库 2.18.0以上

## 使用方法

本插件需配合 [P2P-Player插件](https://github.com/tencentyun/iot-video-p2p-doc/blob/master/IoT%20Video%20P2P-Player%E6%8F%92%E4%BB%B6%E5%BC%80%E5%8F%91%E6%8C%87%E5%8D%97.md) 使用，请先引用 *P2P-Player插件*

### 1. 申请使用插件

小程序后台添加插件，详见[官方文档](https://developers.weixin.qq.com/miniprogram/dev/framework/plugin/using.html)

```
appid: 'wx1319af22356934bf'
```

### 2. 引入插件代码包

```
// 在app.json里面引入插件，注意插件版本号
{
  "plugins": {
    "iotvideo-weapp-plugin": {
      "version": "1.0.0", // 具体需要使用的版本号
      "provider": "wx1319af22356934bf" // 插件的appid
    }
  }
}
```

### 3. 调用插件接口

这里会用到接入腾讯云 IOT Video P2P 服务时收到的 `appParams`

```
// 获取插件
const videoPlugin = requirePlugin('iotvideo-weapp-plugin');
const p2pModule = videoPlugin.p2p;
// 初始化 IoTP2PModule，建议尽早初始化，提前探测网络状态
p2pModule
  .init({
    appParams: {
      appOauthId: '$yourAppOauthId',
      appKey: '$yourAKey',
      appSecretKey: '$yourASecretKey',
      appPackage: '$yourAPackage',
    },
    source: p2pModule.XP2PSource.IoTP2PServer,
  })
  .then((res) => {
    // res === 0 说明初始化成功
    console.log('init res', res);
  })
  .catch(({ errcode, errmsg }) => {
    console.error('init error', errcode, errmsg);
  });
// 在 p2p-player 插件开始请求后启动p2p通信，注意不能同时存在相同的 streamId
p2pModule.startP2PService(streamId, streamInfo, {
  msgCallback: (event, subtype, detail) => {
    // 各种消息通知，取值见api说明
  },
  dataCallback: (data) => {
    // data 是 ArrayBuffer 类型，在这里把数据推送给 p2p-player
  },
});
// 在 p2p-player 插件结束请求后关闭p2p通信
p2pModule.stopServiceById(streamId);
// 销毁 IoTP2PModule，可以在小程序销毁时一并销毁
p2pModule.destroy();
```

### 4. 异常处理

当模块出现异常时，会通过 `msgCallback` 通知出来。如果是p2p链路断开，用户可以根据需要重置p2p模块

```
onP2PMessage(event, subtype, detail) {
  switch (event) {
    case p2pModule.XP2PEventEnum.Notify:
      console.log('onP2PMessage, Notify', subtype, detail);
      if (subtype === p2pModule.XP2PNotify_SubType.Disconnect) {
        // p2p链路断开，建议间隔一段时间后，检查网络状态并重置p2p模块
        setTimeout(() => {
          p2pModule
            .resetP2P()
            .then((res) => {
              // res === 0 说明reset成功
              console.log('reset res', res);
            })
            .catch(({ errcode, errmsg }) => {
              console.error('reset error', errcode, errmsg);
            });
        }, 5000); 
      }
      break;

    case p2pModule.XP2PEventEnum.Log:
      console.log('onP2PMessage, Log', subtype, detail);
      break;

    default:
      console.log('onP2PMessage, unknown event', event, subtype);
  }
}
```

## API 说明

### p2pModule.init(object) => Promise<res>

初始化

#### 参数

##### object: Object

| 属性      | 类型   | 默认值 | 必填 | 说明     |
| :-------- | :----- | :----- | :--- | :------- |
| appParams | Object | -      | 是   | 客户参数 |
| source    | number | -      | 是   | P2P类型  |

source 的合法值

| source | 说明                                                 |
| :----- | :--------------------------------------------------- |
| 1      | P1P 1V1，建议使用 p2pModule.XP2PSource.IPC           |
| 3      | P2P 1V多，建议使用 p2pModule.XP2PSource.IoTP2PServer |

#### 返回值

##### Promise<res: number>

res 的值

| res   | 说明               |
| :---- | :----------------- |
| 0     | 成功               |
| -2000 | 参数错误           |
| -2003 | 重复启动           |
| -2201 | Xntp模块重复启动   |
| -2202 | 探测错误           |
| -2301 | 加载本地server错误 |

------

### p2pModule.resetP2P() => Promise<res>

重置p2p模块

#### 返回值

##### Promise<res: number>

res 的值

| res   | 说明           |
| :---- | :------------- |
| 0     | 成功           |
| -2002 | 模块尚未初始化 |
| -2202 | 探测错误       |

------

### p2pModule.destroy() => void

销毁

------

### p2pModule.startP2PService(id, streamInfo, callbacks) => Promise<res>

开始指定id的xp2p服务

#### 参数

| 参数       | 类型   | 说明         |
| :--------- | :----- | :----------- |
| id         | string | 流的唯一id   |
| streamInfo | Object | 流的具体信息 |
| callbacks  | Object | 各种回调函数 |

##### streamInfo: Object

流的具体信息

| 属性    | 类型   | 默认值 | 必填 | 说明           |
| :------ | :----- | :----- | :--- | :------------- |
| url     | string | -      | 是   | 源流的地址     |
| headers | Object | -      | 否   | 预留，暂未使用 |

##### callbacks: Object

各种回调函数

| 属性         | 类型                                                     | 默认值 | 必填 | 说明           |
| :----------- | :------------------------------------------------------- | :----- | :--- | :------------- |
| msgCallback  | (event: string, subtype: string, detail: Object) => void | -      | 是   | 消息通知       |
| dataCallback | (data: ArrayBuffer) => void                              | -      | 是   | 直播流数据回调 |

**callbacks.msgCallback 参数**

| 参数    | 类型   | 说明     |
| :------ | :----- | :------- |
| event   | string | 事件名   |
| subtype | string | 子类型   |
| detail  | Object | 详细信息 |

event 的值

| event    | 说明     |
| :------- | :------- |
| 'notify' | 消息通知 |
| 'log'    | 日志     |

- event === 'notify' 时，subtype如下，detail暂未使用

| subtype      | 说明           |
| :----------- | :------------- |
| 'request'    | 开始请求       |
| 'parsed'     | 响应头解析成功 |
| 'close'      | 主动关闭直播流 |
| 'eof'        | 直播流结束     |
| 'disconnect' | 直播流断开     |

- event === 'log' 时，subtype暂未使用，detail是log字符串

**callbacks.dataCallback 参数**

| 参数 | 类型        | 说明     |
| :--- | :---------- | :------- |
| data | ArrayBuffer | 视频数据 |

#### 返回值

##### Promise<res: number>

res 的值

| res   | 说明             |
| :---- | :--------------- |
| 0     | 成功             |
| -2000 | 参数错误         |
| -2002 | 模块尚未初始化   |
| -2401 | 重复启动数据服务 |
| -2402 | 订阅数据错误     |

------

### p2pModule.stopP2PService(id) => void

停止指定id的xp2p服务

#### 参数

| 参数 | 类型   | 说明       |
| :--- | :----- | :--------- |
| id   | string | 流的唯一id |

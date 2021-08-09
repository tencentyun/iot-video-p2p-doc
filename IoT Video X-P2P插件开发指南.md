# 腾讯云IoT Video X-P2P插件P2P开发指南

## 插件CHANGELOG

| 版本号 | 发布时间  | 描述                             |
| ------ | --------- | -------------------------------- |
| v1.0.0beta | 2021.7.19 | 支持小程序P2P初版，支持1V多P2P和1V1P2P观看摄像头实时监控流的内测beta版本 |
| v1.0.0 | 2021.8.10 | 增加加密和支持1V1 P2P 语音对讲和自定义信令 |

## 介绍
### 1V多P2P

传统的多人观看场景，观看端向云端发送HTTP请求获取数据。在腾讯云IoT Video 1V多 P2P服务中，观看端和云端建立一个共享P2P网络，本插件就是这个P2P网络的一个小程序Peer，客户小程序利用 [P2P-Player插件](https://github.com/tencentyun/iot-video-p2p-doc/blob/master/IoT%20Video%20P2P-Player%E6%8F%92%E4%BB%B6%E5%BC%80%E5%8F%91%E6%8C%87%E5%8D%97.md) 将live-player的请求发送至本插件，本插件从云端或其他P2P节点获取数据并持续返回，客户小程序再将数据持续推送至 P2P-Player插件，就能实现P2P直播功能。通过P2P，客户可以互相分享数据，从而大幅降低云端流量，节省相关成本。

支持的流媒体：http-flv。

### 1V1 P2P

支持在微信小程序内通过P2P方式直连摄像头观看直播和本地录像。

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

### 1. 申请使用插件

小程序后台添加插件，详见[官方文档](https://developers.weixin.qq.com/miniprogram/dev/framework/plugin/using.html)
``` js
appid: 'wx1319af22356934bf'
```

### 2. 引入插件代码包

``` js
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

### 3.1 1v多

这里会用到接入腾讯云 IOT Video P2P 服务时收到的 `appParams`

``` js
// 获取插件
const videoPlugin = requirePlugin('iotvideo-weapp-plugin');
const p2pModule = videoPlugin.p2p;
```

``` js
// 初始化 IoTP2PModule，建议尽早初始化，提前探测网络状态
p2pModule
  .init({
    appParams: {
      appOauthId: '$yourAppOauthId',
      appKey: '$yourAKey',
      appSecretKey: '$yourASecretKey',
      appPackage: '$yourAPackage',
    },
  })
  .then((res) => {
    // res === 0 说明初始化成功
    console.log('init res', res);
  })
  .catch(({ errcode, errmsg }) => {
    console.error('init error', errcode, errmsg);
  });

```

``` js
// 在 p2p-player 插件开始请求后启动p2p通信，注意不能同时存在相同的 streamId
p2pModule.startP2PService(streamId, streamInfo, {
  msgCallback: (event, subtype, detail) => {
    // 各种消息通知，取值见api说明
  },
  dataCallback: (data) => {
    // data 是 ArrayBuffer 类型，在这里把数据推送给 p2p-player
  },
});

```

``` js
// 在 p2p-player 插件结束请求后关闭p2p通信
p2pModule.stopServiceById(streamId);

```

``` js
// 销毁 IoTP2PModule，可以在小程序销毁时一并销毁
p2pModule.destroy();

```

### 3.2 1v1

基本流程和1v多类似，也会用到接入腾讯云 IOT Video P2P 服务时收到的 `appParams`

``` js
// 获取插件
const videoPlugin = requirePlugin('iotvideo-weapp-plugin');
const p2pModule = videoPlugin.p2p;
```

``` js
// 初始化 IoTP2PModule，建议尽早初始化，提前探测网络状态
p2pModule
  .init({
    appParams: {
      appOauthId: '$yourAppOauthId',
      appKey: '$yourAKey',
      appSecretKey: '$yourASecretKey',
      appPackage: '$yourAPackage',
    },
  })
  .then((res) => {
    // res === 0 说明初始化成功
    console.log('init res', res);
  })
  .catch(({ errcode, errmsg }) => {
    console.error('init error', errcode, errmsg);
  });

```

``` js
// 为了提高出图速度，在开始播放前可以先建立p2p连接，注意不能同时存在相同的 ipcId
p2pModule.startP2PService(ipcId, ipcInfo, {
  msgCallback: (event, subtype, detail) => {
    // 各种消息通知，取值见api说明
  },
});

```

``` js
// 在 p2p-player 插件开始请求后启动p2p拉流，注意需要先调用 startP2PService
p2pModule.startP2PStream(ipcId, ipcInfo, {
  dataCallback: (data) => {
    // data 是 ArrayBuffer 类型，在这里把数据推送给 p2p-player
  },
});

```

``` js
// 在 p2p-player 插件结束请求后关闭p2p拉流
p2pModule.stopP2PStream(ipcId);

```

``` js
// 开始语音对讲，注意需要先调用 startP2PService
p2pModule.startVoiceService(ipcId, recorderManager);

```

``` js
// 停止语音对讲
p2pModule.stopVoiceService(ipcId);

```

``` js
// 发送信令，注意需要先调用 startP2PService
p2pModule.sendCommand(ipcId, command);

```

``` js
// 关闭p2p通信，如果正在拉流或者对讲，也会一起关闭
p2pModule.stopServiceById(streamId);

```

``` js
// 销毁 IoTP2PModule，可以在小程序销毁时一并销毁
p2pModule.destroy();

```

### 4. 异常处理

当模块出现异常时，会通过 `msgCallback` 通知出来。如果是p2p链路断开，用户可以根据需要重置p2p模块
``` js
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

### p2pModule.init(object) => Promise\<res\>

初始化

#### 参数

##### object: Object

| 属性 | 类型 | 默认值 | 必填 | 说明 |
| - | - | - | - | - |
| appParams | Object | - | 是 | 客户参数 |

#### 返回值

##### Promise<res: number>

res 的值

| res | 说明 |
| - | - |
| 0 | 成功 |
| -2000 | 参数错误 |
| -2003 | 重复启动 |
| -2201 | Xntp模块重复启动 |
| -2202 | 探测错误 |
| -2301 | 加载本地server错误 |

--------

### p2pModule.resetP2P() => Promise\<res\>

重置p2p模块

#### 返回值

##### Promise<res: number>

res 的值

| res | 说明 |
| - | - |
| 0 | 成功 |
| -2002 | 模块尚未初始化 |
| -2202 | 探测错误 |


--------

### p2pModule.destroy() => void

销毁

--------

### p2pModule.startP2PService(id, streamInfo, callbacks) => Promise\<res\>

开始指定id的xp2p服务

#### 参数

| 参数 | 类型 | 说明 |
| - | - | - |
| id | string | 唯一id |
| streamInfo | Object | 流的具体信息 |
| callbacks | Object | 各种回调函数 |

##### streamInfo: Object

流的具体信息

| 属性 | 类型 | 默认值 | 必填 | 说明 |
| - | - | - | - | - |
| url | string | - | 是 | 源流的地址 |
| codeUrl | string | '' | 否 | 1v多时需要，获取1v多加密code的url |
| productId | string | '' | 否 | 1v1时需要，目标摄像头的 productId |
| deviceName | string | '' | 否 | 1v1时需要，目标摄像头的 deviceName |
| xp2pInfo | string | '' | 否 | 1v1时需要，目标摄像头的 xp2pInfo |

##### callbacks: Object

各种回调函数

| 属性 | 类型 | 默认值 | 必填 | 说明 |
| - | - | - | - | - |
| msgCallback | (event: string, subtype: string, detail: Object) => void | - | 是 | 消息通知 |
| dataCallback | (data: ArrayBuffer) => void | - | 否 | 直播流数据回调，如果设置，会自动调用 startP2PStream 接口启动拉流，不设置则不会启动拉流 |

**callbacks.msgCallback 参数**

| 参数 | 类型 | 说明 |
| - | - | - |
| event | string | 事件名 |
| subtype | string | 子类型 |
| detail | Object | 详细信息 |

event 的值

| event | 说明 |
| - | - |
| 'notify' | 消息通知 |
| 'log' | 日志 |

- event === 'notify' 时，subtype如下，detail暂未使用

| subtype | 说明 |
| - | - |
| 'request' | 开始请求 |
| 'parsed' | 响应头解析成功 |
| 'close' | 主动关闭直播流 |
| 'eof' | 直播流结束 |
| 'disconnect' | 直播流断开 |

- event === 'log' 时，subtype暂未使用，detail是log字符串

**callbacks.dataCallback 参数**

| 参数 | 类型 | 说明 |
| - | - | - |
| data | ArrayBuffer | 视频数据 |

#### 返回值

##### Promise<res: number>

res 的值

| res | 说明 |
| - | - |
| 0 | 成功 |
| -2000 | 参数错误 |
| -2002 | 模块尚未初始化 |
| -2401 | 重复启动p2p服务 |
| -2402 | 拉流出错 |
| -2403 | p2p服务尚未启动 |

--------

### p2pModule.stopP2PService(id) => void

停止指定id的xp2p服务

#### 参数

| 参数 | 类型 | 说明 |
| - | - | - |
| id | string | 唯一id |

--------

### p2pModule.startP2PStream(id, callbacks) => Promise\<res\>

开始指定id的拉流服务

#### 参数

| 参数 | 类型 | 说明 |
| - | - | - |
| id | string | 唯一id |
| callbacks | Object | 各种回调函数 |

##### callbacks: Object

各种回调函数

| 属性 | 类型 | 默认值 | 必填 | 说明 |
| - | - | - | - | - |
| dataCallback | (data: ArrayBuffer) => void | - | 是 | 直播流数据回调 |

**callbacks.dataCallback 参数**

| 参数 | 类型 | 说明 |
| - | - | - |
| data | ArrayBuffer | 视频数据 |

#### 返回值

##### Promise<res: number>

res 的值

| res | 说明 |
| - | - |
| 0 | 成功 |
| -2000 | 参数错误 |
| -2002 | 模块尚未初始化 |
| -2401 | 重复启动p2p服务 |
| -2402 | 启动拉流失败 |
| -2403 | p2p服务尚未启动 |

--------

### p2pModule.stopP2PStream(id) => void

停止指定id的拉流服务

#### 参数

| 参数 | 类型 | 说明 |
| - | - | - |
| id | string | 唯一id |

--------

### p2pModule.startVoiceService(id， recorderManager) => Promise\<res\>

开始指定id的语音对讲服务

#### 参数

| 参数 | 类型 | 说明 |
| - | - | - |
| id | string | 唯一id |
| recorderManager | RecorderManager | 小程序小程序录音管理器 |

#### 返回值

##### Promise<res: number>

res 的值

| res | 说明 |
| - | - |
| 0 | 成功 |
| -2000 | 参数错误 |
| -2002 | 模块尚未初始化 |
| -2401 | 重复启动p2p服务 |
| -2403 | p2p服务尚未启动 |
| -2601 | 启动语音对讲失败 |

--------

### p2pModule.stopVoiceService(id) => void

停止指定id的语音对讲服务

#### 参数

| 参数 | 类型 | 说明 |
| - | - | - |
| id | string | 唯一id |

--------

### p2pModule.sendCommand(id, command) => Promise\<res\>

向指定id发送信令

#### 参数

| 参数 | 类型 | 说明 |
| - | - | - |
| id | string | 唯一id |
| command | string | 信令内容 |

#### 返回值

##### Promise<res: Object>

res 信令返回结果

| 属性 | 类型 | 说明 |
| - | - | - |
| type | string | 结果类型 |
| status | number | HTTP 状态码 |
| data | string | 返回内容 |
| errcode | number | 错误码 |
| errmsg | string | 错误提示语 |

type 的值

| type | 说明 |
| - | - |
| 'success' | 目标ipc返回成功 |
| 'failure' | 目标ipc返回失败 |
| 'error' | 请求失败 |
| 'timeout' | 请求超时 |

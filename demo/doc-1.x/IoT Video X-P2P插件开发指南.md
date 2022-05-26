# 腾讯云物联网 IoT Video X-P2P 插件

## 功能

传统的观看场景，所有观看端都向云端发送HTTP请求获取数据。

在腾讯云 IoT Video P2P 服务中
- 1V1 P2P：观看端通过P2P方式直连摄像头观看直播和本地录像。
- 1V多 P2P：多个观看端和云端建立一个共享P2P网络，观看端之间可以互相分享数据。
  
通过P2P，客户可以大幅降低云端流量，节省相关成本。

## 微信版本要求

- 1v1：微信 8.0.10 以上，基础库 2.19.3 以上
- 1v多：微信 8.0.14 以上，基础库 2.20.2 以上

目前插件所要求的基础库已经能覆盖 95% 以上用户，详见 [基础库版本分布](https://developers.weixin.qq.com/miniprogram/dev/framework/client-lib/version.html)

建议根据需要在小程序后台设置最低基础库版本，设置后能自动提示用户更新微信，详见 [基础库低版本兼容](https://developers.weixin.qq.com/miniprogram/dev/framework/compatibility.html)

## 原理

`X-P2P插件` 是P2P网络中的一个小程序Peer，可以和其他Peer分享数据

`P2P-Player插件` 封装了live-player，可以播放来自本地的http-flv格式的数据

客户小程序的播放控制模块需要组合使用2个插件：
- 客户小程序收到 `P2P-Player插件` 的播放请求后，通知 `X-P2P插件` 开始拉流
- `X-P2P插件` 从云端或其他P2P节点获取数据，并持续返回给客户小程序
- 客户小程序再将数据持续推送至 `P2P-Player插件`，从而实现P2P播放功能

![原理图](../../pic/plugin-xp2p/intro.png)

# CHANGELOG

| 插件版本 | 支持的设备sdk版本 | 描述 |
| - | - | - |
| 2.0.x | 2.4.x | 新增：1V1支持快速出图 |
| 1.3.0 | 2.3.x | 新增：1V1支持语音对讲回音消除（依赖p2p-player插件1.1.0以上版本，且设备端需要支持播放AAC音频） |
| 1.2.0 | 2.3.x | 新增：1V1支持本地文件下载 |
| 1.1.1 | 2.3.x | 优化：检测到本地NAT发生变化时通知调用方 |
| 1.1.0 | 2.3.x | 新增：1V多支持server端的https流，不用另外部署加密code服务 |
| 1.0.x | 2.3.x | 正式版，支持：1V多拉流，1V1拉流、语音对讲、自定义信令 |
| beta | 2.3.x | 内测版，支持1V多P2P和1V1P2P观看摄像头实时监控流 |

# 使用说明

## 1. 准备工作

使用本插件需要：

- 接入腾讯云 IoT Video P2P 服务，获取访问密钥等信息（即后文中的`appParams`），详见 [接入文档](https://cloud.tencent.com/document/product/1131/52735)
- 申请使用 [X-P2P插件](https://mp.weixin.qq.com/wxopen/plugindevdoc?appid=wx1319af22356934bf) 和 [P2P-Player插件](https://mp.weixin.qq.com/wxopen/plugindevdoc?appid=wx9e8fbc98ceac2628) 
- 有 live-player 的权限，详见 [live-player官方文档](https://developers.weixin.qq.com/miniprogram/dev/component/live-player.html)
- 如果使用语音对讲、双向音视频功能，需要有 live-pusher 的权限，详见 [live-pusher官方文档](https://developers.weixin.qq.com/miniprogram/dev/component/live-pusher.html)
- 如果使用 1v多 模式，需要将flv流的域名加到小程序的 `request合法域名` 和 `tcp合法域名` 配置中，详见 [服务器域名配置官方文档](https://developers.weixin.qq.com/miniprogram/dev/framework/ability/network.html#1.%20%E6%9C%8D%E5%8A%A1%E5%99%A8%E5%9F%9F%E5%90%8D%E9%85%8D%E7%BD%AE)

申请通过后，可以利用demo熟悉基本功能

demo项目地址：https://github.com/tencentyun/iot-video-p2p-doc/tree/master/demo/miniprogram

运行前需要修改一些配置：
- 替换 project.config.json 里的小程序 appid
- 替换 config/config.js 里的客户参数 appParams
- 1v1模式，替换 config/devcies.js 里预置的设备信息
- 1v多模式，替换 config/streams.js 里预置的server流信息

注意事项：
- 要求微信 8.0.10 以上，基础库 2.19.3 以上，低版本需提示升级
- 开发者工具不支持 live-player 和 TCPServer，所以不能在开发者工具中调试，也不支持真机调试，需使用二维码预览的方式在真机运行

## 2. 在配置中引入插件

``` js
// 在app.json里面引入插件，注意尽量用最新的插件版本号
{
  "plugins": {
    "wechat-p2p-player": {
      "version": "1.1.2",
      "provider": "wx9e8fbc98ceac2628"
    },
    "xp2p": {
      "version": "1.3.0",
      "provider": "wx1319af22356934bf"
    }
  }
}
```

## 3. 基本流程

p2p监控需要2个插件配合使用，参考 demo 中的组件 [iot-p2p-common-player](https://github.com/tencentyun/iot-video-p2p-doc/tree/master/demo/miniprogram/components/iot-p2p-common-player)。

1v1和1v多有各自的功能特性，参考 demo 中的组件 [iot-p2p-player-ipc](https://github.com/tencentyun/iot-video-p2p-doc/tree/master/demo/miniprogram/components/iot-p2p-player-ipc) 和 [iot-p2p-player-server](https://github.com/tencentyun/iot-video-p2p-doc/tree/master/demo/miniprogram/components/iot-p2p-player-server)，他们在 common-player 的基础上进行了简单扩展。

基本流程如下：

![流程图](../../pic/plugin-xp2p/flow.png)

插件状态转换如下：

![状态图](../../pic/plugin-xp2p/common-player.png)

### 获取插件

``` js
// 获取插件
const videoPlugin = requirePlugin('iotvideo-weapp-plugin');
const p2pModule = videoPlugin.p2p;
```

### 初始化模块

初始化时会用到接入腾讯云 IOT Video P2P 服务时收到的 `appParams`

这部分和目标设备无关，建议尽早初始化，提前探测网络

``` js
// 初始化 IoTP2PModule，建议尽早初始化，提前探测网络状态
p2pModule
  .init({
    appParams: {
      appid: $yourTCloudAppId,
      appOauthId: $yourAppOauthId,
      appKey: $yourAppKey,
      appSecretKey: $yourAppSecretKey,
      appPackage: $yourAppPackage,
    },
    eventHandler: (event, detail) => {
      // 各种本地NAT相关的事件通知，取值见api说明，要求最低版本 1.1.1
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

### 开始建立p2p连接

根据设备的 productId、deviceName、xp2pInfo 等信息开始建立p2p连接

注意：
- 一个设备只能有一个p2p连接

``` js
// 开始建立p2p连接，注意不能同时存在相同的 ipcId
p2pModule.startP2PService(ipcId, ipcInfo, {
  msgCallback: (event, subtype, detail) => {
    // 各种消息通知，取值见api说明
  },
});

```

``` js
// 支持修改 callbacks
p2pModule.updateServiceCallbacks(ipcId, {
  msgCallback: (event, subtype, detail) => {
    // 各种消息通知，取值见api说明
  },
});

```

### 开始拉流

指定拉流类型、清晰度等参数拉流

注意：
- 需要在收到 `P2P-Player插件` 的 playerStartPull 消息之后才能开始拉流，否则数据无法传递给 live-player
- 一个p2p连接只能有一个拉流请求，如果需要观看另一个流，可以 stopStream 然后用新参数重新 startStream


``` js
// 在 p2p-player 插件开始请求后启动p2p拉流，注意需要先调用 startP2PService
// 1.3.0 之前需使用旧接口名 startP2PStream
p2pModule.startStream(ipcId, {
  // 不指定 flv 就从 startP2PService 的参数里解析
  flv: {
    filename: 'ipc.flv',
    params: 'action=live&channel=0&quality=high',
  },
  dataCallback: (data) => {
    // data 是 ArrayBuffer 类型，在这里把数据推送给 p2p-player
  },
});

```

### 结束拉流

``` js
// 在 p2p-player 插件结束请求后关闭p2p拉流
// 1.3.0 之前需使用旧接口名 stopP2PStream
p2pModule.stopStream(ipcId);

```

### 关闭p2p通信

``` js
// 关闭p2p通信，如果正在拉流或者对讲，也会一起关闭
// 1.3.0 之前需使用旧接口名 stopServiceById
p2pModule.stopP2PService(ipcId);

```

### 销毁模块

可以在小程序销毁时一并销毁

``` js
// 销毁 IoTP2PModule，可以在小程序销毁时一并销毁
p2pModule.destroy();

```

## 4. 1v1 扩展功能

对于1v1，在 startP2PService 之后，可以直接与设备进行交互

### 发送信令

通常用来获取设备状态、控制设备ptz等

有2类信令：
- 内置信令：信令格式固定，新增/修改信令需要设备sdk支持
- 自定义信令：可以自行定义，新增/修改信令不需要升级设备sdk

信令说明：https://cloud.tencent.com/document/product/1131/61744
  
***信令接口***
``` js
// 发送信令
p2pModule.sendCommand(ipcId, command);
```

***内置信令参数***
- action：固定为 inner_define
- channel：对于ipc设备固定为0，对于nvr设备为子设备channel
- cmd：详见 https://cloud.tencent.com/document/product/1131/61744
- params：不同的cmd需要不同的参数，详见 https://cloud.tencent.com/document/product/1131/61744

``` js
// 内置信令示例
p2pModule
  .sendCommand(ipcId, `action=inner_define&channel=0&cmd=${cmd}&${params}`)
  .then((res) => {
    // res 格式见API说明
    console.log('sendCommand res', res);
    if (res.type === 'success') {
      // Success handler
    } else {
      // Error handler
    }
  })
  .catch((err) => {
    console.error('sendCommand error', err);
  });

```

***自定义信令参数***
- action：固定为 user_define
- channel：对于ipc设备固定为0，对于nvr设备为子设备channel
- userParams：自定义，比如可以用 `cmd=${JSON.stringify(cmdObj)}`

``` js
// 自定义信令示例
p2pModule
  .sendCommand(ipcId, `action=user_define&channel=0&${userParams}`)
  .then((res) => {
    // res 格式见API说明
    console.log('sendCommand res', res);
    if (res.type === 'success') {
      // Success handler
    } else {
      // Error handler
    }
  })
  .catch((err) => {
    console.error('sendCommand error', err);
  });
```

### 语音对讲（PCM编码，不支持回音消除）

利用 [RecorderManager](https://developers.weixin.qq.com/miniprogram/dev/api/media/recorder/RecorderManager.html) 采集语音

PCM编码，不支持回音消除

***语音接口***
``` js
// 开始语音对讲
// 1.3.0 之前需使用旧接口名 startVoiceService
p2pModule.startVoice(ipcId, recorderManager, options, callbacks);

// 停止语音对讲
// 1.3.0 之前需使用旧接口名 stopVoiceService
p2pModule.stopVoice(ipcId);
```

***示例***
``` js
// 语音对讲需要recorderManager，用来采集语音
const recorderManager = wx.getRecorderManager();

// 说明见微信官方文档中 RecorderManager.start 的参数
const recorderOptions = {
  numberOfChannels: 1, // 录音通道数
  sampleRate: 8000, // 采样率
  encodeBitRate: 16000, // 编码码率
};

// 开始语音对讲
startVoide() {
  // 检查小程序对讲状态，不要重复发起对讲

  // 发送信令检查设备当时能否接收对讲请求（设备同时只能接收1路对讲），详见信令文档的 get_device_st

  // 检查通过，开始语音对讲请求
  p2pModule
    .startVoice(ipcId, recorderManager, recorderOptions, {
      onPause: (res) => {
        // 简单点，recorder暂停就停止语音对讲
        this.stopVoice();
      },
      onStop: (res) => {
        if (!res.willRestart) {
          // 如果是到达最长录音时间触发的，插件会自动续期，不自动restart的才需要stopVoice
          this.stopVoice();
        }
      },
    })
    .then((res) => {
      // Success handler
    })
    .catch((err) => {
      // Error handler
      this.stopVoice();
    });
}

// 停止语音对讲
stopVoice() {
  // 检查小程序对讲状态，对讲中的才需要停止

  // 停止语音请求 
  p2pModule.stopVoice(ipcId);
}
```

### 语音对讲（AAC编码，支持回音消除，要求xp2p插件1.3.x以上，player插件1.1.x以上）

利用 P2P-Player 插件中的 p2p-pusher 组件采集语音，原理是先用 [live-pusher](https://developers.weixin.qq.com/miniprogram/dev/component/live-pusher.html) 采集，然后转成 http-flv 数据通知出来

AAC编码，可设置开启回音消除

注意：需要设备端支持相关功能

***语音接口***
``` js
// 开始语音对讲
p2pModule.startVoiceData(ipcId, options, callbacks);

// 停止语音对讲
p2pModule.stopVoice(ipcId);
```

***p2p-pusher组件常用参数***

语音对讲场景：
- enableCamera: false
- enableMic: true

p2p-pusher透传了live-pusher的参数，更多参数详见 [live-pusher官方文档](https://developers.weixin.qq.com/miniprogram/dev/component/live-pusher.html)

``` html
<p2p-pusher
  id="{{pusherId}}"
  mode="RTC"
  enableCamera="{{enableCamera}}"
  enableMic="{{enableMic}}"
  enableAgc="{{true}}"
  enableAns="{{true}}"
  audioQuality="low"
  audioVolumeType="voicecall"
  bind:pusherReady="onPusherReady"
  bind:pusherStartPush="onPusherStartPush"
  bind:pusherFlvHeader="onPusherFlvHeader"
  bind:pusherFlvAudioTag="onPusherFlvAudioTag"
  bind:pusherFlvVideoTag="onPusherFlvVideoTag"
  bind:pusherFlvDataTag="onPusherFlvDataTag"
  bind:pusherClose="onPusherClose"
  bind:pusherError="onPusherError"
  bind:error="onLivePusherError"
  bind:statechange="onLivePusherStateChange"
  bind:netstatus="onLivePusherNetStatusChange"
/>
```

***示例***

注意：示例中的 this.data.pusher 是封装过的 [iot-p2p-common-pusher组件](https://github.com/tencentyun/iot-video-p2p-doc/tree/master/demo/miniprogram/components/iot-p2p-common-pusher)，不是直接用的p2p-pusher

``` js
// 开始语音对讲
startVoide() {
  // 检查小程序对讲状态，不要重复发起对讲

  // 设备只能支持1路对讲，所以要先发信令检查设备当时能否接受对讲，详见信令文档的 get_device_st

  // 检查通过，开始语音对讲
  p2pModule
    .startVoiceData(ipcId, options, {
      onStop: () => {
        this.stopVoice();
      },
      onComplete: () => {
        this.stopVoice();
      },
    })
    .then((writer) => {
      // 启动pusher采集语音
      this.data.pusher.start({
        writer,
        fail: (err) => {
          // Error handler
          this.stopVoice();
        },
      });
    })
    .catch((err) => {
      // Error handler
      this.stopVoice();
    });
}

// 停止语音对讲
stopVoice() {
  // 检查小程序对讲状态，对讲中的才需要停止

  // 停止pusher采集语音
  this.data.pusher.stop();

  // 停止语音请求 
  p2pModule.stopVoice(ipcId);
}
```

### 本地文件下载（要求xp2p插件1.2.x以上）

先用信令`get_file_list`获取文件列表，再指定文件名下载

注意：需要设备端支持相关功能

***下载接口***
``` js
// 开始下载文件
p2pModule.startLocalDownload(ipcId, options, callbacks);

// 停止下载文件
p2pModule.stopLocalDownload(ipcId);
```

***示例***
``` js
// 下载视频文件示例：
const file = { file_name: 'p2p_demo_file.mp4' };
const params = `channel=0&file_name=${file.file_name}&offset=0`;

// 临时文件路径
const filePath = `${wx.env.USER_DATA_PATH}/${file.file_name.replace('/', '_')}`;

// 使用FileSystemManager组装文件
const fileSystemManager = wx.getFileSystemManager();

p2pModule.startLocalDownload(ipcId, { urlParams: params }, {
  onChunkReceived: (chunk) => {
    // 接收chunk包并组装文件
    fileSystemManager.appendFileSync(filePath, chunk, 'binary')
  },
  onComplete: () => {
    // 保存组装的临时视频文件到相册
    wx.saveVideoToPhotosAlbum({
      filePath,
      success(res) {
        // saved file handler
      },
      fail(res) {
        // Error handler
      }
    });
  },
  onFailure: (result) => {
    // Error handler
  },
  onError: (result) => {
    // Error handler
  },
});
```

### 1v1转1vN（要求xp2p插件2.0.x以上，设备sdk 2.4.x以上)

整合了1v1和1vN的功能, 开启此功能后, 1v1观看摄像头的人数超过摄像头最大承载人数时, 后进入的用户会自动使用1vN模式

开启方法: 见startP2PService接口的streamLiveDomain参数

注意：需要设备端支持相关功能

# 常见问题

拉流时需要 `xp2p插件` 和 `p2p-player插件` 同时使用，2个插件的错误事件都需要处理

下面对照 iot-p2p-common-player 组件的启播流程来说明

![流程图](../../pic/plugin-xp2p/common-player.png)

## 1 xp2p插件启动错误（ServiceStarted之前）

### 1.1 P2PInitError
- -2000 参数错误：检查appParams各字段是否填写完整
- -2003 重复启动：单例，只需要启动1次
- 超时：检查本地网络是否正常

### 1.2 ServiceStartError
- -2401 重复启动：同一个设备只能有1个连接，如果重连需要先stop前一个

## 2 p2p-player插件启动错误（PlayerReady之前）

### 2.1 PlayerError
- 检查环境：微信 8.0.10 以上，基础库 2.19.3 以上
- 不支持开发者工具调试，需要真机二维码预览运行

### 2.2 LivePlayerError
- 透传 live-player 的error事件

## 3 播放相关错误

### 3.1 进入监控页，第一次触发播放，有时live-player并没有开始播放

通过代码 playerCtx.play() 来触发播放，有时候 live-player 并没有真正开始播放，建议按这个流程处理：
- 进入监控页，启动p2p和创建player并行，初始 autoplay 为 false
- playerReady 并且 startP2PService 成功（注意要2个都完成）
  - 如果 autoplay 为 false，把它设为 true
  - 如果 autoplay 已经是 true（比如p2p连接断开后重连），调用 playerCtx.play()

### 3.2 live-player已经开始播放，通过 playerStartPull 事件触发了xp2p插件拉流，但是xp2p插件没收到数据

请检查设备是否在线，以及小程序拿到的xp2pInfo是否正确

### 3.3 播放一段时间之后，收到xp2p插件的连接断开事件

xp2p插件会通过 `msgCallback` 通知各种事件。

如果是连接断开，可能有多种情况：设备离线、设备网络变化、设备停止推流、本地网络状态变化等等，通常处理是退出监控页，用户检查之后再重新进入页面。

注意：在退出时可能需要重置p2p模块，详见后文 **“退出监控页时的处理”**。

``` js
// xp2p插件消息处理
onP2PMessage(event, subtype, detail) {
  switch (event) {
    case p2pModule.XP2PEventEnum.Notify:
      console.log('onP2PMessage, Notify', subtype, detail);
      if (subtype === p2pModule.XP2PNotify_SubType.Disconnect) {
        // p2p链路断开，弹个提示，退出监控页
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

### 3.4 网络变化后，xp2p插件收不到数据，live-player自动重试数次后提示播放失败

网络变化会导致p2p模块收不到数据，live-player在一段时间没收到数据后会触发自动重试。

可以在p2p-player组件的 statechange 事件 2103 中检查，如果网络变化，就认为播放失败。

注意，可以区分1v1/1v多做不同处理：
- 1v1：网络变化后就不能再次连接上ipc，所以需要调用 checkCanRetry 检查，不能重试的就算播放失败
- 1v多：网络变化但还是有连接时（比如 wifi->4g），重试可以成功，只是后续会一直从server拉流，无法切换到从其他节点拉流
  - 为了省流量，可以和1v1一样，调用 checkCanRetry 检查
  - 为了体验稳定，可以不特别处理，live-player 会继续重试

``` js
// p2p-player组件消息处理
onLivePlayerStateChange({ detail }) {
  switch (detail.code) {
    case 2103: // 网络断连, 已启动自动重连
      console.error('onLivePlayerStateChange', detail.code, detail);
      if (/errCode:-1004(\D|$)/.test(detail.message) || /Failed to connect to/.test(detail.message)) {
        // 无法连接本地服务器
        /* 详见下一节 */
      } else {
        // 这里一般是一段时间没收到数据，或者数据不是有效的视频流导致的
        /*
          这里可以区分1v1/1v多做不同处理：
          - 1v1：网络变化后就不能再次连接上ipc，所以需要调用 checkCanRetry 检查，不能重试的就算播放失败
          - 1v多：网络变化但还是有连接时（比如 wifi->4g），重试可以成功，只是后续会一直从server拉流，无法切换到从其他节点拉流
            - 为了省流量，可以和1v1一样，调用 checkCanRetry 检查
            - 为了体验稳定，可以不特别处理，live-player 会继续重试
          这里为了简单统一处理
         */
        this.checkCanRetry();
      }
      break;
  }
}
```

### 3.5 退后台一段时间再回来，live-player已经开始播放，但是没触发 playerStartPull 事件

退后台一段时间，部分系统会中断网络服务，导致player插件启动的本地server无法再收到请求。

对于player插件1.1.0以上版本，会收到playerError(code: 'WECHAT_SERVER_ERROR')

对于player插件1.0.x版本，没有单独的事件，但是可以在p2p-player组件的 statechange 事件 2103 中通过详情间接判断。

通常处理也是退出监控页，退出时重置本地server，用户重新进入页面后创建的player就能正常触发事件了。

``` js
// p2p-player组件消息处理
onLivePlayerStateChange({ detail }) {
  switch (detail.code) {
    case 2103: // 网络断连, 已启动自动重连
      console.error('onLivePlayerStateChange', detail.code, detail);
      if (/errCode:-1004(\D|$)/.test(detail.message) || /Failed to connect to/.test(detail.message)) {
        // 无法连接本地服务器
        xp2pManager.needResetLocalServer = true;

        // 这时其实网络状态应该也变了，但是网络状态变化事件延迟较大，networkChanged不一定为true，所以主动把 networkChanged 也设为true
        xp2pManager.networkChanged = true;

        // 销毁p2p-player组件，否则会多次重试，多次收到 2103
        
        // 弹个提示，退出监控页
      } else {
        // 这里一般是一段时间没收到数据，或者数据不是有效的视频流导致的
        /* 详见上一节 */
      }
      break;
  }
}
```

## 4 退出监控页时的处理

退出监控页时，根据标记重置插件

``` js
// 退出监控页时的处理
onUnload() {
  // 各种针对当前设备的清理 stopVoice, stopStream, stopP2PService 等等

  // 下面是对插件的处理
  if (xp2pManager.networkChanged) {
    // 如果本地网络变化，需要重置p2p
    try {
      console.log('networkChanged, resetP2P when exit');
      xp2pManager.resetP2P();
    } catch (err) {
      console.error('resetP2P error', err);
    }
  }

  if (xp2pManager.needResetLocalServer) {
    // 如果本地Server出错，需要重置player插件
    try {
      console.log('needResetLocalServer, resetLocalServer when exit');
      xp2pManager.resetLocalServer();
    } catch (err) {
      console.error('resetLocalServer error', err);
    }
  }
}
```

## 5 信令相关

### 5.1 设备支持哪些内置信令

详见 https://cloud.tencent.com/document/product/1131/61744

### 5.2 如何用信令控制设备PTZ

由于不同设备对PTZ的实现不同，这部分是用自定义信令实现的。

demo中的PTZ信令实现如下：

``` js
const cmdObj = {
  topic: 'ptz',
  data: {
    // 'ptz_up_press' | 'ptz_down_press' | 'ptz_left_press' | 'ptz_right_press' | 'ptz_release_pre'
    cmd: 'ptz_up_press',
  },
};
const userParams: `cmd=${JSON.stringify(cmdObj)}`;
p2pModule
  .sendCommand(ipcId, `action=user_define&channel=0&${userParams}`)
  .then((res) => {
    // res 格式见API说明
    console.log('sendCommand res', res);
    if (res.type === 'success') {
      // Success handler
    } else {
      // Error handler
    }
  })
  .catch((err) => {
    console.error('sendCommand error', err);
  });
```

## 6 语音对讲相关

### 6.1 部分机型发起对讲时黑屏

利用 RecorderManager 方式采集语音，在开始录音时会有一些系统调用，影响页面渲染。

可以尝试提前启动并停止录音，以减少再次启动时的性能消耗（但不能完全消除影响），注意启动录音需要 `scope:record` 权限。

``` js
const recorderManager = wx.getRecorderManager();
recorderManager.onStart(() => {
  // 提前启动，开始后就停止，不用实际录制
  recorderManager.stop();
});
recorderManager.start(options);
```
### 6.2 能否支持回音消除

RecorderManager 方式不支持。

P2P-Pusher 方式可通过设置 enableAns 支持。

### 6.3 设备播放 AAC 音频异常

检查设备是否支持播放 AAC 音频，部分设备只支持 PCM 音频。

尝试将 p2p-pusher 的 audioQuality 设置为 "low"，部分设备只支持低音质语音。

## 7 下载相关

### 7.1 下载的视频文件能否保存到系统相册

下载的文件会先保存在小程序文件系统的 [本地用户文件](https://developers.weixin.qq.com/miniprogram/dev/framework/ability/file-system.html#%E6%9C%AC%E5%9C%B0%E7%94%A8%E6%88%B7%E6%96%87%E4%BB%B6)，可以用 [FileSystemManager](https://developers.weixin.qq.com/miniprogram/dev/api/file/FileSystemManager.html) 来管理。

要把视频文件从 `小程序本地用户文件` 保存到 `系统相册`，需要调用 [wx.saveVideoToPhotosAlbum](https://developers.weixin.qq.com/miniprogram/dev/api/media/video/wx.saveVideoToPhotosAlbum.html) 接口来保存，但是能否保存成功取决于系统是否支持该视频格式：
- 如果是mp4文件，Android 和 iOS 系统都支持
- 如果是flv文件
  - Android系统下大部分机型支持
  - iOS系统不支持

# API 说明

## 整体模块相关

### init

p2pModule.init(object) => Promise\<res\>

初始化

***参数***

**object: Object**

| 属性 | 类型 | 默认值 | 必填 | 说明 |
| - | - | - | - | - |
| appParams | Object | - | 是 | 客户参数 |
| eventHandler | (event: string, detail: Object) => void | - | 否 | 本地NAT事件通知，要求最低版本 1.1.1 |

eventHandler 参数

| 参数 | 类型 | 说明 |
| - | - | - |
| event | string | 事件名 |
| detail | Object | 详细信息 |

event 的值

| event | 说明 |
| - | - |
| 'natChanged' | 本地NAT发生变化 |
| 'natError' | 本地NAT探测失败 |

***返回值***

Promise<res: number>

res 的值

| res | 说明 |
| - | - |
| 0 | 成功 |
| -2000 | 参数错误 |
| -2003 | 模块重复启动 |
| -2201 | Xntp模块重复启动 |
| -2202 | 探测错误 |
| -2301 | 加载本地server错误 |

--------

### resetP2P

p2pModule.resetP2P() => Promise\<res\>

重置模块

***参数***

无

***返回值***

Promise<res: number>

res 的值

| res | 说明 |
| - | - |
| 0 | 成功 |
| -2002 | 模块尚未初始化 |
| -2202 | 探测错误 |


--------

### destroy

p2pModule.destroy() => void

销毁模块

***参数***

无

***返回值***

无

--------

### getUUID

p2pModule.getUUID() => string

获取UUID，可以用来查XP2P的log

init 之后调用，初始化失败也能获取到

***参数***

无

***返回值***

uuid: string

--------

## p2p链路相关

### startP2PService

p2pModule.startP2PService(id, streamInfo, callbacks) => Promise\<res\>

开始指定id的xp2p服务

***参数***

| 参数 | 类型 | 说明 |
| - | - | - |
| id | string | 唯一id |
| streamInfo | Object | 流的具体信息 |
| callbacks | Object | 各种回调函数 |

**streamInfo: Object**

流的具体信息

| 属性 | 类型 | 默认值 | 必填 | 说明 |
| - | - | - | - | - |
| url | string | - | 是 | 源流的地址<br/>1vN时：要求https，支持 [wx.request 开启 enableChunked](https://developers.weixin.qq.com/miniprogram/dev/api/network/request/wx.request.html) 访问<br/>1v1时：`http://XP2P_INFO.xnet/ipc.p2p.com/ipc.flv?${flvParams}` |
| productId | string | '' | 否 | 1v1时需要，目标摄像头的 productId |
| deviceName | string | '' | 否 | 1v1时需要，目标摄像头的 deviceName |
| xp2pInfo | string | '' | 否 | 1v1时需要，目标摄像头的 xp2pInfo |
| liveStreamDomain | string | '' | 否 | 1v1时需要，1vN向server拉流的域名. 填写代表开启1v1转1vn, 此时小程序会根据摄像头的承载能力, 选择1v1直拉还是server中转拉流. 走中转server的用户会互相P2P |

**callbacks: Object**

各种回调函数

| 属性 | 类型 | 默认值 | 必填 | 说明 |
| - | - | - | - | - |
| msgCallback | (event: string, subtype: string, detail: Object) => void | - | 是 | 消息通知 |
| dataCallback | (data: ArrayBuffer) => void | - | 否 | 直播流数据回调，如果设置，会自动调用 startP2PStream 接口启动拉流，不设置则不会启动拉流 |

- callbacks.msgCallback 参数

| 参数 | 类型 | 说明 |
| - | - | - |
| event | string | 事件名 |
| subtype | string | 子类型 |
| detail | Object | 详细信息 |

event 的值

| event | 说明 |
| - | - |
| 'notify' | 消息通知 |
| 'log' | 日志，目前未使用 |

event === 'notify' 时，subtype 和 detail 如下

| subtype | 说明 | detail |
| - | - | - |
| 'connected' | 连接成功 | - |
| 'request' | 开始请求 | - |
| 'parsed' | 响应头解析成功 | { status: number; headers: { [key: string]: string } } |
| 'close' | 主动关闭直播流 | - |
| 'eof' | 直播流结束 | - |
| 'disconnect' | 直播流断开 | - |

event === 'log' 时，subtype是log等级，detail是log字符串

| subtype | 说明 |
| - | - |
| 'log' | 普通信息 |
| 'info' | 重要信息 |
| 'warn' | 警告 |
| 'error' | 错误 |

- callbacks.dataCallback 参数

| 参数 | 类型 | 说明 |
| - | - | - |
| data | ArrayBuffer | 视频数据 |

***返回值***

Promise<res: number>

res 的值

| res | 说明 |
| - | - |
| 0 | 成功 |
| -2000 | 参数错误 |
| -2001 | 解析xp2pInfo错误 |
| -2002 | 模块尚未初始化 |
| -2401 | 重复启动p2p服务 |
| -2402 | 启动拉流失败 |
| -2403 | p2p服务尚未启动 |

--------

### updateServiceCallbacks

p2pModule.updateServiceCallbacks(id, callbacks) => res

更新指定xp2p服务的callbacks

***参数***

| 参数 | 类型 | 说明 |
| - | - | - |
| id | string | 唯一id |
| callbacks | Object | 各种回调函数，同 startP2PService 的 callbacks 参数 |

***返回值***

res: number

res 的值

| res | 说明 |
| - | - |
| 0 | 成功 |
| -2000 | 参数错误 |

--------

### stopP2PService

p2pModule.stopP2PService(id) => void

停止指定id的xp2p服务

***参数***

| 参数 | 类型 | 说明 |
| - | - | - |
| id | string | 唯一id |

***返回值***

无

--------

## p2p拉流相关

### startStream

p2pModule.startStream(id, params) => Promise\<res\>

开始指定id的拉流请求

***参数***

| 参数 | 类型 | 说明 |
| - | - | - |
| id | string | 唯一id |
| params | Object | 流的具体参数和回调函数 |

**params: Object**

各种回调函数

| 属性 | 类型 | 默认值 | 必填 | 说明 |
| - | - | - | - | - |
| dataCallback | (data: ArrayBuffer) => void | - | 是 | 直播流数据回调 |
| flv | { filename: string; params: string } | - | 否 | 不指定就从 startP2PService 的参数中解析 |

***返回值***

Promise<res: number>

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

### stopStream

p2pModule.stopStream(id) => void

停止指定id的拉流请求

***参数***

| 参数 | 类型 | 说明 |
| - | - | - |
| id | string | 唯一id |

***返回值***

无

--------

## 1V1 扩展功能

### sendCommand

p2pModule.sendCommand(id, command) => Promise\<res\>

向指定id发送信令

***参数***

| 参数 | 类型 | 说明 |
| - | - | - |
| id | string | 唯一id |
| command | string | 信令内容 |

***返回值***

Promise<res: Object>

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

--------

### startVoice

p2pModule.startVoice(id, recorderManager, options, callbacks) => Promise\<res\>

开始指定id的语音对讲

***参数***

| 参数 | 类型 | 说明 |
| - | - | - |
| id | string | 唯一id |
| recorderManager | RecorderManager | 录音管理器 |
| options | RecorderManagerStartOption | 录音参数，format 需设置为 PCM |
| callbacks | Object | 各种回调函数 |

**callbacks: Object**

各种回调函数

| 属性 | 类型 | 默认值 | 必填 | 说明 |
| - | - | - | - | - |
| onStart | () => void | - | 否 | 参考 RecorderManager.onStart |
| onPause | ({ inInterruption: boolean }) => void | - | 否 | 参考 RecorderManager.onPause，参数增加属性 inInterruption |
| onResume | () => void | - | 否 | 参考 RecorderManager.onStart |
| onStop | ({ willRestart: boolean }) => void | - | 否 | 参考 RecorderManager.onStop，参数增加属性 willRestart |

***返回值***

Promise<res: number>

res 的值

| res | 说明 |
| - | - |
| 0 | 成功 |
| -2000 | 参数错误 |
| -2002 | 模块尚未初始化 |
| -2401 | 重复启动p2p服务 |
| -2403 | p2p服务尚未启动 |
| -2601 | 启动语音对讲失败 |

### startVoiceData

p2pModule.startVoiceData(id, options, callbacks) => Promise\<res\>

开始指定id的语音对讲，自定义语音数据

***参数***

| 参数 | 类型 | 说明 |
| - | - | - |
| id | string | 唯一id |
| options | Object | 请求参数，{ urlParams?: string } |
| callbacks | Object | 各种回调函数 |

**callbacks: Object**

各种回调函数

| 属性 | 类型 | 默认值 | 必填 | 说明 |
| - | - | - | - | - |
| onStop | () => void | - | 否 | 语音停止回调 |
| onSuccess | (result: XP2PRequestResult) => void | - | 否 | 语音请求成功，status: 2xx |
| onFailure | (result: XP2PRequestResult) => void | - | 否 | 语音请求失败，status: 非2xx |
| onError | (result: XP2PRequestResult) => void | - | 否 | 语音请求失败，未收到response |
| onComplete | () => void | - | 否 | 语音请求结束（成功、失败都会执行） |

***返回值***

Promise<writer: XP2PVoiceDataWriter>

通过 writer 向请求里写语音数据

| 属性 | 类型 | 说明 |
| - | - | - |
| addChunk | (chunk: ArrayBuffer) => void | 向请求里写语音数据 |

--------

### stopVoice

p2pModule.stopVoice(id) => void

停止指定id的语音对讲

***参数***

| 参数 | 类型 | 说明 |
| - | - | - |
| id | string | 唯一id |

***返回值***

无

--------

### startLocalDownload

p2pModule.startLocalDownload(ipcId, options, callbacks) => Promise\<res\>

开始指定id的本地文件下载

***参数***

| 参数 | 类型 | 说明 |
| - | - | - |
| ipcId | string | 唯一Id |
| options | XP2PLocalDownloadOptions | 下载参数，{ urlParams?: \`channel=0&file_name=${file.file_name}&offset=0\` } |
| callbacks | XP2PLocalDownloadCallbacks | 各种回调函数 |


**options: XP2PLocalDownloadOptions**

下载参数

| 属性 | 类型 | 默认值 | 必填 | 说明 |
| - | - | - | - | - |
| urlParams | string | - | 是 | 文件下载的URL，示例：\`_crypto=off&channel=0&file_name=${file.file_name}&offset=0\` |

**callbacks: XP2PLocalDownloadCallbacks**

各种回调函数

| 属性 | 类型 | 默认值 | 必填 | 说明 |
| - | - | - | - | - |
| onChunkReceived | (chunk: ArrayBuffer) => void | - | 是 | 文件流的chunk包 |
| onComplete | () => void | - | 是 | 文件流传输完成的回调函数，成功失败都会调用，调用完成后自动关闭p2p连接 |
| onHeadersReceived | (result: { status: number; headers: Headers }) => void | - | 否 | 响应头解析成功的回调 |
| onSuccess | (result: XP2PLocalDownloadResult) => void | - | 否 | 文件传输成功的回调，调用顺序早于onComplete |
| onFailure | (result: XP2PLocalDownloadResult) => void | - | 否 | 文件传输失败的回调，调用顺序早于onComplete，会自动断开p2p连接 |
| onError | (result: XP2PLocalDownloadResult) => void | - | 否 | 文件传输出错的回调 |

- 回调函数参数

result: XP2PLocalDownloadResult

| 属性 | 类型 | 默认值 | 必填 | 说明 |
| - | - | - | - | - |
| status | number | - | 是 | http 状态码 |
| headers | Headers | - | 是 | http 响应头 |
| data | ArrayBuffer | - | 否 | 响应的数据包 |
| errcode | number | - | 否 | 错误码 |
| errmsg | string | - | 否 | 错误信息 |

***返回值***

Promise<res: number>

res 的值

| res | 说明 |
| - | - |
| 0 | 成功 |
| -2000 | 参数错误 |
| -2002 | 模块尚未初始化 |
| -2401 | 重复启动p2p服务 |
| -2403 | p2p服务尚未启动 |
| -2701 | 文件下载失败 |

--------

### stopLocalDownload

p2pModule.stopLocalDownload(ipcId) => void

停止指定id的本地文件下载

***参数***

| 参数 | 类型 | 说明 |
| - | - | - |
| ipcId | string | 唯一id |

***返回值***

无

--------

# 附录：错误码汇总

| 错误码 | 说明 |
| - | - |
| 0 | 成功 |
| -2000 | 参数错误 |
| -2001 | 解析xp2pInfo错误 |
| -2002 | 模块尚未初始化 |
| -2003 | 模块重复启动 |
| -2004 | 不支持的操作 |
| -2005 | 设备版本过低 |
| -2201 | XNTP模块重复启动 |
| -2202 | 探测错误 |
| -2301 | 加载本地server错误 |
| -2401 | 重复启动p2p服务 |
| -2402 | 启动拉流失败 |
| -2403 | p2p服务尚未启动 |
| -2404 | 当前环境不支持p2p服务 |
| -2501 | 数据加密失败 |
| -2502 | 数据解密失败 |
| -2601 | 启动语音对讲失败 |
| -2701 | 文件下载失败 |
| -2801 | 1v1转1vN，查询设备状态错误 |

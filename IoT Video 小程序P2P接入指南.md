# 腾讯云IoT Video 小程序 P2P接入指南

## 介绍

通过腾讯云IoT Video小程序P2P服务，引入IoT Video P2P插件和P2P-Player插件，可实现摄像头和小程序直接打洞传输视频流；配合云端的server SDK，可实现小程序和小程序，小程序和APP之间的数据共享。

## 前提条件

- 申请腾讯云 IoT Video P2P 服务，获取访问密钥
- 有使用 live-player 的权限，详见[官方文档](https://developers.weixin.qq.com/miniprogram/dev/component/live-player.html)
- 微信 8.0.7以上 基础库 2.18.0以上
- 向腾讯云IoT Video团队申请[IoT Video P2P插件](https://github.com/tencentyun/iot-video-p2p-doc/blob/master/IoT%20Video%20X-P2P%E6%8F%92%E4%BB%B6%E5%BC%80%E5%8F%91%E6%8C%87%E5%8D%97.md)和[IoT Video P2P-Player插件](https://github.com/tencentyun/iot-video-p2p-doc/blob/master/IoT%20Video%20P2P-Player%E6%8F%92%E4%BB%B6%E5%BC%80%E5%8F%91%E6%8C%87%E5%8D%97.md)

## 接入指引

### 接入流程图

![](https://github.com/tencentyun/iot-video-p2p-doc/blob/master/pic/%E5%B0%8F%E7%A8%8B%E5%BA%8FP2P%E6%9E%B6%E6%9E%84%E5%9B%BE.png)

- 1、初始化阶段：

  1-1：小程序Demo或自有小程序引用IoT Video P2P-Player，返回`livePlayerContext`， 可以直接对`live-player`的context进行操作

  1-2：小程序Demo或自有小程序调用IoT Video P2P插件的初始化接口，初始化入参填写腾讯云IoT Video分配的appKey和appKeySecret等信息

- 2、小程序用户选择某个摄像头进行播放

- 3、小程序Demo或自有小程序设置播放：

  3-1：P2P-Player插件抛出拉流事件给小程序应用
  
  3-2：小程序应用在拉流回调中，调用XP2P插件的startP2PService接口，传入需要播放的摄像头ID或播放URL，并设置消息接收和数据接收回调

- 4、数据流会通过第3步设置的数据接收回调，传递给P2P-Player插件播放

- 5、小程序用户停止播放

- 6、插件终止播放：

  6-1：小程序Demo或自有小程序调用P2P插件的stopServiceById终止传输数据

  6-2：小程序Demo或自有小程序操作live-player的context，停止播放

### 小程序Demo和代码示例

###### Demo源码

###### https://github.com/tencentyun/iot-video-p2p-doc/tree/master/demo/miniprogram

###### Demo使用流程

1）进入主页面

![](https://github.com/tencentyun/iot-video-p2p-doc/blob/master/pic/demo.png)

”X-P2P Demo IPC“  演示1V1 P2P直连摄像头场景，”X-P2P Demo 1vN-xntp“ 和 ”X-P2P Demo 1vN-tcp“ 演示1V多 P2P场景。
2）1V1 P2P 直连摄像头场景：

![](https://github.com/tencentyun/iot-video-p2p-doc/blob/master/pic/1v1.png)

点击“initModule”，填写“peername”信息，点击“startPlay“，即可小程序1V1 P2P获取摄像头数据，”peername“获取规则如下：

先通过获取设备属性数据API（ https://cloud.tencent.com/document/product/1131/53100 ) 获取"sys_p2p_info" 字段，"sys_p2p_info"字段样式如：XP2Pxxxxx%x.y.z，其中前4个字节为固定为”XP2P“，第5个字节到%(即：xxxx位置)为此版本的设备端”peername“信息，该字段填入到小程序中的”peername“中。（!注：此版本1V1 P2P为联调版本，正式上线后，直接将设备属性数据API的获取结果传入即可）

3）1V多 P2P 直连场景

![](https://github.com/tencentyun/iot-video-p2p-doc/blob/master/pic/1vN.png)

目前微信iOS客户端体验需要进入”X-P2P Demo 1vN-xntp“完成体验，Android客户端请联系腾讯云IoT Video团队获取新微信客户端版本，关掉微信自动更新，再进入”X-P2P Demo 1vN-tcp“体验。进入体验页后，点击”initModule“，再点击”startPlay“，即可播放视频流。

###### 代码示例

- 1、player插件事件回调

``` javascript
  onPlayerReady({ detail }) {
    console.log('onPlayerReady', detail);
    this.playerCtx = detail.livePlayerContext;
    this.setData({
      playerCtx: detail.livePlayerContext,
    });
  },
  onPlayerStartPull() {
    this.startStream();
  },
  onPlayerClose({ detail }) {
    if(detail.error?.code === PlayerCloseType.LIVE_PLAYER_CLOSED) {
      console.error('player close, now state: ', this.data.state);
      // 拉流过程中停止
      if(this.data.state === 'dataParsed' || this.data.state === 'request') {
        // 因为player会自动重试，触发startPull回调，这里只是停止拉流即可。
        this.stopStream();
      }
    }
  },
```

- 2、初始化xp2p插件HttpModule模块

``` javascript
  initModule() {
    if (this.data.state) {
      this.showToast('p2pModule already running');
      return;
    }
    this.setData({ state: 'init' });

    p2pExports
      .init({
        appParams: config.appParams,
        source: p2pExports.XP2PSource.IoTP2PServer,
      })
      .then((res) => {
        console.log('init res', res);

        if (res === 0) {
          const localPeername = p2pExports.getLocalXp2pInfo();
          console.log('localPeername', localPeername);
          this.setData({ state: 'inited', localPeername });
        } else {
          this.resetXP2PData();
          wx.showModal({
            content: `init 失败, res=${res}`,
            showCancel: false,
          });
        }
      })
      .catch((errcode) => {
        console.error('init error', errcode);

        this.resetXP2PData();
        wx.showModal({
          content: `init 失败, errcode: ${errcode}`,
          showCancel: false,
        });
      });
  },
```

- 3、xp2p插件开始拉流

``` javascript
  startStream() {
    if (!this.data.inputId || !this.data.inputUrl) {
      this.showToast('please input id and url');
      return;
    }

    if (this.data.state !== 'inited') {
      this.showToast('can not start service in state', this.data.state);
      return;
    }
    this.setData({ state: 'startStream' });
    this.addLog('start stream');

    const id = this.data.inputId;
    const msgCallback = (event, subtype, detail) => {
      this.onP2PMessage(id, event, subtype, detail);
    };

    const player = this.selectComponent(`#${this.data.playerId}`);
    p2pExports
      .startP2PService(id, { url: this.data.inputUrl }, {
        msgCallback,
        dataCallback: (data) => {
          player.addChunk(data);
        },
      })
      .then((res) => {
        console.log('startServiceWithStreamUrl res', res);

        if (res === 0) {
          this.setData({ state: 'serviceReady', id });
          this.addLog('stream service ready');
          const flvUrl = p2pExports.getHttpFlvUrl(id);
          console.log('set flvUrl', flvUrl);
          this.setData(
            {
              flvUrl,
            }
          );
        } else {
          this.stopStream();
          wx.showModal({
            content: `startServiceWithStreamUrl 失败, res=${res}`,
            showCancel: false,
          });
        }
      })
      .catch((errcode) => {
        console.error('startServiceWithStreamUrl error', errcode);

        this.stopStream();
        wx.showModal({
          content: `startServiceWithStreamUrl 失败, errcode: ${errcode}`,
          showCancel: false,
        });
      });
  },
```

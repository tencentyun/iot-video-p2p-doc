# 腾讯云IoT  Video P2P-Player 插件开发指南
## 插件CHANGELOG

| 版本号 | 发布时间  | 描述              |
| ------ | --------- | ----------------- |
| v1.0.0.beta | 2021.7.12 | 支持小程序P2P内测版 |



## 插件介绍
p2p-player`实现了在微信端的`live-player`组件拉取本地js模块组装的视频数据流，主要应用在`p2p视频`等场景。此类场景下视频源并不是来自远端的视频服务器，而是来自于某个P端节点的，该节点并没有域名甚至没有外网IP，无法直接通过设置`live-player`的`src`直接拉取节点的视频数据。可以通过`p2p打洞等技术获取到视频数据（至于技术细节将不赘述，可自行了解）。而此插件就可以将获取到的视频数据吐给`live-player`,完成正常的视频播放。

## 插件原理
详见以下原理图
![原理图](https://iot-public-1256872341.cos.ap-guangzhou.myqcloud.com/14dec8d5fa7a389e118fe5f5ad18d1eb/1625998678565.png)
关键步骤说明：

- step1.调用插件中的`p2p-player`的自定义组件
- step2.`p2p-player`的自定义组件初始化一个本地的`http-server`，自动监听某个本地端口
- step3.设置`live-player`中的`src`属性为本地`127.0.0.1:port`的地址
- step4.完成初始化，外部调用方得到`p2p-player`暴露的方法
- step5.外部调用方开始获取视频数据，并通过`p2p-player`暴露的方发`addChunk`来将数据吐给`live-player`

## 插件使用
### 插件引入
```js
// app.json
{
  "pages": [
    // 自行定义
    "pages/index/index"
  ],
  "plugins": {
    "wechat-p2p-player": {
      // version自行定义
      "version": "dev",
      "provider": "wx9e8fbc98ceac2628"
    }
  },
  "sitemapLocation": "sitemap.json",
  "usingComponents": {
    "p2p-player": "plugin://wechat-p2p-player/p2p-player"
  }
}

```
```js
// pages/index/index.json
{
  "usingComponents": {
    "p2p-player": "plugin://wechat-p2p-player/p2p-player"
  }
}
```

### 插件使用
>导出的是一个自定义组件，所以在`wxml`中引用
```html
		<p2p-player
		 id="{{playerId}}"
		 orientation="vertical"
		 bind:playerReady="onPlayerReady"
		 bind:playerStartPull="onPlayerStartPull"
		 bind:playerClose="onPlayerClose"
		/>
```

### 插件参数说明
|  参数    | 类型   |  默认值  | 是否必填 |  说明   |
|  ----   | ----   | ----    | ----   | ----  |
| id  | string | 无 | 必填 | player id为唯一标示 |
| bind:playerReady  | Function | 无 | 必填 | 本地`http-server`初始化完的回调，将返回`livePlayerContext` 可以直接对`live-player`的context进行操作，具体见`live-player`小程序文档 |
| bind:playerStartPull  | Function | 无 | 必填 | `live-player`开始播放之后，开始拉流的回调，这个时候可以开始触发addChunk的方法，进行吐流 |
| bind:playerClose  | Function | 无 | 非必填 | `live-player`停止或者暂停之后的回调 |
| 其他  | 无 | 无 | 非必填 | `live-player`的其他非必填参数的透传，具体见`live-player`小程序文档|

### 插件导出的方法说明
> 通过自定义组件支持的方法获取到当前组件，就可以访问到相应的方法，调用方式如下：
```js
const p2pPlayer = this.selectComponent(`#${this.data.playerId}`);
```

|  方法名    |  传参   |  说明   |
|  ----   | ----   | ----    |
| addChunk | data `ArrayBuffer` `必填` `视频数据` | 往`p2p-player`里面推流
| finishMedia | data `ArrayBuffer` `非必填` `视频数据` | 结束推流

### 示例
``` js
// index.js
Page({
  data: {
    xp2pApp: null,
    src: '',
    playerId: 'live-player-demo-1',
    playerId2: 'live-player-demo-2',
    p2pPlayerComponentMap: {},
    serverPort: 0,
    mode: '',
    protocol: '',
    id: '', // 这是是streamId
    host: '',
    basePath: '',
    flvPath: '',
    flvParams: '',
    streamUrl: '',
    state: '',
    localPeername: '',
    peerlist: '',
    log: '',
  },
  onLoad(query) {},
  onUnload() {
    console.log('onUnload');
  },
  onReady(res) {
    this.setData({
      p2pPlayerComponentMap: {
        [this.data.playerId]: this.selectComponent(`#${this.data.playerId}`),
        [this.data.playerId2]: this.selectComponent(`#${this.data.playerId2}`),
      },
    });
  },
  onPlayerReady({ detail }) {
    console.log('onPlayerReady', detail);
    this.livePlayerContext = detail.livePlayerContext;
  },
  onPlayerStartPull({ detail }) {
    console.log('=====livePlayerStartPull====');
    this.pullVideo();
  },
  onPlayerClose({ detail }) {
    this.abortVideoReq();
  },
  bindPlay() {
    this.startToPlay();
  },
  bindPause() {
    this.livePlayerContext.pause({
      success: (res) => {
        console.log('pause success');
      },
      fail: (res) => {
        console.log('pause fail');
      },
    });
  },
  bindStop() {
    this.livePlayerContext.stop({
      success: (res) => {
        console.log('stop success');
      },
      fail: (res) => {
        console.log('stop fail');
      },
    });
  },
  bindResume() {
    this.livePlayerContext.resume({
      success: (res) => {
        console.log('resume success');
      },
      fail: (res) => {
        console.log('resume fail');
      },
    });
  },
  bindMute() {
    this.livePlayerContext.mute({
      success: (res) => {
        console.log('mute success');
      },
      fail: (res) => {
        console.log('mute fail');
      },
    });
  },
  onP2pPlayerError(error) {
    console.error('---====', error);
  },
  startToPlay() {
    console.log('==== this.data.p2pPlayerComponentMap====', this.data.p2pPlayerComponentMap);
    // 调用播放事件
    this.data.p2pPlayerComponentMap[this.data.playerId].startToPlay();
    // setTimeout(() => {
    //   this.data.p2pPlayerComponentMap[this.data.playerId2].startToPlay();
    // }, 10000);
  },
  pullVideo() {
    const perDataLength = 181 * 500;
    const loopWrite = (opts, data, offset = 0) => {
      if (offset >= data.byteLength) {
        // console.log(`[${this.objName}] response write end`);
        this.data.p2pPlayerComponentMap[this.data.playerId].finishMedia();
        return;
      }
      const chunkLen = Math.min(data.byteLength - offset, perDataLength);
      this.data.p2pPlayerComponentMap[this.data.playerId].addChunk(data.slice(offset, offset + chunkLen));
      setTimeout(() => {
        loopWrite(opts, data, offset + chunkLen);
      }, 300);
    };
    const src = 'https://iot-public-1256872341.cos.ap-guangzhou.myqcloud.com/hazelchen/test.flv';
    wx.request({
      url: src,
      dataType: '其他',
      responseType: 'arraybuffer',
      success(res) {
        console.log(res);
        loopWrite({ header: res.header }, res.data);
      },
    });
  },
  resetXP2PData() {
    this.setData({ state: '', localPeername: '', flvUrl: '', peerlist: '', log: '' });
  },
});

```

```html
<view class="page-body">
	<view class="page-section tc">
		<p2p-player
		 id="{{playerId}}"
		 orientation="vertical"
		 bind:playerReady="onPlayerReady"
		 bind:playerStartPull="onPlayerStartPull"
		 bind:playerClose="onPlayerClose"
		/>
		<view class="btn-area">
			<button bindtap="bindPlay" class="page-body-button" type="primary">播放</button>
			<button bindtap="bindPause" class="page-body-button" type="primary">暂停</button>
			<button bindtap="bindStop" class="page-body-button" type="primary">停止</button>
		</view>
	</view>
</view>

```

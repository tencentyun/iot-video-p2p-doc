# 腾讯云IoT Video 小程序 P2P接入指南

## 介绍

通过腾讯云IoT Video小程序P2P服务，引入IoT Video P2P插件和P2P-Player插件，可实现摄像头和小程序直接打洞传输视频流；配合云端的server SDK，可实现小程序和小程序，小程序和APP之间的数据共享。

## 前提条件

- 申请腾讯云 IoT Video P2P 服务，获取访问密钥（针对1V多P2P）
- 有使用 live-player 的权限，详见 [官方文档](https://developers.weixin.qq.com/miniprogram/dev/component/live-player.html)
- 微信 8.0.7以上 基础库 2.18.0以上
- 向腾讯云IoT Video团队申请 [IoT Video P2P插件](https://github.com/tencentyun/iot-video-p2p-doc/blob/master/IoT%20Video%20X-P2P%E6%8F%92%E4%BB%B6%E5%BC%80%E5%8F%91%E6%8C%87%E5%8D%97.md) 和 [IoT Video P2P-Player插件](https://github.com/tencentyun/iot-video-p2p-doc/blob/master/IoT%20Video%20P2P-Player%E6%8F%92%E4%BB%B6%E5%BC%80%E5%8F%91%E6%8C%87%E5%8D%97.md)

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

![](https://github.com/tencentyun/iot-video-p2p-doc/blob/master/pic/demo-v1.0.0.png)

”X-P2P Demo IPC“  演示1V1 P2P直连摄像头场景，”X-P2P Demo 1vN-xntp“ 和 ”X-P2P Demo 1vN-tcp“ 演示1V多 P2P场景，“多播放器”示例多播放器的调用。

2）1V1 P2P 直连摄像头场景：

![](https://github.com/tencentyun/iot-video-p2p-doc/blob/master/pic/1v1-1-v1.0.0.png)

点击“initModule”，填写“productId”、“deviceName”，通过获取设备属性数据API（ https://cloud.tencent.com/document/product/1131/53100 ) 获取"sys_p2p_info" 字段填入”xp2pInfo“中。点击“prepare”和“startPlay”即可开始播放。
“flvFile”字段可设置播放清晰度，信令交互参考：
https://github.com/tencentyun/iot-link-android/blob/master/sdk/video-link-android/doc/%E8%AE%BE%E5%A4%87%E4%B8%8EAPP%E4%BA%A4%E4%BA%92%E6%8C%87%E5%BC%95.md 。

![](https://github.com/tencentyun/iot-video-p2p-doc/blob/master/pic/1v1-2-v1.0.0.png)

点击“不加密对讲”和“加密对讲”可演示小程序语音对讲，点击“挂断”停止对讲。
修改信令command的"cmd=xxx“可演示自定义信令。

3）1V多 P2P 直连场景

![](https://github.com/tencentyun/iot-video-p2p-doc/blob/master/pic/1vN-v1.0.0.png)

目前微信iOS客户端体验需要进入”X-P2P Demo 1vN-xntp“完成体验，Android客户端均可支持，但体验”X-P2P Demo 1vN-tcp“请联系腾讯云IoT Video团队获取新微信客户端版本，关掉微信自动更新，再进入”X-P2P Demo 1vN-tcp“体验。
进入体验页后，支持输入"codeUrl"为部署的密钥服务模块的接入层，点击”initModule“，再点击”startPlay“，即可播放视频流。（！注：正式上线时为了server端不暴露UDP端口，请使用1vN-tcp的调用方式。）


###### 插件使用施力
参考 [IoT Video P2P插件](https://github.com/tencentyun/iot-video-p2p-doc/blob/master/IoT%20Video%20X-P2P%E6%8F%92%E4%BB%B6%E5%BC%80%E5%8F%91%E6%8C%87%E5%8D%97.md) 和 [IoT Video P2P-Player插件](https://github.com/tencentyun/iot-video-p2p-doc/blob/master/IoT%20Video%20P2P-Player%E6%8F%92%E4%BB%B6%E5%BC%80%E5%8F%91%E6%8C%87%E5%8D%97.md)

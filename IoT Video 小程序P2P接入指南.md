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

**1、初始化阶段：**

1-1：小程序Demo或自有小程序引用IoT Video P2P-Player，返回`livePlayerContext`， 可以直接对`live-player`的context进行操作

1-2：小程序Demo或自有小程序调用IoT Video P2P插件的初始化接口，初始化入参填写腾讯云IoT Video分配的appKey和appKeySecret等信息

**2、小程序用户选择某个摄像头进行播放**

**3、小程序Demo调用P2P插件的startP2PService接口，传入需要播放的摄像头ID或播放URL，并设置消息接收和数据接收回调**

**4、数据流会通过第3步设置的数据接收回调，传递给P2P-Player插件播放**

**5、小程序用户停止播放**

**6、插件终止播放：**

6-1：小程序Demo或自有小程序调用P2P插件的stopServiceById终止传输数据

6-2：小程序Demo或自有小程序操作live-player的context，停止播放

### 小程序Demo和代码示例

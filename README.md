# 腾讯云IoT Video 1V多 P2P接入手册

## 一、接入总体流程                    

腾讯云1V多 P2P分享可实现从云端获取的原始http-flv视频流在客户端和客户端、客户端和小程序、小程序和小程序之间分享，可提供server SDK在客户云环境部署，整体架构图如下：

![image-20210629204514803](https://github.com/tencentyun/iot-video-p2p-doc/blob/master/pic/%E6%80%BB%E6%9E%B6%E6%9E%84.png)

为实现上述架构，需实现云端server端的对接，应用端app和小程序的对接，接入总体流程如下：

![image-20210628111403102](https://github.com/tencentyun/iot-video-p2p-doc/blob/master/pic/%E6%8E%A5%E5%85%A5%E6%80%BB%E6%B5%81%E7%A8%8B.png)



## 二、腾讯云 IoT Video 提供SDK

SDK具体可参考线下邮件发布的SDK文件包，SDK分为服务端SDK、应用端SDK，应用端SDK包含小程序插件和APP SDK（含安卓和iOS）。客户可基于SDK，在服务端对接客户的原始http-flv流，进行自有小程序、APP的开发，实现小程序与APP间建立P2P节点分享视频流，达到节省云端流量的目的。另外为统计应用端X-P2P流量信息，腾讯云为客户分配了调用腾讯云统计服务的appId、appKey和appSecret，该三要素需要在应用端初始化时填入，具体可参考线下邮件发布的《腾讯云IoT Video 1V多P2P访问密钥》文档。

## 三、服务端接入和部署

Server SDK分为两部分，一部分是受限于微信不支持https chunk方案，我们将提供密钥生成SDK，生成的密钥用于服务端视频数据加解密；另一部分是1V多 P2P SDK，该SDK用于拉取客户原始视频流，添加SEI帧和分片，用于P2P共享。架构图如下：

![image-20210628204633406](https://github.com/tencentyun/iot-video-p2p-doc/blob/master/pic/server%20sdk%E6%9E%B6%E6%9E%84.png)

### 1、密钥生成模块

密钥生成SDK依赖于存储资源，客户部署该服务时，会有自己熟悉的http server架构和存储资源，为了方便客户对接，腾讯云将密钥生成模块以微服务形式提供demo示例，参考
https://github.com/tencentyun/iot-video-p2p-key-demo
。客户可参考使用。具体使用参考[腾讯云IoT Video 1V多 P2P 服务端密钥生成模块参考](https://github.com/tencentyun/iot-video-p2p-doc/blob/master/%E8%85%BE%E8%AE%AF%E4%BA%91IoT%20Video%201V%E5%A4%9A%20P2P%20%E6%9C%8D%E5%8A%A1%E7%AB%AF%E5%AF%86%E9%92%A5%E7%94%9F%E6%88%90%E6%A8%A1%E5%9D%97%E5%8F%82%E8%80%83.md)。

### 2、1V多 P2P 模块

该模块用于拉取原始http-flv流，对分享节点进行管理，将视频流分片用于观看端间共享。目前该模块以二进制形式提供，入参是拉流源域名。客户需部署接入层，保证在对某路视频流的取流过程中，请求会hash至同一服务节点。具体使用参考[腾讯云IoT Video 1V多 P2P Server端接口文档](https://github.com/tencentyun/iot-video-p2p-doc/blob/master/IoT%20Video%201V%E5%A4%9AP2P%20Server%E7%AB%AF%E6%8E%A5%E5%8F%A3%E6%96%87%E6%A1%A3.md)。

### 3、服务端部署

腾讯云IoT Video提供的服务端以二进制提供后，客户需要完成接入层和多实例的部署。密钥生成模块部署在https接入层的后端，推荐多实例部署；1V多 P2P模块部署在http接入层（非80端口）的后端，客户端或小程序请求同一路视频流时，需hash至后端相同的server节点上。

## 四、APP SDK接入

APP SDK入参是腾讯云IoT Video提供的APP ID、APP Key和APP Secret、客户部署的接入层域名，详情参考文档[腾讯云IoT Video 1V多P2P 客户端（iOS）接入手册](https://github.com/tencentyun/iot-video-p2p-doc/blob/master/IoT%20Video%201V%E5%A4%9AP2P%20%E5%AE%A2%E6%88%B7%E7%AB%AFSDK%EF%BC%88iOS%EF%BC%89%20%E6%8E%A5%E5%85%A5%E6%89%8B%E5%86%8C.md)和[腾讯云IoT Video 1V多P2P 客户端（Andriod）接入手册](https://github.com/tencentyun/iot-video-p2p-doc/blob/master/IoT%20%20Video%201V%E5%A4%9AP2P%20%E5%AE%A2%E6%88%B7%E7%AB%AFSDK%EF%BC%88Android%EF%BC%89%E6%8E%A5%E5%85%A5%E6%89%8B%E5%86%8C.md)。

## 五、小程序插件接入

小程序插件入参是腾讯云IoT Video提供的APP ID、APP Key和APP Secret、客户部署的接入层域名，详情参考文档[腾讯云IoT Video 小程序P2P 接入手册](https://github.com/tencentyun/iot-video-p2p-doc/blob/master/IoT%20Video%20%E5%B0%8F%E7%A8%8B%E5%BA%8FP2P%E6%8E%A5%E5%85%A5%E6%8C%87%E5%8D%97.md)。


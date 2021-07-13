# 腾讯云IoT Video 1V多 P2P接入手册

## 一、接入总体流程                    

腾讯云1V多 P2P分享可实现从云端获取的原始http-flv视频流在客户端和客户端、客户端和小程序、小程序和小程序之间分享，可提供海康萤石server SDK在萤石云环境部署，整体架构图如下：

![image-20210629204514803](/Users/judytong/Library/Application Support/typora-user-images/image-20210629204514803.png)

为实现上述架构，需实现萤石云server端的对接，应用端app和小程序的对接，接入总体流程如下：

![image-20210628111403102](/Users/judytong/Library/Application Support/typora-user-images/image-20210628111403102.png)



## 二、腾讯云 IoT Video 提供SDK

SDK具体可参考线下邮件发布的SDK文件包，SDK分为服务端SDK、应用端SDK，应用端SDK包含小程序插件和APP SDK（含安卓和iOS）。萤石可基于SDK，在服务端对接萤石的原始http-flv流，进行自有小程序、APP的开发，实现小程序与APP间建立P2P节点分享视频流，达到节省云端流量的目的。另外为统计应用端X-P2P流量信息，腾讯云为萤石分配了调用腾讯云统计服务的appId、appKey和appSecret，该三要素需要在应用端初始化时填入，具体可参考线下邮件发布的《腾讯云IoT Video 1V多P2P访问密钥》文档。

## 三、服务端接入和部署

Server SDK分为两部分，一部分是受限于微信不支持https chunk方案，我们将提供密钥生成SDK，生成的密钥用于服务端视频数据加解密；另一部分是1V多 P2P SDK，该SDK用于拉取海康萤石原始视频流，添加SEI帧和分片，用于P2P共享。架构图如下：

![image-20210628204633406](/Users/judytong/Library/Application Support/typora-user-images/image-20210628204633406.png)

### 1、密钥生成模块

密钥生成SDK依赖于存储资源，海康萤石部署该服务时，会有自己熟悉的http server架构和存储资源，为了方便海康萤石对接，腾讯云将密钥生成模块以微服务形式提供demo示例，参考https://git.woa.com/sigmawu/xp2p-key，海康萤石可参考使用。具体使用参考《腾讯云IoT Video 1V多 P2P 服务端密钥生成模块参考》。

### 2、1V多 P2P 模块

该模块用于拉取原始http-flv流，对分享节点进行管理，将视频流分片用于观看端间共享。目前该模块以二进制形式提供，入参是拉流源域名。海康萤石需部署接入层，保证在对某路视频流的取流过程中，请求会hash至同一服务节点。具体使用参考《腾讯云IoT Video 1V多 P2P Server端接口文档》。

### 3、服务端部署

腾讯云IoT Video提供的服务端以二进制提供后，海康萤石需要完成接入层和多实例的部署。密钥生成模块部署在https接入层的后端，推荐多实例部署；1V多 P2P模块部署在http接入层（非80端口）的后端，客户端或小程序请求同一路视频流时，需hash至后端相同的server节点上。

## 四、APP SDK接入

APP SDK入参是腾讯云IoT Video提供的APP ID、APP Key和APP Secret、海康萤石部署的接入层域名，详情参考文档《腾讯云IoT Video 1V多P2P 客户端（iOS）接入手册》和《腾讯云IoT Video 1V多P2P 客户端（Andriod）接入手册》。

## 五、小程序插件接入

小程序插件入参是腾讯云IoT Video提供的APP ID、APP Key和APP Secret、海康萤石部署的接入层域名，详情参考文档《腾讯云IoT Video 小程序P2P 接入手册》。


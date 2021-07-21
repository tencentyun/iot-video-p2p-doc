# 腾讯云 IoT Video 1V多P2P客户端 SDK（iOS） 接入手册

## 一、介绍

传统的多人观看场景，客户端向云端发送HTTP请求获取数据，在腾讯云IoT Video 1V多 P2P服务中，观看端和云端建立一个共享P2P网络，SDK可以视为下载代理模块，客户端应用将HTTP请求发送至SDK，SDK从云端或其他P2P节点获取数据，并将数据返回至上层应用。SDK通过互相分享数据可大幅降低云端流量。

SDK支持多实例，即支持同时开启多个不同视频源的直播p2p。

支持的流媒体：http-flv。

## 二、接入SDK

### 1.通过framework接入SDK
- 拷贝XP2P团队提供的xnet.framework
- 直接通过Xode -> General -> "Framework, Libraries, and Embedded Content" 添加xnet.framework

### 2.应用配置
腾讯云对接人员会索取iOS项目的Bundle identifier，并提供App ID、App Key、App Secret Key，如以下形式：
```
Bundle identifier：com.qcloud.helloworld
NSString *appID = @"5919174f79883b4648a90bdd";
NSString *key = @"3qRcwO0Zn1Gm8t2O";
NSString *secret = @"Ayg29EDt1AbCXJ9t6HoQNbZUf6cPuV5J";
```

### 3.具体步骤

- 解压TencentXP2P.zip并得到TencentXP2P.framework，并在项目中引用

- 在App启动时初始化XP2PModule

首先需要初始化p2p sdk，最好在app启动后就作初始化。

``` Obj-C
// Example: 程序的入口AppDelegate.m
#import "AppDelegate.h"
#import <TencentXP2P/TencentXP2P.h>
@implementation AppDelegate
- (BOOL)application:(UIApplication *)application didFinishLaunchingWithOptions:(NSDictionary *)launchOptions
{
    // do something other...

    //下面的接口调用可以开启SDK log的打印，不调用该接口，log打印默认不开启
    [XNet enableDebug]

    NSString *appID = @"your app id";
    NSString *key = @"your app key";
    NSString *secret = @"your app secret";
    bool ok = [XNet initWith:appID appKey:key appSecretKey:secret];

    return YES;
}

- (void)onLogPrint:(NSString*)msg {
    //这里能够收到SDK输出的日志
}

@end

```

- 加载一个频道
直播url的处理很简单, 将指向原有域名的url的domain（即海康萤石部署的接入层域名）之前, 插入sdk的host即可, 据此即可将请求代理
``` Obj-C
- (int)startPlay:(NSString*)url
{
    // 将resource之前的 域名/路径 内容替换为 [XP2PModule host] 即可，比如
    // 原先是，http://example.cdn.com/live/streamid.flv?token=xxx
    // 转换成，http://127.0.0.1:16080/normal.iot.p2p.com/example.cdn.com/live/streamid.flv?token=xxx
    NSString* p2pUrl = [url stringByReplacingOccurrencesOfString:@"http://" withString:
                            [XNet proxyOf:@"normal.iot.p2p.com"]];
    NSString *codecID = @"h265";
    NSString *stremaid = [[url lastPathComponent] stringByDeletingPathExtension];
    NSString *xresid = [NSString stringWithFormat:@"%@_%@", stremaid, codecID];
    NSString* param = [NSString stringWithFormat:@"?xresid=%@", xresid];
    p2pUrl = [p2pUrl stringByAppendingString:param];
    // 直接播放此url即可
    [_player startPlay:p2pUrl];
    return EXIT_SUCCESS;
}
```

- 卸载一个频道

``` Obj-C
- (int)stopPlay
{
    // 播放器链接断开以后 SDK内部会自动释放频道相关的资源, 直接关闭播放器即可
    [_player stopPlay];
    return EXIT_SUCCESS;
}
```

- 恢复前台显示时，必须调用resume。否则在播放器暂停阶段iOS会关闭链接，此时向代理发起请求，会收到类似502的错误
``` Obj-C
    bool ok = [XNet resume];
```
## 三、注意事项
以上是一个播放器使用P2P的基本调用，完成上述调用后您就可以使用P2P为播放器提供服务了，但一个更加完善的客户端还需要做以下工作
- 统计流量，获取SDK运行过程中的P2P流量和CDN流量
- 监听网络变化，在移动网络显示P2P上传，WIFI网络开启P2P上传（默认开启）
这些设置您需要以http请求的方式告知SDK代理服务，调用API请参考文档余下部分

## 四 、API
SDK接口除初始化接口, 其余接口均由http实现, 请求格式为http:://${host}/${func}?${param}, 其中${host}为本地代理服务器, 通过XNet.HTTP_PROXY获取

-------------------------------
### 1.统计
- 描述: 请求对应频道的统计数据

- 方法: GET

- 路径: /stat?xresid=${resource}

- 请求参数:

| 参数名称 | 必选 | 类型 | 说明 |
| ---- | ---- | ---- | ---- |
| xresid | 是 | string | 默认为url中的resource, 否则为频道请求中的xresid值 |

- 返回参数: 

| 返回码 | 说明 |
| ---- | ---- |
| 200 | 查询成功 |
| 404 | 查询失败, 频道不存在 | 200, 返回内容为JSON
| 参数名称 | 类型 | 说明 |
| ---- | ---- | ---- |
| flow.p2pBytes | num | 对应频道p2p流量 |
| flow.cdnBytes | num | 对应频道cdn流量 |

- 请求样例

http://127.0.0.1:16080/iot.p2p.com/stat?xresid=xxx

*注:*channel 即 http://127.0.0.1:16080/iot.p2p.com/${path}/${resoruce}.${ext} 中的 resource

- 返回样例
``` json
"{"flow":{"p2pBytes":0,"cdnBytes":0}}"
```

-------------------------------
### 2.设置上下行
- 描述: 请求设置p2p上行与下行, 0为开启, 1为关闭

- 方法: GET

- 路径: /feature?download=${0or1}&upload=${0or1}

| 参数名称 | 必选 | 类型 | 说明 |
| ---- | ---- | ---- | ---- |
| download | 是 | num | 0为关闭; 1为默认值, 开启 |
| upload | 是 | num | 0为关闭; 1为默认值, 开启 |

- 请求样例

http://127.0.0.1:16080/iot.p2p.com/feature?download=1&upload=0

*注:*一般情况下移动网络需要关闭上传

- 返回参数: JSON, 格式如下

| 参数名称 | 必选 | 类型 | 说明 |
| ---- | ---- | ---- | ---- |
| ret | 是 | num | 0表示正常 |
| msg | 是 | string | 相关信息, 调试使用|
| upload | 是 | bool | 1表示开启, 0表示关闭 |
| download | 是 | bool | 1表示开启, 0表示关闭 |

- 返回样例
``` json
"{"ret":0, "msg":"ok", "download":0,"upload":0}}"
```
## 五、ios当前支持的架构

armv7 armv7s arm64


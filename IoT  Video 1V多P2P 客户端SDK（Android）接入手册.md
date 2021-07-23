# 腾讯云 IoT Video 1V多P2P 客户端SDK(Android) 接入手册


## 介绍

传统的多人观看场景，客户端向云端发送HTTP请求获取数据，在腾讯云IoT Video 1V多 P2P服务中，观看端和云端建立一个共享P2P网络，SDK可以视为下载代理模块，客户端应用将HTTP请求发送至SDK，SDK从云端或其他P2P节点获取数据，并将数据返回至上层应用。SDK通过互相分享数据可大幅降低云端流量。

SDK支持多实例，即支持同时开启多个不同视频源的直播p2p。

支持的流媒体：http-flv。

## 接入
### 接入准备
#### aar接入
1.接入之前，请提供腾讯云IoT Video团队package name，IoT Video团队将为您分发密钥，并提供aar库

2.xnet-release.aar拷贝到libs目录下

3.在应用模块的build.gradle中加入
``` gradle
dependencies {
    implementation fileTree(include: ['*.jar'], dir: 'libs')
    implementation (name: 'xnet-release', ext: 'aar')
}
```


#### 支持的 ABI

`armeabi-v7a` `arm64-v8a` `x86_64` `x86`

### 混淆配置
由于native层代码需要反射调回java，需要确保SDK内的代码都不被混淆，请在proguard中添加以下配置
```
-keep public class com.tencent.qcloud.** {
*;
}
```
### 具体步骤


#### 初始化

- 在App启动之初初始化XP2PModule

首先需要初始化p2p sdk，最好在app启动后就作初始化。

``` java
// 初始化appId等关键客户信息
final String APP_ID = "$your_app_id";
final String APP_KEY = "$your_app_key";
final String APP_SECRET = "$your_app_secret";

@Override
protected void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);

    // 返回值ok可用于统计p2p成功与失败
    // 无论成功与失败，都可以使用XNet.proxyOf与XNet.proxyOf
    // 失败时，XNet.proxyOf是""
    // 成功时，XNet.proxyOf是127.0.0.1:16080/${domain}
    bool ok = XNet.create(this, APP_ID, APP_KEY, APP_SECRET);

    //开启调试日志(发布可关闭)
    XNet.enableDebug();
}
```

#### IOT视频分享

##### 播放控制（start/stop）

启动直播p2p：
直播url的处理很简单, 将指向原有域名的url的domian（即海康萤石部署的接入层域名）之前, 插入sdk的host即可, 据此即可将请求代理
``` java
// 例如：http://domain/path/to/resource.flv?params=xxx
// 变成：http://{XNet.proxyOf(domain)}/path/to/resource.flv?params=xxx
// 要改的仅仅是在://后插入XNET.proxyOf
    String streamID = url.substring(url.lastIndexOf(("/") + 1));
    streamID = streamID.substring(0, streamID.indexOf("."));

    String xResID = streamID;
    String param =   "?xresid=" + xResID; //该参数标识P2P资源,可选

    String p2pURl = url.replace("http://", XNet.proxyOf("iotiot.p2p.com"));
    p2pURl += param;

// 通过获取的url, 播放器直接执行请求
    mediaPlayer.setDataSource(context, Uri.parse(p2pUrl), headers);
    mediaPlayer.prepareAsync();

    // 相关资源随着http请求关闭直接释放，无需再做任何处理
    //注意：该http请求可能会返回302
```

url的params可以控制sdk的拉流域名以及协议
```java
		p2pUrl += "xhost=${your_host}"; // 默认为 "xnet" + 传入域名
		p2pUrl += "xscheme=https"; // 默认为http, 可以设置为https
```

由于后台监听限制的问题，resume的情况下需要调用resume接口

``` java
    // 返回值ok代表着是否恢复成功
    bool ok = XNet.resume();
```

## api
  SDK接口除初始化接口, 其余接口均由http实现, 请求格式为http:://${XNet.proxyOf}${func}?${param}

注意，在初始化返回值为false时，或者XNet.proxyOf""时，意味着没走p2p，不应再向其发起HTTP请求，否则会遇到502等错误，也可认为没P2P的标志

  以下为详细api

-------------------------------

### IOT视频分享接口

#### 统计
- 描述: 请求对应频道的统计数据

- 方法: GET

- 路径: /stat?xresid=${resource}

- 请求参数:

    |  参数名称   | 必选 | 类型 | 说明 |
    |  ----  | ----   | ---- | ----  |
    | xresid  | 是 | string | 默认为url中的resource, 否则为频道请求中的xresid值 |

- 返回参数: 

    |  返回码   | 说明 |
    |  ----  | ----  |
    | 200  | 查询成功 |
    | 404  | 查询失败, 频道不存在 |
    200, 返回内容为JSON
    |  参数名称  |  类型 | 说明 |
    |  ----     | ---- | ----  |
    | flow.p2pBytes | num | 对应频道p2p流量 |
    | flow.cdnBytes | num | 对应频道cdn流量 |

- 请求样例
  
    http://127.0.0.1:16080/iot.p2p.com/stat?xresid=xxx
    
    *注:*xresid 即 http://127.0.0.1:16080/iot.p2p.com/resoruce.ext 中的 resource, 或者用户手动指定
- 返回样例
``` json
    "{"flow":{"p2pBytes":0,"cdnBytes":0}}"
```

-------------------------------
#### 设置上下行
- 描述: 请求设置p2p上行与下行, 0为开启, 1为关闭

- 方法: GET

- 路径: /feature?download=${0or1}&upload=${0or1}

    |  参数名称   | 必选 | 类型 | 说明 |
    |  ----  | ----   | ---- | ----  |
    | download  | 是 | num | 0为关闭; 1为默认值, 开启 |
    | upload  | 是 | num | 0为关闭; 1为默认值, 开启 |

 - 请求样例
   
    http://127.0.0.1:16080/iot.p2p.com/feature?download=1&upload=0
    
    *注:*一般情况下移动网络需要关闭上传

- 返回参数: JSON, 格式如下

    |  参数名称   | 必选 | 类型 | 说明 |
    |  ----  | ----   | ---- | ----  |
    | ret  | 是 | num | 0表示正常 |
    | msg  | 是 | string | 相关信息, 调试使用|
    | upload  | 是 | bool | 1表示开启, 0表示关闭 |
    | download  | 是 | bool | 1表示开启, 0表示关闭 |

- 返回样例
``` json
    "{"ret":0, "msg":"ok", "download":0,"upload":0}}"
```

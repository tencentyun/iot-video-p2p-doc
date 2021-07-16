# 腾讯云IoT Video 1V多P2P Server端接口文档

## server CHANGELOG

| 版本号 | 发布时间  | 描述                             |
| ------ | --------- | -------------------------------- |
| v0.0.1 | 2021.7.12 | 暂不支持加密（md5：d3c944858e244f6168ba2ac1dbfb1d2f ） |

## 说明
Server 监听请求，从数据源拉取视频数据，为视频数据加sei帧以做数据分隔，提供视频数据给请求方，同时也存储客户端上报的节点信息，下发同房间的节点给客户端，以支持p2p。


因视频分享功能运行在独立的工作线程，目前仅支持二进制方式接入。

## 二进制接入
./iot-server -h

Syntax: ./iot-server [ OPTS ]

-h      - help
 
-u      - url host(eg:https://flvopen.ys7.com:9188)  # 拉流源域名

-p      - port # 监听的端口

-t      - delay seconds # 延迟退出时间（没有请求时，多久断开拉流)

-d      - logdir  # 日志目录

-v      - verbose # 开启日志

## 下载方式
d3c944858e244f6168ba2ac1dbfb1d2f

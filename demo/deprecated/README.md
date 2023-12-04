# 使用说明

## 申请权限和配置小程序

- 接入腾讯云 IoT Video P2P 服务，获取访问密钥等信息（即后文中的 `appParams`），详见 [接入文档](https://cloud.tencent.com/document/product/1131/52735)
- 申请使用 [X-P2P插件](https://mp.weixin.qq.com/wxopen/plugindevdoc?appid=wx1319af22356934bf) 和 [P2P-Player插件](https://mp.weixin.qq.com/wxopen/plugindevdoc?appid=wx9e8fbc98ceac2628) 
- 有 live-player 的权限，详见 [live-player官方文档](https://developers.weixin.qq.com/miniprogram/dev/component/live-player.html)
- 如果使用语音对讲、双向音视频功能，还需要有 live-pusher 的权限，详见 [live-pusher官方文档](https://developers.weixin.qq.com/miniprogram/dev/component/live-pusher.html)
- 如果使用 1v多 模式，需要将flv流的域名加到小程序的 `request合法域名` 和 `tcp合法域名` 配置中，详见 [服务器域名配置官方文档](https://developers.weixin.qq.com/miniprogram/dev/framework/ability/network.html#1.%20%E6%9C%8D%E5%8A%A1%E5%99%A8%E5%9F%9F%E5%90%8D%E9%85%8D%E7%BD%AE)

## 利用demo熟悉基本功能

- 替换 project.config.json 里的小程序 appid
- 替换 config/config.js 里的客户参数 appParams
- 1v1模式，替换 config/devcies.js 里预置的设备信息
- 1v多模式，替换 config/streams.js 里预置的server流信息

## 注意事项
- 要求微信 8.0.10 以上，基础库 2.19.3 以上，低版本需提示升级
- 开发者工具不支持 live-player 和 TCPServer，所以不能在开发者工具中调试，也不支持真机调试，需使用二维码预览的方式在真机运行
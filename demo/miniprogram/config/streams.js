/**
 * 属性说明：
 * showInHomePageBtn: boolean 是否显示在首页大按钮，产品用
 * showInHomePageNav: boolean 是否显示在首页导航，有onlyp2p入口，开发用
 *
 * 下面这些会自动填到player组件的输入框里，也可以手动修改
 * serverName: string 会根据serverName从config里查询预置的server信息，然后填到输入框里
 * flvFile: string 视频流的 flvFile，可以带参数
 */

// 这些是预置的server流
const serverStreams = {
  tcpstream0: {
    showInHomePageBtn: true,
    serverName: 'tcpsvr',
    flvFile: '6e0b2be040a943489ef0b9bb344b96b8.hd.flv',
  },
  xntpstream0: {
    showInHomePageNav: true,
    serverName: 'xntpsvr',
    flvFile: '6e0b2be040a943489ef0b9bb344b96b8.hd.flv',
  },
};

export default serverStreams;

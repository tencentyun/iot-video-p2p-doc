import { getXp2pManager } from '../../lib/xp2pManager';

const xp2pManager = getXp2pManager();
const { XP2PDevNotify_SubType } = xp2pManager;

let serverPlayerSeq = 0;

Component({
  behaviors: ['wx://component-export'],
  properties: {
    targetId: {
      type: String,
    },
    flvUrl: {
      type: String,
    },
    codeUrl: {
      type: String,
      value: '',
    },
    // 以下仅供调试，正式组件不需要
    onlyp2p: {
      type: Boolean,
    },
  },
  data: {
    innerId: '',

    // 这些是控制player和p2p的
    playerId: 'iot-p2p-common-player',
    player: null,
    p2pReady: false,

    // 节点列表
    peerlist: '',

    // 订阅记录
    subscribeLog: '',
    // 错误日志
    errLog: '',
    // debug上传的log版本
    logVersion: '',
    // P2P字节
    p2pBytes: 0,
    // 候选者数量
    candidateSize: 0,
    // 子节点数量
    childrenSize: 0,
    // 连接中的节点数量
    standbySize: 0,
    // 子节点peername
    childrenStr: '',
    // 父节点peername
    parent: '',
    // 自己的peername
    localPeername: ''
  },
  lifetimes: {
    created() {
      // 在组件实例刚刚被创建时执行
      serverPlayerSeq++;
      this.setData({ innerId: `server-player-${serverPlayerSeq}` });
      console.log(`[${this.data.innerId}]`, '==== created');
    },
    attached() {
      // 在组件实例进入页面节点树时执行
      console.log(`[${this.data.innerId}]`, '==== attached', this.id, this.properties);
      const player = this.selectComponent(`#${this.data.playerId}`);
      if (player) {
        this.setData({ player });
      } else {
        console.error(`[${this.data.innerId}]`, 'create player error', this.data.playerId);
      }
    },
    ready() {
      // 在组件在视图层布局完成后执行
    },
    detached() {
      // 在组件实例被从页面节点树移除时执行
      console.log(`[${this.data.innerId}]`, '==== detached');
      this.stopAll();
      console.log(`[${this.data.innerId}]`, '==== detached end');
    },
    error() {
      // 每当组件方法抛出错误时执行
    },
  },
  export() {
    return {
      stopAll: this.stopAll.bind(this),
    };
  },
  methods: {
    stopAll() {
      if (this.data.player) {
        this.data.player.stopAll();
      }
    },
    showToast(content) {
      wx.showToast({
        title: content,
        icon: 'none',
      });
    },
    passEvent(e) {
      this.triggerEvent(e.type, e.detail);
    },
    // 以下是 common-player 的事件
    onP2PStateChange(e) {
      console.log(`[${this.data.innerId}]`, 'onP2PStateChange', e.detail.p2pState);
      const p2pReady = e.detail.p2pState === 'ServiceStarted';
      this.setData({ p2pReady });
      if (!p2pReady) {
        this.setData({
          peerlist: '',
          subscribeLog: '',
        });
      }
      this.passEvent(e);
    },
    formatFixed2(n, p = 2) {
      return n < Math.pow(10, p - 1) ? `0${n}` : n;
    },

    getClockTime() {
      const date = new Date();
      return `${date.getFullYear()}-${this.formatFixed2(date.getMonth() + 1)}-${this.formatFixed2(date.getDate())} ${this.formatFixed2(date.getHours())}:${this.formatFixed2(date.getMinutes())}:${this.formatFixed2(date.getSeconds())}.${this.formatFixed2(date.getMilliseconds(), 3)}`;
    },
    onP2PDevNotify({ detail }) {
      if (!this.data.p2pReady) {
        return;
      }
      switch (detail.type) {
        case XP2PDevNotify_SubType.P2P:
          this.setData({
            p2pBytes: this.data.p2pBytes + detail.detail.chunkSize
          });
          break;
        case XP2PDevNotify_SubType.Peers:
        {
          const { candidateSize, standbySize, childrenSize, childrenStr, localPeername } = detail.detail;
          this.setData({
            candidateSize,
            standbySize,
            childrenSize,
            childrenStr,
            localPeername,
          });
          break;
        }
        case XP2PDevNotify_SubType.Parent:
          this.setData({
            parent: detail.detail.peername
          });
          break;
        case XP2PDevNotify_SubType.Peerlist:
          this.setData({ peerlist: `${this.getClockTime()} - ${detail.detail}` });
          break;
        case XP2PDevNotify_SubType.Subscribe:
          console.log(`[${this.data.innerId}]`, 'onP2PDevNotify', detail.type, detail.detail);
          this.setData({ subscribeLog: `${this.data.subscribeLog}${this.getClockTime()} - ${detail.detail}\n` });
          break;
        case XP2PDevNotify_SubType.Err:
          this.setData({ errLog: `${this.data.errLog} ${detail.detail.err}\n`});
          break;
        case XP2PDevNotify_SubType.RTLog:
          this.setData({ logVersion: detail.detail.logVersion });
          break;
      }
    },
  },
});

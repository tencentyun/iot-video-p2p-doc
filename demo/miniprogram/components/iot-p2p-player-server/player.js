import { getXp2pManager } from '../../xp2pManager';

const xp2pManager = getXp2pManager();
const { XP2PDevNotify_SubType } = xp2pManager;

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
    // 这些是控制player和p2p的
    playerId: 'iot-p2p-common-player',
    player: null,
    p2pReady: false,

    // 节点列表
    peerlist: '',

    // 订阅记录
    subscribeLog: '',
  },
  lifetimes: {
    created() {
      // 在组件实例刚刚被创建时执行
    },
    attached() {
      // 在组件实例进入页面节点树时执行
      console.log(`[${this.id}]`, '==== attached', this.id, this.properties);
      const player = this.selectComponent(`#${this.data.playerId}`);
      if (player) {
        this.setData({ player });
      } else {
        console.error('create player error', this.data.playerId);
      }
    },
    ready() {
      // 在组件在视图层布局完成后执行
    },
    detached() {
      // 在组件实例被从页面节点树移除时执行
      this.stopAll();
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
      console.log(`[${this.id}]`, 'onP2PStateChange', e.detail.p2pState);
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
    onP2PDevNotify({ detail }) {
      if (!this.data.p2pReady) {
        return;
      }
      switch (detail.type) {
        case XP2PDevNotify_SubType.Peerlist:
          this.setData({ peerlist: `${Date.now()} - ${detail.detail}` });
          break;
        case XP2PDevNotify_SubType.Subscribe:
          console.log(`[${this.id}]`, 'onP2PDevNotify', detail.type, detail.detail);
          this.setData({ subscribeLog: `${this.data.subscribeLog}${Date.now()} - ${detail.detail}\n` });
          break;
      }
    },
  },
});

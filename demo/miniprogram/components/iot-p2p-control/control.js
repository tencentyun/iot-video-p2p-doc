import { getXp2pManager } from '../../lib/xp2pManager';

const xp2pManager = getXp2pManager();

Component({
  behaviors: ['wx://component-export'],
  properties: {
    id: {
      type: String,
      value: '',
    },
  },
  data: {
    // 这些是p2p状态
    uuid: '',
    state: '',
    localPeername: '',

    // 记录需要刷新
    dirty: false,
  },
  pageLifetimes: {
    show() {
      // 再显示时同步一下状态，应该用事件通知，先简单处理吧
      if (!this.data.dirty) {
        return;
      }
      this.setData({ dirty: false });

      console.log(`[${this.id}]`, 'refreshState after show');
      this.refreshState();
    },
    hide() {
      this.setData({ dirty: true });
    },
  },
  lifetimes: {
    created() {
      // 在组件实例刚刚被创建时执行
    },
    attached() {
      // 在组件实例进入页面节点树时执行
      // 自动 initModule
      this.initModule();
    },
    ready() {
      // 在组件在视图层布局完成后执行
    },
    detached() {
      // 在组件实例被从页面节点树移除时执行
    },
    error() {
      // 每当组件方法抛出错误时执行
    },
  },
  export() {
    return {
      getState: () => this.data.state,
      refreshState: this.refreshState.bind(this),
      initModule: this.initModule.bind(this),
      destroyModule: this.destroyModule.bind(this),
      resetP2P: this.resetP2P.bind(this),
    };
  },
  methods: {
    showToast(content) {
      wx.showToast({
        title: content,
        icon: 'none',
      });
    },
    resetXP2PData() {
      this.changeState({
        // uuid: '', // reset 不用清uuid
        state: '',
        localPeername: '',
        localPeername2: ''
      });
    },
    printData() {
      console.log(`[${this.id}]`, 'now p2p data', this.data);
    },
    changeState(newData) {
      this.triggerEvent('statechange', { state: newData.state, localPeername: newData.localPeername, localPeername2: newData.localPeername2 });
      this.setData(newData);
    },
    refreshState() {
      // eslint-disable-next-line max-len
      if (xp2pManager.state === this.data.state && xp2pManager.localPeername === this.data.localPeername && xp2pManager.localPeername2 === this.data.localPeername2) {
        // 无变化
        return;
      }
      this.changeState({
        uuid: xp2pManager.uuid,
        state: xp2pManager.state,
        localPeername: xp2pManager.localPeername,
        localPeername2: xp2pManager.localPeername2
      });

      if (xp2pManager.state === 'initing' || xp2pManager.state === 'reseting') {
        xp2pManager.promise
          .then((res) => {
            if (res === 0) {
              this.changeState({ state: 'inited', localPeername: xp2pManager.localPeername, localPeername2: xp2pManager.localPeername2 });
            } else {
              this.destroyModule();
            }
          })
          .catch(() => {
            this.destroyModule();
          });
      }
    },
    initModule() {
      console.log(`[${this.id}]`, 'initModule');

      if (this.data.state) {
        this.showToast('p2pModule already running');
        return;
      }

      const start = Date.now();
      this.changeState({ state: 'initing', localPeername: '', localPeername2: '' });

      xp2pManager
        .initModule()
        .then((res) => {
          console.log(`[${this.id}]`, 'init res', res);

          const now = Date.now();
          console.log(`[${this.id}]`, 'init delay', now - start);
          const { localPeername, localPeername2 } = xp2pManager;
          console.log(`[${this.id}]`, 'localPeername', localPeername, localPeername2);
          this.changeState({ state: 'inited', localPeername, localPeername2 });
        })
        .catch((errcode) => {
          console.error(`[${this.id}]`, 'init error', errcode);

          this.destroyModule();
          wx.showModal({
            content: `init 失败, errcode: ${errcode}`,
            showCancel: false,
          });
        });
      this.setData({ uuid: xp2pManager.uuid });
    },
    destroyModule() {
      console.log(`[${this.id}]`, 'destroyModule');

      if (!this.data.state) {
        console.log(`[${this.id}]`, 'p2pModule not running');
        return;
      }

      this.resetXP2PData();
      xp2pManager.destroyModule();
    },
    resetP2P() {
      console.log(`[${this.id}]`, 'resetP2P');

      if (!this.data.state) {
        console.log(`[${this.id}]`, 'p2pModule not running');
        return;
      }

      const start = Date.now();
      this.changeState({ state: 'reseting', localPeername: '', localPeername2: '' });

      xp2pManager
        .resetP2P()
        .then((res) => {
          console.log(`[${this.id}]`, 'resetP2P res', res);

          const now = Date.now();
          console.log(`[${this.id}]`, 'resetP2P delay', now - start);
          const { localPeername, localPeername2 } = xp2pManager;
          console.log(`[${this.id}]`, 'localPeername', localPeername, localPeername2);
          this.changeState({ state: 'inited', localPeername, localPeername2 });
        })
        .catch((errcode) => {
          console.error(`[${this.id}]`, 'resetP2P error', errcode);

          this.destroyModule();
          wx.showModal({
            content: `resetP2P 失败, errcode: ${errcode}`,
            showCancel: false,
          });
        });
      this.setData({ uuid: xp2pManager.uuid });
    },
  },
});

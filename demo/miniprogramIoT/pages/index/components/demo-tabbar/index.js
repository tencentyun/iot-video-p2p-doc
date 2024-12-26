Component({
  behaviors: ['wx://component-export'],
  options: {
    addGlobalClass: true,
  },
  properties: {
    list: {
      type: Array,
      value: []
    }
  },
  data: {
    selected: 0,
    tabBarList: [{
      pagePath: '/pages/index/index',
      text: '首页',
      iconPath: '/icons/tab-bar/demo.png',
      selectedIconPath: '/icons/tab-bar/demo-active.png'
    }, {
      pagePath: '/pages/features-index/index',
      text: 'Features',
      iconPath: '/icons/tab-bar/feature.png',
      selectedIconPath: '/icons/tab-bar/feature-active.png'
    }, {
      pagePath: '/pages/video-files/files',
      text: '录像',
      iconPath: '/icons/tab-bar/video.png',
      selectedIconPath: '/icons/tab-bar/video-active.png'
    }, {
      pagePath: '/pages/log/files',
      text: '日志',
      iconPath: '/icons/tab-bar/log.png',
      selectedIconPath: '/icons/tab-bar/log-active.png'
    }],
  },
  export() {
    return {};
  },
  lifetimes: {
    attached() {
    },
  },
  methods: {
    switchTab(e) {
      const data = e.currentTarget.dataset;
      const url = data.path;
      wx.switchTab({ url });
      this.setData({
        selected: data.index
      });
    },
  },
});

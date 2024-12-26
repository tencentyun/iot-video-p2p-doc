Component({
  behaviors: ['wx://component-export'],
  options: {
    addGlobalClass: true,
  },
  properties: {
    showIcons: {
      type: Object,
      value: {
        quality: false,
        muted: false,
        orientation: false, // 视频流设备才支持
        rotate: false, // 图片流监控才支持旋转
        fill: false,
        fullScreen: false,
        snapshot: false,
        record: false,
      },
    },
    iconSize: {
      type: Number,
      value: 25,
    },
    qualityMap: {
      type: Object,
      value: {},
    },
    quality: {
      type: String,
      value: '',
    },
    muted: {
      type: Boolean,
      value: false,
    },
    orientation: {
      type: String,
      value: 'vertical',
    },
    rotate: {
      type: Number,
      value: 0,
    },
    fill: {
      type: Boolean,
      value: false,
    },
    fullScreen: {
      type: Boolean,
      value: false,
    },
    record: {
      type: Boolean,
      value: false,
    },
  },
  data: {
    // TODO
  },
  export() {
    return {
      hello: () => wx.showToast({ title: 'hello', icon: 'none' }),
    };
  },
  methods: {
    clickIcon({ currentTarget: { dataset } }) {
      const { name } = dataset;
      this.triggerEvent('clickicon', { name });
    },
  },
});

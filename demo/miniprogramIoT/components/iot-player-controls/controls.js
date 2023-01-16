Component({
  behaviors: ['wx://component-export'],
  options: {
    addGlobalClass: true,
  },
  properties: {
    showIcons: {
      type: Object,
      value: {
        quality: true,
        muted: true,
        orientation: true,
        fullScreen: true,
        snapshot: true,
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
    fullScreen: {
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

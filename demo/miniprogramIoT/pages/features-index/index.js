
Page({
  data: {
    showIcons: {
      quality: true,
    },
    navigators: [
      {
        icon: 'video',
        title: 'voip呼叫设备',
        path: '/pages/video/pages/voip-call/index?name=voip-call',
      },
      {
        icon: 'order',
        title: 'Log管理',
        path: '/pages/user-files/files?name=logs',
      },
      {
        icon: 'video',
        title: 'flv录像',
        path: '/pages/user-files/files?name=flvs',
      },
      {
        icon: 'video',
        title: 'stream录像',
        path: '/pages/user-files/files?name=streams',
      },
      {
        icon: 'phone',
        title: '对讲录像',
        path: '/pages/user-files/files?name=voices',
      },
      {
        icon: 'download',
        title: '本地下载',
        path: '/pages/user-files/files?name=downloads',
      },
      {
        icon: 'download',
        title: '云存下载',
        path: '/pages/user-files/files?name=cloud',
      },
      {
        icon: 'video',
        title: 'Video测试',
        path: '/pages/test-video/test',
      },
      {
        icon: 'video',
        title: 'local player',
        path: '/pages/video/pages/local-flv-player/player',
      },
      {
        icon: 'phone',
        title: 'TWeCall',
        path: '/pages/video/pages/voip/voip',
      },
      {
        icon: 'video',
        title: 'IPC监控',
        path: '/pages/features/pages/ipc-live/demo',
      },
      {
        icon: 'video',
        title: '自定义信令',
        path: '/pages/features/pages/ipc-custom-signal/demo',
      },
      {
        icon: 'video',
        title: 'IPC清晰度',
        path: '/pages/features/pages/ipc-definition/demo',
      },
      {
        icon: 'video',
        title: 'IPC全屏',
        path: '/pages/features/pages/ipc-fullscreen/demo',
      },
      {
        icon: 'video',
        title: 'IPC静音',
        path: '/pages/features/pages/ipc-muted/demo',
      },
      {
        icon: 'video',
        title: 'IPC方向',
        path: '/pages/features/pages/ipc-orientation/demo',
      },
      {
        icon: 'video',
        title: 'IPC截图',
        path: '/pages/features/pages/ipc-snapshot/demo',
      },
      {
        icon: 'video',
        title: '填充方式',
        path: '/pages/features/pages/ipc-fill/demo',
      },
      {
        icon: 'video',
        title: 'IPC-PTZ',
        path: '/pages/features/pages/ipc-ptz/demo',
      },
    ],
  },
  onLoad() {},
  handleNavigate(e) {
    const idx = parseInt(e.detail.key, 10);
    wx.navigateTo({ url: this.data.navigators[idx].path });
  },
});

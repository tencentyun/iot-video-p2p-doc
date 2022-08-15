import { getXp2pManager } from '../../lib/xp2pManager';

const xp2pManager = getXp2pManager();

Page({
  data: {
    // 这是onLoad时就固定的
    cfg: '',

    // 这些是控制player和p2p的
    playerId: 'iot-p2p-player',
    player: null,
  },
  onLoad(query) {
    console.log('demo: onLoad', query);

    const cfg = query.cfg || '';
    this.setData({
      cfg,
    });
  },
  onShow() {
    console.log('demo: onShow');
  },
  onHide() {
    console.log('demo: onHide');
  },
  onUnload() {
    console.log('demo: onUnload');
    this.hasExited = true;

    // 监控页关掉player就好，不用销毁 p2p 模块
    if (this.data.player) {
      this.data.player.stopAll('auto'); // 按player内部属性来
      this.setData({ player: null });
    }

    console.log('demo: checkReset when exit');
    xp2pManager.checkReset();
  },
  onStartPlayer({ detail }) {
    console.log('demo: onStartPlayer', detail);
    this.setData(detail, () => {
      const player = this.selectComponent(`#${this.data.playerId}`);
      if (player) {
        this.setData({ player });
      } else {
        console.error('create player error', this.data.playerId);
      }
    });
  },
  onPlayError({ detail }) {
    console.log('demo: onPlayError', detail);
    const { errMsg, errDetail, isFatalError } = detail;
    wx.showModal({
      content: `${errMsg || '播放失败'}\n${(errDetail && errDetail.msg) || ''}`, // 换行在开发者工具中无效，真机正常
      showCancel: false,
      complete: () => {
        if (isFatalError) {
          // 致命错误，需要reset的全部reset
          xp2pManager.checkReset();
          this.data.player.reset();
        }
      },
    });
  },
  onOpenPage() {
    wx.navigateTo({ url: '/pages/test-video/test' });
  },
});

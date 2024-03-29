import { getPlayerProperties } from '../../utils';
import { getXp2pManager } from '../../lib/xp2pManager';

const xp2pManager = getXp2pManager();

Page({
  data: {
    // 这是onLoad时就固定的
    playerIdPrefix: 'iot-p2p-player',
    playerPropsList: [],

    // 这些是控制player和p2p的
    playerMap: {},
  },
  onLoad(query) {
    console.log('multiplayers: onLoad', query);

    console.log('multiplayers: checkReset when enter');
    xp2pManager.checkReset();

    const cfg1 = query.cfg1 || '';
    const cfg2 = query.cfg2 || '';
    const onlyp2p = !!parseInt(query.onlyp2p, 10);
    const opts = {
      onlyp2p,
    };

    const props1 = getPlayerProperties(cfg1, { playerId: `${this.data.playerIdPrefix}-1`, ...opts });
    const props2 = getPlayerProperties(cfg2, { playerId: `${this.data.playerIdPrefix}-2`, ...opts });
    if (!props1) {
      wx.showModal({
        content: `invalid cfg ${cfg1}`,
        showCancel: false,
      });
      return;
    }
    if (!props2) {
      wx.showModal({
        content: `invalid cfg ${cfg2}`,
        showCancel: false,
      });
      return;
    }

    this.setData(
      {
        playerPropsList: [props1, props2],
      },
      () => {
        console.log('multiplayers: now data', this.data);

        const playerMap = {};
        this.data.playerPropsList.forEach((props) => {
          const { playerId } = props;
          const player = this.selectComponent(`#${playerId}`);
          if (player) {
            playerMap[playerId] = player;
          } else {
            console.error('create player error', playerId);
          }
        });
        this.setData(
          {
            playerMap,
          },
          () => {
            console.log('now playerMap', this.data.playerMap);
          },
        );
      },
    );
  },
  onUnload() {
    console.log('multiplayers: onUnload');
    this.hasExited = true;

    // 监控页关掉player就好，不用销毁 p2p 模块
    Object.values(this.data.playerMap).forEach((player) => {
      player.stopAll();
    });

    this.setData({ playerMap: {} });

    console.log('multiplayers: checkReset when exit');
    xp2pManager.checkReset();
  },
  onPlayError({ detail, currentTarget }) {
    console.log('multiplayers: onPlayError', currentTarget.id, detail.errType, 'isFatalError', detail.isFatalError, detail);
    const { errMsg, errDetail, isFatalError } = detail;
    wx.showModal({
      content: `${currentTarget.id}: ${errMsg || '播放失败'}\n${(errDetail && errDetail.msg) || ''}`, // 换行在开发者工具中无效，真机正常
      showCancel: false,
      complete: () => {
        if (isFatalError) {
          // demo简单点，直接退出，注意 onUnload 时可能需要reset插件
          // 如果不想退出，在这里reset插件（如果需要的话），然后重新创建player组件
          !this.hasExited && wx.navigateBack();
        }
      },
    });
  },
});

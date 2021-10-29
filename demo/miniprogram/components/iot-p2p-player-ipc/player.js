import config from '../../config/config';
import { getXp2pManager, Xp2pManagerErrorEnum } from '../../xp2pManager';

const xp2pManager = getXp2pManager();

const { commandMap } = config;

Component({
  behaviors: ['wx://component-export'],
  properties: {
    targetId: {
      type: String,
    },
    flvUrl: {
      type: String,
    },
    productId: {
      type: String,
    },
    deviceName: {
      type: String,
    },
    xp2pInfo: {
      type: String,
    },
    // 以下仅供调试，正式组件不需要
    onlyp2p: {
      type: Boolean,
    },
    showDebugInfo: {
      type: Boolean,
    },
  },
  data: {
    // 这些是控制player和p2p的
    playerId: 'iot-p2p-player-ipc',
    player: null,
    p2pReady: false,

    // 语音对讲
    voiceState: '',

    // 自定义信令
    inputCommand: 'action=user_define&cmd=xxx',

    // 搞个方便操作的面板
    ptzBtns: [
      { name: 'up', cmd: 'ptz_up_press' },
      { name: 'down', cmd: 'ptz_down_press' },
      { name: 'left', cmd: 'ptz_left_press' },
      { name: 'right', cmd: 'ptz_right_press' }
    ],
    ptzCmd: '',
    releasePTZTimer: null,
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
      this.stopVoice();

      if (this.data.ptzCmd || this.data.releasePTZTimer) {
        this.controlDevicePTZ('ptz_release_pre');
      }

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
      console.log('ipcplayer: onP2PStateChange', e.detail.p2pState);
      const p2pReady = e.detail.p2pState === 'ServiceStarted';
      this.setData({ p2pReady });
      this.passEvent(e);
    },
    // 以下是用户交互
    changeFlv(e) {
      console.log(`[${this.id}]`, 'changeFlv');
      if (!this.data.p2pReady) {
        console.log('p2p not ready');
        return;
      }
      if (!this.data.player) {
        console.log('no player');
        return;
      }

      const { flv } = e.currentTarget.dataset;
      const [filename, params] = flv.split('?');
      console.log(`[${this.id}]`, 'call changeFlv', filename, params);
      this.data.player.changeFlv({ filename, params });
    },
    startVoice(e) {
      console.log(`[${this.id}]`, 'startVoice');
      if (!this.data.p2pReady) {
        console.log('p2p not ready');
        return;
      }
      if (this.data.voiceState === 'starting' || this.data.voiceState === 'sending') {
        console.log(`can not start voice in voiceState ${this.data.voiceState}`);
        return;
      }

      // 每种采样率有对应的编码码率范围有效值，设置不合法的采样率或编码码率会导致录音失败
      // 具体参考 https://developers.weixin.qq.com/miniprogram/dev/api/media/recorder/RecorderManager.start.html
      const [numberOfChannels, sampleRate, encodeBitRate] = e.currentTarget.dataset.recorderCfg
        .split('-')
        .map((v) => Number(v));
      const recorderOptions = {
        numberOfChannels, // 录音通道数
        sampleRate, // 采样率
        encodeBitRate, // 编码码率
      };

      console.log(`[${this.id}]`, 'do startVoice', this.properties.targetId, recorderOptions);
      this.setData({ voiceState: 'starting' });
      xp2pManager
        .startVoice(this.properties.targetId, recorderOptions, {
          onPause: (res) => {
            console.log(`[${this.id}]`, 'voice onPause', res);
            // 简单点，recorder暂停就停止语音对讲
            this.stopVoice();
          },
          onStop: (res) => {
            console.log(`[${this.id}]`, 'voice onStop', res);
            if (res.willRestart) {
              // 如果是到时间触发的，插件会自动续期，不自动restart的才需要stopVoice
              this.stopVoice();
            }
          },
        })
        .then((res) => {
          console.log('startVoice success', res);
          this.setData({ voiceState: 'sending' });
        })
        .catch((res) => {
          console.log('startVoice fail', res);
          this.setData({ voiceState: '' });
          wx.showToast({
            title: res === Xp2pManagerErrorEnum.NoAuth ? '请授权小程序访问麦克风' : '发起语音对讲失败',
            icon: 'error',
          });
        });
    },
    stopVoice() {
      console.log(`[${this.id}]`, 'stopVoice');
      if (!this.data.p2pReady) {
        console.log('p2p not ready');
        return;
      }
      if (!this.data.voiceState) {
        console.log('not voicing');
        return;
      }
      console.log(`[${this.id}]`, 'do stopVoice', this.properties.targetId);
      this.setData({ voiceState: '' });
      xp2pManager.stopVoice(this.properties.targetId);
    },
    sendInnerCommand(e) {
      console.log(`[${this.id}]`, 'sendInnerCommand');
      if (!this.data.p2pReady) {
        console.log('p2p not ready');
        return;
      }

      const { cmd } = e.currentTarget.dataset;
      if (!cmd || !commandMap[cmd]) {
        this.showToast(`sendInnerCommand: invalid cmd ${cmd}`);
        return;
      }

      const cmdDetail = commandMap[cmd];
      console.log(`[${this.id}]`, 'do sendInnerCommand', this.properties.targetId, cmdDetail);
      xp2pManager
        .sendInnerCommand(this.properties.targetId, cmdDetail)
        .then((res) => {
          console.log(`[${this.id}]`, 'sendInnerCommand res', res);
          wx.showModal({
            content: `sendInnerCommand res: ${JSON.stringify(res, null, 2)}`,
            showCancel: false,
          });
        })
        .catch((errmsg) => {
          console.error(`[${this.id}]`, 'sendInnerCommand error', errmsg);
          wx.showModal({
            content: errmsg,
            showCancel: false,
          });
        });
    },
    inputIPCCommand(e) {
      this.setData({
        inputCommand: e.detail.value,
      });
    },
    sendCommand() {
      console.log(`[${this.id}]`, 'sendCommand');
      if (!this.data.p2pReady) {
        console.log('p2p not ready');
        return;
      }

      if (!this.data.inputCommand) {
        this.showToast('sendCommand: please input command');
        return;
      }

      xp2pManager
        .sendCommand(this.properties.targetId, this.data.inputCommand)
        .then((res) => {
          console.log(`[${this.id}]`, 'sendCommand res', res);
          wx.showModal({
            content: `sendCommand res: type=${res.type}, status=${res.status}, data=${res.data}`,
            showCancel: false,
          });
        })
        .catch((errcode) => {
          console.error(`[${this.id}]`, 'sendCommand error', errcode);
          wx.showModal({
            content: `sendCommand error: ${errcode}`,
            showCancel: false,
          });
        });
    },
    toggleVoice(e) {
      if (!this.data.p2pReady) {
        return;
      }

      const isSendingVoice = this.data.voiceState === 'sending';
      if (!isSendingVoice) {
        this.startVoice(e);
      } else {
        this.stopVoice();
      }
    },
    controlDevicePTZ(e) {
      console.log(`[${this.id}]`, 'controlDevicePTZ');
      if (!this.data.p2pReady) {
        console.log('p2p not ready');
        return;
      }
      const cmd = e && e.currentTarget ? e.currentTarget.dataset.cmd : e;
      if (!cmd) {
        return;
      }
      console.log(`[${this.id}]`, 'do controlDevicePTZ', cmd);

      if (this.data.releasePTZTimer) {
        clearTimeout(this.data.releasePTZTimer);
        this.setData({ releasePTZTimer: null });
      }

      if (cmd !== 'ptz_release_pre') {
        this.setData({ ptzCmd: cmd });
      } else {
        this.setData({ ptzCmd: '' });
      }

      const p2pId = this.data.targetId;
      const cmdDetail = {
        topic: 'ptz',
        data: {
          cmd,
        },
      };
      const start = Date.now();
      xp2pManager
        .sendUserCommand(p2pId, { cmd: cmdDetail })
        .then((res) => {
          console.log(`[${p2pId}] sendPTZCommand delay ${Date.now() - start}, res`, res);
        })
        .catch((err) => {
          console.error(`[${p2pId}] sendPTZCommand delay ${Date.now() - start}, error`, err);
        });
    },
    releasePTZBtn() {
      console.log(`[${this.id}]`, 'releasePTZBtn');
      if (!this.data.p2pReady) {
        console.log('p2p not ready');
        return;
      }
      console.log(`[${this.id}]`, 'delay releasePTZBtn');

      // 先把cmd清了，恢复按钮状态
      this.setData({ ptzCmd: '' });

      if (this.data.releasePTZTimer) {
        clearTimeout(this.data.releasePTZTimer);
        this.setData({ releasePTZTimer: null });
      }

      // 延迟发送release
      const releasePTZTimer = setTimeout(() => {
        this.controlDevicePTZ('ptz_release_pre');
      }, 500);
      this.setData({ releasePTZTimer });
    },
  },
});

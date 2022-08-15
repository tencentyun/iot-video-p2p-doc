import { sysInfo } from '../../utils';
import { getXp2pManager, Xp2pManagerErrorEnum } from '../../lib/xp2pManager';
import { getRecordManager } from '../../lib/recordManager';
import { VoiceOpEnum, VoiceStateEnum, voiceConfigMap } from './common';

const xp2pManager = getXp2pManager();

const voiceManager = getRecordManager('voices');

Component({
  behaviors: ['wx://component-export'],
  options: {
    addGlobalClass: true,
  },
  properties: {
    targetId: {
      type: String,
      value: '',
    },
    productId: {
      type: String,
      value: '',
    },
    deviceName: {
      type: String,
      value: '',
    },
    intercomType: {
      type: String,
      value: 'Recorder',
    },
    p2pReady: {
      type: Boolean,
      value: false,
    },
  },
  data: {
    innerId: '',
    isDetached: false,

    // 语音对讲
    needPusher: false, // attached 时根据 intercomType 设置
    needDuplex: false, // attached 时根据 intercomType 设置
    voiceState: '', // VoiceStateEnum
    // voiceFileObj: null, // 移到 userData

    // 对讲时的特殊处理，recorder 默认 mute
    voiceOp: VoiceOpEnum.None, // none/mute/pause，attached 时根据 intercomType 设置初始值

    // 这些是控制pusher的
    pusherId: 'iot-p2p-common-pusher',
    // pusher: null, // 移到 userData
    pusherReady: false,
    pusherError: null,
    pusherProps: {
      isRTC: true,
      enableAgc: true,
      enableAns: true,
      highQuality: false,
    },
    pusherPropChecks: [
      {
        field: 'isRTC',
        text: 'RTC模式（自动开启回声抑制）',
      },
      {
        field: 'enableAgc',
        text: '自动增益（补偿音量，但会放大噪音）',
      },
      {
        field: 'enableAns',
        text: '噪声抑制（过滤噪音，但会误伤正常声音）',
      },
      {
        field: 'highQuality',
        text: '高音质（高-48KHz，低-16KHz）',
      },
    ],
    isModifyPusher: false,
  },
  observers: {
    voiceState(val) {
      this.triggerEvent('voiceStateChange', {
        voiceState: val,
      });
    },
  },
  lifetimes: {
    created() {
      this.setData({ innerId: 'p2p-voice' });
      console.log(`[${this.data.innerId}]`, '==== created');

      // 渲染无关，不放在data里，以免影响性能
      this.userData = {
        pusher: null,
        voiceFileObj: null, // pusher采集时把数据录下来，调试用
      };
    },
    attached() {
      console.log(`[${this.data.innerId}]`, '==== attached', this.id, this.properties);

      const voiceConfig = voiceConfigMap[this.properties.intercomType];
      console.log(`[${this.data.innerId}]`, 'voiceConfig', this.properties.intercomType, voiceConfig);
      if (!voiceConfig) {
        return;
      }

      this.setData({
        needPusher: voiceConfig.needPusher,
        needDuplex: voiceConfig.needDuplex,
        voiceOp: voiceConfig.voiceOp || VoiceOpEnum.None,
      });
      if (voiceConfig.needPusher) {
        this.getPusherComp();
      }
    },
    detached() {
      console.log(`[${this.data.innerId}]`, '==== detached');
      this.setData({ isDetached: true });
      this.stopVoice();
      console.log(`[${this.data.innerId}]`, '==== detached end');
    },
  },
  export() {
    return {
      start: this.startVoice.bind(this),
      stop: this.stopVoice.bind(this),
    };
  },
  methods: {
    showToast(content) {
      !this.data.isDetached && wx.showToast({
        title: content,
        icon: 'none',
      });
    },
    showModal(params) {
      !this.data.isDetached && wx.showModal(params);
    },
    getPusherComp() {
      const pusher = this.selectComponent(`#${this.data.pusherId}`);
      if (pusher) {
        this.userData.pusher = pusher;
        console.log(`[${this.data.innerId}]`, 'getPusherComp success', pusher);
      } else {
        console.error(`[${this.data.innerId}]`, 'getPusherComp error', this.data.pusherId);
      }
    },
    onPusherStateChange(e) {
      console.log(`[${this.data.innerId}]`, 'onPusherStateChange', e.detail.pusherState);
      const pusherReady = e.detail.pusherState === 'PusherReady';
      this.setData({ pusherReady });
    },
    onPusherStartPush(e) {
      // 真正开始推流了
      console.log(`[${this.data.innerId}]`, 'onPusherStartPush', e.detail);
      if (this.data.voiceState !== VoiceStateEnum.sending) {
        console.warn(`[${this.data.innerId}]`, 'onPusherStartPush in voiceState', this.data.voiceState);
      }
    },
    onPusherClose(e) {
      console.log(`[${this.data.innerId}]`, 'onPusherClose', e.detail);
      if (!this.data.voiceState || !this.data.needPusher) {
        return;
      }
      this.stopVoice();
      this.showModal({
        content: '推流结束',
        showCancel: false,
      });
    },
    onPusherPushError(e) {
      console.error(`[${this.data.innerId}]`, 'onPusherPushError', e.detail);
      if (this.data.voiceState && this.data.needPusher) {
        this.stopVoice();
      }
      const { errType, errMsg, errDetail } = e.detail;
      if (errType === 'PusherError' || errType === 'LivePusherError') {
        this.setData({ pusherReady: false, pusherError: e.detail });
      }
      this.showModal({
        content: `${errMsg || '推流失败'}\n${(errDetail && errDetail.msg) || ''}`, // 换行在开发者工具中无效，真机正常,
        showCancel: false,
      });
    },
    checkAuthCanStartVoice() {
      console.log(`[${this.data.innerId}]`, 'checkAuthCanStartVoice');
      return new Promise((resolve, reject) => {
        xp2pManager
          .checkRecordAuthorize()
          .then(() => {
            console.log(`[${this.data.innerId}]`, 'checkRecordAuthorize success');
            resolve();
          })
          .catch((err) => {
            console.log(`[${this.data.innerId}]`, 'checkRecordAuthorize err', err);
            this.showToast('请授权小程序访问麦克风');
            reject(err);
          });
      });
    },
    checkDeviceCanStartVoice() {
      console.log(`[${this.data.innerId}]`, 'checkDeviceCanStartVoice');
      return new Promise((resolve, reject) => {
        xp2pManager
          .sendInnerCommand(this.properties.targetId, {
            cmd: 'get_device_st',
            params: {
              type: 'voice',
            },
          })
          .then((res) => {
            let canStart = false;
            let errMsg = '';
            const data = res[0]; // 返回的 res 是数组
            const status = parseInt(data && data.status, 10); // 有的设备返回的 status 是字符串，兼容一下
            console.log(`[${this.data.innerId}]`, 'checkDeviceCanStartVoice status', status, res);
            switch (status) {
              case 0:
                canStart = true;
                break;
              case 1:
                errMsg = '设备正忙，请稍后重试';
                break;
              case 405:
                errMsg = '当前连接人数超过限制，请稍后重试';
                break;
              default:
                console.error(`[${this.data.innerId}]`, 'check can start voice, unknown status', status);
            }
            if (canStart) {
              resolve();
            } else {
              this.showToast(errMsg || '获取设备状态失败');
              reject(errMsg || '获取设备状态失败');
            }
          })
          .catch((errmsg) => {
            console.log(`[${this.data.innerId}]`, 'checkDeviceCanStartVoice error', errmsg);
            this.showToast('获取设备状态失败');
            reject('获取设备状态失败');
          });
      });
    },
    async startVoice(e) {
      console.log(`[${this.data.innerId}]`, 'startVoice');
      if (this.data.voiceState) {
        console.log(`[${this.data.innerId}]`, `can not start voice in voiceState ${this.data.voiceState}`);
        return;
      }

      if (this.data.needPusher && !this.data.pusherReady) {
        if (this.data.pusherError) {
          const { errMsg, errDetail } = this.data.pusherError;
          this.showModal({
            content: `${errMsg || '推流失败'}\n${(errDetail && errDetail.msg) || ''}`, // 换行在开发者工具中无效，真机正常,
            showCancel: false,
          });
        } else {
          this.showToast('pusher not ready');
        }
        return;
      }

      if (this.data.needDuplex) {
        // 是双向音视频，在demo里省略呼叫应答功能，直接发起
        this.triggerEvent('beforeStartVoice', { voiceOp: this.data.voiceOp });
        this.doStartVoiceByPusher(e);
        return;
      }

      // 是普通语音对讲，先检查能否对讲
      try {
        this.setData({ voiceState: VoiceStateEnum.authChecking });
        await this.checkAuthCanStartVoice();
      } catch (err) {
        if (!this.data.voiceState) {
          // 已经stop了
          return;
        }
        console.log(`[${this.data.innerId}]`, '==== checkAuthCanStartVoice error', err);
        this.stopVoice();
        return;
      }

      try {
        this.setData({ voiceState: VoiceStateEnum.deviceChecking });
        await this.checkDeviceCanStartVoice();
      } catch (err) {
        if (!this.data.voiceState) {
          // 已经stop了
          return;
        }
        console.log(`[${this.data.innerId}]`, '==== checkDeviceCanStartVoice error', err);
        this.stopVoice();
        return;
      }

      if (!this.data.voiceState) {
        // 已经stop了
        return;
      }
      // 检查通过，开始对讲
      console.log(`[${this.data.innerId}]`, '==== checkCanStartVoice success');

      // 通知事件
      this.triggerEvent('beforeStartVoice', { voiceOp: this.data.voiceOp });

      if (this.data.needPusher) {
        this.doStartVoiceByPusher(e);
      } else {
        this.doStartVoiceByRecorder(e);
      }
    },
    doStartVoiceByRecorder(e) {
      // 每种采样率有对应的编码码率范围有效值，设置不合法的采样率或编码码率会导致录音失败
      // 具体参考 https://developers.weixin.qq.com/miniprogram/dev/api/media/recorder/RecorderManager.start.html
      const { options } = voiceConfigMap[this.properties.intercomType];

      // 弄个副本，以免被修改
      let voiceOptions;
      if (e?.currentTarget?.dataset?.recorderCfg) {
        const [numberOfChannels, sampleRate, encodeBitRate] = e?.currentTarget?.dataset?.recorderCfg
          .split('-')
          .map((v) => Number(v));
        const recorderOptions = {
          numberOfChannels, // 录音通道数
          sampleRate, // 采样率
          encodeBitRate, // 编码码率
        };
        voiceOptions = { ...options, ...recorderOptions };
      } else {
        voiceOptions = { ...options };
      }

      console.log(`[${this.data.innerId}]`, 'do doStartVoiceByRecorder', this.properties.targetId, voiceOptions);
      this.setData({ voiceState: VoiceStateEnum.preparing });
      xp2pManager
        .startVoice(this.properties.targetId, voiceOptions, {
          onPause: (res) => {
            console.log(`[${this.data.innerId}]`, 'voice onPause', res);
            // 简单点，recorder暂停就停止语音对讲
            this.stopVoice();
          },
          onStop: (res) => {
            console.log(`[${this.data.innerId}]`, 'voice onStop', res);
            if (!res.willRestart) {
              // 如果是到时间触发的，插件会自动续期，不自动restart的才需要stopVoice
              this.stopVoice();
            }
          },
        })
        .then((res) => {
          if (!this.data.voiceState) {
            // 已经stop了
            return;
          }
          console.log(`[${this.data.innerId}]`, 'startVoice success', res);
          this.setData({ voiceState: VoiceStateEnum.sending });
        })
        .catch((errcode) => {
          if (!this.data.voiceState) {
            // 已经stop了
            return;
          }
          console.log(`[${this.data.innerId}]`, 'startVoice fail', errcode);
          this.showToast(errcode === Xp2pManagerErrorEnum.NoAuth ? '请授权小程序访问麦克风' : '发起语音对讲失败');
          this.stopVoice();
        });
    },
    doStartVoiceByPusher(e) {
      const { options } = voiceConfigMap[this.properties.intercomType];

      // 弄个副本，以免被修改
      const voiceOptions = { ...options };

      const needRecord = parseInt(e?.currentTarget?.dataset?.needRecord, 10);

      console.log(`[${this.data.innerId}]`, 'do doStartVoiceByPusher', this.properties.targetId, voiceOptions);
      this.setData({ voiceState: VoiceStateEnum.preparing });
      xp2pManager
        .startVoiceData(this.properties.targetId, voiceOptions, {
          onStop: () => {
            if (!this.data.voiceState) {
              // 已经stop了
              return;
            }
            console.log(`[${this.data.innerId}]`, 'voice onStop');
            this.stopVoice();
          },
          onComplete: () => {
            if (!this.data.voiceState) {
              // 已经stop了
              return;
            }
            console.log(`[${this.data.innerId}]`, 'voice onComplete');
            this.stopVoice();
          },
        })
        .then((writer) => {
          if (!this.data.voiceState) {
            // 已经stop了
            return;
          }
          console.log(`[${this.data.innerId}]`, 'startVoiceData success', writer);

          let writerForPusher = writer;
          if (needRecord) {
            // 录制，方便验证，正式版本不需要
            const fileName = [
              `voice-${this.properties.productId}-${this.properties.deviceName}`,
              sysInfo.platform,
              this.data.pusherProps.isRTC ? 'RTC' : 'SD',
            ].join('-');
            const voiceFileObj = voiceManager.openRecordFile(fileName);
            this.userData.voiceFileObj = voiceFileObj;
            writerForPusher = {
              addChunk: (chunk) => {
                // 收到pusher的数据
                // 写文件，不直接用 voiceFileObj 是因为 userData.voiceFileObj 后面可能会变，以 userData 里的为准
                this.userData.voiceFileObj && voiceManager.writeRecordFile(this.userData.voiceFileObj, chunk);
                // 写到xp2p语音请求里
                writer.addChunk(chunk);
              },
            };
          }

          // 启动推流，这时还不能发送数据
          console.log(`[${this.data.innerId}]`, 'call pusher.start, pusherProps', this.data.pusherProps);
          this.setData({ voiceState: VoiceStateEnum.starting });
          this.userData.pusher.start({
            writer: writerForPusher,
            success: (res) => {
              console.log(`[${this.data.innerId}]`, 'voice pusher start success', res);
              this.setData({ voiceState: VoiceStateEnum.sending });
            },
            fail: (err) => {
              console.log(`[${this.data.innerId}]`, 'voice pusher start fail', err);
              this.stopVoice();
            },
          });
        })
        .catch((errcode) => {
          if (!this.data.voiceState) {
            // 已经stop了
            return;
          }
          console.log(`[${this.data.innerId}]`, 'startVoiceData fail', errcode);
          this.showToast('对讲失败');
          this.stopVoice();
        });
    },
    stopVoice() {
      console.log(`[${this.data.innerId}]`, 'stopVoice');
      if (!this.data.voiceState) {
        console.log(`[${this.data.innerId}]`, 'not voicing');
        return;
      }

      console.log(`[${this.data.innerId}]`, 'do stopVoice', this.properties.targetId, this.data.voiceState);

      const { voiceFileObj } = this.userData;
      this.userData.voiceFileObj = null;

      const { voiceState } = this.data;
      this.setData({ voiceState: '' });

      if (voiceFileObj) {
        voiceManager.closeRecordFile(voiceFileObj);
      }

      if (this.data.needPusher) {
        // 如果是pusher，先停止采集语音
        if (voiceState === VoiceStateEnum.starting || voiceState === VoiceStateEnum.sending) {
          this.userData.pusher?.stop();
        }
      } else {
        // 如果是recorder，p2p模块里的stopVoice里会停止recorderManager
      }
      xp2pManager.stopVoice(this.properties.targetId);

      // 通知事件
      this.triggerEvent('afterStopVoice', { voiceOp: this.data.voiceOp });
    },
    toggleModifyPusher() {
      if (!this.data.isModifyPusher) {
        this.stopVoice();
        this.setData({
          isModifyPusher: true,
          pusherReady: false,
          pusherError: null,
        });
        this.userData.pusher = null;
      } else {
        this.setData({
          isModifyPusher: false,
        }, () => {
          this.getPusherComp();
        });
      }
    },
    goRecordList() {
      wx.navigateTo({
        url: `/pages/user-files/files?name=${voiceManager.name}`,
      });
    },
    voiceOpChanged(e) {
      this.setData({
        voiceOp: e.detail.value,
      });
    },
    switchPusherPropCheck(e) {
      const { pusherProps } = this.data;

      const { field } = e.currentTarget.dataset;
      pusherProps[field] = e.detail.value;

      this.setData({
        pusherProps,
      });
    },
  },
});

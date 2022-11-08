import { sysInfo } from '../../utils';
import { getXp2pManager, Xp2pManagerErrorEnum } from '../../lib/xp2pManager';
import { getRecordManager } from '../../lib/recordManager';
import { VoiceOpEnum, VoiceStateEnum, voiceConfigMap } from './common';

// 覆盖 console
const app = getApp();
const oriConsole = app.console;
const console = app.logger || oriConsole;

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

    // 语音对讲
    needPusher: false, // attached 时根据 intercomType 设置
    needDuplex: false, // attached 时根据 intercomType 设置

    // 是否加密
    needCrypto: true,

    // 对讲状态
    voiceState: '', // VoiceStateEnum
    // voiceFileObj: null, // 移到 userData

    // 对讲时的特殊处理，recorder 默认 mute
    voiceOp: VoiceOpEnum.None, // none/mute/pause，attached 时根据 intercomType 设置初始值

    // 这些是控制pusher的
    pusherId: '',
    // pusher: null, // 移到 userData
    pusherProps: {
      isRTC: true,
      enableAgc: true,
      enableAns: true,
      highQuality: false,
      ignoreEmptyAudioTag: false,
      fillAudioTag: false,
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
      {
        field: 'ignoreEmptyAudioTag',
        text: '不发送空 audioTag',
      },
      {
        field: 'fillAudioTag',
        text: '填充 audioTag',
      },
    ],
    isModifyPusher: false,
    showPusherDebugInfo: false,

    // 用语音文件模拟
    useVoiceFile: false,
  },
  observers: {
    voiceState(val) {
      console.log(`[${this.data.innerId}] voiceState changed ${val}`);
      if (val) {
        const now = Date.now();
        if (!this.userData.timestamps) {
          this.userData.timestamps = {
            firstState: val,
          };
          this.userData.steps = [];
        }
        if (!this.userData.timestamps[val]) {
          const { firstState, lastState } = this.userData.timestamps;
          if (lastState) {
            this.userData.steps.push({
              step: `${lastState}->${val}`,
              delay: now - this.userData.timestamps[lastState],
            });
          }
          this.userData.timestamps.lastState = val;
          this.userData.timestamps[val] = now;
          if (val === VoiceStateEnum.sending || val === VoiceStateEnum.error) {
            this.userData.timestamps.totalDelay = now - this.userData.timestamps[firstState];
            console.log(`[${this.data.innerId}] voiceStat`, {
              lastState: this.userData.timestamps.lastState,
              totalDelay: this.userData.timestamps.totalDelay,
              steps: this.userData.steps
            });
          }
        }
      } else {
        if (this.userData.timestamps) {
          if (!this.userData.timestamps.totalDelay) {
            // 还没出结果
            const now = Date.now();
            const nowState = 'stop';
            const { firstState, lastState } = this.userData.timestamps;
            if (lastState) {
              this.userData.steps.push({
                step: `${lastState}->${nowState}`,
                delay: now - this.userData.timestamps[lastState],
              });
            }
            this.userData.timestamps.lastState = nowState;
            this.userData.timestamps[nowState] = now;
            this.userData.timestamps.totalDelay = now - this.userData.timestamps[firstState];
            console.log(`[${this.data.innerId}] voiceStat`, {
              lastState: this.userData.timestamps.lastState,
              totalDelay: this.userData.timestamps.totalDelay,
              steps: this.userData.steps
            });
          }
          this.userData.timestamps = null;
          this.userData.steps = null;
        }
      }
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
        isDetached: false,
        timestamps: null,
        steps: null,
        pusher: null,
        voiceTriggerDataset: null, // startVoice时的dataset
        voiceFileObj: null, // pusher采集时把数据录下来，调试用
        writer: null,
        loopWriting: false,
      };
    },
    attached() {
      console.log(`[${this.data.innerId}]`, '==== attached', this.id);
      oriConsole.log(this.properties);

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

      // 触发对讲时再创建pusher
    },
    ready() {
      console.log(`[${this.data.innerId}]`, 'ready');
      this.triggerEvent('ready');
    },
    detached() {
      console.log(`[${this.data.innerId}]`, '==== detached');
      this.userData.isDetached = true;
      this.stopVoice();
      console.log(`[${this.data.innerId}]`, '==== detached end');
    },
  },
  export() {
    return {
      startVoice: this.startVoice.bind(this),
      stopVoice: this.stopVoice.bind(this),
    };
  },
  methods: {
    showToast(content) {
      !this.userData.isDetached && wx.showToast({
        title: content,
        icon: 'none',
      });
    },
    showModal(params) {
      !this.userData.isDetached && wx.showModal(params);
    },
    createPusher(data) {
      console.log(`[${this.data.innerId}]`, 'createPusher', data);
      return new Promise((resolve) => {
        this.setData(data, () => {
          const pusher = this.selectComponent(`#${this.data.pusherId}`);
          console.log(`[${this.data.innerId}]`, 'createPusher res', !!pusher);
          this.userData.pusher = pusher;
          resolve(pusher);
        });
      });
    },
    onPusherStartPush(e) {
      // 真正开始推流了
      console.log(`[${this.data.innerId}]`, 'onPusherStartPush', e.detail);
      if (this.data.voiceState === VoiceStateEnum.starting) {
        this.setData({ voiceState: VoiceStateEnum.sending });
      } else {
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
      const { errMsg, errDetail } = e.detail;
      this.showModal({
        content: `${errMsg || '推流失败'}\n${(errDetail && errDetail.msg) || ''}`, // 换行在开发者工具中无效，真机正常,
        showCancel: false,
      });
    },
    checkAuthCanStartVoice() {
      console.log(`[${this.data.innerId}]`, 'checkAuthCanStartVoice');
      return new Promise((resolve, reject) => {
        const start = Date.now();
        xp2pManager
          .checkRecordAuthorize()
          .then(() => {
            console.log(`[${this.data.innerId}]`, `checkRecordAuthorize success, delay ${Date.now() - start}`);
            resolve();
          })
          .catch((err) => {
            console.log(`[${this.data.innerId}]`, `checkRecordAuthorize err, delay ${Date.now() - start}`, err);
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
      if (this.userData.isDetached) {
        return;
      }

      console.log(`[${this.data.innerId}] startVoice in voiceState ${this.data.voiceState}, isModifyPusher ${this.data.isModifyPusher}`);
      if (this.data.voiceState) {
        console.log(`[${this.data.innerId}] can not start voice in voiceState ${this.data.voiceState}`);
        return;
      }
      if (this.data.isModifyPusher) {
        console.log(`[${this.data.innerId}] can not start voice when isModifyPusher`);
        return;
      }

      // 记下来
      this.userData.voiceTriggerDataset = e?.currentTarget?.dataset;

      const fromFile = parseInt(this.userData.voiceTriggerDataset?.fromFile, 10);
      this.setData({ useVoiceFile: !!fromFile });

      if (fromFile) {
        // 使用语音文件
        if (!this.userData.voiceDataFromFile) {
          this.showToast('请先选择语音文件');
          return;
        }
      } else if (this.data.needPusher) {
        // 需要pusher采集语音
        console.log(`[${this.data.innerId}] needPusher ${this.data.needPusher}, hasPusher ${!!this.userData.pusher}`);
        const needCreate = !this.userData.pusher;
        if (!this.userData.pusher) {
          // 创建
          this.setData({ voiceState: VoiceStateEnum.creating });
          await this.createPusher({ pusherId: 'iot-p2p-common-pusher' });

          if (!this.userData.pusher) {
            // 创建pusher出错
            console.error(`[${this.data.innerId}]`, '==== createPusher error', err);
            this.stopVoice();
            return;
          }
        }

        // 如果pusher内部出错了，这个可以触发重新开始，刚创建的不用prepare
        !needCreate && this.userData.pusher.prepare();
      }

      this.doStartVoice();
    },
    async doStartVoice() {
      if (this.userData.isDetached) {
        return;
      }

      const dataset = this.userData.voiceTriggerDataset;
      console.log(`[${this.data.innerId}] doStartVoice in voiceState ${this.data.voiceState}, dataset`, dataset);

      if (this.data.needDuplex) {
        // 是双向音视频，在demo里省略呼叫应答功能，直接发起
        this.triggerEvent('beforeStartVoice', { voiceOp: this.data.voiceOp });
        this.doStartVoiceByPusher(dataset);
        return;
      }

      // 是普通语音对讲，先检查能否对讲
      try {
        this.setData({ voiceState: VoiceStateEnum.authChecking });
        await this.checkAuthCanStartVoice();
        if (!this.data.voiceState) {
          // 已经stop了
          return;
        }
      } catch (err) {
        if (!this.data.voiceState) {
          // 已经stop了
          return;
        }
        console.error(`[${this.data.innerId}]`, '==== checkAuthCanStartVoice error', err);
        this.stopVoice();
        return;
      }

      try {
        this.setData({ voiceState: VoiceStateEnum.deviceChecking });
        await this.checkDeviceCanStartVoice();
        if (!this.data.voiceState) {
          // 已经stop了
          return;
        }
      } catch (err) {
        if (!this.data.voiceState) {
          // 已经stop了
          return;
        }
        console.error(`[${this.data.innerId}]`, '==== checkDeviceCanStartVoice error', err);
        this.stopVoice();
        return;
      }

      if (this.userData.isDetached || !this.data.voiceState) {
        // 已经stop了
        return;
      }
      // 检查通过，开始对讲
      console.log(`[${this.data.innerId}]`, '==== checkCanStartVoice success');

      // 通知事件
      this.triggerEvent('beforeStartVoice', { voiceOp: this.data.voiceOp });

      if (this.data.needPusher) {
        this.doStartVoiceByPusher(dataset);
      } else {
        this.doStartVoiceByRecorder(dataset);
      }
    },
    doStartVoiceByRecorder(dataset) {
      // 每种采样率有对应的编码码率范围有效值，设置不合法的采样率或编码码率会导致录音失败
      // 具体参考 https://developers.weixin.qq.com/miniprogram/dev/api/media/recorder/RecorderManager.start.html
      const { options } = voiceConfigMap[this.properties.intercomType];

      // 弄个副本，以免被修改
      let voiceOptions;
      if (dataset?.recorderCfg) {
        const [numberOfChannels, sampleRate, encodeBitRate] = dataset?.recorderCfg
          .split('-')
          .map((v) => Number(v));
        const recorderOptions = {
          numberOfChannels, // 录音通道数
          sampleRate, // 采样率
          encodeBitRate, // 编码码率
        };
        voiceOptions = { ...options, ...recorderOptions, offCrypto: !this.data.needCrypto };
      } else {
        voiceOptions = { ...options, offCrypto: !this.data.needCrypto };
      }

      console.log(`[${this.data.innerId}]`, 'doStartVoiceByRecorder', this.properties.targetId, voiceOptions);
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
          console.log(`[${this.data.innerId}]`, 'xp2pManager.startVoice success', res);
          this.setData({ voiceState: VoiceStateEnum.sending });
        })
        .catch((errcode) => {
          if (!this.data.voiceState) {
            // 已经stop了
            return;
          }
          console.log(`[${this.data.innerId}]`, 'xp2pManager.startVoice fail', errcode);
          this.showToast(errcode === Xp2pManagerErrorEnum.NoAuth ? '请授权小程序访问麦克风' : '发起语音对讲失败');
          this.stopVoice();
        });
    },
    doStartVoiceByPusher(dataset) {
      const { options } = voiceConfigMap[this.properties.intercomType];

      // 弄个副本，以免被修改
      const voiceOptions = { ...options, offCrypto: !this.data.needCrypto };

      const needRecord = parseInt(dataset?.needRecord, 10);

      console.log(`[${this.data.innerId}]`, 'doStartVoiceByPusher', this.properties.targetId, voiceOptions, `needRecord: ${needRecord}`);
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
          console.log(`[${this.data.innerId}]`, 'xp2pManager.startVoiceData success', writer);

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
          this.userData.writer = writerForPusher;

          const fromFile = parseInt(dataset?.fromFile, 10);
          if (fromFile) {
            // 点击按钮再触发发送
          } else if (this.userData.pusher) {
            this.userData.pusher.start({ writer: writerForPusher });
          } else {
            console.log(`[${this.data.innerId}]`, 'call pusher.start fail, no pusher');
            this.showToast('对讲失败');
            this.stopVoice();
          }
        })
        .catch((errcode) => {
          if (!this.data.voiceState) {
            // 已经stop了
            return;
          }
          console.log(`[${this.data.innerId}]`, 'xp2pManager.startVoiceData fail', errcode);
          this.showToast('对讲失败');
          this.stopVoice();
        });
    },
    stopVoice() {
      if (this.userData.isDetached) {
        return;
      }

      console.log(`[${this.data.innerId}] stopVoice in voiceState ${this.data.voiceState}`);
      if (!this.data.voiceState) {
        console.log(`[${this.data.innerId}]`, 'not voicing');
        return;
      }

      console.log(`[${this.data.innerId}]`, 'doStopVoice', this.properties.targetId);

      const { voiceFileObj } = this.userData;
      this.userData.voiceFileObj = null;
      this.userData.voiceTriggerDataset = null;

      this.userData.writer = null;
      this.userData.loopWriting = false;

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
    toggleCrypto() {
      if (!this.data.voiceState) {
        // 不在对讲中才可以点
        this.setData({ needCrypto: !this.data.needCrypto });
      }
    },
    togglePusherDebugInfo() {
      if (this.data.pusherId && !this.data.isModifyPusher) {
        // 有pusher才可以点
        this.setData({ showPusherDebugInfo: !this.data.showPusherDebugInfo });
      }
    },
    toggleModifyPusher() {
      if (!this.data.isModifyPusher) {
        // 进入修改模式
        this.stopVoice();
        this.setData({
          isModifyPusher: true,
          showPusherDebugInfo: false,
        });
        this.userData.pusher = null;
      } else {
        // 完成修改
        this.createPusher({ isModifyPusher: false });
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
    async chooseVoiceFile() {
      let file;
      try {
        const res = await wx.chooseMessageFile({
          count: 1,
          type: 'file',
          extension: ['flv'],
        });
        file = res.tempFiles[0];
        console.log('chooseMessageFile res', file);
        if (!file?.size) {
          this.showToast('file empty');
          return;
        }
        if (file?.size > 1024 * 1024) {
          this.showToast('file too large');
          return;
        }
      } catch (err) {
        console.error('chooseMessageFile fail', err);
        this.showToast('chooseMessageFile fail');
        return;
      }

      const fileSystem = wx.getFileSystemManager();
      fileSystem.readFile({
        filePath: file.path,
        success: (res) => {
          console.log('readFile success');
          this.userData.voiceDataFromFile = res.data;
          this.setData({ voiceDataFileSize: file.size });
        },
        fail: (err) => {
          console.error('readFile fail', err);
          this.showToast('readFile fail');
        },
      });
    },
    startWriteVoiceData(e) {
      if (!this.userData.writer) {
        // 不能写
        return;
      }
      if (this.userData.loopWriting) {
        // 发送中
        return;
      }
      const quick = parseInt(e?.currentTarget?.dataset?.quick, 10);
      const chunkSize = quick ? 800 : 200;
      const chunkInterval = 60;
      console.log(`[${this.data.innerId}] startWriteVoiceData, chunkSize ${chunkSize}, chunkInterval ${chunkInterval}`);
      this.setData({ voiceState: VoiceStateEnum.sending });
      this.userData.loopWriting = true;
      this.loopWriteVoiceData(this.userData.voiceDataFromFile, 0, chunkSize, chunkInterval);
    },
    loopWriteVoiceData(data, offset, chunkSize, chunkInterval) {
      if (!this.userData.writer) {
        // 不能写
        return;
      }
      if (offset >= data.byteLength) {
        console.log(`[${this.data.innerId}]`, 'loopWriteVoiceData end, stopVoice');
        this.stopVoice();
        return;
      }
      const chunkLen = Math.min(data.byteLength - offset, chunkSize);
      const chunkData = data.slice(offset, offset + chunkLen);
      this.userData.writer.addChunk(chunkData);
      setTimeout(() => {
        this.loopWriteVoiceData(data, offset + chunkLen, chunkSize, chunkInterval);
      }, chunkInterval);
    },
  },
});

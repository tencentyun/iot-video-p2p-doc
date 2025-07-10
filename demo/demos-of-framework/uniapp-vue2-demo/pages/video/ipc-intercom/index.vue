<template>
  <view class="intercom-wrap">
    <iot-p2p-player-with-mjpg
      v-if="playerId"
      class="demo-player"
      mode="RTC"
      :id="playerId"
      :deviceInfo="deviceInfo"
      :xp2pInfo="deviceInfo.xp2pInfo"
      :sceneType="playerOptions.sceneType"
      :streamQuality="playerOptions.streamQuality"
      :streamParams="playerOptions.streamParams"
      :definition="playerOptions.definition"
      :soundMode="playerOptions.soundMode"
      :needCheckStream="playerOptions.needCheckStream"
      :muted="playerOptions.muted"
      :showLog="playerOptions.showLog"
      :acceptPlayerEvents="playerOptions.acceptPlayerEvents"
      :showDebugInfo="playerOptions.showDebugInfo"
      :onlyp2pMap="onlyp2pMap"
      @playstart="onPlayStateEvent"
      @playsuccess="onPlayStateEvent"
      @playstop="onPlayStateEvent"
      @playend="onPlayStateEvent"
    />
    <iot-p2p-intercom
      mode="RTC"
      :id="intercomId"
      compClass="my-intercom"
      :intercomVideoSizeClass="intercomOptions.intercomVideoSizeClass"
      :deviceInfo="deviceInfo"
      :pusherProps="intercomOptions.pusherProps"
      :autoStopIfPageHide="intercomOptions.autoStopIfPageHide"
      :showLog="intercomOptions.showLog"
      :showInnerPusherLog="intercomOptions.showInnerPusherLog"
      @intercomeventchange="onIntercomEventChange"
      @intercomstatechange="onIntercomStateChange"
      @intercomstart="onIntercomProcess"
      @intercomsuccess="onIntercomProcess"
      @intercomstop="onIntercomProcess"
      @intercomerror="onIntercomError"
      @previewchange="onIntercomPreviewChange"
      @previewerror="onIntercomPreviewError"
      @livepushercontextchange="onLivePusherContextChange"
      @systempermissionerror="onIntercomSystemPermissionError"
      @netstatus="onIntercomLivePusherNetStatus"
    />
    <view class="button-group">
      <view style="margin-bottom: 20px">
        <van-button custom-style="width:100%;margin-bottom:10px" type="primary" @click="startIntercomCall"
          >呼叫</van-button
        >

        <van-button custom-style="width:100%" type="danger" @click="stopIntercomCall">挂断</van-button>
      </view>
      <view>
        <van-button custom-style="width:100%;margin-bottom:10px" type="primary" @click="startPreview">预览</van-button>
        <van-button custom-style="width:100%;margin-bottom:10px" type="danger" @click="stopPreview"
          >挂断预览</van-button
        >
      </view>
      <!-- 获取到pusher context才可以操作摄像头相关的逻辑 -->
      <van-collapse v-if="!!livePusherContext" :value="activeNameArr" @change="onChange">
        <van-collapse-item title="pusher设置" name="pusherSetting">
          <view class="pusher-settting-wrap">
            <van-button @click="switchCamera">摄像头切换</van-button>
            <van-button @click="snapshot">截屏</van-button>
            <van-button @click="toggleTorch">手电筒切换</van-button>
            <van-button @click="setMICVolume">设置音量</van-button>
            <van-button @click="setZoom">设置缩放级别</van-button>
            <van-button @click="getMaxZoom">获取最大缩放级别</van-button>
          </view>
        </van-collapse-item>
      </van-collapse>
    </view>
    <van-toast id="van-toast" />
  </view>
</template>

<script>
// https://developers.weixin.qq.com/miniprogram/dev/component/live-pusher.html
import Toast from '@/wxcomponents/vant/toast/toast';
import { mapState } from 'vuex';
import { isDevTools } from '@/utils';
import { getXp2pManager } from '@/pages/video/xp2pManager';
import { intercomBirateMap, INTERCOM_COMMAND_MAP } from '@/constants';
let xp2pManager = null;

export default {
  name: 'IpcIntercom',
  data() {
    return {
      playerId: 'p2pPlayer',
      intercomId: 'p2pInterCom',
      pageId: '[ipc-intercom]',
      intercomRef: null,
      livePusherContext: null,
      p2pMode: 'ipc',
      onlyp2pMap: {
        flv: isDevTools(),
        mjpg: isDevTools(),
      },
      activeNameArr: ['pusherSetting'],
      playerOptions: {
        sceneType: 'live',
        streamQuality: 'high',
        definition: 'standard',
        streamParams: '',
        mode: 'RTC',
        soundMode: 'speaker',
        needCheckStream: true,
        muted: false,
        showLog: false,
        acceptPlayerEvents: null,
        showDebugInfo: false,
      },
      intercomOptions: {
        showLog: false,
        needVideo: true,
        showInnerPusherLog: false,
        autoStopIfPageHide: false,
        pusherInfoCount: 0,
        intercomVideoSizeClass: 'vertical_3_4',
        bufferInfo: { bitrateType: 'high' },
        P2PWaterMark: {
          low: 0,
          high: 0,
        },
        pusherProps: {
          enableCamera: true,
          enableMic: true,
          enableAgc: true,
          enableAns: true,
          mode: 'RTC',
          orientation: 'vertical',
          aspect: '3:4',
          fps: 15,
          minBitrate: 200,
          maxBitrate: 400,
          videoWidth: 480,
          videoHeight: 640,
          localMirror: 'disable',
          removeMirror: false,
          autoPush: true,
          devicePosition: 'front',
          disableCameraIfPageHide: true,
          disableMicIfPageHide: true,
          acceptPusherEvents: {
            statechange: true,
            netstatus: true,
          },
          // 图片流设备配置参数
          mjpg: {
            quality: 50,
            width: 240,
            height: 320,
            fps: 15,
            livePusherSnapshotQuality: "raw"
          },
          ...intercomBirateMap.high,
        },
      },
      status: {
        intercomState: 'Ready2Call',
        intercomVideoSize: '',
        stateList: [],
        eventList: [],
      },
      playerState: {
        isPlaying: false,
        isPlaySuccess: false,
        isPlayError: false,
      },
    };
  },
  methods: {
    onChange(e) {
      this.activeNameArr = e.detail;
    },
    async startIntercomCall() {
      this.log('startIntercomCall this.playerState ->', this.playerState);
      if (!this.playerState.isPlaySuccess) {
        this.log('startIntercomCall err, isPlaySuccess false');
        return Toast.fail('请等待播放后再开始呼叫');
      }

      // 检查实例是否初始化成功
      if (!this.intercomRef) {
        this.error('startIntercomCall but no intercom component');
        return Toast('对讲组件尚未初始化');
      }
      // 开始对讲时默认用高码率

      const { P2PWaterMark, pusherProps } = this.intercomOptions;
      this.intercomOptions = {
        ...this.intercomOptions,
        bufferInfo: 'high',
        pusherProps: {
          ...pusherProps,
          mjpg: {
            width: 160,
            height: 240,
          },
        },
        pusherInfoCount: 0,
      };
      this.log('startIntercomCall intercomOptions ->', this.intercomOptions);
      this.intercomRef.setP2PWaterMark(P2PWaterMark);
      // 下面监听的方法log太多了
      // this.intercomRef.setP2PEventCallback(this.onIntercomP2PEvent.bind(this));
      this.intercomRef.intercomCall({ needRecord: false });
    },
    // 开启预览
    async startPreview() {
      this.log('startPreview');
      this.intercomRef.startPreview();
      const res = this.sendUserCommand('wx_call_start');
      this.log('sendUserCommand wx_call_start', res);
    },
    async sendUserCommand(cmd) {
      const sendRes = await xp2pManager
        .sendCommand(this.deviceInfo.deviceId, `action=user_define&channel=0&cmd=${cmd}`)
        .then(() => 'success')
        .catch(e => console.error(e));
      this.log('sendUserCommand', cmd, sendRes);
      return sendRes;
    },

    // 关闭预览
    async stopPreview() {
      this.log('stopPreview');
      this.intercomRef.stopPreview();
      const res = this.sendUserCommand('wx_call_cancel');
      this.log('sendUserCommand wx_call_cancel', res);
    },
    async stopIntercomCall() {
      const { intercomState } = this.status;
      this.log('stopIntercomCall in state ->', intercomState);
      if (!this.intercomRef) {
        return this.error('stopIntercomCall but no intercom component');
      }
      this.clearIntercomBufferInfo();
      this.intercomRef.intercomHangup();
      this.log('关闭intercom组件完成');
    },

    clearIntercomBufferInfo() {
      this.log('clearIntercomBufferInfo');
      const { intercomBufferInfo } = this.intercomOptions;
      if (!intercomBufferInfo) {
        return;
      }
      const { bitrateType, timer } = intercomBufferInfo;
      this.intercomOptions.intercomBufferInfo = null;
      if (timer) {
        clearTimeout(timer);
      }
      if (bitrateType !== 'high') {
        this.intercomOptions.pusherProps = {
          ...this.intercomOptions.pusherProps,
        };
      }
    },
    onPlayStateEvent({ type }) {
      switch (type) {
        case 'playstart':
          this.playerState.isPlaying = true;
          break;
        case 'playsuccess':
          this.playerState.isPlaySuccess = true;
          break;
        case 'playstop':
        case 'playend':
          Object.keys(this.playerState).forEach(key => {
            this.playerState[key] = false;
          });
          break;
        case 'playerror':
          this.playerState.isPlaying = false;
          this.playerState.isPlaySuccess = false;
          this.playerState.isPlayError = true;
          break;
      }
    },
    onIntercomP2PEvent(eventName, detail) {
      this.log('onIntercomP2PEvent', {
        eventName,
        detail,
      });
    },
    intercomEventChange(e) {
      this.log('onIntercomEventChange', e);
    },
    onIntercomStateChange(e) {
      const {
        detail: { state, stateList },
      } = e;
      this.log('onIntercomStateChange', {
        state,
        stateList,
      });
    },
    onIntercomProcess(e) {
      this.log('onIntercomProcess', e);
    },
    onIntercomError(e) {
      this.log('onIntercomError', e);
      Toast(e?.detail?.errMsg);
    },
    onIntercomPreviewChange(e) {
      this.log('onIntercomPreviewChange', e);
    },
    onLivePusherContextChange(e) {
      this.livePusherContext = e.detail.livePusherContext;
      this.log('onLivePusherContextChange', {
        e,
      });
    },
    onIntercomSystemPermissionError(e) {
      this.log('onIntercomSystemPermissionError', e);
    },
    onIntercomSystemPermissionError(e) {
      this.log('onIntercomPreviewError', e);
    },
    onIntercomLivePusherNetStatus(e) {
      this.log('onIntercomLivePusherNetStatus', e);
    },
    // ============LivePusher原生方法开始
    switchCamera() {
      const that = this;
      this.livePusherContext.switchCamera({
        success(res) {
          that.log('切换摄像头成功', res);
        },
      });
    },
    snapshot() {
      const that = this;
      this.livePusherContext.snapshot({
        success(res) {
          that.log('截屏成功', res);
        },
      });
    },
    toggleTorch() {
      const that = this;
      this.livePusherContext.toggleTorch({
        success(res) {
          that.log('切换闪光灯成功', res);
        },
      });
    },
    setMICVolume() {
      const that = this;
      this.livePusherContext.setMICVolume({
        volume: 0.5,
        success(res) {
          that.log('设置音量成功', res);
        },
      });
    },
    setZoom() {
      const that = this;
      this.livePusherContext.setZoom({
        zoom: '1.1',
        success(res) {
          that.log('设置缩放级别成功', res);
        },
      });
    },
    getMaxZoom() {
      const that = this;
      this.livePusherContext.getMaxZoom({
        success(res) {
          that.log('获取最大缩放级别', res);
        },
      });
    },
    // ============LivePusher原生方法结束
    getComponentRefs() {
      const page = getCurrentPages().pop();
      this.intercomRef = page.selectComponent(`#${this.intercomId}`);
      this.playerRef = page.selectComponent(`#${this.playerId}`);
      this.log('获取player实例 ->', this.playerRef);
      this.log('获取intercom实例 ->', this.intercomRef);
    },
    async startP2PService() {
      const { deviceId } = this.deviceInfo;
      try {
        await xp2pManager.startP2PService({
          p2pMode: this.p2pMode,
          deviceInfo: this.deviceInfo,
          xp2pInfo: this.deviceInfo.xp2pInfo,
          caller: this.pageId,
        });
        xp2pManager.addP2PServiceEventListener(deviceId, 'serviceReceivePrivateCommand', this.feedbackFromDevice);
      } catch (e) {
        this.log('startP2PService error 启动P2P服务失败', e);
      }
    },
    feedbackFromDevice(params) {
      this.log('收到设备端反馈', {
        params,
      });
      const cmd = params.iv_private_cmd;
      if (cmd === 'call_answer') {
        this.startIntercomCall();
      }
    },
  },
  created() {
    // 覆盖清晰度
    if (this.deviceInfo.definition) {
      this.playerOptions.definition = this.deviceInfo.definition;
    }
  },
  mounted() {
    this.log('=========mounted=========');
    xp2pManager = getXp2pManager();
    this.startP2PService();
    this.getComponentRefs();
  },
  beforeDestroy() {
    this.log('=========beforeDestroy=========');
    const { deviceId } = this.deviceInfo;
    if (this.intercomRef && !['IntercomIdle', 'Ready2Call'].includes(this.status.intercomState)) {
      this.stopIntercomCall();
    }
    xp2pManager.stopP2PService(deviceId, this.pageId);
    xp2pManager.removeP2PServiceEventListener(deviceId, 'serviceReceivePrivateCommand', this.feedbackFromDevice);
  },
  computed: {
    ...mapState(['rawDeviceInfo']),
    deviceInfo() {
      return {
        ...this.rawDeviceInfo,
        isMjpgDevice: this.rawDeviceInfo.xp2pInfo?.endsWith?.('m'),
      };
    },
  },
};
</script>
<style lang="scss">
.intercom-wrap {
  width: 100%;
  height: 200px;
  background-color: #000;
  .demo-player {
    width: 100%;
    height: 200px;
  }

  .my-intercom {
    margin: 10px 0;
    background-color: #000;
  }

  .iot-p2p-intercom.my-intercom.vertical_3_4 {
    width: 180rpx;
    height: 240rpx;
  }

  .iot-p2p-intercom.my-intercom.vertical_9_16 {
    width: 180rpx;
    height: 320rpx;
  }

  .iot-p2p-intercom.my-intercom.horizontal_3_4 {
    width: 240rpx;
    height: 180rpx;
  }

  .iot-p2p-intercom.my-intercom.horizontal_9_16 {
    width: 320rpx;
    height: 180rpx;
  }

  .intercom--iot-p2p-intercom.intercom--not-intercoming.intercom--not-preview {
    // width: 225rpx !important;
    // height: 400rpx !important;
  }

  .button-group {
  }
  .pusher-settting-wrap {
    display: flex;
    flex-wrap: wrap;
    button {
      margin-right: 10px;
      margin-bottom: 10px;
    }
  }
}
</style>

<template>
  <view class="content">
    <iot-p2p-player-with-mjpg
      v-if="!!deviceInfo.deviceId"
      :id="playerId"
      class="demo-player"
      :sceneType="playerOptions.sceneType"
      :streamParams="playerOptions.streamParams"
      :mode="p2pMode"
      soundMode="speaker"
      :deviceInfo="deviceInfo"
      :xp2pInfo="deviceInfo.xp2pInfo"
      :needCheckStream="playerOptions.needCheckStream"
      :showLog="playerOptions.showLog"
      :showDebugInfo="playerOptions.showDebugInfo"
      :onlyp2pMap="playerOptions.onlyp2pMap"
      :orientation="conrtolState.orientation"
      :fill="conrtolState.objectFit === 'fillCrop'"
      :streamQuality="conrtolState.definition"
      :muted="conrtolState.muted"
      :acceptPlayerEvents="acceptPlayerEvents"
      :triggerFirstPlayByAutoPlay="false"
      @playsuccess="onPlayStateChange"
    >
      <view slot="flvInner">
        <PlayerControls :conrtolState="conrtolState" @iconClick="iconClick"></PlayerControls>
      </view>
    </iot-p2p-player-with-mjpg>
    <view v-else>等待播放中。。。</view>
    <van-toast id="van-toast" />
  </view>
</template>

<script>
import { mapState } from 'vuex';
import Toast from '@/wxcomponents/vant/toast/toast';
import PlayerControls from '@/pages/video/components/player-controls/index.vue';
import { isDevTools } from '@/utils';
import { recordFlvOptions } from '@/constants';
import { getXp2pManager } from '../xp2pManager';
let xp2pManager = null;
export default {
  name: 'IpcLive',
  components: {
    PlayerControls,
  },
  data() {
    return {
      pageId: '[ipc-live]',
      playerId: 'p2pPlayer',
      playerOptions: {
        showDebugInfo: false,
        showLog: true,
        needCheckStream: false,
        onlyp2pMap: {
          flv: isDevTools(),
          mjpg: isDevTools(),
        },
        sceneType: 'live',
        streamParams: '',
      },
      p2pMode: 'ipc',
      acceptPlayerEvents: null,
      xp2pManager: null,
      playerRef: null,
      controlIcons: [],
      conrtolState: {
        definition: 'standard',
        orientation: 'vertical',
        objectFit: 'contain',
        muted: false,
        fullscreen: false,
        snapshot: false,
        record: false,
      },
      deviceInfo:{}
    };
  },
  methods: {
    stateChangeHandler(detail) {
      this.log('serviceStateChange', detail);
    },
    feedbackFromDeviceHandler(detail) {
      this.log('feedbackFromDevice', detail);
    },
    // 播放器控件相关开始===============================
    iconClick({ type, value }) {
      const fnMap = {
        muted: this.toggleMuted,
        fullscreen: this.toggleFullscreen,
        definition: this.changeDefinition,
        orientation: this.changeOrientation,
        objectFit: this.changeObjectFit,
        snapshot: this.doSnapshot,
        record: this.doRecord,
      };
      fnMap[type](value);
    },
    // 切换静音
    toggleMuted(value) {
      this.log('切换音量', value);
      this.conrtolState.muted = !value;
    },
    // 切换全屏
    async toggleFullscreen(value) {
      try {
        if (!value) {
          await this.playerRef.requestFullScreen({ direction: 90 });
        } else {
          await this.playerRef.exitFullScreen();
        }
        this.conrtolState.fullscreen = !value;
        this.log('切换全屏成功', value);
      } catch (e) {
        Toast('切换全屏失败');
        this.log('切换全屏失败', e);
      }
    },
    // 切换清晰度
    changeDefinition(value) {
      this.conrtolState.definition = value;
    },
    // 切换方向
    changeOrientation(value) {
      this.conrtolState.orientation = value;
    },
    // 切换填充模式
    changeObjectFit(value) {
      this.conrtolState.objectFit = value;
    },
    // 截屏
    async doSnapshot() {
      try {
        await this.playerRef.snapshotAndSave();
      } catch (err) {
        if (err.errType === 'saveAuthError') {
          return Toast('请授权小程序访问相册');
        }
        Toast.fail('截图失败');
      }
    },
    // 录制
    doRecord(value) {
      try {
        if (!value) {
          this.playerRef.startRecordFlv(recordFlvOptions);
        } else {
          this.playerRef.stopRecordFlv();
        }
        this.conrtolState.record = !value;
      } catch (e) {
        this.log('录制失败', e);
        Toast.fail('录制失败');
      }
    },
    // 播放器控件相关结束===============================

    onStartPlayer() {
      this.log('onStartPlayer', this.deviceInfo);
      const { deviceId } = this.deviceInfo;
      const promise = xp2pManager.startP2PService({
        p2pMode: this.p2pMode,
        deviceInfo: this.deviceInfo,
        xp2pInfo: this.deviceInfo.xp2pInfo,
        caller: this.pageId,
      });
      promise.then(res => {
        this.log('startP2PService res', res);
        xp2pManager.addP2PServiceEventListener(deviceId, 'serviceStateChange', this.stateChangeHandler);
        xp2pManager.addP2PServiceEventListener(deviceId, 'feedbackFromDevice', this.feedbackFromDeviceHandler);
      });
    },
    onPlayStateChange({ type, detail } = {}) {
      this.log('onPlayStateChange', type, detail);
    },
    getRefs() {
      const page = getCurrentPages().pop();
      this.playerRef = page.selectComponent(`#${this.playerId}`);
    },
    async asyncGetDeviceInfo() {
      setTimeout(() =>{
        this.deviceInfo = this.rawDeviceInfo;
        this.log('deviceInfo获取完毕',this.deviceInfo)
        return
      },3000)
    }
  },
  async created() {
    // 覆盖清晰度
    // this.conrtolState.definition = this.deviceInfo.definition;
    // this.conrtolState.muted = this.deviceInfo.muted;
    this.log('rawDeviceInfo',this.rawDeviceInfo)
    await this.asyncGetDeviceInfo()
    this.onStartPlayer()
  },
  async mounted() {
    this.log('=========mounted=========');
    xp2pManager = getXp2pManager();
    this.log('获取xp2pManager 结果 ->', xp2pManager);
    this.getRefs();
  },
  beforeDestroy() {
    this.log('=========beforeDestroy=========');
    const { deviceId } = this.deviceInfo;
    xp2pManager.removeP2PServiceEventListener(deviceId, 'serviceStateChange', this.stateChangeHandler);
    xp2pManager.removeP2PServiceEventListener(deviceId, 'feedbackFromDevice', this.feedbackFromDeviceHandler);
    xp2pManager.stopP2PService(deviceId, this.pageId);
  },
  computed: {
    ...mapState(['rawDeviceInfo']),
    // deviceInfo() {
    //   return {
    //     ...this.rawDeviceInfo,
    //     isMjpgDevice: this.rawDeviceInfo.xp2pInfo.endsWith('m'),
    //   };
    // },
  },
};
</script>

<style lang="scss">
.content {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}
</style>

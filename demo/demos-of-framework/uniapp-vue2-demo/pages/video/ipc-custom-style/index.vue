<template>
  <view class="custom-style-wrap">
    <iot-p2p-player-with-mjpg
      v-if="playerId"
      :id="playerId"
      class="player-wrap"
      compClass="custom-style-player"
      compStyle="width: 100%; height: 300px;"
      sceneType="live"
      mode="ipc"
      soundMode="speaker"
      :deviceInfo="deviceInfo"
      :xp2pInfo="deviceInfo.xp2pInfo"
      :showLog="playerOptions.showLog"
      :showDebugInfo="playerOptions.showDebugInfo"
      :triggerFirstPlayByAutoPlay="false"
    >
    </iot-p2p-player-with-mjpg>
    <iot-p2p-intercom
      id="intercomRef"
      class="intercom-wrap"
      compClass="my-intercom"
      compStyle="width: 100% !important; height: 300px !important;"
      :deviceInfo="deviceInfo"
      :xp2pInfo="deviceInfo.xp2pInfo"
      :pusherProps="intercomOptions.pusherProps"
    >
    </iot-p2p-intercom>
    <van-toast id="van-toast" />
  </view>
</template>

<script>
import { mapState } from 'vuex';
import { isDevTools } from '@/utils';
import { intercomBirateMap } from '@/constants';

export default {
  name: 'IpcCustomStyle',
  data() {
    return {
      pageId: '[ipc-custom-style]',
      playerId: 'playerRef',
      playerOptions: {
        showDebugInfo: false,
        showLog: false,
        needCheckStream: false,
        onlyp2pMap: {
          flv: isDevTools(),
          mjpg: isDevTools(),
        },
        sceneType: 'live',
        streamParams: '',
      },
      p2pMode: 'ipc',
      intercomOptions: {
        showLog: false,
        showInnerPusherLog: false,
        autoStopVoiceIfPageHide: true,
        pusherInfoCount: 0,
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
          localMirror: 'auto',
          removeMirror: false,
          autoPush: true,
          devicePosition: 'front',
          disableCameraIfPageHide: true,
          disableMicIfPageHide: true,
          acceptPusherEvents: {
            statechange: true,
            netstatus: true,
          },
          ...intercomBirateMap.high,
        },
      },
      acceptPlayerEvents: null,
      xp2pManager: null,
      playerRef: null,
      intercomRef: null,
    };
  },
  methods: {
    onPlayStateChange({ type, detail } = {}) {
      this.log('onPlayStateChange', type, detail);
    },
    startPreview() {
      this.intercomRef.startPreview();
    },
    getRefs() {
      const page = getCurrentPages().pop();
      this.playerRef = page.selectComponent('#playerRef');
      this.intercomRef = page.selectComponent('#intercomRef');
      this.log('获取ref =>', {
        intercomRef: this.intercomRef,
        playerRef: this.playerRef,
      });
    },
  },
  created() {
    this.log({
      deviceInfo: this.deviceInfo,
    });
  },
  mounted() {
    this.getRefs();
    this.startPreview();
  },
  computed: {
    ...mapState(['rawDeviceInfo']),
    deviceInfo() {
      return {
        ...this.rawDeviceInfo,
        isMjpgDevice: this.rawDeviceInfo.xp2pInfo.endsWith('m'),
      };
    },
  },
};
</script>
<style lang="scss">
.custom-style-wrap {
  display: flex;
  width: 100%;
  flex-wrap: nowrap;
  height: 300px;
  padding: 0 10px;
  .player-wrap {
    margin-right: 10px;
  }
  .intercom-wrap,
  .player-wrap {
    flex: 1;
  }
  .my-intercom {
    background-color: #000;
  }
}
</style>

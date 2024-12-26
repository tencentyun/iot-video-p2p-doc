<template>
  <view>
    <view> IPC Demo </view>
    <view>deviceName: {{ deviceInfo.deviceName }}</view>
    <iot-p2p-player-with-mjpg
      v-if="playerId"
      :id="playerId"
      class="demo-player"
      :deviceInfo="deviceInfo"
      :xp2pInfo="deviceInfo.xp2pInfo"
      :needCheckStream="true"
      sceneType="live"
      streamQuality="high"
      streamParams=""
      mode="RTC"
      soundMode="speaker"
      :muted="false"
      :acceptPlayerEvents="true"
      :showLog="true"
      :showDebugInfo="showDebugInfo"
      :onlyp2pMap="onlyp2pMap"
      @playsuccess="handlePlaySuccess"
    >
    </iot-p2p-player-with-mjpg>
  </view>
</template>

<script lang="ts">
// @ts-ignore
import { getXp2pManager } from './lib/xp2pManager';
import Vue from 'vue';

const xp2pManager = getXp2pManager();

export default Vue.extend({
  data() {
    return {
      deviceInfo: {
        productId: 'XOCLFIHUCU',
        deviceName: 'feedback_eric01',
        deviceId: 'XOCLFIHUCU/camera_eric04',
        xp2pInfo: 'XP2PTmt7R2EZyJUoWyVPYegs9A==%2.4.43',
        isMjpg: false,
      },
      playerId: '',
      showDebugInfo: false,
      onlyp2pMap: {
        flv: true,
        mjpg: true,
      },
    };
  },
  created() {
    console.log('[DEMO] [INF] [onLoad] ipc-demo.vue.', {
      deviceInfo: this.deviceInfo,
      xp2pManager,
    });

    this.playerId = 'iot-p2p-player-with-mjpg';
    // this.setData({
    //   playerId: 'iot-p2p-player-with-mjpg',
    // });

    xp2pManager.addP2PServiceEventListener(
      this.deviceInfo.deviceId,
      'feedbackFromDevice',
      this.handleFeedback.bind(this),
    );
  },
  destroyed() {
    xp2pManager.removeP2PServiceEventListener(
      this.deviceInfo.deviceId,
      'feedbackFromDevice',
      this.handleFeedback.bind(this),
    );
  },
  methods: {
    startP2PService() {},
    handlePlaySuccess({ currentTarget: { dataset }, detail }) {
      console.log('[DEMO] [INF] [demo-ipc] handlePlaySuccess');
    },

    handleFeedback(details) {
      console.log('[DEMO] [INF] [demo-ipc] handleFeedback', details);
    },
  },
});
</script>

<style></style>

<!--
<script setup lang="ts">
import { reactive, ref } from "vue";
import { onLaunch, onLoad } from "@dcloudio/uni-app";
import { isDevTool } from "@/utils";



const deviceInfo = reactive({
  deviceId: "",
  productId: "",
  deviceName: "",
  xp2pInfo: "",
  isMjpg: false,
});

// ========== 监控 ==========
const playerId = ref("");
const showDebugInfo = ref(false);

// 开发者工具不支持 live-player，设置 onlyp2pMap 可以控制只拉数据不实际播放
// 仅调试用，实际项目中带参数直接进页面时不要设置这个参数
const onlyp2pMap = reactive({
  flv: isDevTool,
  mjpg: isDevTool,
});

// ========== 对讲 ==========
const intercomId = ref("");
const intercomState = ref("");

onLoad((e) => {
  const { deviceName, productId, xp2pInfo, isMjpg } = JSON.parse(
    decodeURIComponent(e.deviceInfo)
  );
  deviceInfo.deviceName = deviceName;
  deviceInfo.productId = productId;
  deviceInfo.deviceId = `${productId}/${deviceName}`;
  deviceInfo.xp2pInfo = xp2pInfo;
  deviceInfo.isMjpg = isMjpg;
  console.log("[DEMO] [INF] [onLoad] ipc-demo.vue.", {
    deviceInfo,
    xp2pManager,
  });

  wx.setStorageSync("deviceInfo", JSON.stringify(deviceInfo));

  playerId.value = "iot-p2p-player-with-mjpg";
});

let intercom = null;

const handlePlaySuccess = ({ currentTarget: { dataset }, detail }) => {
  console.log("[DEMO] [INF] [demo-ipc] handlePlaySuccess");

  intercomId.value = "iot-p2p-intercom";

  // 等待组件创建完毕再获取组件实例
  wx.nextTick(() => {
    // setup 模式下没有 this, 需要手动获取 this (即原生小程序的 page 对象)
    const page = getCurrentPages().pop();
    intercom = page?.selectComponent(`#${intercomId.value}`);
    console.log(
      "[DEMO] [INF] [demo-ipc] handlePlaySuccess wx.selectComponent(intercomId.value):",
      intercom
    );
    if (!intercom) {
      if (!intercomState.value) {
        wx.showModal({ title: "DEBUG", content: "对讲组件初始化失败!" });
      } else {
        wx.showModal({
          title: "DEBUG",
          content: "wx.selectComponent error. 对讲组件获取失败!",
        });
      }
    }
  });
};

const handleIntercomstatechange = ({ currentTarget: { dataset }, detail: { state } }) => {
  console.log("[DEMO] [INF] [demo-ipc] handleIntercomstatechange", state);
  intercomState.value = state;
};

const startIntercom = (e) => {
  // 检查实例是否初始化成功
  if (!intercom) {
    console.error("[DEMO] [WRN] startIntercomCall but no intercom component");
    wx.showToast({
      title: "对讲组件尚未初始化",
      icon: "error",
    });
    return;
  }

  intercom.setP2PEventCallback?.(onIntercomP2PEvent);
  intercom.intercomCall({ needRecord: false });
};

const onIntercomP2PEvent = (evtName, detail) => {
  switch (evtName) {
    case "buffer_state_change": {
      /*
          buffer水位状态变化，detail: { state: -1 | 0 | 1; size: number }
          state: 水位状态
            - -1 水位 < low
            - 0 水位 [low, high]
            - 1 水位 > high
          size: 字节数

          一个简单的流控策略：水位维持在high以上（state > 0）几秒钟就降码率，维持high以下（state <= 0）几秒钟再恢复，避免跳来跳去的情况
        */
      console.log("[DEMO] [INF] onIntercomP2PEvent", evtName, detail);
      break;
    }
    case "writable": {
      // buffer水位低于 low 时会持续触发，detail: number，字节数
      break;
    }
    case "unwritable": {
      // buffer水位高于 high 时会持续触发，detail: number，字节数
      break;
    }
  }
};

const stopIntercomCall = () => {
  console.log("[DEMO] [INF] stopIntercomCall in intercomState", intercomState);

  if (!intercom) {
    console.error("[DEMO] [WRN] stopIntercomCall but no intercom component");
    return;
  }
  intercom.intercomHangup();
};
</script>

<template>
  <view> IPC_DEMO </view>
  <view>deviceName: {{ deviceInfo.deviceName }}</view>
  <iot-p2p-player-with-mjpg
    v-if="playerId"
    :id="playerId"
    class="demo-player"
    :deviceInfo="deviceInfo"
    :xp2pInfo="deviceInfo.xp2pInfo"
    :needCheckStream="true"
    sceneType="live"
    streamQuality="high"
    streamParams=""
    mode="RTC"
    soundMode="speaker"
    :muted="false"
    :acceptPlayerEvents="true"
    :showLog="true"
    :showDebugInfo="showDebugInfo"
    :onlyp2pMap="onlyp2pMap"
    @playsuccess="handlePlaySuccess"
  >
  </iot-p2p-player-with-mjpg>

  <iot-p2p-intercom
    v-if="intercomId"
    :id="intercomId"
    class="my-intercom"
    :deviceInfo="deviceInfo"
    :autoStopIfPageHide="true"
    :showLog="true"
    @intercomstatechange="handleIntercomstatechange"
  ></iot-p2p-intercom>

  <view>
    <view>操作按钮, 对讲状态: {{ intercomState }}</view>
    <button v-if="intercomState === 'Ready2Call'" type="primary" @click="startIntercom">
      开始对讲
    </button>
    <button v-if="intercomState === 'Sending'" @click="stopIntercomCall">关闭对讲</button>
  </view>
</template>
<style>
.demo-player {
  width: 100vw;
  height: 300px;
  background: #000;
}
</style>
-->

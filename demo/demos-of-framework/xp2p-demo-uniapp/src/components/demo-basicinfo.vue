<script setup lang="ts">
import { ref, computed } from "vue";
import { getUserId, toDateTimeMsString, compareVersion } from "@/utils";
import { onLaunch, onShow, onHide } from "@dcloudio/uni-app";

defineProps({
  playerVersion: String,
  xp2pVersion: String,
  canToggleTcpFirst: Boolean,
  tcpFirst: Boolean,
  xp2pUuid: String,
  xp2pState: String,
  xp2pStateTime: Number,
  xp2pLocalPeername: String,
  xp2pNatEvent: String,
  xp2pNatEventTime: String,
});

const isCollesped = ref(true); // 默认折叠
const toggleCollesped = () => {
  isCollesped.value = !isCollesped.value;
};

const sysInfo = wx.getSystemInfoSync();
const accountInfo = wx.getAccountInfoSync();
const miniProgramInfo = accountInfo.miniProgram;

const wxVersion = ref(sysInfo.version);
const wxSDKVersion = ref(sysInfo.SDKVersion);
const hostInfo = ref(`${miniProgramInfo.appId}-${miniProgramInfo.envVersion}`);
// const sysInfo = ref(`${sysInfo.platform} / ${sysInfo.system}`);
const userId = ref(getUserId());

const xp2pNatEventTimeStr = computed(() => toDateTimeMsString(xp2pNatEventTime.value));

const restart = () => {
  if (compareVersion(wx.getSystemInfoSync().SDKVersion, "3.0.1") >= 0) {
    wx.restartMiniProgram({
      path: "/pages/index/index",
    });
  } else {
    wx.exitMiniProgram({
      fail: (err) => {
        console.error("exitMiniProgram fail", err);
      },
    });
  }
};

const toggleTcpFirst = () => {
  const app = getApp();
  if (!app.restart) app.restart = restart;
  if (typeof app.toggleTcpFirst !== 'function') {
    return;
  }
  app.toggleTcpFirst();
};
</script>

<template>
  <view class="basic-info-title" @click="toggleCollesped"
    >>>>>>> Demo 基本信息 [{{ isCollesped ? ">>>展开" : "收起<<<" }}]</view
  >
  <view class="page-section page-section-gap" v-if="!isCollesped">
    <view
      >hostInfo: <text user-select>{{ hostInfo }}</text></view
    >
    <view
      >sysInfo: <text user-select>{{ sysInfo }}</text></view
    >
    <view
      >wxVersion:
      <text user-select>wx {{ wxVersion }} / sdk {{ wxSDKVersion }}</text></view
    >
    <view
      >pluginVersion:
      <text user-select
        >p2p-player {{ playerVersion }} / xp2p {{ xp2pVersion }}</text
      ></view
    >
    <view
      >userId: <text user-select>{{ userId }}</text></view
    >
    <view>
      xp2p info
      <view class="margin-left">
        <view v-if="canToggleTcpFirst"
          >tcpFirst: {{ tcpFirst }}
          <text class="text-btn" @click="toggleTcpFirst">切换</text></view
        >
        <view
          >uuid: <text user-select>{{ xp2pUuid }}</text></view
        >
        <view
          >state: {{ xp2pState }}
          <text v-if="xp2pState">@{{ xp2pStateTimeStr }}</text></view
        >
        <view>localPeername: {{ xp2pLocalPeername }}</view>
        <view v-if="xp2pNatEvent" style="color: red"
          >{{ xp2pNatEvent }} @{{ xp2pNatEventTimeStr }}</view
        >
      </view>
    </view>
  </view>
</template>

<style>
@import "../styles/common.scss";

.basic-info-title {
  margin-top: -15px;
  color: blue;
}
</style>

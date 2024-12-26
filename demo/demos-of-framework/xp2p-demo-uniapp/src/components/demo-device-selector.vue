<template>
  <view class="page-section page-section-gap">
    <view class="device-input">
      <label class="input-label">
        <text>ProductId</text>
        <input
          type="text"
          name=""
          :value="deviceInfo.productId"
          @input="handleProductIdChange"
          placeholder="请输入ProductId"
        />
      </label>
      <label class="input-label">
        <text>DeviceName</text>
        <input
          type="text"
          name=""
          :value="deviceInfo.deviceName"
          @input="handleDeviceNameChange"
          placeholder="请输入DeviceName"
        />
      </label>
      <label class="input-label">
        <text>Xp2pInfo</text>
        <input
          type="text"
          name=""
          :value="deviceInfo.xp2pInfo"
          @input="handleXp2pInfoChange"
          placeholder="请输入Xp2pInfo"
        />
      </label>
    </view>

    <button type="primary" @click="gotoIpcPanel()">goto ipc</button>
  </view>
</template>

<script setup lang="ts">
import { reactive } from "vue";
import { onLaunch, onShow, onHide, onLoad } from "@dcloudio/uni-app";

const deviceInfo = reactive({
  productId: "",
  deviceName: "",
  xp2pInfo: "",
  isMjpg: false,
});

onShow((query) => {
  // 从 storage 中读取 deviceInfo
  const deviceInfoStr = wx.getStorageSync("deviceInfo");
  let tmpDeviceInfo = {};
  try {
    tmpDeviceInfo = JSON.parse(deviceInfoStr) || {};
    deviceInfo.productId = tmpDeviceInfo.productId;
    deviceInfo.deviceName = tmpDeviceInfo.deviceName;
    deviceInfo.xp2pInfo = tmpDeviceInfo.xp2pInfo;
    deviceInfo.isMjpg = tmpDeviceInfo.isMjpg;
  } catch (error) {
    console.error("onLoad query: ", error);
  }
});

const handleProductIdChange = (e) => {
  deviceInfo.productId = e.detail.value;
};
const handleDeviceNameChange = (e) => {
  deviceInfo.deviceName = e.detail.value;
};
const handleXp2pInfoChange = (e) => {
  deviceInfo.xp2pInfo = e.detail.value;
};

const gotoIpcPanel = () => {
  console.log("[INF] gotoIpcPanel deviceInfo:", deviceInfo);

  wx.navigateTo({
    url:
      "/pages/video/ipc-demo?deviceInfo=" +
      encodeURIComponent(JSON.stringify(deviceInfo)),
  });
};
</script>

<style>
@import "../styles/common.scss";
</style>

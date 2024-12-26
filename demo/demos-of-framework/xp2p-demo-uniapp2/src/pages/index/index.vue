<template>
  <view class="content">
    <image class="logo" src="../../static/logo.png"></image>
    <view>
      <text class="title">{{ title }}</text>
    </view>
    <view>
      <text class="title" @click="gotoIpc">IPC-Test</text>
    </view>
  </view>
</template>

<script lang="ts">
import Vue from 'vue';
const app = getApp();

export default Vue.extend({
  data() {
    return {
      title: 'Hello',
      hasExited: false,
    };
  },
  created() {
    console.log(`[index] [INF] created`);
    this.initXp2pManager();
  },
  methods: {
    initXp2pManager() {
      const start = Date.now();
      // @ts-ignore // 微信的 require
      __non_webpack_require__
        .async('../video/lib/xp2pManager.js')
        .then(pkg => {
          if (this.hasExited) {
            return;
          }
          console.log(`[index] [INF] preload xp2pManager.js success, delay ${Date.now() - start}ms`, pkg);
          getApp().xp2pManager = pkg.getXp2pManager();
          console.log(`[index] [INF] preload xp2pManager success, delay ${Date.now() - start}ms`, pkg);
          this.onXp2pLoaded();
        })
        .catch(err => {
          if (this.hasExited) {
            return;
          }
          console.error(`[index] [ERR] preload xp2pManager fail, delay ${Date.now() - start}ms`, err);
        });
    },
    onXp2pLoaded() {
      const { xp2pManager } = app;
      console.log(`[index] [INF] onXp2pLoaded, uuid ${xp2pManager?.uuid}, xp2pState ${xp2pManager?.moduleState}`);
    },

    gotoIpc() {
      uni.navigateTo({
        url: '/pages/video/ipc-demo',
      })
    },
  },
});
</script>

<style>
.content {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.logo {
  height: 200rpx;
  width: 200rpx;
  margin: 200rpx auto 50rpx auto;
}

.text-area {
  display: flex;
  justify-content: center;
}

.title {
  font-size: 36rpx;
  color: #8f8f94;
}
</style>

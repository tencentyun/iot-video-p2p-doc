<template>
  <view class="page-body">
    <demo-privacy />
    <demo-basicinfo
      :playerVersion="playerVersion"
      :xp2pVersion="xp2pVersion"
      :canToggleTcpFirst="canToggleTcpFirst"
      :tcpFirst="tcpFirst"
      :xp2pUuid="xp2pUUID"
      :xp2pState="xp2pState"
      :xp2pStateTime="xp2pStateTime"
      :xp2pLocalPeername="xp2pLocalPeername"
      :xp2pNatEvent="xp2pNatEvent"
      :xp2pNatEventTime="xp2pNatEventTime"
    />
    <demo-device-selector />
  </view>
</template>

<script setup lang="ts">
import { ref, reactive } from "vue";
import { onLaunch, onShow, onHide, onLoad } from "@dcloudio/uni-app";

const title = ref("Hello");
const app = getApp();

const hasExited = false;

const userData: any = {};

const XP2PManagerEvent = {
  XP2P_STATE_CHANGE: "xp2pStateChange",
  XP2P_NAT_EVENT: "xp2pNatEvent",
};

// xp2p info
const tcpFirst = ref(false);
const canToggleTcpFirst = ref(false);
const playerVersion = ref("");
const xp2pVersion = ref("");
const xp2pUUID = ref("");
const xp2pState = ref("");
const xp2pStateTime = ref(0);
const xp2pLocalPeername = ref("");


const start = new Date();

onShow((query) => {
  require
    .async("../video/lib/xp2pManager.js")
    .then((pkg) => {
      if (hasExited) {
        return;
      }
      console.log(
        `[index] [INF] preload xp2pManager.js success, delay ${Date.now() - start}ms`,
        pkg
      );
      app.xp2pManager = pkg.getXp2pManager();
      userData.xp2pManager = app.xp2pManager;
      if (app.toggleTcpFirst) {
        tcpFirst.value = app.tcpFirst;
        canToggleTcpFirst.value = true;
      }
      console.log(
        `[index] [INF] preload xp2pManager success, delay ${Date.now() - start}ms`,
        pkg
      );
      onXp2pLoaded();
    })
    .catch((err) => {
      if (hasExited) {
        return;
      }
      console.error(
        `[index] [ERR] preload xp2pManager fail, delay ${Date.now() - start}ms`,
        err
      );
    });
});

const onXp2pLoaded = () => {
  const { xp2pManager } = userData;
  console.log(
    `[index] [INF] onXp2pLoaded, uuid ${xp2pManager?.uuid}, xp2pState ${xp2pManager?.moduleState}`
  );
  xp2pManager.addEventListener(XP2PManagerEvent.XP2P_STATE_CHANGE, onXp2pStateChange);
  xp2pManager.addEventListener(XP2PManagerEvent.XP2P_NAT_EVENT, onXp2pNatEvent);

  playerVersion.value = xp2pManager.P2PPlayerVersion;
  xp2pVersion.value = xp2pManager.XP2PVersion;
  xp2pUUID.value = xp2pManager.uuid;
  xp2pState.value = xp2pManager.moduleState;
  xp2pStateTime.value = Date.now();
};

const onXp2pStateChange = ({ state }) => {
  console.log("[index] [INF] onXp2pStateChange", state);
  xp2pState.value = state;
  xp2pStateTime.value = Date.now();
  xp2pLocalPeername.value = userData.xp2pManager.localPeername;

  if (state === "initing" || state === "reseting") {
    xp2pNatEvent.value = "";
    xp2pNatEventTime.value = 0;
  }
};
const onXp2pNatEvent = ({ type, detail }) => {
  console.log("[index] [INF] onXp2pNatEvent", type, detail);
  xp2pNatEvent.value = type;
  xp2pNatEventTime.value = Date.now();
};
</script>

<style></style>

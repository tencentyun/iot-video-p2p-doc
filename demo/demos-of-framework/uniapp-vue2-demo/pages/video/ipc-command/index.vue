<template>
  <view class="command-wrap">
    <iot-p2p-player-with-mjpg
      v-if="playerId"
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
      :fill="conrtolState.objectFit === 'contain'"
      :streamQuality="conrtolState.definition"
      :muted="conrtolState.muted"
      :acceptPlayerEvents="acceptPlayerEvents"
      :triggerFirstPlayByAutoPlay="false"
      @playsuccess="onPlayStateChange"
    >
      <view slot="flvInner"> </view>
    </iot-p2p-player-with-mjpg>
    <van-tabs :active="activeTab" @change="onTabChange">
      <van-tab title="字符串格式" name="str">
        <van-cell-group>
          <van-field
            border
            :value="commandStr"
            @change="handleChange"
            label="信令"
            type="textarea"
            placeholder="请输入"
            autosize
          />
        </van-cell-group>
      </van-tab>
      <van-tab title="字段格式" name="field">
        <van-field data-name="action" label="action" :value="commandForm.action" @input="onInput" clearable />
        <van-field data-name="channel" label="channel" :value="commandForm.channel" @input="onInput" clearable />
        <van-field data-name="cmd" label="cmd" :value="commandForm.cmd" @input="onInput" clearable />
        <van-field data-name="type" label="type" :value="commandForm.type" @input="onInput" clearable />
        <van-field
          data-name="extraParams"
          placeholder="JSON格式"
          label="extraParams"
          type="textarea"
          clearable
          autosize
          :value="commandForm.extraParams"
          @input="onInput"
        />
      </van-tab>
    </van-tabs>
    <van-button size="small" type="primary" @click="sencCommand" custom-style="width: 100%; margin: 10px 0"
      >发送</van-button
    >
    <view class="command-result">
      <view v-if="commandReult.data" class="command-result-success">
        <view>发送成功，结果json为</view>
        <view class="json-text">{{ JSON.stringify(commandReult.data, null, 2) }}</view>
      </view>
      <view v-if="commandReult.error" class="command-result-error">
        <view>发送失败，失败原因是</view>
        <view class="json-text">{{ JSON.stringify(commandReult.error, null, 2) }}</view>
      </view>
    </view>

    <van-toast id="van-toast" />
  </view>
</template>

<script>
import { mapState } from 'vuex';
import Toast from '@/wxcomponents/vant/toast/toast';
import { revertObjToStr } from '@/utils/command';
import { isDevTools } from '@/utils';
import { getXp2pManager } from '../xp2pManager';
let xp2pManager = null;
export default {
  name: 'IpcCommand',
  data() {
    return {
      pageId: '[ipc-command]',
      playerId: 'p2pPlayer',
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
      acceptPlayerEvents: null,
      xp2pManager: null,
      playerRef: null,
      activeTab: 'str',
      commandStr: 'action=inner_define&channel=0&cmd=get_device_st&type=voice',
      commandForm: {
        action: 'inner_define',
        channel: '0',
        cmd: 'get_device_st',
        type: 'voice',
        extraParams: '',
      },
      commandReult: {
        data: '',
        error: '',
      },
    };
  },
  methods: {
    handleChange(e) {
      this.commandStr = e.detail;
    },
    onInput(e) {
      const { detail, target } = e;
      this.commandForm[target.dataset.name] = detail;
    },
    onTabChange(e) {
      this.activeTab = e.detail.name;
    },
    stateChangeHandler(detail) {
      this.log('serviceStateChange', detail);
    },
    feedbackFromDeviceHandler(detail) {
      this.log('feedbackFromDevice', detail);
    },
    async sencCommand() {
      if (this.activeTab === 'field') {
        this.commandStr = revertObjToStr(this.commandForm);
      }
      if (!this.commandStr) {
        return Toast.fail('信令为空！');
      }
      console.log({
        commandStr: this.commandStr,
        commandForm: this.commandForm,
        activeTab: this.activeTab,
      });
      try {
        const res = await xp2pManager.sendCommand(this.deviceInfo.deviceId, this.commandStr, {
          responseType: 'text',
        });
        Toast.success('已发送');
        this.log('已发送', res);
        if (res.errcode === 0) {
          this.onReceiveOk(res.data);
        } else {
          this.onReviewNotOk(res.data);
        }
      } catch (e) {
        Toast.fail('发送失败');
        this.onReviewNotOk(e);
      }
    },
    onReceiveOk(data) {
      this.commandReult.error = '';
      this.commandReult.data = data;
      this.log('发送信令成功', data);
    },
    onReviewNotOk(error) {
      this.commandReult.data = '';
      this.commandReult.error = error;
      this.log('发送信令失败', error);
    },
    async onStartPlayer() {
      const { xp2pInfo, deviceId } = this.deviceInfo;
      this.log('onStartPlayer', this.deviceInfo);
      const startParams = {
        p2pMode: this.p2pMode,
        deviceInfo: this.deviceInfo,
        xp2pInfo: xp2pInfo,
        caller: this.pageId,
      };
      try {
        const res = await xp2pManager.startP2PService(startParams);
        this.log('startP2PService res', res);
        xp2pManager.addP2PServiceEventListener(deviceId, 'serviceStateChange', this.stateChangeHandler);
        xp2pManager.addP2PServiceEventListener(deviceId, 'feedbackFromDevice', this.feedbackFromDeviceHandler);
      } catch (e) {
        this.log('startP2PService error', e);
      }
    },
    onPlayStateChange({ type, detail } = {}) {
      this.log('onPlayStateChange', type, detail);
    },
    getRefs() {
      const page = getCurrentPages().pop();
      this.playerRef = page.selectComponent(`#${this.playerId}`);
    },
  },
  async mounted() {
    xp2pManager = getXp2pManager();
    this.log('获取xp2pManager 结果 ->', xp2pManager);
    this.onStartPlayer();
  },
  beforeDestroy() {
    const { deviceId } = this.deviceInfo;
    xp2pManager.removeP2PServiceEventListener(deviceId, 'serviceStateChange', this.stateChangeHandler);
    xp2pManager.removeP2PServiceEventListener(deviceId, 'feedbackFromDevice', this.feedbackFromDeviceHandler);
    xp2pManager.stopP2PService(deviceId, this.pageId);
  },
  computed: {
    ...mapState(['rawDeviceInfo']),
    deviceInfo() {
      this.log('rawDeviceInfo', this.rawDeviceInfo);
      return {
        ...this.rawDeviceInfo,
        isMjpgDevice: this.rawDeviceInfo.xp2pInfo.endsWith('m'),
      };
    },
  },
};
</script>

<style lang="scss">
.command-wrap {
  width: 100%;
  height: 100vh;
  overflow: hidden;
}
.command-result {
  width: 100%;
  padding: 0 20px;
  &-success {
    color: #58be6a;
  }
  &-error {
    color: #da3231;
  }
  .json-text {
    padding: 20px;
    background-color: #f8f8f8;
    border: 1rpx solid #eee;
    border-radius: 8rpx;
    font-family: monospace; /* 使用等宽字体，使JSON结构更清晰 */
    white-space: prewrap; /* 保留换行和空格 */
    overflow-x: auto;
  }
}
</style>

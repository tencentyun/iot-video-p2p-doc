<template>
  <view class="video-controls-wrap">
    <view class="video-controls">
      <view class="video-controls-left">CH-0</view>
      <view class="video-controls-right">
        <view class="video-controls-item definition" @click="showAcionSheet('definition')"
          >{{ DEFINEITION_MAP[conrtolState.definition] }}
        </view>
        <view class="video-controls-item muted" @click="onIconClick('muted')">
          <image class="control-icon" :src="conrtolState.muted ? iconVolumeOff : iconVolumeUp" />
        </view>
        <view class="video-controls-item orientation" @click="showAcionSheet('orientation')">画面方向</view>
        <view class="video-controls-item object-fit" @click="showAcionSheet('objectFit')">填充方式</view>
        <view class="video-controls-item fullscreen" @click="onIconClick('fullscreen')">
          <image class="control-icon" :src="conrtolState.fullscreen ? iconBack : iconMaxWindow"></image>
        </view>
        <view class="video-controls-item snapshot" @click="onIconClick('snapshot')">
          <image class="control-icon" :src="iconCamera"></image>
        </view>
        <view
          class="video-controls-item record"
          :class="{ isRecording: conrtolState.record }"
          @click="onIconClick('record')"
          >录制</view
        >
      </view>
    </view>
    <van-action-sheet
      data-name="definition"
      :show="definitionShow"
      :actions="definitionOptions"
      @select="onActionSheetSelect"
    />
    <van-action-sheet
      data-name="orientation"
      :show="orientationShow"
      :actions="orientationOptions"
      @select="onActionSheetSelect"
    />
    <van-action-sheet
      data-name="objectFit"
      :show="objectFitShow"
      :actions="objectFitOptions"
      @select="onActionSheetSelect"
    />
  </view>
</template>
<script>
import { DEFINEITION_MAP, orientationOptions, objectFitOptions, definitionOptions } from '@/constants';
import { iconBack, iconCamera, iconMaxWindow, iconVolumeOff, iconVolumeUp } from '@/pages/video/assets';
export default {
  name: 'PlayerControls',
  props: {
    conrtolState: {
      type: Object,
    },
  },
  data() {
    return {
      DEFINEITION_MAP,
      definitionShow: false,
      orientationShow: false,
      objectFitShow: false,
      definitionOptions,
      orientationOptions,
      objectFitOptions,
      iconBack,
      iconCamera,
      iconMaxWindow,
      iconVolumeOff,
      iconVolumeUp,
    };
  },
  methods: {
    onIconClick(type) {
      this.$emit('iconClick', { type, value: this.conrtolState[type] });
    },
    onActionSheetSelect(e) {
      const {
        value,
        dataset: { name },
      } = e.target;
      console.log('onSelect ->', {
        name,
        value,
      });
      this.$emit('iconClick', { type: name, value });
      this[`${name}Show`] = false;
    },
    showAcionSheet(type) {
      console.log('showAcionSheet ->', `this.${type}Show`);
      this[`${type}Show`] = true;
    },
  },
  mounted() {
    console.log(this.definitionOptions);
  },
};
</script>
<style lang="scss">
.video-controls-wrap {
  position: absolute;
  left: 0;
  bottom: 0;
  width: 100%;
  height: 48px;
  background-color: rgba(0, 0, 0, 0.3);
  color: #fff;
  z-index: 9999;
  .video-controls {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0 12px;
    height: 100%;
    .video-controls-left {
      display: flex;
      align-items: center;
      margin-right: 16px;
    }
    .video-controls-right {
      display: flex;
      align-items: center;
      .video-controls-item {
        margin-right: 6px;
        line-height: 20px;
        .control-icon {
          width: 20px;
          height: 20px;
          vertical-align: middle;
        }
        &.isRecording {
          color: red;
        }
      }
    }
  }
}
</style>

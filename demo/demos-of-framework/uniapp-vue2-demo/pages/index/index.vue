<template>
  <view class="home-wrap">
    <van-notice-bar
      wrapable
      :scrollable="false"
      text="本页面的示例为uniapp vue2的版本，如要体验，请填写下方设备信息与播放器配置的表单，保存后在开发者工具上点击预览，通过手机进行调试"
    />
    <view class="config-form-wrap">
      <view class="config-form">
        <van-cell-group title="设备信息">
          <view class="button-group" style="padding-top: 10px">
            <van-button plain type="info" size="small" @click="onCopy">从剪贴板导入</van-button>
          </view>
          <van-field data-name="productId" label="产品ID" :value="form.productId" @input="onInput" clearable />
          <van-field data-name="deviceName" label="设备名称" :value="form.deviceName" @input="onInput" clearable />
          <van-field data-name="xp2pInfo" label="xp2pInfo" :value="form.xp2pInfo" @input="onInput" clearable />
        </van-cell-group>
        <van-cell-group title="播放器与twecall配置">
          <van-field data-name="appId" label="appId" :value="form.appId" @input="onInput" clearable />
          <van-field data-name="modelId" label="modelId" :value="form.modelId" @input="onInput" clearable />
          <van-cell title="清晰度" title-width="100px">
            <van-radio-group data-name="definition" :value="form.definition" @change="onInput" direction="horizontal">
              <van-radio v-for="item of definitionOptions" :key="item.value" :name="item.value">{{
                item.label
              }}</van-radio>
            </van-radio-group>
          </van-cell>
          <!-- <van-cell title="对讲方式" title-width="100px">
            <van-radio-group
              data-name="intercomMode"
              :value="form.intercomMode"
              @change="onInput"
              direction="horizontal"
            >
              <van-radio v-for="item of intercomModeOptions" :key="item.value" :name="item.value">
                {{ item.label }}
              </van-radio>
            </van-radio-group>
          </van-cell> -->
          <van-cell title="静音播放" title-width="100px">
            <van-checkbox :value="form.muted" data-name="muted" @change="onInput"></van-checkbox>
          </van-cell>
          <van-cell title="左滑出现浮窗" title-width="100px">
            <van-checkbox
              :value="form.swipeLeftMinWindow"
              data-name="swipeLeftMinWindow"
              @change="onInput"
            ></van-checkbox>
          </van-cell>
        </van-cell-group>
        <van-button custom-style="width: 100%; margin:12px 0" type="primary" @click="onSubmit">保存</van-button>
      </view>
    </view>
    <van-grid clickable column-num="2">
      <!-- 跳转video页面 -->
      <van-grid-item
        v-for="item of videoPageList"
        :key="item.url"
        icon="play"
        :url="item.url"
        :text="item.text"
        @click="onNavigate(item.url)"
      />
    </van-grid>
    <van-toast id="van-toast" />
  </view>
</template>

<script>
import Toast from '@/wxcomponents/vant/toast/toast';
import { DEFAULT_DEVICE_INFO, definitionOptions, intercomModeOptions } from '@/constants';
import { mapState } from 'vuex';
export default {
  data() {
    return {
      pageId: '[Home]',
      definitionOptions,
      intercomModeOptions,
      form: {
        productId: DEFAULT_DEVICE_INFO.productId,
        deviceName: DEFAULT_DEVICE_INFO.deviceName,
        xp2pInfo: DEFAULT_DEVICE_INFO.xp2pInfo,
        appId: 'wx9e8fbc98ceac2628',
        modelId: 'DYEbVE9kfjAONqnWsOhXgw',
        definition: 'standard',
        intercomMode: 'voice',
        muted: false,
        swipeLeftMinWindow: false,
      },
      videoPageList: [
        { text: 'P2P监控', url: '/pages/video/ipc-live/index' },
        { text: 'P2P回放和下载', url: '/pages/video/ipc-replay/index' },
        { text: 'P2P语音&视频对讲', url: '/pages/video/ipc-intercom/index' },
        { text: '自定义信令', url: '/pages/video/ipc-command/index' },
        { text: 'TWECALL', url: '/pages/video/ipc-twecall/index' },
        { text: '自定义样式', url: '/pages/video/ipc-custom-style/index' },
      ],
    };
  },
  methods: {
    onInput(e) {
      const { detail, target } = e;
      this.form[target.dataset.name] = detail;
    },
    onSubmit() {
      const { productId, deviceName } = this.form;
      const params = {
        ...this.form,
        deviceId: `${productId}/${deviceName}`,
      };
      this.log('params', params);
      this.$store.commit('setDefaultDeviceInfo', params);
      Toast.success('保存成功');
    },
    onCopy() {
      const that = this;
      uni.getClipboardData({
        success: res => {
          const splited = res.data.split('\n');
          if (splited.length !== 3) {
            return Toast('数据格式错误，请检查');
          }
          const [productId, deviceName, xp2pInfo] = splited;
          that.form = {
            ...that.form,
            productId,
            deviceName,
            xp2pInfo,
          };
          that.onSubmit();
        },
        fail: err => {
          this.error('读取剪贴板数据失败:', err);
        },
      });
    },
    onNavigate(url) {
      this.log('======onNavigate=======', url);
      wx[this.form.swipeLeftMinWindow ? 'redirectTo' : 'navigateTo']({
        url,
      });
    },
  },
  onLoad() {
    this.log('======onLoad=======');
  },
  created() {
    Object.keys(this.form).forEach(key => {
      if (this.rawDeviceInfo[key]) {
        this.form[key] = this.rawDeviceInfo[key];
      }
    });
  },
  computed: {
    ...mapState(['rawDeviceInfo']),
  },
};
</script>

<style lang="scss">
.home-wrap {
  display: flex;
  flex-direction: column;
  padding: 12px 0;
  .title {
    font-size: 30px;
    font-weight: bold;
    text-align: left;
  }
  .config-form-wrap {
    padding-top: 12px;

    .button-group {
      margin: 12px 0;
    }
  }
}
</style>

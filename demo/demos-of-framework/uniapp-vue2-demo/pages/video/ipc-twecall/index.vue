<template>
  <view class="twecall-wrap">
    <van-cell-group title="1、输入设备信息">
      <van-field :value="sn" placeholder="请输入" data-name="deviceId" @input="onInput" />
    </van-cell-group>
    <van-cell-group title="2、拉取snTicket和OpenId">
      <van-button type="primary" @click="getSnTiketAndOpenId">拉取</van-button>
    </van-cell-group>
    <van-cell-group title="3、授权设备">
      <van-button type="primary" @click="requestUserAuth">授权</van-button>
    </van-cell-group>
    <van-cell-group title="4、参数信息">
      <van-field
        label="snTicket"
        right-icon="search"
        :value="voipOptions.snTicket"
        @clickIcon="handleCopy('snTicket')"
      />
      <van-field label="openId" right-icon="search" :value="voipOptions.openId" @clickIcon="handleCopy('openId')" />
    </van-cell-group>
    <view class="btn-group">
      <van-button type="primary" @click="requestDeviceAuth">查询授权状态</van-button>
      <van-button type="primary" @click="navigateEndPage">去通话结束页</van-button>
    </view>
    <van-toast id="van-toast" />
    <!-- <twecall-frame /> -->
  </view>
</template>

<script>
import Toast from '@/wxcomponents/vant/toast/toast';
import wmpfVoip from '@/utils/voip';

// https://developers.weixin.qq.com/miniprogram/dev/framework/device/device-voip.html
// voip只能去手机里测试 不能在电脑上测试
export default {
  name: 'IpcTWecall',
  components: {},
  data() {
    return {
      pageId: '[ipc-twecall]',
      sn: 'XOCLFIHUCU_eric06',
      voipOptions: {
        wxappid: 'wx9e8fbc98ceac2628',
        modelId: 'DYEbVE9kfjAONqnWsOhXgw',
        deviceVoipList: [],
        snTicket: '',
        openId: '',
      },
    };
  },
  methods: {
    onInput(e) {
      this.sn = e.detail;
    },
    handleCopy(type) {
      const copyData = type === 'snTicket' ? this.voipOptions.snTicket : this.voipOptions.openId;
      wx.setClipboardData({ data: copyData });
    },
    answer() {
      wmpfVoip.initByCaller({ miniprogramState: 'developer' });
    },
    async getSnTiketAndOpenId() {
      try {
        const res = await wx.cloud.callFunction({
          name: 'getSnTicket',
          data: {
            sn: this.sn,
          },
        });
        const { snTicket, OPENID: openId, errCode } = res.result;
        if (errCode === 0) {
          Toast('拉取成功');
        }
        this.voipOptions = {
          ...this.voipOptions,
          snTicket,
          openId,
        };
        this.log('res', res);
      } catch (e) {
        this.log('云函数执行出错', e);
      }
    },
    async requestUserAuth() {
      const { modelId, snTicket } = this.voipOptions;
      const that = this;
      wx.requestDeviceVoIP({
        sn: this.sn, // 向用户发起通话的设备 sn（需要与设备注册时一致）
        snTicket, // 获取的 snTicket
        modelId,
        deviceName: '测试设备', // 设备名称，用于授权时显示给用户
        success(res) {
          Toast.success('授权成功');
          that.log(`requestDeviceVoIP success:`, res);
        },
        fail(err) {
          Toast.fail('授权失败');
          that.log(`requestDeviceVoIP fail:`, err);
        },
      });
    },
    async requestDeviceAuth() {
      const { modelId, openId } = this.voipOptions;
      const params = {
        sn: this.sn,
        model_id: modelId,
        openid_list: [openId],
      };
      const res = await wmpfVoip.getIotBindContactList(params);
      const { contact_list: contactList } = res;
      const isAuth = contactList.every(item => item.status === 1);
      Toast(isAuth ? '已授权' : '未授权');
    },
    navigateEndPage() {
      uni.navigateTo({
        url: '/pages/video/twecall-end/index?sn=x&ticket=y',
      });
    },
  },
  created() {
    // 云函数初始化
    wx.cloud.init({
      env: 'cloud1-9gy10gzb2687fd99',
    });
  },
};
</script>
<style lang="scss">
.twecall-wrap {
  height: 100vh;
  background-color: #f7f8fa;
}
.padding-cell {
  padding-right: 20px;
}
.btn-group {
  padding-top: 20px;
  .van-button {
    margin-right: 20px;
  }
}
</style>

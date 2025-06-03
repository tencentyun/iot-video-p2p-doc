<template>
  <view>
    这是通话结束的页面
    <view>参数为：{{ JSON.stringify(params, null, 2) }}</view>
  </view>
</template>
<script>
export default {
  name: 'twecallEnd',
  data() {
    return {
      pageId: '[twecall-end]',
      params: {},
    };
  },
  mounted() {},
  onLoad(options) {
    this.params = options;
    this.log('传递的参数为options', options);
  },
};
</script>

<style></style>

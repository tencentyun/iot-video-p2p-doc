<template>
  <view>async subpackage page222 </view>
</template>
<script>
import { DEFAULT_DEVICE_INFO } from '@/constants';

export default {
  name: 'AsyncSubpackagePage',
  data() {
    return {
      name: 'async subpackage page',
      deviceInfo: {
        ...DEFAULT_DEVICE_INFO,
      },
    };
  },
  methods: {
    getName() {
      return this.name;
    },
  },
  async mounted() {
    console.log('async subpackage page mounted');
  },
};
</script>
<style></style>

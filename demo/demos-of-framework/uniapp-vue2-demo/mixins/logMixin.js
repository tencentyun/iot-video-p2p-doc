import { isDevTools } from '@/utils';
function getMethods() {
  const methodMap = {};
  for (const key in console) {
    const oldFn = console[key];
    methodMap[key] = function (...args) {
      // 微信开发者工具打印加粗
      if (isDevTools) {
        oldFn.call(console, `%c${this.pageId}`, `color:#00ab84; font-weight:bold; font-size:18px;`, ...args);
      } else {
        oldFn.call(console, `${this.pageId}`, ...args);
      }
    };
  }
  return methodMap;
}

export default {
  methods: {
    ...getMethods(),
  },
};

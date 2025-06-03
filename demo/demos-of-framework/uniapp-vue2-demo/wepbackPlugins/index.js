const APP_JSON_FILE_NAME = 'app.js';
const CODE_FLAG = '// init twecall code.';
const JOIN_FILE_CONTEXT = `
${CODE_FLAG}
wx.nextTick(() => {
  require.async('./pages/features/twecall.js').then(voip => {
    console.log('[TWeCall] [App] voip inited succeed.', voip);
  }).catch(e => {
    console.error('[TWeCall] [App] voip inited failed.', e);
  })
})\n
`;

class TWeCallInjectPlugin {
  apply(compiler) {
    compiler.hooks.emit.tap('TWeCallInject', (compilation) => {
      let app = compilation.assets[APP_JSON_FILE_NAME];
      if (!app) {
        console.warn(`注入 TWeCall 异步化分包加载代码失败: compilation.assets 中 ${APP_JSON_FILE_NAME} 不存在`);
        return;
      } else {
        let source = app.source();
        if (source.indexOf(CODE_FLAG) === -1) source = JOIN_FILE_CONTEXT + source;
        compilation.assets[APP_JSON_FILE_NAME] = {
          size: () => source.length,
          source: () => source,
        };
      }
    });
  }
}

module.exports = {
  TWeCallInjectPlugin,
};

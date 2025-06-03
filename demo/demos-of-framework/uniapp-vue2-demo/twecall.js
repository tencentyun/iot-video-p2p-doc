// NOTE 分包异步化引入插件，使用 webpack copy 到项目中
const voip = requirePlugin('wmpf-voip').default;
console.log('异步引入twecall插件成功', voip);
exports.getVoipManager = () => {
  return voip
}
module.exports = voip
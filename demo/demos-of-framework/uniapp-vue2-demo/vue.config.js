const path = require('path')
const CopyWebpackPlugin = require('copy-webpack-plugin') //最新版本copy-webpack-plugin插件暂不兼容，推荐v5.0.0
const { TWeCallInjectPlugin } = require("./wepbackPlugins/index")

const getPatterns = () => {
  return ['exportForXp2pPlugin.js', 'exportForPlayerPlugin.js', 'twecall.js'].map(file => {
    const toDir = path.join(__dirname, 'unpackage/dist', process.env.NODE_ENV === 'production' ? 'build' : 'dev', process.env.UNI_PLATFORM)
    return {
      from: path.join(__dirname, file),
      to: path.join(toDir, file === 'twecall.js' ? `pages/features/${file}` : `pages/video/${file}`)
    }
  })
}

module.exports = {
  configureWebpack: {
    plugins: [
      new CopyWebpackPlugin(getPatterns()),
      new TWeCallInjectPlugin()

    ],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./")
      }
    }
  }
}
import { isDevTool } from '../../utils';
import { getRecordManager, getSaveFormat } from '../../lib/recordManager';

const app = getApp();

const isFLV = filename => /\.flv$/i.test(filename);
const isMP4 = filename => /\.mp4$/i.test(filename);
const isMJPG = filename => /\.mjpg$/i.test(filename);
const isJPG = filename => /\.jpg$/i.test(filename) || /\.jpeg$/i.test(filename);
const isLOG = filename => /\.log$/i.test(filename);
const processFileItem = (item) => {
  if (item) {
    item.isMP4 = isMP4(item.fileName);
    item.isFLV = isFLV(item.fileName);
    item.isMJPG = isMJPG(item.fileName);
    item.isJPG = isJPG(item.fileName);
    item.isLOG = isLOG(item.fileName);
    item.showSave = !!getSaveFormat(item.fileName);
  }
  return item;
};

Page({
  data: {
    baseDir: '',
    isVideoDir: false,
    isRefreshing: false,
    recordList: null,
    totalBytes: NaN,
    // 真机显示发送，开发者工具可以直接保存到磁盘
    showSendFile: !isDevTool,
    showSaveFile: isDevTool,
  },
  onLoad(query) {
    console.log('user-files: onLoad', query);
    if (!query?.name) {
      return;
    }
    this.recordManager = getRecordManager(query.name);
    this.setData({
      baseDir: this.recordManager.baseDir,
      isVideoDir: ['records', 'voices', 'downloads'].includes(query.name),
    });
    this.getRecordList();
  },
  async getRecordList() {
    if (this.data.isRefreshing) {
      return;
    }
    this.setData({ isRefreshing: true });

    const files = this.recordManager.getFileList();
    const recordList = files.map(fileName => processFileItem({
      fileName,
      size: NaN,
    }));
    this.setData({
      recordList,
      totalBytes: files.length > 0 ? NaN : 0,
    });

    if (files.length > 0) {
      const pArr = files.map(fileName => this.recordManager.getFileInfo(fileName));
      try {
        const infos = await Promise.all(pArr);
        const total = infos.reduce((prev, { size }) => (prev + size), 0);
        this.setData({
          recordList: infos.map((info, i) => ({ ...recordList[i], ...info })),
          totalBytes: total,
        });
      } catch (err) {}
    }

    this.setData({ isRefreshing: false });
  },
  async removeAllRecords() {
    if (this.data.isRefreshing) {
      return;
    }

    let needExit;
    if (this.recordManager.name === 'logs') {
      // logs 特殊逻辑
      const modalRes = await wx.showModal({
        title: '确定删除log吗？',
        content: '删除log后会重新进入小程序',
      });
      if (!modalRes || !modalRes.confirm) {
        return;
      }
      needExit = true;
    }

    this.recordManager.removeFileList();
    this.setData({
      recordList: [],
      totalBytes: 0,
    });

    if (needExit) {
      app.logger.reset('reLaunch');
      wx.reLaunch({
        url: '/pages/index/index',
      });
    }
  },
  async saveToAlbum(e) {
    const { index } = e.currentTarget.dataset;
    const fileRes = this.data.recordList[index];
    try {
      await this.recordManager.saveToAlbum(fileRes.fileName);
      wx.showModal({
        title: '已保存到相册',
        showCancel: false,
      });
    } catch (err) {
      let content = err.errMsg || '';
      if (/invalid video/.test(content)) {
        content += '\n只支持保存 mp4 格式视频';
      }
      wx.showModal({
        title: '保存到相册失败',
        content,
        showCancel: false,
      });
    }
  },
  saveFileInDevTool(e) {
    const { index } = e.currentTarget.dataset;
    const fileRes = this.data.recordList[index];
    // 开发者工具里什么都可以保存，注意文件后缀
    wx.saveImageToPhotosAlbum({
      filePath: `${this.recordManager.baseDir}/${fileRes.fileName}`,
      success: (res) => {
        console.log(res);
      },
      fail: (res) => {
        console.error(res);
      }
    });
  },
  async sendFile(e) {
    const { index } = e.currentTarget.dataset;
    const fileRes = this.data.recordList[index];
    try {
      await this.recordManager.sendFile(fileRes.fileName);
    } catch (err) {
      wx.showModal({
        title: '发送失败',
        content: err.errMsg || '',
        showCancel: false,
      });
    }
  },
});

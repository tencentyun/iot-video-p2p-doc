import { isMP4 } from '../../utils';
import { getRecordManager } from '../../lib/recordManager';

Page({
  data: {
    recordManager: null,
    baseDir: '',
    isRefreshing: false,
    recordList: null,
    totalBytes: NaN,
    showSendDoc: wx.getSystemInfoSync().platform !== 'devtools', // 开发者工具可以直接保存到磁盘，不用显示发送文档
  },
  onLoad(query) {
    console.log('records: onLoad', query);
    const recordManager = getRecordManager(query.name);
    this.setData({
      recordManager,
      baseDir: recordManager.baseDir,
    });
    this.getRecordList();
  },
  async getRecordList() {
    if (this.data.isRefreshing) {
      return;
    }
    this.setData({ isRefreshing: true });

    const files = this.data.recordManager.getSavedRecordList();
    const recordList = files.map(fileName => ({ fileName, size: NaN, isMP4: isMP4(fileName) }));
    this.setData({
      recordList,
      totalBytes: files.length > 0 ? NaN : 0,
    });

    if (files.length > 0) {
      const pArr = files.map(fileName => this.data.recordManager.getFileInfo(fileName));
      try {
        const infos = await Promise.all(pArr);
        const total = infos.reduce((prev, { size }) => (prev + size), 0);
        this.setData({
          // recordList: recordList.map((baseInfo, i) => ({ ...baseInfo, ...infos[i] })),
          recordList: infos.map((info, i) => ({ ...recordList[i], ...info })),
          totalBytes: total,
        });
      } catch (err) {}
    }

    this.setData({ isRefreshing: false });
  },
  removeAllRecords() {
    if (this.data.isRefreshing) {
      return;
    }

    this.data.recordManager.removeSavedRecordList();
    this.setData({
      recordList: [],
      totalBytes: 0,
    });
  },
  playRecord(e) {
    const { index } = e.currentTarget.dataset;
    const fileRes = this.data.recordList[index];
    if (!(fileRes.size > 0)) {
      wx.showToast({
        title: '文件为空或读取失败',
        icon: 'none',
      });
      return;
    }
    wx.navigateTo({
      url: [
        `/pages/test-p2p-player/player?dirname=${encodeURIComponent(this.data.recordManager.name)}`,
        `&filename=${encodeURIComponent(fileRes.fileName)}`,
      ].join(''),
    });
  },
  renameMP4(e) {
    const { index } = e.currentTarget.dataset;
    const fileRes = this.data.recordList[index];
    if (isMP4(fileRes.fileName)) {
      wx.showToast({
        title: '已经是mp4',
        icon: 'none',
      });
      return;
    }
    try {
      const newFileName = `${fileRes.fileName}.mp4`;
      this.data.recordManager.renameFile(fileRes.fileName, newFileName);
      wx.showToast({
        title: '重命名成功',
        icon: 'none',
      });
      fileRes.fileName = newFileName;
      fileRes.isMP4 = isMP4(fileRes.fileName);
      this.setData({
        recordList: [...this.data.recordList],
      });
    } catch (err) {
      wx.showModal({
        title: '重命名失败',
        content: err.errMsg,
        showCancel: false,
      });
    }
  },
  async saveVideoToAlbum(e) {
    const { index } = e.currentTarget.dataset;
    const fileRes = this.data.recordList[index];
    try {
      await this.data.recordManager.saveVideoToAlbum(fileRes.fileName);
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
  async sendDocument(e) {
    const { index } = e.currentTarget.dataset;
    const fileRes = this.data.recordList[index];
    try {
      await this.data.recordManager.sendDocument(fileRes.fileName);
      // 不用弹框，用户能看到新开页面
    } catch (err) {
      wx.showModal({
        title: '打开文件失败',
        content: err.errMsg || '',
        showCancel: false,
      });
    }
  },
  async removeFile(e) {
    const { index } = e.currentTarget.dataset;
    const fileRes = this.data.recordList[index];
    try {
      await this.data.recordManager.removeFile(fileRes.fileName);
      wx.showToast({
        title: '删除成功',
        icon: 'none',
      });
      this.getRecordList();
    } catch (err) {
      wx.showModal({
        title: '删除失败',
        content: err.errMsg,
        showCancel: false,
      });
    }
  },
});

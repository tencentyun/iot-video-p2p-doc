import { isFLV, isMP4, isMJPG } from '../../utils';
import { getRecordManager } from '../../lib/recordManager';

const processFileItem = (item) => {
  if (item) {
    item.isFLV = isFLV(item.fileName);
    item.isMP4 = isMP4(item.fileName);
    item.isMJPG = isMJPG(item.fileName);
  }
  return item;
};

Page({
  data: {
    baseDir: '',
    isRefreshing: false,
    recordList: null,
    totalBytes: NaN,
    isDevTools: wx.getSystemInfoSync().platform === 'devtools', // 开发者工具可以直接保存到磁盘，不用显示发送文档
  },
  onLoad(query) {
    console.log('records: onLoad', query);
    if (!query?.name) {
      return;
    }
    this.recordManager = getRecordManager(query.name);
    this.setData({
      baseDir: this.recordManager.baseDir,
    });
    this.getRecordList();
  },
  async getRecordList() {
    if (this.data.isRefreshing) {
      return;
    }
    this.setData({ isRefreshing: true });

    const files = this.recordManager.getSavedRecordList();
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

  async addFile() {
    let file;
    try {
      const res = await wx.chooseMessageFile({
        count: 1,
        type: 'file',
        extension: ['flv', 'mjpg', 'mp4', 'aac'],
      });
      file = res.tempFiles[0];
      console.log('choose file res', file);
      if (!file?.size) {
        wx.showToast({
          title: 'file empty',
          icon: 'error',
        });
        return;
      }
    } catch (err) {
      console.error('choose file fail', err);
      return;
    }
    try {
      const addRes = await this.recordManager.addFile(file.name, file.path);
      console.log('add file res', addRes);
      wx.showToast({
        title: '添加成功',
        icon: 'none',
      });
      this.getRecordList();
    } catch (err) {
      console.error('add file fail', err);
    }
  },
  removeAllRecords() {
    if (this.data.isRefreshing) {
      return;
    }

    this.recordManager.removeSavedRecordList();
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
    if (fileRes.isFLV) {
      wx.navigateTo({
        url: [
          `/pages/test-p2p-player/player?dirname=${encodeURIComponent(this.recordManager.name)}`,
          `&filename=${encodeURIComponent(fileRes.fileName)}`,
        ].join(''),
      });
    } else if (fileRes.isMJPG) {
      wx.navigateTo({
        url: [
          `/pages/test-local-mjpg-player/player?dirname=${encodeURIComponent(this.recordManager.name)}`,
          `&filename=${encodeURIComponent(fileRes.fileName)}`,
        ].join(''),
      });
    } else {
      console.error('can not play record', fileRes);
      wx.showToast({
        title: '不支持的文件类型',
        icon: 'none',
      });
    }
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
      this.recordManager.renameFile(fileRes.fileName, newFileName);
      wx.showToast({
        title: '重命名成功',
        icon: 'none',
      });
      fileRes.fileName = newFileName;
      processFileItem(fileRes);
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
  saveFileInDevTools(e) {
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
  async removeFile(e) {
    const { index } = e.currentTarget.dataset;
    const fileRes = this.data.recordList[index];
    try {
      await this.recordManager.removeFile(fileRes.fileName);
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

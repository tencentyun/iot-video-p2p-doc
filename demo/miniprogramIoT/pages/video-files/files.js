import { isDevTool } from '../../utils';
import { getRecordManager, getSaveFormat } from '../../lib/recordManager';

const app = getApp();

const isMP4 = filename => /\.mp4$/i.test(filename);
const isM3U8 = filename => /\.m3u8$/i.test(filename);
const isFLV = filename => /\.flv$/i.test(filename);
const isMJPG = filename => /\.mjpg$/i.test(filename);
const isJPG = filename => /\.jpg$/i.test(filename) || /\.jpeg$/i.test(filename);
const isLOG = filename => /\.log$/i.test(filename);
const processFileItem = (item) => {
  if (item) {
    item.isMP4 = isMP4(item.fileName);
    item.isM3U8 = isM3U8(item.fileName);
    item.isFLV = isFLV(item.fileName);
    item.isMJPG = isMJPG(item.fileName);
    item.isJPG = isJPG(item.fileName);
    item.isLOG = isLOG(item.fileName);
    item.showPlay = item.isMP4 || item.isM3U8 || item.isFLV;
    item.showSaveToAlbum = !!getSaveFormat(item.fileName);
  }
  return item;
};

Page({
  data: {
    baseDir: '',
    isLogDir: false,
    isRefreshing: false,
    recordList: null,
    totalBytes: NaN,
    // 真机显示发送，开发者工具可以直接保存到磁盘
    isDevTool,
    // 查看log
    logFileDetail: null,
  },
  onLoad() {
    const query = { name: 'flv' };
    console.log('user-files: onLoad', query);
    if (!query?.name) {
      return;
    }
    this.recordManager = getRecordManager(query.name);
    this.setData({
      baseDir: this.recordManager.baseDir,
      isLogDir: query.name === 'logs',
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
      let dirCount = 0;
      const pArr = files.map(fileName => this.recordManager.getFileInfo(fileName).catch((err) => {
        if (/directory/.test(err.errMsg)) {
          dirCount++;
        }
        return {
          isDir: true,
          size: 0,
        };
      }));
      try {
        const infos = await Promise.all(pArr);
        const sortedRecordList = infos.map((info, i) => ({ ...recordList[i], ...info })).sort((a, b) => {
          if (a.isDir && !b.isDir) return -1;
          if (!a.isDir && b.isDir) return 1;
          if (a.fileName < b.fileName) return 1;
          if (a.fileName > b.fileName) return -1;
          return 0;
        });
        const totalBytes = sortedRecordList.reduce((prev, { size }) => (prev + size), 0);
        console.log('dirCount', dirCount);
        console.log('sortedRecordList', sortedRecordList);
        this.setData({
          recordList: sortedRecordList,
          totalBytes,
        });
      } catch (err) {
        console.error('get infos error', err);
      }
    }

    this.setData({ isRefreshing: false });
  },
  async removeAllRecords() {
    if (this.data.isRefreshing) {
      return;
    }

    let needExit;
    if (this.data.isLogDir) {
      // logs 特殊逻辑
      const modalRes = await wx.showModal({
        title: '确定删除log吗？',
        content: '删除log后需要重新进入小程序',
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
      app.restart();
    }
  },
  playFile(e) {
    const { index } = e.currentTarget.dataset;
    const fileRes = this.data.recordList[index];
    if (!(fileRes.size > 0)) {
      wx.showToast({
        title: '文件为空或读取失败',
        icon: 'none',
      });
      return;
    }
    if (fileRes.isMP4 || fileRes.isM3U8) {
      wx.navigateTo({
        url: `/pages/test-video/test?localfilepath=${encodeURIComponent(fileRes.filePath)}`,
      });
    } else if (fileRes.isFLV) {
      wx.navigateTo({
        url: `/pages/video/pages/local-flv-player/player?localfilepath=${encodeURIComponent(fileRes.filePath)}`,
      });
    } else {
      console.error('can not play record', fileRes);
      wx.showToast({
        title: '不支持的文件类型',
        icon: 'none',
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
      console.error('saveToAlbum fail', err);
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
  exportToAlbum(e) {
    const { index } = e.currentTarget.dataset;
    const fileRes = this.data.recordList[index];
    console.log('exportToAlbum', fileRes);
    const mediaContainer = wx.createMediaContainer();
    const startTime = Date.now();
    mediaContainer.extractDataSource({
      source: fileRes.filePath,
      success: (extractRes) => {
        console.log('mediaContainer.extractDataSource success', `${fileRes.size}B ${Date.now() - startTime}ms`, extractRes);
        extractRes.tracks.forEach((track) => {
          console.log('addTrack', track.id, track.kind);
          mediaContainer.addTrack(track);
        });
        mediaContainer.export({
          success: (exportRes) => {
            console.log('mediaContainer.export success', `${fileRes.size}B ${Date.now() - startTime}ms`, exportRes);
            mediaContainer.destroy();

            wx.saveVideoToPhotosAlbum({
              filePath: exportRes.tempFilePath,
              success: (saveRes) => {
                console.log('saveVideoToPhotosAlbum success', saveRes);
                wx.showModal({
                  title: '已导出到相册',
                  showCancel: false,
                });
              },
              fail: (err) => {
                console.error('saveVideoToPhotosAlbum fail', err);
                wx.showModal({
                  title: '导出到相册失败',
                  content: err.errMsg || '',
                  showCancel: false,
                });
              },
            });
          },
          fail: (err) => {
            console.error('mediaContainer.export fail', `${fileRes.size}B ${Date.now() - startTime}ms`, err);
            mediaContainer.destroy();

            wx.showModal({
              title: '导出到相册失败',
              content: err.errMsg || '',
              showCancel: false,
            });
          },
        });
      },
      fail: (err) => {
        console.error('mediaContainer.extractDataSource fail', `${fileRes.size}B ${Date.now() - startTime}ms`, err);
        mediaContainer.destroy();

        wx.showModal({
          title: '导出到相册失败',
          content: err.errMsg || '',
          showCancel: false,
        });
      },
    });
  },
  saveFileInDevTool(e) {
    const { index } = e.currentTarget.dataset;
    const fileRes = this.data.recordList[index];
    // 开发者工具里什么都可以保存，注意文件后缀
    wx.saveImageToPhotosAlbum({
      filePath: `${this.recordManager.baseDir}/${fileRes.fileName}`,
      success: (res) => {
        console.log('saveFileInDevTool success', res);
      },
      fail: (err) => {
        console.error('saveFileInDevTool fail', err);
      },
    });
  },
  async sendFile(e) {
    const { index } = e.currentTarget.dataset;
    const fileRes = this.data.recordList[index];
    try {
      await this.recordManager.sendFile(fileRes.fileName);
    } catch (err) {
      console.error('sendFile fail', err);
      wx.showModal({
        title: '发送失败',
        content: err.errMsg || '',
        showCancel: false,
      });
    }
  },
  removeFile(e) {
    const { index } = e.currentTarget.dataset;
    const fileRes = this.data.recordList[index];
    this.recordManager.removeFile(fileRes.fileName);
    this.getRecordList();
  },
  removeDir(e) {
    const { index } = e.currentTarget.dataset;
    const fileRes = this.data.recordList[index];
    this.recordManager.removeSubDir(fileRes.fileName);
    this.getRecordList();
  },
  async openLogFile(e) {
    const { index } = e.currentTarget.dataset;
    const fileRes = this.data.recordList[index];
    try {
      const logFileDetail = await this.recordManager.readFile(fileRes.fileName, { encoding: 'utf-8' });
      this.setData({
        logFileDetail,
      });
    } catch (err) {
      console.error('readFile fail', err);
    }
  },
  closeLogFile() {
    this.setData({
      logFileDetail: null,
    });
  },
});

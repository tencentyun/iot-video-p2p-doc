import { checkAndAuthorize } from '@/utils';

export const XP2P_BASE_DIR = `${wx.env.USER_DATA_PATH}/xp2p`;

export const getSaveFormat = (fileName) => {
  if (/\.mp4$/i.test(fileName) || /\.flv$/i.test(fileName) || /\.mjpg$/i.test(fileName)) {
    return 'video';
  }
  if (/\.jpg$/i.test(fileName) || /\.jpeg$/i.test(fileName)) {
    return 'image';
  }
  return '';
};

const fileSystem = wx.getFileSystemManager();
const xp2pBaseDir = XP2P_BASE_DIR;

export const removeFileByPath = (filePath) => {
  if (!filePath) {
    return;
  }

  try {
    fileSystem.accessSync(filePath);
  } catch (err) {
    if (~err.message.indexOf('fail no such file or directory')) {
      // 文件不存在，算是成功
    } else {
      console.error('removeFileByPath access error', err);
    }
    return;
  }

  try {
    fileSystem.unlinkSync(filePath);
  } catch (err) {
    console.error('removeFileByPath error', err);
  }
};

class RecordManager {
  constructor(name) {
    this.name = name || 'others';
    this.baseDir = `${xp2pBaseDir}/${this.name}`;
  }

  // 获取文件列表
  getFileList() {
    try {
      fileSystem.accessSync(this.baseDir);
    } catch (err) {
      if (~err.message.indexOf('fail no such file or directory')) {
        // 目录不存在
        console.log('RecordManager: getFileList but no such directory');
      } else {
        console.error('RecordManager: getFileList access error', err);
      }
      return [];
    }

    try {
      const files = fileSystem.readdirSync(this.baseDir);
      if (files.length > 1) {
        files.sort((a, b) => {
          if (a < b) return 1;
          if (a > b) return -1;
          return 0;
        });
      }
      console.log('RecordManager: getFileList success, files.length', files.length);
      return files;
    } catch (err) {
      console.error('RecordManager: getFileList error', err);
    }
    return [];
  }

  // 删除所有文件
  removeFileList() {
    try {
      fileSystem.accessSync(this.baseDir);
    } catch (err) {
      if (~err.message.indexOf('fail no such file or directory')) {
        // 目录不存在
        console.log('RecordManager: removeFileList but no such directory');
      } else {
        console.error('RecordManager: removeFileList access error', err);
      }
      return;
    }

    try {
      const res = fileSystem.rmdirSync(this.baseDir, true);
      console.log('RecordManager: removeFileList success', res);
    } catch (err) {
      console.error('RecordManager: removeFileList error', err);
    }
  }

  // 删除单个文件
  removeFile(fileName) {
    if (!fileName) {
      return;
    }
    const filePath = `${this.baseDir}/${fileName.replace(/[^A-Za-z0-9_\-.]/g, '-')}`;
    console.log('RecordManager: removeFile', fileName, filePath);

    try {
      fileSystem.accessSync(filePath);
    } catch (err) {
      if (~err.message.indexOf('fail no such file or directory')) {
        // 文件不存在
        console.log('RecordManager: removeFile but no such file');
      } else {
        console.error('RecordManager: removeFile access error', err);
      }
      return;
    }

    try {
      fileSystem.unlinkSync(filePath);
      console.log('RecordManager: removeFile success');
    } catch (err) {
      console.error('RecordManager: removeFile error', err);
    }
  }

  // 删除子目录
  removeSubDir(subDir) {
    if (!subDir) {
      return;
    }
    const dirPath = `${this.baseDir}/${subDir}`;
    try {
      const res = fileSystem.rmdirSync(dirPath, true);
      console.log('RecordManager: removeSubDir success', res);
    } catch (err) {
      console.error('RecordManager: removeSubDir error', err);
    }
  }

  getFileInfo(fileName) {
    if (!fileName) {
      return Promise.reject({ errMsg: 'param error' });
    }

    return new Promise((resolve, reject) => {
      const filePath = `${this.baseDir}/${fileName}`;
      // console.log('RecordManager: getFileInfo', fileName, filePath);
      fileSystem.getFileInfo({
        filePath,
        success: (res) => {
          // console.log('RecordManager: getFileInfo success', fileName, res);
          resolve({
            fileName,
            filePath,
            ...res,
          });
        },
        fail: (err) => {
          // console.error('RecordManager: getFileInfo fail', fileName, err);
          reject(err);
        },
      });
    });
  }

  readFile(fileName, { encoding, position, length } = {}) {
    if (!fileName) {
      return Promise.reject({ errMsg: 'param error' });
    }
    const filePath = `${this.baseDir}/${fileName}`;
    console.log('RecordManager: readFile', fileName, filePath);

    return new Promise((resolve, reject) => {
      fileSystem.readFile({
        filePath,
        encoding,
        position,
        length,
        success: (res) => {
          resolve({
            fileName,
            filePath,
            ...res,
          });
        },
        fail: (err) => {
          console.error('RecordManager: readFile fail', fileName, err);
          reject(err);
        },
      });
    });
  }

  // 创建目录
  prepareDir() {
    try {
      fileSystem.accessSync(this.baseDir);
    } catch (err) {
      if (~err.message.indexOf('fail no such file or directory')) {
        fileSystem.mkdirSync(this.baseDir, true);
      }
    }
  }

  // 创建文件
  prepareFile(fileName) {
    if (!fileName) {
      return null;
    }
    const filePath = `${this.baseDir}/${fileName.replace(/[^A-Za-z0-9_\-.]/g, '-')}`;
    console.log('RecordManager: prepareFile', fileName, filePath);

    this.prepareDir();

    let isExist = true;
    try {
      fileSystem.accessSync(filePath);
    } catch (err) {
      isExist = false;
    }

    try {
      if (isExist) {
        // 存在就截断
        fileSystem.truncateSync({
          filePath,
          length: 0,
        });
        console.log('RecordManager: prepareFile, truncate existed file', filePath);
      } else {
        // 不存在就创建
        fileSystem.writeFileSync(
          filePath,
          new ArrayBuffer(0),
          'binary',
        );
        console.log('RecordManager: prepareFile, create new file', filePath);
      }
      return filePath;
    } catch (err) {
      console.error('RecordManager: prepareFile error', err);
    }
    return null;
  }

  // 保存到相册
  async saveToAlbum(fileName) {
    const filePath = `${this.baseDir}/${fileName}`;

    const saveFormat = getSaveFormat(fileName);
    let api = '';
    if (saveFormat === 'video') {
      api = 'saveVideoToPhotosAlbum';
    } else if (saveFormat === 'image') {
      api = 'saveImageToPhotosAlbum';
    } else {
      console.error('RecordManager: saveToAlbum, invalid format');
      throw new Error('invalid format');
    }

    try {
      await checkAndAuthorize('scope.writePhotosAlbum');
    } catch (err) {
      console.error('RecordManager: saveToAlbum, checkAndAuthorize fail', err);
      throw err;
    }

    try {
      const res = await wx[api]({
        filePath,
      });
      console.log(`RecordManager: saveToAlbum, ${api} success`, res);
      return res;
    } catch (err) {
      console.error(`RecordManager: saveToAlbum, ${api} fail`, err);
      throw err;
    }
  }

  async sendFileByOpenDocument(fileName) {
    const filePath = `${this.baseDir}/${fileName}`;

    await wx.setClipboardData({
      data: fileName,
    });
    await wx.showModal({
      title: '发送给朋友',
      content: '从新页面右上角菜单发送给朋友，发送的文件名会被修改，接收后需手动改回原文件名（原文件名已复制到剪贴板）',
      showCancel: false,
    });

    try {
      console.log('RecordManager: sendFileByOpenDocument', filePath);
      const res = await wx.openDocument({
        filePath,
        showMenu: true,
        fileType: 'doc',
      });
      console.log('RecordManager: openDocument success', res);
      return res;
    } catch (err) {
      console.error('RecordManager: openDocument fail', err);
      throw err;
    }
  }

  async sendFile(fileName) {
    const filePath = `${this.baseDir}/${fileName}`;

    if (!wx.shareFileMessage) {
      // 兼容低版本
      return await this.sendFileByOpenDocument(fileName);
    }

    try {
      console.log('RecordManager: sendFileByShareFileMessage', filePath);
      const res = await wx.shareFileMessage({
        filePath,
      });
      console.log('RecordManager: shareFileMessage success', res);
      return res;
    } catch (err) {
      console.error('RecordManager: shareFileMessage fail', err);
      throw err;
    }
  }
}

const mgrMap = {};
export const getRecordManager = (name) => {
  const key = name || 'others';
  if (!mgrMap[key]) {
    mgrMap[key] = new RecordManager(key);
  }
  return mgrMap[key];
};

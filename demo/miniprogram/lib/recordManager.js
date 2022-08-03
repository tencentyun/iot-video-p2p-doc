import { toDateTimeFilename, checkAuthorize } from '../utils';

export const MAX_FILE_SIZE_IN_M = 50;
export const MAX_FILE_SIZE = MAX_FILE_SIZE_IN_M * 1024 * 1024;

let fileSystem;
const xp2pBaseDir = `${wx.env.USER_DATA_PATH}/xp2p`;

/*
export interface FileObject {
  fileName: string;
  filePath: string;
  fd: any;
  writePos: number;
}
export interface SavedFileObject {
  fileName: string;
  filePath: string;
  size: number;
}
*/

class RecordManager {
  constructor(name) {
    if (!fileSystem) {
      fileSystem = wx.getFileSystemManager();
    }
    this.name = name || 'others';
    this.baseDir = `${xp2pBaseDir}/${this.name}`;
  }

  // 获取文件列表
  getSavedRecordList() {
    try {
      fileSystem.accessSync(this.baseDir);
    } catch (err) {
      if (~err.message.indexOf('fail no such file or directory')) {
        // 目录不存在
        console.log('RecordManager: getSavedRecordList but no such directory');
      } else {
        console.log('RecordManager: getSavedRecordList access error', err);
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
      console.log('RecordManager: getSavedRecordList success, files.length', files.length);
      return files;
    } catch (err) {
      console.error('RecordManager: getSavedRecordList error', err);
    }
    return [];
  }

  // 删除所有文件
  removeSavedRecordList() {
    try {
      fileSystem.accessSync(this.baseDir);
    } catch (err) {
      if (~err.message.indexOf('fail no such file or directory')) {
        // 目录不存在
        console.log('RecordManager: removeSavedRecordList but no such directory');
      } else {
        console.log('RecordManager: removeSavedRecordList access error', err);
      }
      return;
    }

    try {
      const res = fileSystem.rmdirSync(this.baseDir, true);
      console.log('RecordManager: removeSavedRecordList success', res);
    } catch (err) {
      console.error('RecordManager: removeSavedRecordList error', err);
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
          // console.log('RecordManager: getFileInfo fail', fileName, err);
          reject(err);
        },
      });
    });
  }

  readFile(fileName) {
    if (!fileName) {
      return Promise.reject({ errMsg: 'param error' });
    }
    const filePath = `${this.baseDir}/${fileName}`;
    console.log('RecordManager: readFile', fileName, filePath);

    return new Promise((resolve, reject) => {
      const filePath = `${this.baseDir}/${fileName}`;
      fileSystem.readFile({
        filePath,
        success: (res) => {
          resolve({
            fileName,
            ...res,
          });
        },
        fail: (err) => {
          console.log('RecordManager: readFile fail', fileName, err);
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

  // 添加文件
  addFile(fileName, srcFilePath) {
    if (!fileName) {
      return Promise.reject({ errMsg: 'invalid fileName' });
    }
    if (!srcFilePath) {
      return Promise.reject({ errMsg: 'invalid srcFilePath' });
    }
    const filePath = `${this.baseDir}/${fileName}`;
    console.log('RecordManager: addFile', fileName, filePath);

    this.prepareDir();

    let isExist = false;
    try {
      fileSystem.accessSync(filePath);
      isExist = true;
    } catch (err) {}

    if (isExist) {
      console.log('RecordManager: addFile fail, file exist');
      return Promise.reject({ errMsg: 'file already exist' });
    }

    return new Promise((resolve, reject) => {
      fileSystem.saveFile({
        tempFilePath: srcFilePath,
        filePath,
        success: resolve,
        fail: reject,
      });
    });
  }

  // 创建文件
  prepareFile(fileName) {
    if (!fileName) {
      return null;
    }
    const filePath = `${this.baseDir}/${fileName}`;
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
      console.log('RecordManager: prepareFile error', err);
    }
    return null;
  }

  // 删除文件，一直提示失败
  /*
  removeFile(fileName) {
    if (!fileName) {
      return Promise.reject({ errMsg: 'param error' });
    }
    const filePath = `${this.baseDir}/${fileName}`;
    console.log('RecordManager: removeFile', fileName, filePath);

    try {
      fileSystem.accessSync(filePath);
    } catch (err) {
      if (~err.message.indexOf('fail no such file or directory')) {
        // 文件不存在
        console.log('RecordManager: removeSavedRecordList but no such directory');
        return Promise.resolve();
      }
      console.log('RecordManager: removeSavedRecordList access error', err);
      return Promise.reject(err);
    }

    return new Promise((resolve, reject) => {
      fileSystem.removeSavedFile({
        filePath,
        success: (res) => {
          console.log('RecordManager: removeFile success', fileName, res);
          resolve(res);
        },
        fail(err) {
          console.log('RecordManager: removeFile fail', fileName, err);
          reject(err);
        },
      });
    });
  }
  */

  // 按文件名写文件
  writeFile(fileName, data) {
    if (!fileSystem || !fileName || !data?.byteLength) {
      return -1;
    }
    try {
      const filePath = `${this.baseDir}/${fileName}`;
      fileSystem.writeFileSync(filePath, data, 'binary');
      return data.byteLength;
    } catch (err) {
      return -1;
    }
  }

  // 打开文件（通用，不改文件名，也不清理之前的文件）
  openFile(fileName) {
    if (!fileName) {
      return null;
    }
    const filePath = `${this.baseDir}/${fileName}`;
    console.log('RecordManager: openFile', fileName, filePath);

    this.prepareDir();

    try {
      const fd = fileSystem.openSync({
        filePath,
        flag: 'as+',
      });
      console.log('RecordManager: openFile success', filePath, fd);
      return {
        fileName,
        filePath,
        fd,
        writePos: 0,
      };
    } catch (err) {
      console.log('RecordManager: openFile error', err);
    }
    return null;
  }

  // 打开录像文件
  openRecordFile(recordFilename, fileType = 'flv') {
    if (!recordFilename) {
      return null;
    }
    console.log('RecordManager: openRecordFile', recordFilename);

    // 每次录之前清掉之前的录像，避免占用过多空间，demo就不清了，方便定位问题
    // this.removeSavedRecordList();

    // 录像文件名自动带上录制时间
    const fixedFilename = recordFilename.replace(new RegExp(`\\.${fileType}$`), '').replace(/\W/g, '-');
    const fileName = `${fixedFilename}.${toDateTimeFilename(new Date())}.${fileType || 'flv'}`;

    return this.openFile(fileName);
  }

  // 返回写入字节数，-1表示失败
  writeRecordFile(fileObj, data) {
    if (!fileSystem || !fileObj?.fd || !fileObj?.filePath || !data?.byteLength) {
      return -1;
    }
    const newSize = fileObj.writePos + data.byteLength;
    if (newSize > MAX_FILE_SIZE) {
      return -1;
    }
    try {
      fileSystem.writeSync({
        fd: fileObj.fd,
        data,
        position: fileObj.writePos || 0,
      });
      fileObj.writePos = newSize;
    } catch (err) {
      return -1;
    }
    return data.byteLength;
  }

  saveRecordFile(fileObj) {
    if (!fileSystem || !fileObj?.fd || !fileObj?.filePath) {
      return null;
    }

    console.log('RecordManager: saveRecordFile', fileObj.fileName);
    fileSystem.closeSync({
      fd: fileObj.fd,
    });
    fileObj.fd = null;

    return {
      fileName: fileObj.fileName,
      filePath: fileObj.filePath,
      size: fileObj.writePos,
    };
  }

  closeRecordFile(fileObj) {
    if (!fileSystem || !fileObj || !fileObj.fd) {
      return;
    }
    console.log('RecordManager: closeRecordFile', fileObj.fileName);
    fileSystem.closeSync({
      fd: fileObj.fd,
    });
    fileObj.fd = null;
  }

  renameFile(fileName, newFileName) {
    try {
      const res = fileSystem.renameSync(
        `${this.baseDir}/${fileName}`,
        `${this.baseDir}/${newFileName}`,
      );
      console.log('RecordManager: renameFile success', res);
      return res;
    } catch (err) {
      console.log('RecordManager: renameFile fail', err);
      throw err;
    }
  }

  async saveToAlbum(fileName) {
    const filePath = `${this.baseDir}/${fileName}`;

    let api = '';
    if (/\.mp4$/i.test(fileName) || /\.flv$/i.test(fileName) || /\.mjpg$/i.test(fileName)) {
      api = 'saveVideoToPhotosAlbum';
    } else if (/\.jpg$/i.test(fileName) || /\.jpeg$/i.test(fileName)) {
      api = 'saveImageToPhotosAlbum';
    } else {
      console.log('RecordManager: saveToAlbum, invalid format');
      throw new Error('invalid format');
    }

    try {
      await checkAuthorize('scope.writePhotosAlbum');
    } catch (err) {
      console.log('RecordManager: saveToAlbum, checkAuthorize fail', err);
      throw err;
    }

    try {
      const res = await wx[api]({
        filePath,
      });
      console.log(`RecordManager: saveToAlbum, ${api} success`, res);
      return res;
    } catch (err) {
      console.log(`RecordManager: saveToAlbum, ${api} fail`, err);
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
      const res = await wx.openDocument({
        filePath,
        showMenu: true,
        fileType: 'doc',
      });
      console.log('RecordManager: openDocument success', res);
      return res;
    } catch (err) {
      console.log('RecordManager: openDocument fail', err);
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
      const res = await wx.shareFileMessage({
        filePath,
      });
      console.log('RecordManager: shareFileMessage success', res);
      return res;
    } catch (err) {
      console.log('RecordManager: shareFileMessage fail', err);
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

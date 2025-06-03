/**
 * sample urls:
 * - 最基础的，只有 ts 分片
 *   https://1500005692.vod2.myqcloud.com/43843706vodtranscq1500005692/62656d94387702300542496289/v.f100240.m3u8
 * - 有 EXT-X-MAP
 *   https://1259367869.vod2.myqcloud.com/timeshift/live/b4d5af98-31d7-4026-833e-559e2043f4fb/timeshift.m3u8?starttime_epoch=1717646648&endtime_epoch=1717646679&xxx
 * - 有 EXT-X-MEDIA，多级 m3u8
 *   https://videojs-test-1.s3.eu-central-1.amazonaws.com/HLS_Segmented/master.m3u8
 * - 有 EXT-X-MEDIA，多级 m3u8，singlefile + byterange
 *   https://videojs-test-1.s3.eu-central-1.amazonaws.com/HLS_SingleFiles/master.m3u8
 */
const fileSystem = wx.getFileSystemManager();

const createDir = (dirPath) => {
  try {
    fileSystem.accessSync(dirPath);
  } catch (err) {
    if (~err.message.indexOf('fail no such file or directory')) {
      fileSystem.mkdirSync(dirPath, true);
    } else {
      throw err;
    }
  }
};

const removeDir = (dirPath) => {
  try {
    fileSystem.rmdirSync(dirPath, true);
  } catch (err) {
    if (~err.message.indexOf('fail no such file or directory')) {
      // 不存在，算是成功
    } else {
      throw err;
    }
  }
};

// fileName 可能包括子目录
const createFile = (dirPath, fileName) => {
  const filePath = `${dirPath}/${fileName}`;

  // 如果 fileName 包括子目录，先创建各级目录
  const arr = fileName.split('/');
  let nowPath = dirPath;
  while (arr.length > 1) {
    nowPath = `${nowPath}/${arr.shift()}`;
    try {
      fileSystem.accessSync(nowPath);
    } catch (err) {
      if (~err.message.indexOf('fail no such file or directory')) {
        fileSystem.mkdirSync(nowPath, true);
      } else {
        throw err;
      }
    }
  }

  let isExist = false;
  try {
    fileSystem.accessSync(filePath);
    isExist = true;
  } catch (err) {}

  if (isExist) {
    // 存在就截断
    fileSystem.truncateSync({
      filePath,
      length: 0,
    });
  } else {
    // 不存在就创建
    fileSystem.writeFileSync(
      filePath,
      new ArrayBuffer(0),
      'binary',
    );
  }
  return filePath;
};

const parseUrlSimple = (url) => {
  const [urlNoQuery] = url.split('?');
  const pos = urlNoQuery.lastIndexOf('/');
  const urlBase = urlNoQuery.substring(0, pos);
  const fileName = urlNoQuery.substring(pos + 1);

  let fileType = '';
  const tmp = fileName.split('.');
  if (tmp.length > 1) {
    fileType = tmp.pop().toLowerCase();
  }

  return {
    urlBase,
    fileName,
    fileType,
  };
};

const getAbsUrl = (baseUrl, url) => {
  if (/^http/.test(url)) {
    return url;
  }
  if (/^\//.test(url)) {
    const match = baseUrl.match(/^https?:\/\/[\w-.]+/);
    return match[0] + url;
  }
  const arr = baseUrl.split('/');
  arr.pop();
  arr.push(url);
  return arr.join('/');
};

const maxFileSizeDefault = 100 * 1024 * 1024;
const maxFileSizeMin = 1 * 1024 * 1024;

export class M3U8Downloader {
  constructor({ url, localDir, maxFileSize, success, fail }) {
    console.log('[M3U8Downloader] create', url, localDir);
    this.url = url;
    this.urlDetail = parseUrlSimple(url);
    this.localDir = localDir;
    this.maxFileSize = maxFileSize >= maxFileSizeMin ? maxFileSize : maxFileSizeDefault;
    this.success = success;
    this.fail = fail;

    this.isDownloading = false;
    this.fileDir = ''; // start 时创建
    this.filePath = '';
    this.dataLength = 0;
  }

  async start() {
    if (this.urlDetail?.fileType !== 'm3u8') {
      console.error('[M3U8Downloader] start error, not m3u8', this.url, this.urlDetail);
      return;
    }
    try {
      fileSystem.accessSync(this.localDir);
    } catch (err) {
      console.error('[M3U8Downloader] access localDir error', this.localDir, err);
      return;
    }
    if (this.isDownloading) {
      return;
    }
    this.isDownloading = true;
    this.fileDir = `${this.localDir}/${this.urlDetail.fileName}-${Date.now()}`;
    this.filePath = `${this.fileDir}/${this.urlDetail.fileName}`;
    this.dataLength = 0;

    console.log('[M3U8Downloader] ==== start', this.filePath);

    try {
      createDir(this.fileDir);
    } catch (err) {
      console.error('[M3U8Downloader] createFileDir error', this.fileDir, err);
      this.doFail(err);
      return;
    }

    let sliceList;
    try {
      sliceList = await this.downloadAndParseMainM3U8({ url: this.url });
      console.log('[M3U8Downloader] downloadAndParseMainM3U8 success, sliceList.length', sliceList.length);
    } catch (err) {
      console.error('[M3U8Downloader] downloadAndParseMainM3U8 error', err);
      this.doFail(err);
      return;
    }

    try {
      await this.downloadSliceList(sliceList);
      console.log('[M3U8Downloader] downloadSliceList success, dataLength', this.dataLength);
    } catch (err) {
      console.error('[M3U8Downloader] downloadSliceList error', err);
      this.doFail(err);
      return;
    }

    let exportRes;
    try {
      exportRes = await this.exportMp4();
      console.log('[M3U8Downloader] exportMp4 success', exportRes);
    } catch (err) {
      console.error('[M3U8Downloader] exportMp4 error', err);
      this.doFail(err);
      return;
    }

    this.doSuccess(exportRes);
  }

  stop() {
    if (!this.isDownloading) {
      return;
    }
    this.doFail({ errMsg: 'user cancel' });
  }

  // 以下 protected
  async downloadAndParseMainM3U8({ url }) {
    let m3u8List = [{ url, fileName: this.urlDetail.fileName }];
    let sliceList = [];
    while (m3u8List.length > 0) {
      if (!this.isDownloading) {
        return;
      }
      const m3u8Item = m3u8List.shift();
      const res = await this.downloadAndParseSingleM3U8(m3u8Item);
      if (res.sliceList) {
        // 加到后面
        sliceList = sliceList.concat(res.sliceList);
      }
      if (res.m3u8List) {
        // 加到前面
        m3u8List = res.m3u8List.concat(m3u8List);
      }
    }
    return sliceList;
  }

  // fileName 是相对于 fileDir 的相对路径，可能包括子目录
  downloadAndParseSingleM3U8({ url, fileName }) {
    let filePath = '';
    try {
      filePath = createFile(this.fileDir, fileName);
    } catch (err) {
      console.error(`[M3U8Downloader][${fileName}]`, 'createFile error', err);
      return Promise.reject(err);
    }
    const fileRes = {
      url,
    };
    return new Promise((resolve, reject) => {
      console.log(`[M3U8Downloader][${fileName}]`, 'download m3u8');
      wx.downloadFile({
        url,
        filePath,
        success: (res) => {
          fileRes.statusCode = res.statusCode;
          if (res.statusCode === 200) {
            console.log(`[M3U8Downloader][${fileName}]`, 'download m3u8 success', `${res.dataLength}B`);
            fileSystem.readFile({
              filePath,
              encoding: 'utf-8',
              success: (res) => {
                console.log(`[M3U8Downloader][${fileName}]`, 'read m3u8 success');
                try {
                  const parseRes = this.parseSingleM3U8(url, fileName, res.data);
                  console.log(`[M3U8Downloader][${fileName}]`, 'parse m3u8 success', parseRes);
                  resolve(parseRes);
                } catch (err) {
                  console.error(`[M3U8Downloader][${fileName}]`, 'parse m3u8 error', err);
                  fileRes.errType = 'parseError';
                  fileRes.errMsg = err.errMsg;
                  fileRes.errDetail = err;
                  reject(fileRes);
                }
              },
              fail: (err) => {
                console.error(`[M3U8Downloader][${fileName}]`, 'read m3u8 error', err);
                fileRes.errType = 'readError';
                fileRes.errMsg = err.errMsg;
                fileRes.errDetail = err;
                reject(fileRes);
              },
            });
          } else {
            console.error(`[M3U8Downloader][${fileName}]`, 'download m3u8 statusCode error', res);
            fileRes.errType = 'downloadError';
            fileRes.errMsg = `statusCode error: ${res.statusCode}`;
            fileRes.errDetail = res;
            reject(fileRes);
          }
        },
        fail: (err) => {
          console.error(`[M3U8Downloader][${fileName}]`, 'download m3u8 fail', err);
          fileRes.errType = 'downloadError';
          fileRes.errMsg = err.errMsg;
          fileRes.errDetail = err;
          reject(fileRes);
        },
      });
    });
  }

  // m3u8FileName 是相对于 fileDir 的相对路径，可能包括子目录
  parseSingleM3U8(m3u8Url, m3u8FileName, fileData) {
    let fileNameInFileDirPrifix = '';
    if (m3u8FileName.indexOf('/') >= 0) {
      fileNameInFileDirPrifix = `${parseUrlSimple(m3u8FileName).urlBase}/`;
    }
    const lines = fileData.split('\n');
    const result = {
      sliceList: null, // { url, fileName }[], 可能是 ts mp4 或者 m4s
      m3u8List: null, // { url, fileName }[]
    };
    let sliceCount = 0;
    let subM3U8Count = 0;

    // 要去重，支持 singlefile 方式
    const itemMap = {}; // url -> item
    const addSlice = (url) => {
      const absUrl = getAbsUrl(m3u8Url, url);
      if (itemMap[absUrl]) {
        // 去重
        return itemMap[absUrl];
      }
      if (!result.sliceList) {
        result.sliceList = [];
      }
      // 不管实际url是什么，存在用户文件里的都是 slice_{sliceCount}.{fileType}
      sliceCount++;
      const { fileType = 'ts' } = parseUrlSimple(url);
      const fileNameInThisFile = `slice_${sliceCount}.${fileType}`;
      const item = {
        url: absUrl,
        fileName: `${fileNameInFileDirPrifix}${fileNameInThisFile}`,
        fileNameInThisFile,
      };
      itemMap[absUrl] = item;
      result.sliceList.push(item);
      return item;
    };
    const addSubM3U8 = (url) => {
      const absUrl = getAbsUrl(m3u8Url, url);
      if (itemMap[absUrl]) {
        // 去重
        return itemMap[absUrl];
      }
      if (!result.m3u8List) {
        result.m3u8List = [];
      }
      // 不管实际url是什么，存在用户文件里的都是 m3u8_{subM3U8Count}/{oriFileName}
      subM3U8Count++;
      const { fileName: oriFileName } = parseUrlSimple(url);
      const fileNameInThisFile = `m3u8_${subM3U8Count}/${oriFileName}`;
      const item = {
        url: absUrl,
        fileName: `${fileNameInFileDirPrifix}${fileNameInThisFile}`,
        fileNameInThisFile,
      };
      itemMap[absUrl] = item;
      result.m3u8List.push(item);
      return item;
    };

    const len = lines.length;
    const findUrlLine = (start) => {
      let i = start;
      let line = '';
      while (i < len) {
        line = lines[i];
        if (line && !/^#/.test(line)) {
          return i;
        }
        i++;
      }
      return -1;
    };

    let i = 0;
    let line = '';
    while (i < len) {
      line = lines[i];
      if (/^#EXT-X-MAP:/.test(line) || /^#EXT-X-MEDIA:/.test(line)) {
        const match = line.match(/URI="([^"]+)"/);
        if (match) {
          const oriURI = match[1];
          const { fileType } = parseUrlSimple(oriURI);
          let item;
          if (fileType === 'm3u8') {
            item = addSubM3U8(oriURI);
          } else {
            item = addSlice(oriURI);
          }
          // console.log(`[M3U8Downloader][${m3u8FileName}]`, 'init line', i, line, item);
          lines[i] = line.replace(oriURI, item.fileNameInThisFile);
        }
      } else if (/^#EXTINF:/.test(line)) {
        const urlIdx = findUrlLine(i + 1);
        if (urlIdx < 0) {
          throw {
            errMsg: '解析 m3u8 失败',
          };
        }
        i = urlIdx;
        line = lines[i];
        const item = addSlice(line);
        // console.log(`[M3U8Downloader][${m3u8FileName}]`, 'slice line', i, line, item);
        lines[i] = item.fileNameInThisFile;
      } else if (/^#EXT-X-STREAM-INF:/.test(line)) {
        const urlIdx = findUrlLine(i + 1);
        if (urlIdx < 0) {
          throw {
            errMsg: '解析 m3u8 失败',
          };
        }
        i = urlIdx;
        line = lines[i];
        const item = addSubM3U8(line);
        // console.log(`[M3U8Downloader][${m3u8FileName}]`, 'm3u8 line', i, line, item);
        lines[i] = item.fileNameInThisFile;
      }
      i++;
    }

    if (!sliceCount && !subM3U8Count) {
      throw {
        errMsg: '解析 m3u8 失败',
      };
    }

    // 改成相对路径了，重写m3u8
    const m3u8FilePath = `${this.fileDir}/${m3u8FileName}`;
    fileSystem.truncateSync({
      filePath: m3u8FilePath,
      length: 0,
    });
    fileSystem.writeFileSync(m3u8FilePath, lines.join('\n'), 'utf-8');

    return result;
  }

  // 下载视频分段列表
  async downloadSliceList(sliceList) {
    const total = sliceList.length;
    for (let i = 0; i < total; i++) {
      if (!this.isDownloading) {
        return;
      }
      const sliceItem = sliceList[i];
      await this.downloadSingleSlice(sliceItem);
    }
  }

  // 下载单个视频分段
  downloadSingleSlice({ url, fileName }) {
    let filePath = '';
    try {
      filePath = createFile(this.fileDir, fileName);
    } catch (err) {
      console.error(`[M3U8Downloader][${fileName}]`, 'createFile error', err);
      return Promise.reject(err);
    }
    const fileRes = {
      url,
    };
    return new Promise((resolve, reject) => {
      // console.log(`[M3U8Downloader][${fileName}]`, 'download slice');
      wx.downloadFile({
        url,
        filePath,
        success: (res) => {
          fileRes.statusCode = res.statusCode;
          this.dataLength += res.dataLength;
          if (res.statusCode === 200) {
            // console.log(`[M3U8Downloader][${fileName}]`, 'download slice success', `${res.dataLength}B`);
            if (this.dataLength > this.maxFileSize) {
              // 超出大小限制
              const err = {
                dataLength: this.dataLength,
                maxFileSize: this.maxFileSize,
                errMsg: `dataLength overflow: ${this.dataLength} > ${this.maxFileSize}`,
              };
              console.error(`[M3U8Downloader][${fileName}]`, 'download slice dataLength overflow', url, err);
              fileRes.errType = 'downloadOverflow';
              fileRes.errMsg = err.errMsg;
              fileRes.errDetail = err;
              reject(fileRes);
              return;
            }
            resolve(res);
          } else {
            console.error(`[M3U8Downloader][${fileName}]`, 'download slice statusCode error', url, res);
            fileRes.errType = 'downloadError';
            fileRes.errMsg = `statusCode error: ${res.statusCode}`;
            fileRes.errDetail = res;
            reject(fileRes);
          }
        },
        fail: (err) => {
          console.error(`[M3U8Downloader][${fileName}]`, 'download slice fail', url, err);
          fileRes.errType = 'downloadError';
          fileRes.errMsg = err.errMsg;
          fileRes.errDetail = err;
          reject(fileRes);
        },
      });
    });
  }

  exportMp4() {
    if (!this.isDownloading) {
      return;
    }
    const mediaContainer = wx.createMediaContainer();
    this.mediaContainer = mediaContainer;

    const startTime = Date.now();
    return new Promise((resolve, reject) => {
      mediaContainer.extractDataSource({
        source: this.filePath,
        success: (extractRes) => {
          console.log('[M3U8Downloader] mediaContainer.extractDataSource success', `${Date.now() - startTime}ms`, extractRes);
          extractRes.tracks.forEach((track) => {
            mediaContainer.addTrack(track);
          });
          mediaContainer.export({
            success: (exportRes) => {
              console.log('[M3U8Downloader] mediaContainer.export success', `${Date.now() - startTime}ms`, exportRes);
              mediaContainer.destroy();
              if (this.mediaContainer === mediaContainer) {
                this.mediaContainer = null;
              }
              resolve(exportRes);
            },
            fail: (err) => {
              console.error('[M3U8Downloader] mediaContainer.export fail', `${Date.now() - startTime}ms`, err);
              mediaContainer.destroy();
              if (this.mediaContainer === mediaContainer) {
                this.mediaContainer = null;
              }
              reject(err);
            },
          });
        },
        fail: (err) => {
          console.error('[M3U8Downloader] mediaContainer.extractDataSource fail', `${Date.now() - startTime}ms`, err);
          mediaContainer.destroy();
          if (this.mediaContainer === mediaContainer) {
            this.mediaContainer = null;
          }
          reject(err);
        },
      });
    });
  }

  doSuccess(res) {
    if (!this.isDownloading) {
      return;
    }
    console.log('[M3U8Downloader] ==== download success', this.filePath, this.dataLength, res);
    this.resetDownloadData();
    this.success?.(res);
  }

  doFail(failErr) {
    if (!this.isDownloading) {
      return;
    }
    console.error('[M3U8Downloader] ==== download fail', this.filePath, this.dataLength, failErr);
    this.resetDownloadData();
    this.fail?.(failErr);
  }

  resetDownloadData() {
    this.isDownloading = false;
    if (this.mediaContainer) {
      this.mediaContainer.destroy();
      this.mediaContainer = null;
    }
    if (this.fileDir) {
      try {
        console.log('[M3U8Downloader] removeDir', this.fileDir);
        removeDir(this.fileDir);
      } catch (err) {
        console.error('[M3U8Downloader] removeFileDir error', this.fileDir, err);
      }
      this.fileDir = '';
    }
    this.filePath = '';
    this.dataLength = 0;
  }
}

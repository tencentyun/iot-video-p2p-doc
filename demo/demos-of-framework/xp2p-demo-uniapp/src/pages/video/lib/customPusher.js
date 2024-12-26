const fileSystem = wx.getFileSystemManager();

export class CustomPusher {
  constructor({ file, errorCallback }) {
    if (!file) {
      throw new Error('[CustomPusher] invalid file');
    }
    if (!errorCallback) {
      throw new Error('[CustomPusher] invalid errorCallback');
    }
    console.log('[CustomPusher] file', file);
    this.file = file;
    this.errorCallback = errorCallback;
  }

  start({ writer }) {
    if (this.isSending) {
      return;
    }
    console.log('[CustomPusher] start');
    this.isSending = true;
    this.writer = writer;
    this.startTime = Date.now();
    this.totalBytes = 0;
    this.pos = 0;
    this._sendData(13); // header
  }

  stop() {
    if (!this.isSending) {
      return;
    }
    console.log(`[CustomPusher] stop, totalBytes ${this.totalBytes}B, totalTime ${Date.now() - this.startTime}ms`);
    this.isSending = false;
    this.writer = null;
    this.startTime = 0;
    this.totalBytes = 0;
    this.pos = 0;
  }

  destroy() {
    if (!this.file) {
      return;
    }
    console.log('[CustomPusher] destroy');
    this.stop();
    this.file = null;
    this.errorCallback = null;
  }

  _sendData(bytes) {
    if (!this.isSending) {
      return;
    }

    let length = bytes > 0
      ? bytes // 指定大小
      : (Math.random() < 0.5 ? 5000 : 500); // 没指定，随机模拟视频tag/音频tag

    // 不能超过文件size
    length = Math.min(this.file.size - this.pos, length);

    fileSystem.readFile({
      filePath: this.file.path,
      position: this.pos,
      length,
      success: (res) => {
        if (!this.isSending) {
          return;
        }
        this.writer.addChunk(res.data);
        this.totalBytes += length;
        this.pos += length;
        if (this.pos >= this.file.size) {
          this.pos = 13;
        }
        setTimeout(() => {
          this._sendData();
        }, 10);
      },
      fail: (err) => {
        console.error('[CustomPusher] read file error', err.errCode, err.errMsg);
        this.errorCallback(err);
      },
    });
  }
}

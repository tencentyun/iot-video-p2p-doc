export class CustomParser {
  start() {
    console.log('[CustomParser] start');
    this.hasHeader = false;
    this.chunkCount = 0;
  }

  setFlvHeader(header) {
    console.log(`[CustomParser] setFlvHeader, ${header.byteLength}B`);
    this.hasHeader = true;
  }

  parseFlvData(chunk) {
    // 解析 flv data
    // 注意 chunk 可能包含多个 tag，也可能只是部分 tag 数据
    this.chunkCount++;
    return chunk;
  }

  parseMjpgData(chunk) {
    // 解析 mjpg data，图片流设备用
    // 注意 chunk 可能是 --boundary 分隔，也可能只是部分 jpg 数据
    this.chunkCount++;
    return chunk;
  }
  stop() {
    console.log(`[CustomParser] stop, hasHeader ${this.hasHeader}, chunkCount ${this.chunkCount}`);
    this.hasHeader = false;
    this.chunkCount = 0;
  }
}

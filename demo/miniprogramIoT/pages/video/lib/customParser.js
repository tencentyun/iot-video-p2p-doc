/* eslint-disable no-unused-vars */
import { arrayBufferToHex } from '../../../utils';

const FLV_HEADER_LENGTH = 13;
const FLV_TAG_HEADER_LENGTH = 11;

const AUDIO_TAG = 0x08;
const VIDEO_TAG = 0x09;
const SCRIPT_TAG = 0x12;

const READ_STATE_FLV_HEADER = 0;
const READ_STATE_TAG_HEADER = 1;
const READ_STATE_TAG_DATA = 2;

const tagMaxSizeDefault = 100 * 1024;

const memcpy = (destBuf, destCpyOffset, srcBuf, srcCpyOffset, cpyLen) => {
  const u1 = new Uint8Array(destBuf, destCpyOffset, cpyLen);
  const u2 = new Uint8Array(srcBuf, srcCpyOffset, cpyLen);
  for (let i = 0; i < cpyLen; i++) {
    u1[i] = u2[i];
  }
};

export class CustomParser {
  constructor({ tagMaxSize } = {}) {
    // 申请一段buffer，注意要能放下最大的tag
    this.tagBuffer = new ArrayBuffer(tagMaxSize > tagMaxSizeDefault ? tagMaxSize : tagMaxSizeDefault);
  }

  start() {
    console.log('[CustomParser] start');
    this.hasHeader = false;
    this.chunkCount = 0;
    this.mjpgChunkCount = 0;
    this.flvDataWriter = null;
    this.mjpgDataWriter = null;
    this.readState = READ_STATE_FLV_HEADER;
    this.tagShowLog = false;
    this.tagCount = 0;
    this.tagType = 0;
    this.tagTotalLen = 0;
    this.tagCurrentLen = 0;
  }

  setFlvHeader(header) {
    console.log(`[CustomParser] setFlvHeader, ${header.byteLength}B`);
    this.hasHeader = true;
    this.readState = READ_STATE_TAG_HEADER;
  }

  setFlvDataWriter(writer) {
    console.log(`[CustomParser] setFlvDataWriter ${!!writer}`);
    this.flvDataWriter = writer;
  }

  parseFlvData(chunk) {
    // 解析 flv data
    // 注意 chunk 可能包含多个 tag，也可能只是部分 tag 数据
    this.chunkCount++;

    let pos = 0;
    while (pos < chunk.byteLength) {
      if (this.readState === READ_STATE_TAG_HEADER) {
        const readLen = Math.min(FLV_TAG_HEADER_LENGTH - this.tagCurrentLen, chunk.byteLength - pos);
        memcpy(this.tagBuffer, this.tagCurrentLen, chunk, pos, readLen);
        this.tagCurrentLen += readLen;

        pos += readLen;

        const uint8Array = new Uint8Array(this.tagBuffer, 0, this.tagCurrentLen);
        if (!this.tagType) {
          // tag start
          this.tagCount++;
          this.tagType = uint8Array[0];

          // FIXME 频繁调用的地方不要打印，会影响性能，开发期间打印前xx个，正式代码里要去掉
          this.tagShowLog = this.chunkCount <= 20;
          if (readLen < FLV_TAG_HEADER_LENGTH) {
            // tagHeader 不完整，强制打印
            this.tagShowLog = true;
            console.log(`[CustomParser][chunk ${this.chunkCount}] tag ${this.tagCount} start, tagType ${this.tagType}, < ${arrayBufferToHex(this.tagBuffer, 0, this.tagCurrentLen, ' ')} >`);
          } else if (this.tagShowLog) {
            console.log(`[CustomParser][chunk ${this.chunkCount}] tag ${this.tagCount} start, tagType ${this.tagType}`);
          }
        }
        if (this.tagCurrentLen >= FLV_TAG_HEADER_LENGTH) {
          // tag header complete
          const tagDataLen = (uint8Array[1] << 16)
            + (uint8Array[2] << 8)
            + uint8Array[3];
          this.tagTotalLen = FLV_TAG_HEADER_LENGTH + tagDataLen + 4; // 4 - tag末尾的4字节长度字段
          this.readState = READ_STATE_TAG_DATA;
        }
      }
      
      if (this.readState === READ_STATE_TAG_DATA) {
        if (this.tagCurrentLen < this.tagTotalLen) {
          const readLen = Math.min(this.tagTotalLen - this.tagCurrentLen, chunk.byteLength - pos);
          memcpy(this.tagBuffer, this.tagCurrentLen, chunk, pos, readLen);
          this.tagCurrentLen += readLen;

          pos += readLen;

          if (this.tagCurrentLen >= this.tagTotalLen) {
            // 完整的tag，可以在这里处理后再传给播放器，也可以不传自行渲染，但是录制flv接口只会录制传给播放器的内容
            // FIXME 频繁调用的地方不要打印，会影响性能，开发期间打印前xx个，正式代码里要去掉
            if (this.tagShowLog) {
              console.log(`[CustomParser][chunk ${this.chunkCount}] tag ${this.tagCount} end, ${this.tagType} ${this.tagTotalLen}B, < ${arrayBufferToHex(this.tagBuffer, 0, FLV_TAG_HEADER_LENGTH, ' ')} ... >`);
            }
            this.flvDataWriter.addChunk(this.tagBuffer.slice(0, this.tagTotalLen));
            
            this.readState = READ_STATE_TAG_HEADER;
            this.tagShowLog = false;
            this.tagType = 0;
            this.tagTotalLen = 0;
            this.tagCurrentLen = 0;
          }
        }
      }
    }
  }

  setMjpgDataWriter(writer) {
    console.log(`[CustomParser] setMjpgDataWriter ${!!writer}`);
    this.mjpgDataWriter = writer;
  }

  parseMjpgData(chunk) {
    // 解析 mjpg data，图片流设备用
    // 注意 chunk 可能是 --boundary 分隔，也可能只是部分 jpg 数据
    this.mjpgChunkCount++;

    // FIXME 频繁调用的地方不要打印，会影响性能，开发期间打印前xx个，正式代码里要去掉
    if (this.mjpgChunkCount <= 10) {
      console.log(`[CustomParser][mjpgchunk ${this.mjpgChunkCount}] ${chunk.byteLength}B, < ${arrayBufferToHex(chunk, 0, 10, ' ')} >`);
    }
    this.mjpgDataWriter.addChunk(chunk);
  }

  stop() {
    console.log(`[CustomParser] stop, hasHeader ${this.hasHeader}, chunkCount ${this.chunkCount}, mjpgChunkCount ${this.mjpgChunkCount}, tagCount ${this.tagCount}`);
    this.hasHeader = false;
    this.chunkCount = 0;
    this.mjpgChunkCount = 0;
    this.flvDataWriter = null;
    this.mjpgDataWriter = null;
    this.readState = READ_STATE_FLV_HEADER;
    this.tagCount = 0;
    this.tagType = 0;
    this.tagTotalLen = 0;
    this.tagCurrentLen = 0;
  }
}

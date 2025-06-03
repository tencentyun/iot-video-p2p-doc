<template>
  <view class="replay-wrap">
    <view v-if="p2pMode !== 'ipc'">not for p2pMode {{ deviceInfo.p2pMode }}</view>
    <view v-else-if="sceneType !== 'playback'">not for sceneType {{ sceneType }}</view>
    <iot-p2p-playback-player
      v-else
      :id="playerId"
      class="my-player"
      :deviceInfo="deviceInfo"
      :needCheckStream="playerOptions.needCheckStream"
      :streamChannel="playerOptions.streamChannel"
      :videoInfo="videoInfo"
      :mode="playerOptions.playerRTC ? 'RTC' : 'live'"
      :muted="playerOptions.muted"
      :orientation="playerOptions.orientation"
      :fill="playerOptions.fill"
      :showLog="playerOptions.playerLog"
      :showDebugInfo="playerOptions.showDebugInfo"
      :onlyp2p="onlyp2pMap.flv"
      :xp2pInfo="deviceInfo.xp2pInfo"
      @playerstatechange="onPlayerEvent"
      @streamstatechange="onPlayerEvent"
      @playstart="onPlayStateEvent"
      @playsuccess="onPlaySuccess"
      @playpause="onPlayStateEvent"
      @playresume="onPlayStateEvent"
      @playstop="onPlayStateEvent"
      @playend="onPlayStateEvent"
      @playerror="onPlayError"
      @recordstatechange="onRecordStateChange"
      @recordfilestatechange="onRecordFileStateChange"
      @timeUpdate="onTimeUpdate"
    ></iot-p2p-playback-player>
    <view class="dates">
      <view class="dates-title">请选择日期：</view>
      <van-button
        v-for="(item, index) of validateDates"
        type="default"
        :key="index"
        @click="handleSelectedDate(item.date)"
      >
        {{ item.date }}
      </van-button>
    </view>
    <view class="selected-date">
      <view>当前选择日期：</view>
      <view>{{ selectedDate }}</view>
    </view>
    <view v-if="validateDates && validateDates.length >= 0" class="videos">
      <view class="sub-title">录像列表</view>
      <van-button type="primary" @click="onChooseRecordClick">选择录像并播放</van-button>
      <van-popup :show="recordDialogOpen" round position="bottom">
        <van-picker
          title="时间"
          show-toolbar
          :columns="recordVideos"
          @confirm="handlePickerConfirm"
          @cancel="handlePickerCancel"
        />
      </van-popup>
    </view>
    <view class="button-group">
      <van-button type="info" @click="onSeekVideo(10)">快进10s</van-button>
      <van-button type="info" @click="onSeekVideo(-10)">快退10s</van-button>
    </view>
    <view v-if="downloadFiles && downloadFiles.length > 0" class="file-wrap">
      <view class="sub-title">下载列表</view>
      <view class="file-list">
        <view class="file-item" v-for="item of downloadFiles" :key="item.fileName">
          <view class="file-item-info">{{ item.timeStr }}:{{ item.fileName }}</view>
          <view class="file-item-btns">
            <van-button size="small" custom-class="file-item-button" type="info" @click="OnDownloadFile(item)"
              >下载</van-button
            >
            <van-button size="small" ustom-class="file-item-button" type="danger" @click="stopDownloadFile"
              >取消</van-button
            >
          </view>
        </view>
      </view>
      <view class="download-progress" v-if="currentFile">
        <view class="current-file">正在下载: {{ currentFile.fileName }}</view>
        {{ downloadSpeedStr }} /{{ (currentFile.fileSize / 1024).toFixed(2) }}KB
      </view>
    </view>

    <van-toast id="van-toast" />
  </view>
</template>

<script>
import dayjs from 'dayjs';
import { throttle } from 'lodash-es';
import { mapState } from 'vuex';
import { isDevTools, toDateTimeFilename } from '@/utils';
import { getXp2pManager } from '../xp2pManager';
import { getRecordManager } from '@/pages/video/lib/recordManager';
import { WRITE_BLOCK_SIZE } from '@/constants';
import Toast from '@/wxcomponents/vant/toast/toast';
let xp2pManager = null;
const fileSystemManager = wx.getFileSystemManager();
const downloadManager = getRecordManager('downloads');
let downloadState = null;
export default {
  name: 'IpcReplay',
  data() {
    return {
      pageId: '[ipc-replay]',
      playerId: 'replayPlayer',
      playerRef: null,
      p2pMode: 'ipc',
      sceneType: 'playback',
      playerOptions: {
        needCheckStream: '',
        streamChannel: 0,
        muted: false,
        orientation: '',
        fill: false,
        playerLog: false,
        showDebugInfo: false,
      },
      validateDates: [],
      downloadFiles: [],
      recordVideoTip: '',
      recordVideos: [],
      onlyp2pMap: {
        flv: isDevTools(),
        mjpg: isDevTools(),
      },
      calendarMonth: `${dayjs().year()}-${String(dayjs().month() + 1).padStart(2, '0')}`,
      selectedDate: '',
      recordDialogOpen: false,
      videoStatus: {},
      videoInfo: null,
      currentVideo: null,
      playState: {
        currentTime: 0,
        isPlaying: false,
      },
      currentFile: null,
      downloadBytesStr: '',
      downloadSpeedStr: '',
    };
  },
  methods: {
    async onSeekVideo(value) {
      const { currentTime } = this.playState;
      const { duration } = this.currentVideo;
      let nextTime = currentTime + value;
      nextTime = Math.max(nextTime, 0);
      nextTime = Math.min(nextTime, duration);
      this.log('seekVideo', currentTime, nextTime);
      try {
        const res = await this.playerRef.seek(nextTime);
        this.log('seekVideo success', res);
      } catch (e) {
        this.log('seekVideo error', err);
      }
    },
    onChooseRecordClick() {
      if (!this.selectedDate) {
        return Toast('请先选择日期');
      }
      this.recordDialogOpen = true;
    },
    handleSelectedDate(date) {
      this.selectedDate = date;
      this.getRecordVideosInDate();
      this.getFilesInDate();
    },
    // 选中日期播放
    handlePickerConfirm(event) {
      const { value: video } = event.detail;
      const { startTime, endTime } = video;
      if (this.currentVideo === video) {
        return Toast('正在播放此录像');
      }
      this.currentVideo = video;
      // 当videoInfo变化时，播放器会自动感知并进行拉流
      this.videoInfo = {
        startTime,
        endTime,
      };
      this.handlePickerCancel();
    },
    handlePickerCancel() {
      this.recordDialogOpen = false;
    },
    async onStartPlayer() {
      const { deviceId, productId, deviceName, xp2pInfo } = this.deviceInfo;
      this.log('startP2PService start');
      try {
        const res = await xp2pManager.startP2PService({
          p2pMode: this.p2pMode,
          deviceInfo: {
            deviceId: deviceId,
            productId: productId,
            deviceName: deviceName,
          },
          xp2pInfo: xp2pInfo,
          caller: this.pageId,
        });
        this.log('startP2PService res', res);
        xp2pManager.addP2PServiceEventListener(deviceId, 'serviceStateChange', this.stateChangeHandler);
        xp2pManager.addP2PServiceEventListener(deviceId, 'feedbackFromDevice', this.feedbackFromDeviceHandler);
        this.getRecordDatesInMonth();
      } catch (err) {
        Toast(err?.errMsg);
        this.log('startP2PService err', err);
      }
    },
    // 录像数据
    async getRecordDatesInMonth() {
      this.log('getRecordDatesInMonth start');
      const { deviceId } = this.deviceInfo;
      try {
        const { date_list: dateList, month } = await xp2pManager.getRecordDatesInMonth(deviceId, {
          month: this.calendarMonth,
          channel: this.playerOptions.streamChannel,
        });
        this.validateDates = dateList.map(date => ({
          month,
          date: `${this.calendarMonth}-${String(date).padStart(2, '0')}`,
        }));
        this.log('getRecordDatesInMonth res', dateList);
      } catch (err) {
        this.error('getRecordDatesInMonth error', err);
        return;
      }
    },
    async getRecordVideosInDate() {
      const { deviceId } = this.deviceInfo;
      const { streamChannel } = this.playerOptions;
      try {
        const { video_list: videoList } = await xp2pManager.getRecordVideosInDate(deviceId, {
          date: this.selectedDate,
          channel: streamChannel,
        });
        this.log('获取录播列表成功', videoList);
        this.recordVideos = (videoList || []).map(item => ({
          date: this.selectedDate,
          startTime: item.start_time,
          endTime: item.end_time,
          text: `${dayjs(item.start_time * 1000).format('HH:mm:ss')}-${dayjs(item.end_time * 1000).format('HH:mm:ss')}`,
          duration: item.end_time - item.start_time,
        }));
      } catch (err) {
        this.error('demo: getRecordVideosInDate error', err);
        return;
      }
    },
    async getFilesInDate() {
      const { deviceId } = this.deviceInfo;
      const { streamChannel } = this.playerOptions;
      try {
        const { file_list: fileList } = await xp2pManager.getFilesInDate(deviceId, {
          date: this.selectedDate,
          channel: streamChannel,
        });
        this.downloadFiles = (fileList || []).map(item => ({
          date: this.selectedDate,
          timeStr: `${dayjs(item.start_time * 1000).format('HH:mm:ss')}-${dayjs(item.end_time * 1000).format(
            'HH:mm:ss',
          )}`,
          fileName: item.file_name,
          fileSize: item.file_size,
        }));
        this.log('获取下载文件列表成功', fileList);
      } catch (err) {
        this.log('获取下载文件列表失败', err);
      }
    },
    // ====================下载文件开始
    OnDownloadFile(file) {
      const { deviceId } = this.deviceInfo;
      if (file === this.currentFile) {
        return Toast('当前正在下载此文件');
      }
      this.currentFile = file;

      let fixedFilename = [deviceId, toDateTimeFilename(new Date(file.start_time * 1000)), file.fileName].join('-');
      const pos = fixedFilename.lastIndexOf('.');
      if (pos < 0) {
        fixedFilename = `${fixedFilename}.mp4`; // 默认mp4
      }
      this.log('prepareFile', fixedFilename);
      const filePath = downloadManager.prepareFile(fixedFilename);
      const fd = fileSystemManager.openSync({ filePath, flag: 'as+' });
      downloadState = {
        filePath,
        fd,
        timestamp: +new Date(),
        writeBytes: 0,
        downloadBytes: 0,
        chunkCount: 0,
        downloadSpeed: 0,
        status: null,
        headers: null,
        chunkCount: 0,
        downloadBytes: 0,
        blockInfo: null,
        writeBytes: 0,
        lastRefreshBytes: 0,
        lastRefreshTimestamp: 0,
        downloadSpeed: 0,
        refreshTimer: null,
        downloadResult: null,
        downloadSuccess: null,
        downloadDelay: 0,
        avgSpeed: 0,
      };
      xp2pManager.startDownloadFile(
        deviceId,
        { file_name: file.fileName },
        {
          onHeadersReceived: this.onDownloadHeadersReceived.bind(this),
          onChunkReceived: this.onDownloadChunkReceived.bind(this),
          onSuccess: this.onDownloadSuccess.bind(this),
          onFailure: this.onDownloadFailure.bind(this),
          onError: this.onDownloadError.bind(this),
        },
      );
    },
    onDownloadHeadersReceived({ status, headers }) {
      this.log('onDownloadHeadersReceived', { status, headers });
    },
    onDownloadChunkReceived(chunk) {
      // this.log('onDownloadChunkReceived 收到下载的chunk', chunk);
      downloadState.chunkCount++;
      downloadState.downloadBytes += chunk.byteLength;
      if (downloadState.chunkCount === 1) {
        this.log('onDownloadChunkReceived firstChunk', chunk.byteLength);
        // 第一个立刻刷新，这个方法里会启动refreshTimer
        this.refreshDownloadProgress();
      }
      if (downloadState.blockInfo?.blockBytes + chunk.byteLength > WRITE_BLOCK_SIZE) {
        // block写不下，把之前的写到文件里，这个方法里会清除blockInfo
        this.writeBlockToFile();
      }
      const writePos = downloadState.downloadBytes;
      if (!downloadState.blockInfo) {
        downloadState.blockInfo = {
          filePosition: writePos,
          blockBuffer: new Uint8Array(WRITE_BLOCK_SIZE),
          blockBytes: 0,
        };
      }
      downloadState.blockInfo.blockBuffer.set(new Uint8Array(chunk), downloadState.blockInfo.blockBytes);
      downloadState.blockInfo.blockBytes += chunk.byteLength;
    },
    refreshDownloadProgress() {
      if (!downloadState) {
        this.downloadBytesStr = '';
        this.downloadSpeedStr = '';
        return;
      }
      if (downloadState.refreshTimer) {
        clearTimeout(downloadState.refreshTimer);
        downloadState.refreshTimer = null;
      }
      if (downloadState.lastRefreshBytes) {
        const recv = downloadState.downloadBytes - downloadState.lastRefreshBytes;
        const delay = Date.now() - downloadState.lastRefreshTimestamp;
        downloadState.downloadSpeed = recv / delay / 1.024; // KB/s
      }
      downloadState.lastRefreshBytes = downloadState.downloadBytes;
      downloadState.lastRefreshTimestamp = Date.now();
      this.downloadBytesStr = String(downloadState.downloadBytes);
      this.downloadSpeedStr = `${downloadState.downloadSpeed.toFixed(2)} KB/s`;
      if (!downloadState.downloadResult) {
        downloadState.refreshTimer = setTimeout(this.refreshDownloadProgress.bind(this), 1000);
      }
    },
    writeBlockToFile() {
      if (!downloadState?.blockInfo) {
        return;
      }
      if (downloadState?.onlyDownload) {
        return;
      }
      const { blockInfo } = downloadState;
      downloadState.blockInfo = null;
      // 写入临时文件
      const writeState = downloadState;
      const that = this;
      fileSystemManager.write({
        fd: writeState.fd,
        data: blockInfo.blockBuffer.buffer,
        length: blockInfo.blockBytes,
        position: blockInfo.filePosition,
        encoding: 'binary',
        success: ({ bytesWritten }) => {
          if (!that.currentFile || downloadState !== writeState) {
            return;
          }
          if (bytesWritten === blockInfo.blockBytes) {
            downloadState.writeBytes += bytesWritten;
            if (downloadState.downloadSuccess && downloadState.writeBytes >= downloadState.downloadBytes) {
              that.doDownloadComplete();
            }
          } else {
            that.error('fileSystemManager.write success but bytesWritten error', blockInfo.blockBytes, res);
            that.stopDownloadFile();
            wx.showModal({
              title: '下载失败',
              content: `${that.currentFile.fileName}\n${downloadState.downloadBytes}/${that.currentFile.fileSize}\n写入文件失败`,
              showCancel: false,
            });
          }
        },
        fail: err => {
          if (!this.currentFile || downloadState !== writeState) {
            return;
          }
          const that = this;
          this.error('fileSystemManager.write fail', err);
          this.stopDownloadFile();
          wx.showModal({
            title: '下载失败',
            content: `${that.currentFile.fileName}\n${downloadState.downloadBytes}/${currentFile.file_size}\n写入文件失败`,
            showCancel: false,
          });
        },
      });
    },

    stopDownloadFile() {
      const { deviceId } = this.deviceInfo;
      if (!this.currentFile) {
        return;
      }
      this.log('stopDownloadFile');
      this.clearDownloadData();
      xp2pManager.stopDownloadFile(deviceId);
    },
    clearDownloadData() {
      if (downloadState.refreshTimer) {
        clearTimeout(downloadState.refreshTimer);
        downloadState.refreshTimer = null;
      }
      if (downloadState.fd) {
        fileSystemManager.closeSync({ fd: downloadState.fd });
        downloadState.fd = null;
      }
      this.currentFile = null;
      downloadState = null;
      this.downloadBytesStr = '';
      this.downloadSpeedStr = '';
    },

    onDownloadSuccess(res) {
      this.log('onDownloadSuccess 下载成功', res);
      this.checkDownloadComplete(res, true);
    },
    onDownloadFailure(res) {
      this.log('onDownloadFailure 下载出现错误', res);
      this.checkDownloadComplete(res);
    },
    onDownloadError(res) {
      this.log('onDownloadError 下载失败', res);
      this.checkDownloadComplete(res);
    },
    checkDownloadComplete(res, isSuccess) {
      if (!this.currentFile) return;

      downloadState.downloadResult = res;
      downloadState.downloadSuccess = isSuccess || false;
      this.refreshDownloadProgress();
      const delay = Date.now() - downloadState.timestamp;
      let avgSpeed;
      if (delay >= 100) {
        avgSpeed = downloadState.downloadBytes / delay / 1.024; // KB/s
      }
      downloadState.downloadDelay = delay;
      downloadState.avgSpeed = avgSpeed;

      // 剩下的block也要写入临时文件
      if (downloadState.blockInfo) {
        this.writeBlockToFile();
      }

      // 记录下载结果
      if (downloadState.downloadSuccess && downloadState.writeBytes < downloadState.downloadBytes) {
        // 下载成功但写入还未完成，等待写入结果
        this.log(`下载成功, 等待写入完成 ${downloadState.writeBytes}/${downloadState.downloadBytes}`);
        return;
      }

      // 真正结束
      this.doDownloadComplete();
    },
    doDownloadComplete() {
      if (!this.currentFile) {
        return;
      }
      const { currentFile } = this;
      this.log('doDownloadComplete', {
        currentFile,
        downloadState,
      });
      const { downloadSuccess, downloadResult, downloadBytes, writeBytes, avgSpeed } = downloadState;
      wx.showModal({
        title: downloadSuccess && writeBytes >= downloadBytes ? '下载成功' : '下载失败',
        content: [
          currentFile.fileName,
          `download: ${downloadBytes}/${currentFile.fileSize}`,
          `write: ${writeBytes}/${downloadBytes}`,
          `avgSpeed: ${avgSpeed ? avgSpeed.toFixed(2) : '-'} KB/s`,
          `status: ${downloadResult?.status}, errcode: ${downloadResult?.errcode}, errmsg: ${downloadResult?.errmsg}`,
        ].join('\n'),
        showCancel: false,
      });
      this.clearDownloadData();
    },
    // ====================下载文件结束
    onTimeUpdate({ detail }) {
      this.log('onTimeUpdate', detail);
      this.playState.currentTime = detail.currentTime;
    },
    onPlayStateEvent(e) {
      this.log('onPlayStateEvent', e);
    },
    onPlaySuccess(e) {
      this.log('onPlaySuccess', e);
    },
    onRecordStateChange(e) {
      this.log('onRecordStateChange', e);
    },
    onPlayerEvent(e) {
      this.log('onPlayerEvent', e);
    },
    onRecordFileStateChange(e) {
      this.log('onRecordFileStateChange', e);
    },
    stateChangeHandler(detail) {
      this.log('serviceStateChange', detail);
    },
    feedbackFromDeviceHandler(detail) {
      this.log('feedbackFromDevice', detail);
    },
  },
  mounted() {
    xp2pManager = getXp2pManager();
    this.onStartPlayer();
    const page = getCurrentPages().pop();
    this.playerRef = page.selectComponent(`#${this.playerId}`);
    this.log('获取播放器实例 结果 ->', this.playerRef);
  },
  beforeDestroy() {
    const { deviceId } = this.deviceInfo;
    xp2pManager.removeP2PServiceEventListener(deviceId, 'serviceStateChange', this.stateChangeHandler);
    xp2pManager.removeP2PServiceEventListener(deviceId, 'feedbackFromDevice', this.feedbackFromDeviceHandler);
    xp2pManager.stopP2PService(deviceId, this.pageId);
  },
  computed: {
    ...mapState(['rawDeviceInfo']),
    deviceInfo() {
      return {
        ...this.rawDeviceInfo,
        isMjpgDevice: this.rawDeviceInfo.xp2pInfo.endsWith('m'),
      };
    },
  },
};
</script>
<style lang="scss">
/* 覆盖组件的 wxss */
.my-player {
  height: 200px;
}
/* 3.2.2 之后这么覆盖，注意给组件加class属性 */
.my-player .iot-player {
  width: 100%;
  height: 200px;
  background-color: #000;
}

.intercom-call-player.full .iot-player,
.my-player.full .iot-player {
  height: 100vh;
}
.replay-wrap {
  .button-group {
    display: flex;
    padding-top: 10px;
    .van-button {
      margin-right: 10px;
    }
  }
  .sub-title {
    color: #666;
    font-size: 18px;
  }
  .file-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    height: 30px;
    margin-bottom: 8px;
    &:last-child {
      margin-bottom: 0;
    }
    .file-item-button {
      &:not(last-child) {
        margin-right: 10px;
      }
    }
  }
}
</style>

/* eslint-disable camelcase, @typescript-eslint/naming-convention */
export const commandMap = {
  getLiveStatus: {
    cmd: 'get_device_st',
    params: {
      type: 'live',
      quality: 'super',
    },
  },
  getVoiceStatus: {
    cmd: 'get_device_st',
    params: {
      type: 'voice',
    },
  },
  getRecordDates: {
    cmd: 'get_month_record',
    params: (date) => {
      const year = date.getFullYear();
      let month = String(date.getMonth() + 1);
      if (month.length < 2) {
        month = `0${month}`;
      }
      return { time: `${year}${month}` }; // yyyymm
    },
    dataHandler: (oriData) => {
      const dates = [];
      const tmpList = parseInt(oriData.video_list, 10).toString(2).split('').reverse();
      const tmpLen = tmpList.length;
      for (let i = 0; i < tmpLen; i++) {
        if (tmpList[i] === '1') {
          dates.push(i + 1);
        }
      }
      return dates;
    },
  },
  getRecordVideos: {
    cmd: 'get_record_index',
    params: (date) => {
      const startDate = new Date(date);
      startDate.setHours(0, 0, 0, 0);
      const start_time = startDate.getTime() / 1000;
      const end_time = start_time + 3600 * 24 - 1;
      return { start_time, end_time };
    },
  },
  getVideoList: {
    cmd: 'get_file_list',
    params: (date) => {
      const startDate = new Date(date);
      startDate.setHours(0, 0, 0, 0);
      const start_time = startDate.getTime() / 1000;
      const end_time = start_time + 3600 * 24 - 1;
      // file_type: '0'-视频，'1'-图片
      return { start_time, end_time, file_type: '0' };
    },
  },
  getPlaybackStatus: {
    cmd: 'get_device_st',
    params: {
      type: 'playback',
    },
  },
  getPlaybackProgress: {
    cmd: 'playback_progress',
  },
  pausePlayback: {
    cmd: 'playback_pause',
  },
  resumePlayback: {
    cmd: 'playback_resume',
  },
};

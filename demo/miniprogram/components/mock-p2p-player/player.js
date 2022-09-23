Component({
  behaviors: ['wx://component-export'],
  properties: {
    type: {
      type: String,
      value: 'livePlayer', // livePlayer, mjpgPlayer
    },
  },
  data: {
    hasCtx: false,
    totalBytes: 0, // 仅显示用，计算用 this.userData.totalBytes
  },
  lifetimes: {
    created() {
      // 渲染无关，不放在data里，以免影响性能
      this.userData = {
        isDetached: false,
        ctx: null,
        chunkCount: 0,
        totalBytes: 0,
      };
    },
    attached() {},
    ready() {
      this.prepare();
    },
    detached() {
      this.userData.isDetached = true;
      this.clearStreamData();
      if (this.userData?.ctx?.isPlaying) {
        this.userData.ctx.stop();
      }
    },
    error() {},
  },
  methods: {
    prepare() {
      // 构造ctx
      const livePlayerContext = {
        isPlaying: false, // play/stop 用
        isPaused: false, // pause/resume 用
        play: ({ success, fail, complete } = {}) => {
          if (livePlayerContext.isPlaying) {
            fail && fail({ errMsg: 'already playing' });
            complete && complete();
            return;
          }
          this.clearStreamData();
          livePlayerContext.isPlaying = true;
          // livePlayerContext.isPaused = false;
          setTimeout(() => {
            success && success();
            complete && complete();
            !livePlayerContext.isPaused && this.triggerEvent('playerStartPull', {});
          }, 0);
        },
        stop: ({ success, fail, complete } = {}) => {
          if (!livePlayerContext.isPlaying) {
            fail && fail({ errMsg: 'not playing' });
            complete && complete();
            return;
          }
          this.clearStreamData();
          livePlayerContext.isPlaying = false;
          // livePlayerContext.isPaused = false;
          // 这个是立刻调用的
          this.triggerEvent('playerClose', { error: { code: 'USER_CLOSE' } });
          setTimeout(() => {
            success && success();
            complete && complete();
          }, 0);
        },
        pause: ({ success, fail, complete } = {}) => {
          if (!livePlayerContext.isPlaying) {
            fail && fail({ errMsg: 'not playing' });
            complete && complete();
            return;
          }
          if (livePlayerContext.isPaused) {
            fail && fail({ errMsg: 'already paused' });
            complete && complete();
            return;
          }
          this.clearStreamData();
          livePlayerContext.isPaused = true;
          setTimeout(() => {
            success && success();
            complete && complete();
            this.triggerEvent('playerClose', { error: { code: 'LIVE_PLAYER_CLOSED' } });
          }, 0);
        },
        resume: ({ success, fail, complete } = {}) => {
          if (!livePlayerContext.isPlaying) {
            fail && fail({ errMsg: 'not playing' });
            complete && complete();
            return;
          }
          if (!livePlayerContext.isPaused) {
            fail && fail({ errMsg: 'not paused' });
            complete && complete();
            return;
          }
          this.clearStreamData();
          livePlayerContext.isPaused = false;
          setTimeout(() => {
            success && success();
            complete && complete();
            this.triggerEvent('playerStartPull', {});
          }, 0);
        },
        // eslint-disable-next-line no-unused-vars, @typescript-eslint/no-unused-vars
        snapshot: ({ success, fail, complete } = {}) => {
          setTimeout(() => {
            fail && fail({ errMsg: 'mock-player not support snapshot' });
            complete && complete();
          }, 0);
        },
      };

      this.userData.ctx = livePlayerContext;
      this.setData({
        hasCtx: true,
      });

      setTimeout(() => {
        if (this.userData.isDetached) {
          return;
        }
        const fieldName = `${this.properties.type}Context`;
        this.triggerEvent('playerReady', {
          msg: 'mockPlayer',
          [fieldName]: livePlayerContext,
          playerExport: {
            setHeaders: this.setHeaders.bind(this),
            addChunk: this.addChunk.bind(this),
            // finishMedia: this.finishMedia.bind(this),
            // abortMedia: this.abortMedia.bind(this),
          },
        });
      }, 10);
    },
    setHeaders(_headers) {},
    addChunk(data) {
      this.userData.chunkCount++;
      this.userData.totalBytes += data.byteLength;
      if (this.userData.chunkCount === 1) {
        this.setData({
          totalBytes: this.userData.totalBytes, // 第一个立刻刷新
        });
      }
      // 控制刷新频率
      this.refreshBytesDelay();
    },
    refreshBytesDelay() {
      if (this.refreshTimer) {
        return;
      }
      this.refreshTimer = setTimeout(() => {
        this.refreshTimer = null;
        this.setData({
          totalBytes: this.userData?.totalBytes || 0, // 把数据更新到界面
        });
      }, 1000);
    },
    clearStreamData() {
      if (this.refreshTimer) {
        clearTimeout(this.refreshTimer);
        this.refreshTimer = null;
      }
      if (this.userData) {
        this.userData.chunkCount = 0;
        this.userData.totalBytes = 0;
      }
      this.setData({
        totalBytes: 0,
      });
    },
  },
});

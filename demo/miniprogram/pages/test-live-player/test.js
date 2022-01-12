Page({
  data: {
    // inputSrc: 'https://iot-public-1256872341.cos.ap-guangzhou.myqcloud.com/hazelchen/test.flv',
    inputSrc: 'https://dev.ad.qvb.qcloud.com/openlive/6e0b2be040a943489ef0b9bb344b96b8.hd.flv',
    src: '',
    ctx: null,
    orientation: 'vertical',
    stateMsg: '',
    errMsg: '',
    isPlayerError: false,
    isSnapshoting: false,
  },
  onReady() {
    this.setData({
      ctx: wx.createLivePlayerContext('player'),
    });
  },
  onLivePlayerStateChange(e) {
    console.log('live-player statechange:', e.detail.code, e.detail);
    this.setData({
      stateMsg: `${e.detail.code} ${e.detail.message}`,
    });
    if (e.detail.code === -2301) {
      this.setData({
        errMsg: e.detail.message,
      });
    }
  },
  onLivePlayerError(e) {
    console.error('live-player error:', e.detail);
    this.setData({
      isPlayerError: true,
      errMsg: e.detail.errMsg,
    });
    this.data.ctx.stop();
  },
  bindInputSrc(e) {
    this.setData({
      inputSrc: e.detail.value,
    });
  },
  bindSetSrc() {
    this.setData({
      src: this.data.inputSrc,
      stateMsg: '',
      errMsg: '',
    });
  },
  bindClearSrc() {
    this.data.ctx.stop();
    this.setData({
      src: '',
      stateMsg: '',
      errMsg: '',
    });
  },
  bindPlay() {
    this.data.ctx.play({
      success: () => {
        console.log('play success');
      },
      fail: (err) => {
        console.log('play fail', err);
        this.setData({
          errMsg: err.errMsg,
        });
      },
    });
  },
  bindPause() {
    this.data.ctx.pause({
      success: () => {
        console.log('pause success');
      },
      fail: (err) => {
        console.log('pause fail', err);
      },
    });
  },
  bindResume() {
    this.data.ctx.resume({
      success: () => {
        console.log('resume success');
      },
      fail: (err) => {
        console.log('resume fail', err);
      },
    });
  },
  bindStop() {
    this.data.ctx.stop({
      success: () => {
        console.log('stop success');
      },
      fail: (err) => {
        console.log('stop fail', err);
      },
    });
  },
  bindSnapshot() {
    wx.authorize({
      scope: 'scope.writePhotosAlbum',
      success: () => {
        console.log('authorize success');

        if (this.data.isSnapshoting) {
          console.log('isSnapshoting');
          return;
        }

        this.setData({ isSnapshoting: true });
        let timer = setTimeout(() => {
          if (!this.data.isSnapshoting) {
            return;
          }
          console.log('snapshot timeout');
          this.setData({ isSnapshoting: false });
          clearTimeout(timer);
          timer = null;
          wx.hideLoading();
          wx.showToast({
            title: '拍照超时',
            icon: 'error',
          });
        }, 5000);
        wx.showLoading({
          title: '拍照中',
        });

        console.log('do snapshot');
        this.data.ctx.snapshot({
          quality: 'raw',
          success: (snapshotRes) => {
            console.log('snapshot success', snapshotRes);
            if (snapshotRes.tempImagePath) {
              console.log('do saveImageToPhotosAlbum');
              wx.saveImageToPhotosAlbum({
                filePath: snapshotRes.tempImagePath,
                success: (saveRes) => {
                  console.log('saveImageToPhotosAlbum success', saveRes);
                  this.setData({ isSnapshoting: false });
                  clearTimeout(timer);
                  timer = null;
                  wx.hideLoading();
                  wx.showToast({
                    title: '已保存至相册',
                    icon: 'success',
                  });
                },
                fail: (err) => {
                  console.log('saveImageToPhotosAlbum fail', err);
                  this.setData({ isSnapshoting: false });
                  clearTimeout(timer);
                  timer = null;
                  wx.hideLoading();
                  wx.showToast({
                    title: err.errMsg.indexOf('auth deny') ? '请授权小程序访问相册' : '保存失败',
                    icon: 'error',
                  });
                },
              });
            } else {
              this.setData({ isSnapshoting: false });
              clearTimeout(timer);
              timer = null;
              wx.hideLoading();
              wx.showToast({
                title: '拍照失败',
                icon: 'error',
              });
            }
          },
          fail: (err) => {
            console.log('snapshot fail', err);
            this.setData({ isSnapshoting: false });
            clearTimeout(timer);
            timer = null;
            wx.hideLoading();
            wx.showToast({
              title: '拍照失败',
              icon: 'error',
            });
          },
        });
      },
      fail: (err) => {
        console.log('authorize fail', err);
        wx.showModal({
          title: '',
          content: '拍照需要您授权小程序访问相册',
          confirmText: '去授权',
          success: ({ confirm }) => {
            if (confirm) {
              wx.openSetting();
            }
          },
          fail: () => {
            wx.showToast({
              title: '请授权小程序访问相册',
              icon: 'error',
            });
          },
        });
      },
    });
  },
  bindChangeOrientation() {
    this.setData({
      orientation: this.data.orientation === 'vertical' ? 'horizontal' : 'vertical',
    });
  },
});

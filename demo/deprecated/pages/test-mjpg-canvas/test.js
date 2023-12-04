const fileSystem = wx.getFileSystemManager();

Page({
  data: {
    ctxReady: false,
    frameNum: 0,
    isPlaying: false,
  },
  onLoad() {
    // 渲染无关的尽量放这里
    this.userData = {
      // 解析出来的帧列表
      frames: [],

      // 切换img用的
      imgIndex: -1,
      timer: null,

      // 循环render用的
      renderCount: 0,
      renderLogTime: 0,
    };

    // 通过 SelectorQuery 获取 Canvas 节点
    wx.createSelectorQuery()
      .select('#canvas')
      .fields({
        node: true,
        size: true,
      })
      .exec(this.init.bind(this));
  },
  onUnload() {
    this.stop();
  },
  init(res) {
    const canvas = res[0].node;
    const width = res[0].width;
    const height = res[0].height;
    const dpr = wx.getSystemInfoSync().pixelRatio;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    console.log('canvas', res[0], dpr, canvas.width, canvas.height);

    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);

    const img = canvas.createImage();

    Object.assign(this.userData, {
      canvas,
      dpr,
      ctx,
      img,
    });
    this.setData({ ctxReady: true });
  },
  onImageLoad() {
    if (this.userData.img.state !== 'loading') {
      return;
    }
    // console.log('onImageLoad', this.userData.imgIndex, this.userData.img.width, this.userData.img.height);
    this.userData.img.state = 'loaded';
    this.render();
  },
  onImageError() {
    if (this.userData.img.state !== 'loading') {
      return;
    }
    console.error('onImageError', this.userData.imgIndex);
    this.userData.img.state = 'error';
  },
  async chooseImages() {
    // 先停掉
    this.stop();

    let files;
    try {
      const res = await wx.chooseMedia({
        count: 9, // 最多就是9
        mediaType: ['image'],
        sourceType: ['album'],
      });
      files = res.tempFiles;
      console.log('chooseMedia success', files);
    } catch (err) {
      console.error('chooseMedia fail', err);
      return;
    }

    // 这个是追加
    this.userData.frames = this.userData.frames.concat(files);
    this.setData({
      frameNum: this.userData.frames.length,
    });
    console.log('chooseImages success, now', this.userData.frames.length);
  },
  async chooseFile() {
    // 先停掉
    this.stop();

    // 文件里包括多个帧，清理之前的images
    this.clearImages();

    let file;
    try {
      const res = await wx.chooseMessageFile({ count: 1 });
      file = res.tempFiles[0];
      console.log('chooseMessageFile success', file);
    } catch (err) {
      console.error('chooseMessageFile fail', err);
      return;
    }

    const buffer = fileSystem.readFileSync(file.path);
    const totalBase64 = wx.arrayBufferToBase64(buffer);
    if (!/^\/9j/.test(totalBase64)) {
      // 不是jpeg的base64
      console.error('invalid mjpg file');
      return;
    }

    const tempArr = totalBase64.split('/9j');
    tempArr.shift(); // 第一个是空字符串

    const frames = tempArr.map(str => ({
      base64: `data:image/jpeg;base64,/9j${str}`,
    }));
    this.userData.frames = frames;
    this.setData({
      srcType: 'base64',
      frameNum: this.userData.frames.length,
    });
    console.log('chooseFile success, now', this.userData.frames.length);
  },
  loadAllBase64() {
    if (!this.userData.frames) {
      return;
    }
    this.userData.frames.forEach((file) => {
      if (file.base64 || !file.tempFilePath) {
        return;
      }
      const res = fileSystem.readFileSync(file.tempFilePath);
      file.base64 = `data:image/jpeg;base64,${wx.arrayBufferToBase64(res)}`;
    });
  },
  clearImages() {
    // 先停掉
    this.stop();

    this.userData.frames = [];
    this.setData({
      srcType: '',
      frameNum: 0,
    });
  },
  clearTimer() {
    if (this.userData?.timer) {
      clearInterval(this.userData.timer);
      this.userData.timer = null;
    }
  },
  clearRenderData() {
    if (this.userData?.img?.state) {
      this.userData.img.state = '';
      delete this.userData.img.onload;
      delete this.userData.img.onerror;
      this.userData.img.src = '';
    }
    this.userData.renderCount = 0;
    this.userData.renderLogTime = 0;
  },
  changeImgIndex(index) {
    if (index === this.userData.imgIndex) {
      return;
    }
    this.userData.imgIndex = index;
    this.userData.img.state = 'loading';
    if (this.userData.srcType === 'filepath') {
      this.userData.img.src = this.userData.frames[index].tempFilePath;
    } else {
      this.userData.img.src = this.userData.frames[index].base64;
    }
  },
  render() {
    if (this.userData?.img?.state !== 'loaded') {
      return;
    }
    this.userData.renderCount++;

    const { canvas, dpr, ctx, img } = this.userData;
    const imgWidth = img.width * dpr;
    const imgHeight = img.height * dpr;
    const scaleX = canvas.width / imgWidth;
    const scaleY = canvas.height / imgHeight;
    const scale = Math.min(scaleX, scaleY);
    const showWidth = imgWidth * scale;
    const showHeight = imgHeight * scale;
    const x = (canvas.width - showWidth) / 2 / dpr;
    const y = (canvas.height - showHeight) / 2 / dpr;

    const now = Date.now();
    const needLog = now - this.userData.renderLogTime >= 1000;
    if (needLog) {
      this.userData.renderLogTime = now;
      console.log(
        'drawImage',
        `image ${this.userData.imgIndex}`,
        `renderCount ${this.userData.renderCount}`,
        0, 0, imgWidth, imgHeight, x, y, showWidth, showHeight,
      );
    }
    ctx.drawImage(
      img,
      0, 0, imgWidth, imgHeight,
      x, y, showWidth, showHeight,
    );
  },
  play({ currentTarget }) {
    if (this.data.isPlaying || !this.userData.frames?.length) {
      return;
    }

    this.clearTimer();
    this.clearRenderData();

    this.setData({
      isPlaying: true,
    });

    this.userData.srcType = currentTarget.dataset.srcType || 'base64';
    if (this.userData.srcType === 'base64') {
      this.loadAllBase64();
    }
    this.userData.img.onload = this.onImageLoad.bind(this);
    this.userData.img.onerror = this.onImageError.bind(this);
    this.changeImgIndex(0);

    const total = this.userData.frames.length;
    this.userData.timer = setInterval(() => {
      if (this.userData.img.state === 'loading') {
        return;
      }
      const index = (this.userData.imgIndex + 1) % total;
      this.changeImgIndex(index);
    }, 50);
  },
  stop() {
    if (!this.data.isPlaying) {
      return;
    }

    this.clearTimer();
    this.clearRenderData();

    this.setData({
      isPlaying: false,
    });
  },
});

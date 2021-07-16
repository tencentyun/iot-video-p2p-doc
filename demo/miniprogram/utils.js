exports.getErrorMsg = function getErrorMsg(err, { defaultMsg = '', errMsgKey = 'msg' } = {}) {
  console.log(err, err.stack);

  const errorMsg = (() => {
    if (!err) return;
    let message = '';

    if (typeof err === 'string') return err;

    if (typeof err === 'object') {
      message = err[errMsgKey] || err.Message || err.msg || err.message || err.errMsg || '连接服务器失败，请稍后再试';
    }

    if (!message) {
      message = defaultMsg || '连接服务器失败，请稍后再试';
    }

    return message;
  })();

  return errorMsg;
};

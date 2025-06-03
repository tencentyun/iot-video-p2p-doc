// 信令结构
class CommandCommand {
  constructor(params) {
    const { action = '', channel = '', cmd = '', type = '' } = params
    this.action = action
    this.channel = channel
    this.cmd = cmd
    this.type = type
  }
}
class InnerCommand extends CommandCommand {
  constructor() {
    super({
      action: "inner_define"
    })
  }
}
class UserCommand extends CommandCommand {
  constructor() {
    super({
      action: "user_define"
    })
  }
}

export const CMD_ENUM = {
  call_hang_up: "call_hang_up",
  call_cancel: "call_cancel",
  call_answer: "call_answer",
  recv_stop: 'recv_stop',
  get_nvr_list: "get_nvr_list",

}
export const parseExtraParams = (extraParams) => {
  if (!extraParams) return ''
  let res = null
  try {
    res = JSON.parse(extraParams)
  } catch (e) {
    console.log("parseExtraParams error", e)
  }
  return `${revertObjToStr(res)}&`
}
export const revertObjToStr = (obj) => {
  if (!obj) return ''
  const keysArr = Object.keys(obj)
  return keysArr.reduce((accu, cur, idx) => {
    const value = obj[cur]

    if (cur === 'extraParams') {
      accu += `${parseExtraParams(value)}`
    } else {
      accu += `${cur}=${value}&`
    }
    // 最后一项去掉 &
    if (idx === keysArr.length - 1) {
      accu = accu.substring(0, accu.length - 1)
    }
    return accu
  }, '')
}
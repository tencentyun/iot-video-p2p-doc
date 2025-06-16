import { getRandomId, getClientToken, splitByFirstUnderscore } from "../../utils/index"
const pagePrefix = "[voip-call]"
const wmpfVoip = requirePlugin("wmpf-voip").default
wmpfVoip.setVoipEndPagePath({
	url: "/pages/index/index",
	options: "voip-call-end=1",
	key: "Call",
	routeType: "switchTab",
})
wmpfVoip.onVoipEvent(event => {
	console.info(pagePrefix, "onVoipEvent", event)
	if (event.eventName === "rejectVoip") {
		console.info(pagePrefix, "通话被拒接了", event)
	} else if (event.eventName === "busy") {
		console.info(pagePrefix, "设备端繁忙", event)
	}
})

wx.cloud.init({
	env: "cloud1-9gy10gzb2687fd99",
})
Page({
	data: {
		form: {
			appKey: "",
			appSecret: "",
			sn: "",
			modelId: "",
			callType: "video",
			isCalling: false,
		},
	},
	onInput(e) {
		const { target, detail } = e
		this.setData({
			form: {
				...this.data.form,
				[target.dataset.name]: detail.value,
			},
		})
	},
	onClear(e) {
		const { target } = e
		this.setData({
			form: {
				...this.data.form,
				[target.dataset.name]: "",
			},
		})
	},
	onCallTypeChange(e) {
		const { detail } = e
		this.setData({
			form: {
				...this.data.form,
				callType: detail.key,
			},
		})
	},
	async onSubmit() {
		const { appKey, appSecret, sn, callType, modelId } = this.data.form
		if (this.data.isCalling) {
			this.setData({ isCalling: false })
			wmpfVoip.forceHangUpVoip()
			return
		}
		console.log(pagePrefix, "onSubmit=> form", this.data.form)
		try {
			this.setData({ isCalling: true })
			const res = await wx.cloud.callFunction({
				name: "getAccessToken",
				data: {
					appKey,
					appSecret,
				},
			})
			const token = res.result.token
			console.log(pagePrefix, "调用云函数getAccessToken成功 token =>", token)
			const callDeviceParams = {
				roomType: callType,
				sn,
				modelId,
				isCloud: true,
				payload: "{}",
				nickName: "jin的手机",
				encodeVideoFixedLength: 320,
				encodeVideoRotation: 1,
				encodeVideoRatio: 0,
				encodeVideoMaxFPS: 15,
			}
			console.log("开始呼叫callDevice params=>", callDeviceParams)
			const { roomId } = await wmpfVoip.callDevice(callDeviceParams)
			console.log(pagePrefix, "调用voip通话成功 roomId =>", roomId)
			const [productId, deviceName] = splitByFirstUnderscore(sn)
			const params = {
				AccessToken: token,
				RequestId: getRandomId(),
				Action: "AppPublishMessage",
				ProductId: productId,
				DeviceName: deviceName,
				Topic: `$twecall/down/service/${productId}/${deviceName}`,
				Payload: JSON.stringify({
					version: "1.0",
					method: "voip_join",
					clientToken: getClientToken(),
					timestamp: Math.floor(Date.now() / 1000),
					params: {
						roomId,
					},
				}),
			}
			wx.request({
				method: "POST",
				url: "https://iot.cloud.tencent.com/api/exploreropen/tokenapi",
				data: params,
				success(res) {
					console.log(pagePrefix, "调用AppPublishMessage成功", res)
					wx.redirectTo({
						url: wmpfVoip.CALL_PAGE_PATH,
					})
				},
				fail(err) {
					console.log(pagePrefix, "调用AppPublishMessage失败", err)
				},
			})
		} catch (err) {
			console.log(pagePrefix, "调用云函数getAccessToken失败", err)
		} finally {
			this.setData({ isCalling: false })
		}
	},
	onLoad() {
		console.log(pagePrefix, "onLoad call")
	},
	onUnload() {
		console.log(pagePrefix, "onUnload call")
	},
})

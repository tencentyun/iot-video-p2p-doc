let xp2pManager = null
export const getXp2pManager = () => {
  if (xp2pManager) {
    return xp2pManager
  }
  const xp2p = requirePlugin("xp2p")
  console.log("引入Xp2p插件成功 =>", xp2p)
  // xp2p.p2p.setTcpFirst(true)
  // xp2p.p2p.setCrossStunTurn(true)
  // xp2p.p2p.setUseDeliveryConfig(true)
  xp2pManager = xp2p.iot.getXp2pManager()
  return xp2pManager
}
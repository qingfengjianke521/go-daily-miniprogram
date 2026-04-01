App({
  globalData: {
    userInfo: null,
    openid: '',
    playState: null,
    resultState: null,
    summaryState: null,
    statusBarHeight: 0,
    navBarHeight: 44,
  },
  onLaunch() {
    // Get system info for custom nav bar
    const sysInfo = wx.getWindowInfo()
    this.globalData.statusBarHeight = sysInfo.statusBarHeight || 20
    this.globalData.navBarHeight = 44

    // Init cloud
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力')
    } else {
      wx.cloud.init({
        env: 'cloud1-2gna4pn73d7fe81e',
        traceUser: true,
      })
    }
  },
  checkAuth() {
    const userInfo = wx.getStorageSync('userInfo')
    if (!userInfo || !userInfo.openid) {
      wx.redirectTo({ url: '/pages/login/index' })
      return false
    }
    this.globalData.userInfo = userInfo
    this.globalData.openid = userInfo.openid
    return true
  }
})

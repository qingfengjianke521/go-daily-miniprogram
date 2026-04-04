var storage = require('../../utils/storage')

Page({
  data: {
    loading: false,
    error: '',
    statusBarHeight: 20,
    navBarHeight: 44,
  },

  onLoad: function () {
    var app = getApp()
    this.setData({
      statusBarHeight: app.globalData.statusBarHeight,
      navBarHeight: app.globalData.navBarHeight,
    })

    // Auto-check if already logged in
    var userInfo = storage.getUserInfo()
    if (userInfo && userInfo.openid) {
      console.log('[login] Already logged in, navigating...')
      if (!userInfo.level_set) {
        wx.redirectTo({ url: '/pages/level-select/index' })
      } else {
        wx.switchTab({ url: '/pages/index/index' })
      }
    }
  },

  handleStart: function () {
    var that = this
    if (that.data.loading) return

    that.setData({ loading: true, error: '' })

    // 先尝试获取微信昵称
    var wxNickname = ''
    try {
      wx.getUserProfile({
        desc: '用于显示你的围棋昵称',
        success: function (profileRes) {
          wxNickname = profileRes.userInfo.nickName || ''
          that._doLogin(wxNickname)
        },
        fail: function () {
          // 用户拒绝授权，用默认名
          that._doLogin('')
        }
      })
    } catch (e) {
      // 旧版本不支持 getUserProfile
      that._doLogin('')
    }
  },

  _doLogin: function (wxNickname) {
    var that = this

    wx.cloud.callFunction({
      name: 'goDaily',
      data: { action: 'initUser', wx_nickname: wxNickname },
      success: function (res) {
        console.log('[login] Full result:', JSON.stringify(res.result))

        if (!res.result) {
          that.setData({ loading: false, error: '云函数返回为空' })
          return
        }

        if (res.result.error) {
          that.setData({ loading: false, error: res.result.error })
          return
        }

        var user = res.result.user
        if (!user) {
          console.error('[login] No user in result:', res.result)
          that.setData({ loading: false, error: '未获取到用户数据' })
          return
        }

        console.log('[login] User:', JSON.stringify(user))

        // Save user info
        var userInfo = {
          openid: user.openid || 'unknown',
          username: user.username || '',
          rating: user.rating || 1200,
          level_name: user.level_name || '18级',
          level_set: !!user.level_set,
        }
        storage.setUserInfo(userInfo)
        console.log('[login] Saved userInfo:', JSON.stringify(userInfo))

        var app = getApp()
        app.globalData.userInfo = userInfo
        app.globalData.openid = userInfo.openid

        that.setData({ loading: false })

        if (!userInfo.level_set) {
          console.log('[login] Navigating to level-select...')
          wx.redirectTo({
            url: '/pages/level-select/index',
            success: function() { console.log('[login] Navigate to level-select OK') },
            fail: function(err) { console.error('[login] Navigate to level-select FAILED:', err) },
          })
        } else {
          console.log('[login] Navigating to home...')
          wx.switchTab({
            url: '/pages/index/index',
            success: function() { console.log('[login] Navigate to home OK') },
            fail: function(err) { console.error('[login] Navigate to home FAILED:', err) },
          })
        }
      },
      fail: function (err) {
        console.error('[login] Cloud call failed:', err)
        that.setData({
          loading: false,
          error: '云函数调用失败: ' + (err.errMsg || '未知错误'),
        })
      },
    })
  },
})

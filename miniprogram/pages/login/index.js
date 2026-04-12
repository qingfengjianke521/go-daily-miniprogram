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

    // getUserProfile 已废弃，直接用随机围棋昵称
    var names = ['执黑少年','白石飞侠','围棋小将','弈海棋童','落子无悔',
      '黑白使者','星位守护','天元侠客','手筋达人','死活高手',
      '棋海拾贝','妙手回春','定式达人','官子精灵','布局大师']
    var nickname = names[Math.floor(Math.random() * names.length)]
    that._doLogin(nickname)
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
          rating: user.rating || 520,
          level_name: user.level_name || '7K',
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

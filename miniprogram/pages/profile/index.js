var apiModule = require('../../utils/api')
var api = apiModule.api
var storage = require('../../utils/storage')

function getLevelColor(name) {
  if (!name) return '#CCCCCC'
  if (name.indexOf('段') !== -1) return '#FFB300'
  var n = parseInt(name)
  if (n <= 9) return '#9E9E9E'
  if (n <= 19) return '#CD7F32'
  return '#BDBDBD'
}

Page({
  data: {
    statusBarHeight: 0,
    navBarHeight: 44,
    username: '围棋爱好者',
    levelName: '--',
    levelColor: '#CCCCCC',
    rating: '--',
    totalSolved: 0,
    accuracy: 0,
    streakDays: 0,
    maxStreak: 0,
    coins: 0,
    streakFreezes: 0,
    canBuyFreeze: false,
    isAdmin: true, // TODO: 从用户信息获取
    categoryStats: [
      { name: '死活', rate: 0, color: '#1C94E0' },
      { name: '手筋', rate: 0, color: '#9B59B6' },
      { name: '入门', rate: 0, color: '#58CC02' },
      { name: '官子', rate: 0, color: '#FF9500' },
    ],
  },

  onLoad: function () {
    var app = getApp()
    this.setData({
      statusBarHeight: app.globalData.statusBarHeight,
      navBarHeight: app.globalData.navBarHeight,
    })
  },

  onShow: function () {
    var userInfo = storage.getUserInfo()
    var username = (userInfo && userInfo.username) ? userInfo.username : '围棋爱好者'
    this.setData({ username: username })
    this._fetchStats()
  },

  _fetchStats: function () {
    var self = this
    api.getStats().then(function (stats) {
      var coins = stats.coins || 0
      var freezes = stats.streak_freezes || 0
      self.setData({
        username: stats.username || self.data.username,
        levelName: stats.level_name || '--',
        levelColor: getLevelColor(stats.level_name),
        rating: stats.rating || 0,
        totalSolved: stats.total_solved || 0,
        accuracy: stats.correct_rate || 0,
        streakDays: stats.streak_days || 0,
        maxStreak: stats.streak_days || 0,
        coins: coins,
        streakFreezes: freezes,
        canBuyFreeze: freezes < 2 && coins >= 50,
      })
    }).catch(function () {})
  },

  onTapLeaderboard: function () {
    wx.navigateTo({ url: '/pages/leaderboard/index' })
  },

  onBuyFreeze: function () {
    var self = this
    wx.showModal({
      title: '购买 Streak Freeze',
      content: '花费 50 棋币购买1个 Streak Freeze？\n使用后当天不做题也不断连续天数。',
      confirmText: '购买',
      confirmColor: '#58CC02',
      success: function (res) {
        if (res.confirm) {
          api.buyStreakFreeze().then(function (r) {
            wx.showToast({ title: '购买成功！', icon: 'success' })
            self.setData({
              coins: r.coins,
              streakFreezes: r.streak_freezes,
              canBuyFreeze: r.streak_freezes < 2 && r.coins >= 50,
            })
          }).catch(function (err) {
            wx.showToast({ title: err.message || '购买失败', icon: 'none' })
          })
        }
      }
    })
  },

  onTapAdjustLevel: function () {
    wx.navigateTo({ url: '/pages/level-select/index' })
  },

  onTapClearData: function () {
    wx.showModal({
      title: '确认退出',
      content: '退出后需要重新登录',
      confirmColor: '#FF4B4B',
      success: function (res) {
        if (res.confirm) {
          storage.clearAuth()
          wx.redirectTo({ url: '/pages/login/index' })
        }
      }
    })
  },

  onTapAdmin: function () {
    wx.navigateTo({ url: '/pages/admin/index' })
  },
})

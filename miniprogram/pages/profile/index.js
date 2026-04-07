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
    isAdmin: false,
    calendarDays: [],
    ratingHistory: [],
    categoryStats: [
      { name: '死活', rate: 0, barWidth: 3, color: '#1C94E0' },
      { name: '手筋', rate: 0, barWidth: 3, color: '#9B59B6' },
      { name: '入门', rate: 0, barWidth: 3, color: '#58CC02' },
      { name: '官子', rate: 0, barWidth: 3, color: '#FF9500' },
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
        isAdmin: stats.is_admin || false,
        categoryStats: self.data.categoryStats.map(function(c) {
          return { name: c.name, rate: c.rate, barWidth: Math.max(c.rate, 3), color: c.color }
        }),
      })
      // 加载棋力趋势
      self._loadRatingChart()
      // 加载打卡日历
      self._loadCalendar()
    }).catch(function () {})
  },

  _loadRatingChart: function () {
    var self = this
    api.getRatingHistory().then(function (res) {
      var history = res.history || []
      self.setData({ ratingHistory: history })
      if (history.length > 1) {
        setTimeout(function () { self._drawChart(history) }, 300)
      }
    }).catch(function () {})
  },

  _drawChart: function (data) {
    var query = this.createSelectorQuery()
    query.select('#ratingChart').fields({ node: true, size: true }).exec(function (res) {
      if (!res || !res[0] || !res[0].node) return
      var canvas = res[0].node
      var ctx = canvas.getContext('2d')
      var dpr = wx.getWindowInfo().pixelRatio || 2
      var w = res[0].width
      var h = res[0].height

      canvas.width = w * dpr
      canvas.height = h * dpr
      ctx.scale(dpr, dpr)

      var pad = { top: 10, right: 15, bottom: 25, left: 40 }
      var cw = w - pad.left - pad.right
      var ch = h - pad.top - pad.bottom

      var ratings = data.map(function (d) { return d.rating })
      var minR = Math.min.apply(null, ratings) - 20
      var maxR = Math.max.apply(null, ratings) + 20
      if (maxR === minR) maxR = minR + 50

      function toX(i) { return pad.left + (i / (data.length - 1)) * cw }
      function toY(r) { return pad.top + (1 - (r - minR) / (maxR - minR)) * ch }

      // 填充区域
      ctx.beginPath()
      ctx.moveTo(toX(0), toY(ratings[0]))
      for (var i = 1; i < data.length; i++) ctx.lineTo(toX(i), toY(ratings[i]))
      ctx.lineTo(toX(data.length - 1), pad.top + ch)
      ctx.lineTo(toX(0), pad.top + ch)
      ctx.closePath()
      ctx.fillStyle = 'rgba(88,204,2,0.15)'
      ctx.fill()

      // 线条
      ctx.beginPath()
      ctx.moveTo(toX(0), toY(ratings[0]))
      for (var j = 1; j < data.length; j++) ctx.lineTo(toX(j), toY(ratings[j]))
      ctx.strokeStyle = '#58CC02'
      ctx.lineWidth = 2
      ctx.lineJoin = 'round'
      ctx.stroke()

      // 端点
      for (var k = 0; k < data.length; k++) {
        ctx.beginPath()
        ctx.arc(toX(k), toY(ratings[k]), 3, 0, Math.PI * 2)
        ctx.fillStyle = '#58CC02'
        ctx.fill()
      }

      // Y轴标签
      ctx.fillStyle = '#AFAFAF'
      ctx.font = '10px sans-serif'
      ctx.textAlign = 'right'
      ctx.fillText(String(Math.round(maxR)), pad.left - 5, pad.top + 10)
      ctx.fillText(String(Math.round(minR)), pad.left - 5, pad.top + ch)

      // X轴日期标签（首尾）
      ctx.textAlign = 'center'
      ctx.fillText(data[0].date.slice(5), toX(0), pad.top + ch + 15)
      ctx.fillText(data[data.length - 1].date.slice(5), toX(data.length - 1), pad.top + ch + 15)
    })
  },

  _loadCalendar: function () {
    var self = this
    var now = new Date(Date.now() + 8 * 3600000) // UTC+8
    var year = now.getUTCFullYear()
    var month = now.getUTCMonth() // 0-based
    var todayDate = now.getUTCDate()

    // 本月第一天是周几（0=周日，转为周一=0）
    var firstDay = new Date(Date.UTC(year, month, 1)).getUTCDay()
    var startOffset = firstDay === 0 ? 6 : firstDay - 1 // 周一=0
    var daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()

    // 从 daily_sessions 获取本月做题日期（用范围查询代替正则，避免索引警告）
    var db = wx.cloud.database()
    var _ = db.command
    var monthStr = year + '-' + String(month + 1).padStart(2, '0')
    var nextMonth = month + 2 <= 12
      ? year + '-' + String(month + 2).padStart(2, '0')
      : (year + 1) + '-01'
    db.collection('daily_sessions').where({
      session_date: _.gte(monthStr + '-01').and(_.lt(nextMonth + '-01')),
      completed_count: _.gte(1),
    }).field({ session_date: true }).get().then(function (res) {
      var doneDates = {}
      for (var i = 0; i < res.data.length; i++) {
        var d = parseInt(res.data[i].session_date.split('-')[2])
        doneDates[d] = true
      }

      var days = []
      // 前面的空白
      for (var s = 0; s < startOffset; s++) days.push({ empty: true })
      // 每天
      for (var d = 1; d <= daysInMonth; d++) {
        days.push({
          day: d,
          today: d === todayDate,
          done: !!doneDates[d],
          empty: false,
        })
      }
      self.setData({ calendarDays: days })
    }).catch(function () {
      // fallback: 无数据也显示空日历
      var days = []
      for (var s = 0; s < startOffset; s++) days.push({ empty: true })
      for (var d = 1; d <= daysInMonth; d++) {
        days.push({ day: d, today: d === todayDate, done: false, empty: false })
      }
      self.setData({ calendarDays: days })
    })
  },

  onEditName: function () {
    var self = this
    wx.showModal({
      title: '修改昵称',
      editable: true,
      placeholderText: '输入你的围棋昵称',
      success: function (res) {
        if (res.confirm && res.content && res.content.trim()) {
          api.setUsername(res.content.trim()).then(function () {
            self.setData({ username: res.content.trim() })
            wx.showToast({ title: '修改成功', icon: 'success' })
          }).catch(function () {
            wx.showToast({ title: '修改失败', icon: 'none' })
          })
        }
      }
    })
  },

  onTapLeaderboard: function () {
    wx.switchTab({ url: '/pages/ranking/index' })
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

  onTapShare: function () {
    wx.showShareMenu({ withShareTicket: true })
    // 小程序分享默认通过页面 onShareAppMessage 触发
  },

  onShareAppMessage: function () {
    return {
      title: '黑白天天练 - 每天3道围棋题',
      path: '/pages/login/index',
    }
  },

  onTapSettings: function () {
    var soundOn = wx.getStorageSync('soundEnabled') !== false
    wx.showActionSheet({
      itemList: [soundOn ? '🔊 关闭音效' : '🔇 开启音效'],
      success: function (res) {
        if (res.tapIndex === 0) {
          var newVal = !soundOn
          wx.setStorageSync('soundEnabled', newVal)
          wx.showToast({ title: newVal ? '音效已开启' : '音效已关闭', icon: 'none' })
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

var apiModule = require('../../utils/api')
var api = apiModule.api
var app = getApp()

// 天梯节点（12级，7K=520 到 5D=1080）
var TIERS = [
  { name: '7K',  rating: 520, reward: 0 },
  { name: '6K',  rating: 560, reward: 0 },
  { name: '5K',  rating: 600, reward: 10 },
  { name: '4K',  rating: 645, reward: 0 },
  { name: '3K',  rating: 695, reward: 0 },
  { name: '2K',  rating: 745, reward: 5 },
  { name: '1K',  rating: 795, reward: 15 },
  { name: '1D',  rating: 845, reward: 20 },
  { name: '2D',  rating: 900, reward: 0 },
  { name: '3D',  rating: 960, reward: 25 },
  { name: '4D',  rating: 1020, reward: 0 },
  { name: '5D',  rating: 1080, reward: 30 },
]

var DAN_START_INDEX = 7 // 1D的index

function getLevelColor(name) {
  if (!name) return '#CCC'
  if (name.indexOf('段') !== -1) return '#FFB300'
  var n = parseInt(name)
  if (n <= 9) return '#9E9E9E'
  if (n <= 19) return '#CD7F32'
  return '#BDBDBD'
}

Page({
  data: {
    statusBarHeight: 20,
    topHeight: 140,
    loading: true,
    stats: {},
    levelColor: '#CCC',
    checkedIn: false,
    circles: [],
    todayDone: 0,
    totalChange: 0,
    completedCount: 0,
    buttonDisabled: false,
    nodes: [],
    scrollTarget: '',
    daily: null,
    danDividerBottom: 0,
    // 登录宝箱
    showLoginChest: false,
    loginChestType: 'wood',
    loginChestAmount: 0,
  },

  onLoad: function () {
    var sbh = app.globalData.statusBarHeight || 20
    this.setData({
      statusBarHeight: sbh,
      topHeight: sbh + 44,
    })
  },

  onShow: function () {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 0 })
    }
    this._loadingContinue = false
    if (!app.checkAuth()) return
    this._tryClaimLoginChest()

    // 做题页传回的最新分数 → 先显示，然后还是要刷新
    var lr = app.globalData.latestRating
    var ll = app.globalData.latestLevel
    if (lr === undefined) {
      lr = wx.getStorageSync('_latestRating')
      ll = wx.getStorageSync('_latestLevel')
    }
    if (lr) {
      this.setData({
        'stats.rating': lr,
        'stats.level_name': ll || (this.data.stats && this.data.stats.level_name) || '7K',
      })
      app.globalData.latestRating = undefined
      app.globalData.latestLevel = undefined
      wx.removeStorageSync('_latestRating')
      wx.removeStorageSync('_latestLevel')
      // 不再 return，继续执行 _loadData 刷新打卡状态
    }
    this._loadData()
  },

  onPullDownRefresh: function () {
    this._loadData()
    wx.stopPullDownRefresh()
  },

  _loadData: function () {
    var that = this
    that.setData({ loading: true })

    // 一次调用拿 stats + daily
    api.getHome().then(function (home) {
        var daily = home.daily, stats = home.stats
        var completedCount = daily.completed_count || 0
        var checkedIn = completedCount >= 3
        var problemList = daily.problems || []
        var problemIds = daily.problem_ids || []
        daily.problems = problemList

        // 打卡圆圈
        var circles = [], totalChange = 0
        for (var i = 0; i < 3; i++) {
          var result = null
          if (daily.results) {
            for (var j = 0; j < daily.results.length; j++) {
              if (daily.results[j].problem_id === problemIds[i]) { result = daily.results[j]; break }
            }
          }
          var st = 'pending'
          if (result) {
            st = result.is_correct ? 'correct' : 'wrong'
            totalChange += result.rating_change || 0
          } else if (i === Math.min(completedCount, 2)) {
            st = 'current'
          }
          circles.push({ number: i + 1, status: st })
        }

        // 天梯节点
        var rating = typeof stats.rating === 'number' ? stats.rating : 100
        var currentIdx = 0
        for (var k = TIERS.length - 1; k >= 0; k--) {
          if (rating >= TIERS[k].rating) { currentIdx = k; break }
        }
        var nextIdx = Math.min(currentIdx + 1, TIERS.length - 1)

        // 节点坐标（百分比，对齐背景图上的小路 S 形）
        // 12 个节点，Y范围 4%~78%，间距约6.7%
        var NODE_POSITIONS = [
          { x: 30, y: 78 }, // 7K
          { x: 65, y: 71 }, // 6K
          { x: 30, y: 64 }, // 5K
          { x: 65, y: 57 }, // 4K
          { x: 30, y: 50 }, // 3K
          { x: 65, y: 43 }, // 2K
          { x: 30, y: 36 }, // 1K
          { x: 65, y: 29 }, // 1D
          { x: 30, y: 22 }, // 2D
          { x: 65, y: 15 }, // 3D
          { x: 30, y: 9 },  // 4D
          { x: 55, y: 4 },  // 5D
        ]

        var nodes = []
        for (var m = 0; m < TIERS.length; m++) {
          var t = TIERS[m]
          var nst = 'locked'
          if (m < currentIdx) nst = 'passed'
          else if (m === currentIdx) nst = 'current'
          else if (m === currentIdx + 1) nst = 'next'

          var pos = NODE_POSITIONS[m] || { x: 50, y: 50 }

          nodes.push({
            id: m,
            name: t.name,
            label: t.name.replace('级', '').replace('初段', '初').replace('二段', '二').replace('三段', '三').replace('四段', '四').replace('五段', '五'),
            rating: t.rating,
            status: nst,
            pctX: pos.x,
            pctY: pos.y,
            gap: nst === 'current' ? Math.max(0, TIERS[nextIdx].rating - rating)
               : nst === 'next' ? Math.max(0, t.rating - rating) : 0,
            reward: t.reward,
            showReward: t.reward > 0 && nst !== 'passed',
          })
        }

        // 计算节点连线
        var nodeLines = []
        for (var nl = 0; nl < nodes.length - 1; nl++) {
          var n1 = nodes[nl], n2 = nodes[nl + 1]
          var done = n1.status === 'passed' && (n2.status === 'passed' || n2.status === 'current')
          // 简化：用百分比坐标画线，角度由 JS 算
          var dx = n2.pctX - n1.pctX
          var dy = n2.pctY - n1.pctY
          var len = Math.round(Math.sqrt(dx * dx + dy * dy) * 10) // rpx 近似
          var angle = Math.round(Math.atan2(dy, dx) * 180 / Math.PI)
          nodeLines.push({ idx: nl, x1: n1.pctX, y1: n1.pctY, len: len, angle: angle, done: done })
        }

        // 计算滚动位置使当前节点居中
        // 图片宽高比 1800/854 = 2.108
        var sysInfo = wx.getWindowInfo()
        var screenW = sysInfo.windowWidth
        var imgHeight = screenW * (1800 / 854)
        var currentPctY = (nodes[currentIdx] || {}).pctY || 50
        var nodePixelY = imgHeight * (currentPctY / 100)
        var viewportH = sysInfo.windowHeight - that.data.topHeight
        var scrollTo = Math.max(0, nodePixelY - viewportH * 0.75)

        app.globalData.isAdmin = stats.is_admin || false
        that.setData({
          loading: false,
          stats: stats,
          levelColor: getLevelColor(stats.level_name),
          daily: daily,
          checkedIn: checkedIn,
          circles: circles,
          totalChange: totalChange,
          completedCount: completedCount,
          problemCount: stats.problems_total || 0,
          todayDone: completedCount,
          buttonDisabled: !problemList || problemList.length === 0,
          nodes: nodes,
          nodeLines: nodeLines,
          scrollToTop: scrollTo,
        })
      })
      .catch(function (err) {
        console.error('[index] load error:', err)
        that.setData({ loading: false, buttonDisabled: true })
      })
  },

  _tryClaimLoginChest: function () {
    var self = this
    // 本地防抖：同一天只尝试一次
    var today = (function () {
      var d = new Date(Date.now() + 8 * 3600000)
      return d.toISOString().slice(0, 10)
    })()
    var lastTried = wx.getStorageSync('_last_login_chest_tried')
    if (lastTried === today) return
    wx.setStorageSync('_last_login_chest_tried', today)

    api.claimLoginChest().then(function (res) {
      if (res.new_chest) {
        // 计算该宝箱会给的金币（展示用，开箱时云端真实结算）
        var estAmount = res.new_chest.type === 'gold' ? 75
          : res.new_chest.type === 'silver' ? 22 : 7
        // 保存新宝箱在数组中的位置，用于后续 openChest
        self._loginChestIndex = (typeof res.new_chest_index === 'number')
          ? res.new_chest_index
          : ((res.chests && res.chests.length > 0) ? res.chests.length - 1 : 0)
        self.setData({
          showLoginChest: true,
          loginChestType: res.new_chest.type,
          loginChestAmount: estAmount,
        })
      }
    }).catch(function () {
      // 静默失败
    })
  },

  onLoginChestDone: function () {
    var self = this
    // 动画完成后自动调 openChest 实际领取
    setTimeout(function () {
      self.setData({ showLoginChest: false })
      // 重新拉数据，更新金币和宝箱数
      if (self._loadData) self._loadData()
    }, 500)
    // 云端真实开箱：用 _tryClaimLoginChest 保存的新宝箱 index（push 到末尾）
    var idx = (typeof self._loginChestIndex === 'number') ? self._loginChestIndex : 0
    api.openChest(idx).catch(function () {})
  },

  handleStart: function () {
    var that = this
    var daily = this.data.daily
    if (!daily) {
      wx.showToast({ title: '加载中，请稍候', icon: 'none' })
      this._loadData()
      return
    }

    if (this.data.checkedIn) {
      if (this._loadingContinue) return
      this._loadingContinue = true
      wx.showLoading({ title: '选题中...' })
      api.getContinueProblem().then(function (res) {
        wx.hideLoading()
        that._loadingContinue = false  // BUG1 修复：成功后也重置
        if (res.problem) {
          app.globalData.playState = {
            problems: [res.problem], currentIndex: 0,
            resultsAccumulated: [], isContinueMode: true,
            userLevel: (that.data.stats && that.data.stats.level_name) || '7K',
            userRating: (that.data.stats && that.data.stats.rating) || 520,
            completedCount: that.data.completedCount || 0,
          }
          wx.navigateTo({ url: '/pages/play/index' })
        } else {
          wx.showToast({ title: '没有更多题目了', icon: 'none' })
        }
      }).catch(function () {
        wx.hideLoading()
        that._loadingContinue = false
        wx.showToast({ title: '获取题目失败', icon: 'none' })
      })
      return
    }

    if (this._navigating) return
    if (!daily.problems || daily.problems.length === 0) {
      wx.showToast({ title: '题目加载中...', icon: 'none' })
      this._loadData()
      return
    }
    this._navigating = true
    setTimeout(function () { that._navigating = false }, 1000)
    var idx = this.data.completedCount % daily.problems.length
    app.globalData.playState = {
      problems: daily.problems, currentIndex: idx,
      resultsAccumulated: daily.results || [], isContinueMode: false,
      userLevel: (this.data.stats && this.data.stats.level_name) || '7K',
      userRating: (this.data.stats && this.data.stats.rating) || 520,
      completedCount: this.data.completedCount || 0,
    }
    wx.navigateTo({ url: '/pages/play/index' })
  },

  onTapNode: function (e) {
    var idx = e.currentTarget.dataset.idx
    var node = this.data.nodes[idx]
    if (!node) return

    if (node.status === 'current') {
      this.handleStart()
    } else if (node.status === 'passed') {
      wx.showToast({ title: '已通过 ' + node.name, icon: 'none' })
    } else {
      wx.showToast({ title: '棋力达到 ' + node.rating + ' 解锁', icon: 'none' })
    }
  },
})

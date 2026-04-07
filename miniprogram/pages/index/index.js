var apiModule = require('../../utils/api')
var api = apiModule.api
var app = getApp()

// 天梯节点（20级，15K=280 到 5D=1100）
var TIERS = [
  { name: '15K', rating: 280, reward: 0 },
  { name: '14K', rating: 310, reward: 0 },
  { name: '13K', rating: 340, reward: 0 },
  { name: '12K', rating: 370, reward: 5 },
  { name: '11K', rating: 400, reward: 0 },
  { name: '10K', rating: 435, reward: 10 },
  { name: '9K',  rating: 470, reward: 0 },
  { name: '8K',  rating: 505, reward: 0 },
  { name: '7K',  rating: 540, reward: 5 },
  { name: '6K',  rating: 575, reward: 0 },
  { name: '5K',  rating: 615, reward: 10 },
  { name: '4K',  rating: 655, reward: 0 },
  { name: '3K',  rating: 695, reward: 0 },
  { name: '2K',  rating: 740, reward: 5 },
  { name: '1K',  rating: 785, reward: 15 },
  { name: '1D',  rating: 840, reward: 20 },
  { name: '2D',  rating: 900, reward: 0 },
  { name: '3D',  rating: 960, reward: 25 },
  { name: '4D',  rating: 1030, reward: 0 },
  { name: '5D',  rating: 1100, reward: 30 },
]

var DAN_START_INDEX = 15 // 1D的index

function getLevelColor(name) {
  if (!name) return '#CCC'
  if (name.indexOf('段') !== -1) return '#FFB300'
  var n = parseInt(name)
  if (n <= 9) return '#9E9E9E'
  if (n <= 19) return '#CD7F32'
  return '#BDBDBD'
}

var GOAL_OPTIONS = [
  { value: 3, label: '轻松', desc: '3题就好~' },
  { value: 5, label: '标准', desc: '5题刚好！' },
  { value: 10, label: '认真', desc: '加油哦！' },
  { value: 20, label: '疯狂', desc: '你是真猛！' },
]

Page({
  data: {
    statusBarHeight: 20,
    topHeight: 140,
    loading: true,
    stats: {},
    levelColor: '#CCC',
    checkedIn: false,
    circles: [],
    dailyGoal: 5,
    todayDone: 0,
    showGoalPicker: false,
    goalOptions: GOAL_OPTIONS,
    totalChange: 0,
    completedCount: 0,
    buttonDisabled: false,
    nodes: [],
    scrollTarget: '',
    daily: null,
    danDividerBottom: 0,
  },

  onLoad: function () {
    var sbh = app.globalData.statusBarHeight || 20
    var savedGoal = wx.getStorageSync('dailyGoal')
    this.setData({
      statusBarHeight: sbh,
      topHeight: sbh + 44,
      dailyGoal: savedGoal || 5,
    })
    // 首次使用弹出目标选择
    if (!savedGoal) {
      this.setData({ showGoalPicker: true })
    }
  },

  onShow: function () {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 0 })
    }
    if (!app.checkAuth()) return
    // 先用做题页传回的最新分数立即更新
    if (app.globalData.latestRating !== undefined) {
      var s = this.data.stats || {}
      s.rating = app.globalData.latestRating
      s.level_name = app.globalData.latestLevel || s.level_name
      this.setData({ stats: s })
      app.globalData.latestRating = undefined
      app.globalData.latestLevel = undefined
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
        // 图片是从底部草地到顶部星空
        // Y: 0%=顶部(星空), 100%=底部(草地)
        // 20 个节点坐标，S形排列
        // Y范围 4%~82%（给底部tab栏留空间）
        var NODE_POSITIONS = [
          { x: 30, y: 82 }, // 15K
          { x: 65, y: 78 }, // 14K
          { x: 30, y: 74 }, // 13K
          { x: 65, y: 70 }, // 12K
          { x: 30, y: 66 }, // 11K
          { x: 65, y: 62 }, // 10K
          { x: 30, y: 58 }, // 9K
          { x: 65, y: 54 }, // 8K
          { x: 30, y: 50 }, // 7K
          { x: 65, y: 46 }, // 6K
          { x: 30, y: 42 }, // 5K
          { x: 65, y: 38 }, // 4K
          { x: 30, y: 34 }, // 3K
          { x: 65, y: 30 }, // 2K
          { x: 30, y: 26 }, // 1K
          { x: 65, y: 22 }, // 1D
          { x: 30, y: 18 }, // 2D
          { x: 65, y: 14 }, // 3D
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

        // 计算滚动位置使当前节点居中
        // 图片宽高比 1800/854 = 2.108
        var sysInfo = wx.getWindowInfo()
        var screenW = sysInfo.windowWidth
        var imgHeight = screenW * (1800 / 854)
        var currentPctY = (nodes[currentIdx] || {}).pctY || 50
        var nodePixelY = imgHeight * (currentPctY / 100)
        var viewportH = sysInfo.windowHeight - that.data.topHeight
        var scrollTo = Math.max(0, nodePixelY - viewportH * 0.75)

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
          scrollToTop: scrollTo,
        })
      })
      .catch(function (err) {
        console.error('[index] load error:', err)
        that.setData({ loading: false, buttonDisabled: true })
      })
  },

  goLearn: function () {
    wx.navigateTo({ url: '/learn/index' })
  },

  onTapGoal: function () {
    this.setData({ showGoalPicker: true })
  },

  onCloseGoal: function () {
    this.setData({ showGoalPicker: false })
  },

  onSelectGoal: function (e) {
    var val = e.currentTarget.dataset.value
    wx.setStorageSync('dailyGoal', val)
    this.setData({ dailyGoal: val, showGoalPicker: false })
  },

  handleStart: function () {
    var that = this
    var daily = this.data.daily
    if (!daily) return

    if (this.data.checkedIn) {
      if (this._loadingContinue) return
      this._loadingContinue = true
      wx.showLoading({ title: '选题中...' })
      api.getContinueProblem().then(function (res) {
        wx.hideLoading()
        if (res.problem) {
          app.globalData.playState = {
            problems: [res.problem], currentIndex: 0,
            resultsAccumulated: [], isContinueMode: true,
            userLevel: (that.data.stats && that.data.stats.level_name) || '15K',
            userRating: (that.data.stats && that.data.stats.rating) || 280,
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

    if (!daily.problems || daily.problems.length === 0) return
    var idx = this.data.completedCount % daily.problems.length
    app.globalData.playState = {
      problems: daily.problems, currentIndex: idx,
      resultsAccumulated: daily.results || [], isContinueMode: false,
      userLevel: (this.data.stats && this.data.stats.level_name) || '15K',
      userRating: (this.data.stats && this.data.stats.rating) || 280,
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

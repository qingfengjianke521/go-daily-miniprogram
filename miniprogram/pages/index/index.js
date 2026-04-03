var apiModule = require('../../utils/api')
var api = apiModule.api
var app = getApp()

// 天梯节点（对照完整方案 25K=0 到 5D=950）
var TIERS = [
  { name: '25K', rating: 0, reward: 0 },
  { name: '20K', rating: 100, reward: 5 },
  { name: '18K', rating: 150, reward: 0 },
  { name: '15K', rating: 225, reward: 5 },
  { name: '13K', rating: 275, reward: 0 },
  { name: '10K', rating: 360, reward: 10 },
  { name: '8K', rating: 420, reward: 0 },
  { name: '5K', rating: 520, reward: 10 },
  { name: '3K', rating: 595, reward: 0 },
  { name: '1K', rating: 675, reward: 15 },
  { name: '1D', rating: 720, reward: 20 },
  { name: '3D', rating: 825, reward: 25 },
  { name: '5D', rating: 950, reward: 30 },
  // -- 段位分界线 --
  { name: '初段', rating: 1800, reward: 50 },
  { name: '二段', rating: 1900, reward: 0 },
  { name: '三段', rating: 2000, reward: 50 },
  { name: '四段', rating: 2200, reward: 0 },
  { name: '五段', rating: 2400, reward: 100 },
]

var DAN_START_INDEX = 13 // 初段的index

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
    this.setData({
      statusBarHeight: sbh,
      topHeight: sbh + 44,
    })
  },

  onShow: function () {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 0 })
    }
    if (!app.checkAuth()) return
    this._loadData()
  },

  onPullDownRefresh: function () {
    this._loadData()
    wx.stopPullDownRefresh()
  },

  _loadData: function () {
    var that = this
    that.setData({ loading: true })

    // 并行加载，不再 resetSession（避免3次云函数调用导致慢）
    Promise.all([api.getDaily(), api.getStats()])
      .then(function (res) {
        var daily = res[0], stats = res[1]
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
        var NODE_POSITIONS = [
          // 25K(底部) → 5D(顶部)，13个节点
          { x: 30, y: 84 }, // 25K
          { x: 65, y: 77 }, // 20K
          { x: 35, y: 70 }, // 18K
          { x: 60, y: 63 }, // 15K
          { x: 30, y: 56 }, // 13K
          { x: 65, y: 49 }, // 10K
          { x: 35, y: 42 }, // 8K
          { x: 60, y: 35 }, // 5K
          { x: 30, y: 28 }, // 3K
          { x: 65, y: 21 }, // 1K
          { x: 35, y: 14 }, // 1D
          { x: 60, y: 7 },  // 3D
          { x: 45, y: 2 },  // 5D
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

  handleStart: function () {
    var daily = this.data.daily
    if (!daily) return

    if (this.data.checkedIn) {
      wx.showLoading({ title: '选题中...' })
      api.getContinueProblem().then(function (res) {
        wx.hideLoading()
        if (res.problem) {
          app.globalData.playState = {
            problems: [res.problem], currentIndex: 0,
            resultsAccumulated: [], isContinueMode: true,
          }
          wx.navigateTo({ url: '/pages/play/index' })
        } else {
          wx.showToast({ title: '没有更多题目了', icon: 'none' })
        }
      }).catch(function () {
        wx.hideLoading()
        wx.showToast({ title: '获取题目失败', icon: 'none' })
      })
      return
    }

    if (!daily.problems || daily.problems.length === 0) return
    var idx = this.data.completedCount % daily.problems.length
    app.globalData.playState = {
      problems: daily.problems, currentIndex: idx,
      resultsAccumulated: daily.results || [], isContinueMode: false,
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

var apiModule = require('../../utils/api')
var api = apiModule.api
var app = getApp()

// 段位层级（每2级一个节点，更密集）
var TIERS = [
  { name: '25级', rating: 500, reward: 5 },
  { name: '23级', rating: 600, reward: 0 },
  { name: '21级', rating: 700, reward: 5 },
  { name: '19级', rating: 800, reward: 0 },
  { name: '17级', rating: 900, reward: 10 },
  { name: '15级', rating: 1000, reward: 0 },
  { name: '13级', rating: 1050, reward: 10 },
  { name: '11级', rating: 1100, reward: 0 },
  { name: '9级', rating: 1200, reward: 15 },
  { name: '7级', rating: 1300, reward: 0 },
  { name: '5级', rating: 1400, reward: 15 },
  { name: '3级', rating: 1500, reward: 0 },
  { name: '1级', rating: 1700, reward: 20 },
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
      topHeight: sbh + 44 + 44 + 28,
    })
  },

  onShow: function () {
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

    var dailyPromise = api.getDaily().then(function (daily) {
      if ((!daily.problems || daily.problems.length === 0) && !daily.useLocalProblems) {
        return wx.cloud.callFunction({ name: 'goDaily', data: { action: 'resetSession' } })
          .then(function () { return api.getDaily() })
          .catch(function () { return daily })
      }
      return daily
    })

    Promise.all([dailyPromise, api.getStats()])
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
        var rating = stats.rating || 1200
        var currentIdx = 0
        for (var k = TIERS.length - 1; k >= 0; k--) {
          if (rating >= TIERS[k].rating) { currentIdx = k; break }
        }
        var nextIdx = Math.min(currentIdx + 1, TIERS.length - 1)

        // 节点坐标（百分比，对齐背景图上的小路 S 形）
        // 图片是从底部草地到顶部星空
        // Y: 0%=顶部(星空), 100%=底部(草地)
        var NODE_POSITIONS = [
          // 25级(底部) → 五段(顶部)
          { x: 30, y: 88 }, // 25级 底部左
          { x: 65, y: 82 }, // 23级 右
          { x: 35, y: 76 }, // 21级 左
          { x: 60, y: 70 }, // 19级 右
          { x: 30, y: 64 }, // 17级 左
          { x: 65, y: 58 }, // 15级 右
          { x: 35, y: 52 }, // 13级 左
          { x: 60, y: 46 }, // 11级 右
          { x: 30, y: 40 }, // 9级 左
          { x: 65, y: 35 }, // 7级 右
          { x: 35, y: 30 }, // 5级 左
          { x: 60, y: 25 }, // 3级 右
          { x: 35, y: 20 }, // 1级 左
          // 段位区
          { x: 55, y: 15 }, // 初段
          { x: 35, y: 11 }, // 二段
          { x: 60, y: 7 },  // 三段
          { x: 40, y: 4 },  // 四段
          { x: 55, y: 1 },  // 五段
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
          scrollTarget: 'node-' + currentIdx,
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

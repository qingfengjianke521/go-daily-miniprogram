var apiModule = require('../../utils/api')
var api = apiModule.api
var app = getApp()

// 段位层级（从低到高）
var TIERS = [
  { name: '25级', rating: 500, reward: 5, rewardIcon: '💎' },
  { name: '22级', rating: 650, reward: 5, rewardIcon: '💎' },
  { name: '20级', rating: 800, reward: 10, rewardIcon: '💎' },
  { name: '18级', rating: 900, reward: 10, rewardIcon: '💎' },
  { name: '15级', rating: 1000, reward: 15, rewardIcon: '💎' },
  { name: '12级', rating: 1100, reward: 15, rewardIcon: '💎' },
  { name: '10级', rating: 1200, reward: 20, rewardIcon: '💎' },
  { name: '8级', rating: 1300, reward: 20, rewardIcon: '💎' },
  { name: '6级', rating: 1400, reward: 25, rewardIcon: '💎' },
  { name: '4级', rating: 1500, reward: 25, rewardIcon: '💎' },
  { name: '2级', rating: 1600, reward: 30, rewardIcon: '💎' },
  { name: '1级', rating: 1700, reward: 30, rewardIcon: '💎' },
  { name: '初段', rating: 1800, reward: 50, rewardIcon: '🏆' },
  { name: '二段', rating: 1900, reward: 50, rewardIcon: '🏆' },
  { name: '三段', rating: 2000, reward: 50, rewardIcon: '🏆' },
  { name: '四段', rating: 2200, reward: 80, rewardIcon: '🏆' },
  { name: '五段', rating: 2400, reward: 100, rewardIcon: '🏆' },
]

Page({
  data: {
    statusBarHeight: 20,
    currentLevel: '',
    currentRating: 0,
    nextLevel: '',
    gapPoints: 0,
    progressToNext: 0,
    nodes: [],
    scrollTarget: '',
  },

  onLoad: function () {
    this.setData({ statusBarHeight: app.globalData.statusBarHeight })
  },

  onShow: function () {
    if (!app.checkAuth()) return
    this._loadData()
  },

  _loadData: function () {
    var that = this
    api.getStats().then(function (stats) {
      var rating = typeof stats.rating === 'number' ? stats.rating : 100
      var levelName = stats.level_name || '20K'

      // 找当前所在的 tier
      var currentIdx = 0
      for (var i = TIERS.length - 1; i >= 0; i--) {
        if (rating >= TIERS[i].rating) { currentIdx = i; break }
      }

      // 下一级
      var nextIdx = Math.min(currentIdx + 1, TIERS.length - 1)
      var nextTier = TIERS[nextIdx]
      var currentTier = TIERS[currentIdx]
      var gap = nextIdx > currentIdx ? Math.max(0, nextTier.rating - rating) : 0
      var range = nextIdx > currentIdx ? (nextTier.rating - currentTier.rating) : 1
      var progress = nextIdx > currentIdx ? Math.min(100, ((rating - currentTier.rating) / range) * 100) : 100

      // 构建节点列表
      var nodes = []
      for (var j = 0; j < TIERS.length; j++) {
        var tier = TIERS[j]
        var status = 'locked'
        if (j < currentIdx) status = 'passed'
        else if (j === currentIdx) status = 'current'
        else if (j === currentIdx + 1) status = 'next'

        nodes.push({
          id: j,
          name: tier.name,
          label: tier.name.replace('级', '').replace('段', 'D'),
          rating: tier.rating,
          status: status,
          side: j % 2 === 0 ? 'left' : 'right',
          gap: status === 'next' ? gap : 0,
          reward: tier.reward,
          rewardIcon: tier.rewardIcon,
          passDate: status === 'passed' ? '' : '', // TODO: track dates
        })
      }

      that.setData({
        currentLevel: levelName,
        currentRating: rating,
        nextLevel: nextTier.name,
        gapPoints: gap,
        progressToNext: Math.round(progress),
        nodes: nodes,
        scrollTarget: 'node-' + currentIdx,
      })
    }).catch(function () {})
  },

  onTapNode: function (e) {
    var idx = e.currentTarget.dataset.index
    var node = this.data.nodes[idx]
    if (!node) return

    if (node.status === 'passed') {
      wx.showToast({ title: '已通过 ' + node.name, icon: 'none' })
    } else if (node.status === 'current') {
      wx.showToast({ title: '当前段位 ' + node.name + '\n棋力 ' + this.data.currentRating, icon: 'none' })
    } else if (node.status === 'next') {
      wx.showToast({ title: '棋力达到 ' + node.rating + ' 即可解锁', icon: 'none' })
    } else {
      wx.showToast({ title: '棋力达到 ' + node.rating + ' 即可解锁', icon: 'none' })
    }
  },
})

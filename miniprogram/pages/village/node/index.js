var SKILL_TREE = require('../../../data/skill-tree')
var beginnerPuzzles = require('../../../data/beginner-puzzles')
var apiModule = require('../../../utils/api')
var api = apiModule.api
var app = getApp()

function getProgress() {
  return wx.getStorageSync('village_progress') || {}
}

Page({
  data: {
    statusBarHeight: 20,
    navBarHeight: 44,
    nodeId: '',
    nodeName: '',
    nodeIcon: '',
    nodeColor: '',
    nodeDescription: '',
    levels: [],
    completedLevel: 0,
  },

  onLoad: function (options) {
    var nodeId = options.id
    var node = null
    for (var i = 0; i < SKILL_TREE.length; i++) {
      if (SKILL_TREE[i].id === nodeId) { node = SKILL_TREE[i]; break }
    }
    if (!node) {
      wx.showToast({ title: '技能不存在', icon: 'none' })
      wx.navigateBack()
      return
    }

    this._node = node
    this.setData({
      statusBarHeight: app.globalData.statusBarHeight || 20,
      navBarHeight: app.globalData.navBarHeight || 44,
      nodeId: node.id,
      nodeName: node.name,
      nodeIcon: node.icon,
      nodeColor: node.color,
      nodeDescription: node.description,
    })
  },

  onShow: function () {
    this._refreshLevels()
  },

  _refreshLevels: function () {
    var node = this._node
    if (!node) return
    var progress = getProgress()
    var p = progress[node.id]
    var completed = (p && p.completedLevel) || 0
    var scores = (p && p.scores) || {}

    var levels = []
    for (var i = 0; i < node.levels.length; i++) {
      var lvl = node.levels[i]
      var status = 'locked'
      if (i < completed) {
        status = 'completed'
      } else if (i === completed) {
        status = 'available'
      }
      var score = scores[lvl.level] || 0
      var stars = 0
      if (status === 'completed') {
        var pct = lvl.count > 0 ? score / lvl.count : 0
        stars = pct >= 0.9 ? 3 : (pct >= 0.7 ? 2 : 1)
      }
      levels.push({
        level: lvl.level,
        name: lvl.name,
        tag: lvl.tag,
        count: lvl.count,
        status: status,
        score: score,
        stars: stars,
      })
    }

    this.setData({
      levels: levels,
      completedLevel: completed,
    })
  },

  onTapLevel: function (e) {
    var tag = e.currentTarget.dataset.tag
    var level = e.currentTarget.dataset.level
    var status = e.currentTarget.dataset.status

    if (status === 'locked') {
      wx.showToast({ title: '完成上一关后解锁', icon: 'none' })
      return
    }

    var that = this
    // 直接使用本地题库（已打包在小程序中）
    var allProblems = beginnerPuzzles.getPuzzlesByTag(tag)  // 已随机打乱
    if (!allProblems || allProblems.length === 0) {
      wx.showToast({ title: '题目加载失败', icon: 'none' })
      return
    }
    // 每次只出10题，从池中随机抽，重复做不会总是同样的题
    var problems = allProblems.slice(0, 10)

    app.globalData.playState = {
      problems: problems,
      currentIndex: 0,
      resultsAccumulated: [],
      isVillageMode: true,
      villageNodeId: that.data.nodeId,
      villageLevel: level,
      villagePuzzleTag: tag,
      villageNodeName: that.data.nodeName,
      userLevel: (app.globalData.userInfo && app.globalData.userInfo.level_name) || '25K',
      userRating: (app.globalData.userInfo && app.globalData.userInfo.rating) || 280,
    }

    wx.navigateTo({ url: '/pages/play/index' })
  },

  onBack: function () {
    wx.navigateBack()
  },
})

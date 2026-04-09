var SKILL_TREE = require('../../data/skill-tree')
var apiModule = require('../../utils/api')
var api = apiModule.api
var app = getApp()

function getProgress() {
  return wx.getStorageSync('village_progress') || {}
}

function isNodeUnlocked(nodeId, progress) {
  var node = null
  for (var i = 0; i < SKILL_TREE.length; i++) {
    if (SKILL_TREE[i].id === nodeId) { node = SKILL_TREE[i]; break }
  }
  if (!node) return false
  if (node.prerequisites.length === 0) return true

  for (var i = 0; i < node.prerequisites.length; i++) {
    var preId = node.prerequisites[i]
    var preProgress = progress[preId]
    if (!preProgress || !preProgress.completedLevel || preProgress.completedLevel < 1) {
      return false
    }
  }
  return true
}

function getNodeStatus(node, progress) {
  var p = progress[node.id]
  if (!isNodeUnlocked(node.id, progress)) return 'locked'
  if (p && p.completedLevel >= node.levels.length) return 'completed'
  if (p && p.completedLevel > 0) return 'in_progress'
  return 'available'
}

Page({
  data: {
    statusBarHeight: 20,
    navBarHeight: 44,
    nodes: [],
    overallProgress: 0,
    isGraduated: false,
    showGraduationToast: false,
  },

  onLoad: function () {
    this.setData({
      statusBarHeight: app.globalData.statusBarHeight || 20,
      navBarHeight: app.globalData.navBarHeight || 44,
    })
  },

  onShow: function () {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 1 })
    }
    this._loadProgress()
  },

  _loadProgress: function () {
    var progress = getProgress()
    var nodes = []
    var totalLevels = 0
    var completedLevels = 0

    for (var i = 0; i < SKILL_TREE.length; i++) {
      var node = SKILL_TREE[i]
      var status = getNodeStatus(node, progress)
      var p = progress[node.id]
      var completed = (p && p.completedLevel) || 0

      totalLevels += node.levels.length
      completedLevels += Math.min(completed, node.levels.length)

      var levelDots = []
      for (var j = 0; j < node.levels.length; j++) {
        levelDots.push({
          level: node.levels[j].level,
          status: j < completed ? 'done' : (j === completed && status !== 'locked' ? 'current' : 'pending'),
        })
      }

      nodes.push({
        id: node.id,
        name: node.name,
        icon: node.icon,
        color: node.color,
        description: node.description,
        status: status,
        completedLevel: completed,
        totalLevels: node.levels.length,
        levelDots: levelDots,
      })
    }

    var overallProgress = totalLevels > 0 ? Math.round(completedLevels / totalLevels * 100) : 0
    var isGraduated = overallProgress >= 100

    this.setData({
      nodes: nodes,
      overallProgress: overallProgress,
      isGraduated: isGraduated,
    })

    // 通关首次触发：弹提示 + 提升 rating 到 520
    if (isGraduated && !wx.getStorageSync('village_graduated')) {
      wx.setStorageSync('village_graduated', true)
      this._handleGraduation()
    }

    // sync from cloud in background
    this._syncFromCloud(progress)
  },

  _handleGraduation: function () {
    // 当前 rating 低于 520 才提升
    var userInfo = app.globalData.userInfo || {}
    var currentRating = userInfo.rating || wx.getStorageSync('userRating') || 520
    var promoteToSeven = currentRating < 520

    var content = '你已掌握基础技能，去天梯挑战更难的题目吧！'
    if (promoteToSeven) {
      content += '\n\n你的等级已提升至 7K (520分)。'
    }

    wx.showModal({
      title: '🎓 恭喜毕业！',
      content: content,
      confirmText: '去天梯',
      cancelText: '继续练习',
      success: function (res) {
        if (promoteToSeven) {
          // 调云函数升 rating
          api.setLevel('7K', 520).catch(function () {})
          if (app.globalData.userInfo) {
            app.globalData.userInfo.rating = 520
            app.globalData.userInfo.level_name = '7K'
          }
          app.globalData.latestRating = 520
          app.globalData.latestLevel = '7K'
          wx.setStorageSync('userRating', 520)
        }
        if (res.confirm) {
          // 跳转到首页天梯
          wx.switchTab({ url: '/pages/index/index' })
        }
      },
    })
  },

  _syncFromCloud: function (localProgress) {
    api.getVillageProgress().then(function (res) {
      if (!res || !res.village_progress) return
      var cloudProgress = res.village_progress
      var merged = {}
      var changed = false

      // merge: take the higher completedLevel
      var allKeys = {}
      var k
      for (k in localProgress) { allKeys[k] = true }
      for (k in cloudProgress) { allKeys[k] = true }

      for (k in allKeys) {
        var local = localProgress[k] || {}
        var cloud = cloudProgress[k] || {}
        var localLevel = local.completedLevel || 0
        var cloudLevel = cloud.completedLevel || 0
        if (cloudLevel > localLevel) {
          merged[k] = cloud
          changed = true
        } else {
          merged[k] = local
        }
      }

      if (changed) {
        wx.setStorageSync('village_progress', merged)
      }
    }).catch(function () {
      // silently ignore cloud sync errors
    })
  },

  onTapNode: function (e) {
    var nodeId = e.currentTarget.dataset.id
    var status = e.currentTarget.dataset.status
    if (status === 'locked') {
      wx.showToast({ title: '完成前置技能后解锁', icon: 'none' })
      return
    }
    wx.navigateTo({
      url: '/pages/village/node/index?id=' + nodeId,
    })
  },

  goLadder: function () {
    wx.switchTab({ url: '/pages/index/index' })
  },
})

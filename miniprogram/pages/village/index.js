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

    this.setData({
      nodes: nodes,
      overallProgress: overallProgress,
    })

    // sync from cloud in background
    this._syncFromCloud(progress)
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
})

var fusekiData = require('../../../data/fuseki')
var getFusekiByDifficulty = fusekiData.getFusekiByDifficulty
var DIFFICULTY_LABELS = fusekiData.DIFFICULTY_LABELS
var DIFFICULTY_COLORS = fusekiData.DIFFICULTY_COLORS

Page({
  data: {
    statusBarHeight: 0,
    navBarHeight: 44,
    groups: [],
  },

  onLoad: function () {
    var app = getApp()
    this.setData({
      statusBarHeight: app.globalData.statusBarHeight,
      navBarHeight: app.globalData.navBarHeight,
    })
    this._buildGroups()
  },

  _buildGroups: function () {
    var byDiff = getFusekiByDifficulty()
    var diffs = [1, 2, 3]
    var groups = []

    for (var i = 0; i < diffs.length; i++) {
      var diff = diffs[i]
      var fusekis = byDiff.get(diff) || []
      if (fusekis.length === 0) continue

      var colors = DIFFICULTY_COLORS[diff]
      groups.push({
        difficulty: diff,
        label: DIFFICULTY_LABELS[diff],
        bgColor: colors.bg,
        textColor: colors.text,
        count: fusekis.length,
        items: fusekis.map(function (f) {
          return {
            id: f.id,
            name: f.name,
            description: f.description,
            moveCount: f.moves.length,
            bgColor: colors.bg,
            textColor: colors.text,
          }
        }),
      })
    }

    this.setData({ groups: groups })
  },

  onTapFuseki: function (e) {
    var id = e.currentTarget.dataset.id
    wx.navigateTo({
      url: '/pages/fuseki/practice/index?id=' + id,
    })
  },
})

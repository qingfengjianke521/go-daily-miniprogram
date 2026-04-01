var josekiData = require('../../../data/joseki')
var getJosekiByDifficulty = josekiData.getJosekiByDifficulty
var DIFFICULTY_LABELS = josekiData.DIFFICULTY_LABELS
var DIFFICULTY_COLORS = josekiData.DIFFICULTY_COLORS

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
    var byDiff = getJosekiByDifficulty()
    var diffs = [1, 2, 3]
    var groups = []

    for (var i = 0; i < diffs.length; i++) {
      var diff = diffs[i]
      var josekis = byDiff.get(diff) || []
      if (josekis.length === 0) continue

      var colors = DIFFICULTY_COLORS[diff]
      groups.push({
        difficulty: diff,
        label: DIFFICULTY_LABELS[diff],
        bgColor: colors.bg,
        textColor: colors.text,
        count: josekis.length,
        items: josekis.map(function (j) {
          return {
            id: j.id,
            name: j.name,
            description: j.description,
            moveCount: j.moves.length,
            bgColor: colors.bg,
            textColor: colors.text,
          }
        }),
      })
    }

    this.setData({ groups: groups })
  },

  onTapJoseki: function (e) {
    var id = e.currentTarget.dataset.id
    wx.navigateTo({
      url: '/pages/joseki/practice/index?id=' + id,
    })
  },
})

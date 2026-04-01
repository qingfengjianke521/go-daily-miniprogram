var apiModule = require('../../utils/api')
var api = apiModule.api
var app = getApp()

Page({
  data: {
    statusBarHeight: 20,
    loading: true,
    topThree: [],
    restList: [],
  },

  onLoad: function () {
    this.setData({ statusBarHeight: app.globalData.statusBarHeight })
    this._fetch()
  },

  _fetch: function () {
    var that = this
    api.getLeaderboard().then(function (res) {
      var list = res.leaderboard || []
      that.setData({
        loading: false,
        topThree: list.slice(0, 3),
        restList: list.slice(3),
      })
    }).catch(function () {
      that.setData({ loading: false })
    })
  },

  handleBack: function () {
    wx.navigateBack()
  },
})

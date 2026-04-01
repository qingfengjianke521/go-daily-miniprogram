var apiModule = require('../../utils/api')
var api = apiModule.api
var app = getApp()

Page({
  data: {
    statusBarHeight: 20,
    activeTab: 'daily',
    loading: true,
    topThree: [],
    restList: [],
    myRank: null,
  },

  onLoad: function () {
    this.setData({ statusBarHeight: app.globalData.statusBarHeight })
  },

  onShow: function () {
    if (!app.checkAuth()) return
    this._fetch()
  },

  onSwitchTab: function (e) {
    var tab = e.currentTarget.dataset.tab
    if (tab === this.data.activeTab) return
    this.setData({ activeTab: tab, loading: true })
    this._fetch()
  },

  _fetch: function () {
    var that = this
    // 目前用 getLeaderboard (按rating排), 后续可改为按变化量排
    api.getLeaderboard().then(function (res) {
      var list = res.leaderboard || []
      that.setData({
        loading: false,
        topThree: list.slice(0, 3).map(function (u) {
          return {
            rank: u.rank,
            username: u.username,
            level_name: u.level_name,
            change: u.rating || 0,
            streak_days: u.streak_days || 0,
          }
        }),
        restList: list.slice(3).map(function (u) {
          return {
            rank: u.rank,
            username: u.username,
            level_name: u.level_name,
            change: u.rating || 0,
            streak_days: u.streak_days || 0,
          }
        }),
        myRank: null, // TODO: find current user in list
      })
    }).catch(function () {
      that.setData({ loading: false })
    })
  },
})

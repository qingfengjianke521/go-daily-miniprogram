var apiModule = require('../../utils/api')
var api = apiModule.api
var app = getApp()

// 随机围棋昵称（匿名用户用）
var GO_NAMES = ['执黑少年','白石飞侠','围棋小将','弈海棋童','落子无悔','星位高手','手筋达人','死活王者','天元少侠','定式大师']

function getInitial(name) {
  if (!name || name === '匿名棋手') return '棋'
  return name.charAt(0)
}

function fixName(name) {
  if (!name || name === '匿名棋手') {
    return GO_NAMES[Math.floor(Math.random() * GO_NAMES.length)]
  }
  return name
}

Page({
  data: {
    statusBarHeight: 20,
    activeTab: 'daily',
    loading: true,
    list: [],
    topThree: [],
    restList: [],
  },

  onLoad: function () {
    this.setData({ statusBarHeight: app.globalData.statusBarHeight })
  },

  onShow: function () {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 1 })
    }
    if (!app.checkAuth()) return
    this._fetch()
  },

  onTab: function (e) {
    var tab = e.currentTarget.dataset.tab
    if (tab === this.data.activeTab) return
    this.setData({ activeTab: tab, loading: true })
    this._fetch()
  },

  _fetch: function () {
    var that = this
    api.getLeaderboard().then(function (res) {
      var list = (res.leaderboard || []).map(function (u) {
        var name = fixName(u.username)
        return {
          rank: u.rank,
          username: name,
          initial: getInitial(name),
          level_name: u.level_name || '',
          rating: u.rating || 0,
          streak_days: u.streak_days || 0,
        }
      })
      that.setData({
        loading: false,
        list: list,
        topThree: list.slice(0, 3),
        restList: list.slice(3),
      })
    }).catch(function () {
      that.setData({ loading: false })
    })
  },
})

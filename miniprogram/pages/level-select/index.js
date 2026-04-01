var apiModule = require('../../utils/api')
var api = apiModule.api
var storage = require('../../utils/storage')

var LEVELS = [
  { name: '25级', label: '零基础', emoji: '🌱', desc: '我还不会下围棋', rating: 500 },
  { name: '20级', label: '入门', emoji: '⭐', desc: '我知道基本规则，会吃子', rating: 700 },
  { name: '10级', label: '有基础', emoji: '💪', desc: '我在学死活题和手筋', rating: 1100 },
  { name: '1级', label: '高手', emoji: '🏆', desc: '我有业余段位', rating: 1600 },
]

Page({
  data: {
    levels: LEVELS,
    selected: '',
    loading: false,
    statusBarHeight: 20,
    navBarHeight: 44,
  },

  onLoad: function () {
    var app = getApp()
    this.setData({
      statusBarHeight: app.globalData.statusBarHeight,
      navBarHeight: app.globalData.navBarHeight,
    })
  },

  onSelectLevel: function (e) {
    var name = e.currentTarget.dataset.name
    this.setData({ selected: name })
  },

  handleConfirm: function () {
    var that = this
    var selected = this.data.selected
    if (!selected || this.data.loading) return

    this.setData({ loading: true })

    api.setLevel(selected)
      .then(function (res) {
        // Update local userInfo with new level
        var userInfo = storage.getUserInfo() || {}
        userInfo.level_set = true
        userInfo.level_name = selected
        if (res.user && res.user.rating) {
          userInfo.rating = res.user.rating
        }
        storage.setUserInfo(userInfo)

        that.setData({ loading: false })
        wx.switchTab({ url: '/pages/index/index' })
      })
      .catch(function () {
        // Fallback: go home anyway
        that.setData({ loading: false })
        wx.switchTab({ url: '/pages/index/index' })
      })
  },

  _getBadgeText: function (name) {
    return name.replace('级', '').replace('段', 'D')
  },
})

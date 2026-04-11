var apiModule = require('../../utils/api')
var api = apiModule.api
var storage = require('../../utils/storage')

var LEVELS = [
  { name: '7K', label: '7级', emoji: '🌱', desc: '入门，了解基本规则', rating: 520 },
  { name: '3K', label: '3级', emoji: '⭐', desc: '有基础，在学死活手筋', rating: 695 },
  { name: '1D', label: '初段', emoji: '💪', desc: '业余初段水平', rating: 845 },
  { name: '3D', label: '三段', emoji: '🏆', desc: '业余高段位', rating: 960 },
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

    // 从 LEVELS 找到对应的 rating
    var selectedRating = 100
    for (var i = 0; i < LEVELS.length; i++) {
      if (LEVELS[i].name === selected) { selectedRating = LEVELS[i].rating; break }
    }

    // 调云函数 setLevel
    api.setLevel(selected, selectedRating)
      .then(function () {
        var userInfo = storage.getUserInfo() || {}
        userInfo.level_set = true
        userInfo.level_name = selected
        userInfo.rating = selectedRating
        storage.setUserInfo(userInfo)

        that.setData({ loading: false })
        wx.switchTab({ url: '/pages/index/index' })
      })
      .catch(function () {
        that.setData({ loading: false })
        wx.switchTab({ url: '/pages/index/index' })
      })
  },

  _getBadgeText: function (name) {
    return name.replace('级', '').replace('段', 'D')
  },
})

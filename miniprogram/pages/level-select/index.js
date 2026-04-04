var apiModule = require('../../utils/api')
var api = apiModule.api
var storage = require('../../utils/storage')

var LEVELS = [
  { name: '25K', oldName: '25级', label: '零基础', emoji: '🌱', desc: '我还不会下围棋', rating: 50 },
  { name: '20K', oldName: '20级', label: '入门', emoji: '⭐', desc: '我知道基本规则，会吃子', rating: 100 },
  { name: '10K', oldName: '10级', label: '有基础', emoji: '💪', desc: '我在学死活题和手筋', rating: 360 },
  { name: '1K', oldName: '1级', label: '高手', emoji: '🏆', desc: '我有业余段位', rating: 675 },
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

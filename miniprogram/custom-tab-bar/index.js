Component({
  data: {
    selected: 0,
    list: [
      { pagePath: '/pages/index/index', text: '首页', icon: '🏠' },
      { pagePath: '/pages/village/index', text: '学习', icon: '📖' },
      { pagePath: '/pages/ranking/index', text: '排行', icon: '🏆' },
      { pagePath: '/pages/profile/index', text: '我的', icon: '👤' },
    ],
  },

  methods: {
    switchTab: function (e) {
      var data = e.currentTarget.dataset
      wx.switchTab({ url: data.path })
    },
  },
})

Component({
  data: {
    selected: 0,
    list: [
      { pagePath: '/pages/index/index', text: '首页',
        icon: '/images/tab-home.png', selectedIcon: '/images/tab-home-active.png' },
      { pagePath: '/pages/village/index', text: '学习',
        icon: '/images/tab-joseki.png', selectedIcon: '/images/tab-joseki-active.png' },
      { pagePath: '/pages/ranking/index', text: '排行',
        icon: '/images/tab-rank.png', selectedIcon: '/images/tab-rank-active.png' },
      { pagePath: '/pages/profile/index', text: '我的',
        icon: '/images/tab-profile.png', selectedIcon: '/images/tab-profile-active.png' },
    ],
  },

  methods: {
    switchTab: function (e) {
      var data = e.currentTarget.dataset
      wx.switchTab({ url: data.path })
    },
  },
})

const tutorialIndex = require('./tutorial-index.js')

Page({
  data: {
    statusBarHeight: 0,
    topPadding: 44,
    sections: [],
  },

  onLoad() {
    const app = getApp()
    const sbh = app.globalData.statusBarHeight || wx.getWindowInfo().statusBarHeight || 20
    this.setData({
      statusBarHeight: sbh,
      topPadding: sbh + 44,
    })
    this._loadSections()
  },

  onShow() {
    // Refresh progress when returning from a lesson
    this._loadProgress()
  },

  _loadSections() {
    const sections = tutorialIndex.map(s => ({
      ...s,
      expanded: s.id === 1, // Expand first section by default
      completed: 0,
      lessons: s.lessons.map(l => ({ ...l, done: false })),
    }))
    this.setData({ sections })
    this._loadProgress()
  },

  _loadProgress() {
    // Load completed lessons from local storage
    const progress = wx.getStorageSync('learn_progress') || {}
    const sections = this.data.sections.map(s => {
      let completed = 0
      const lessons = s.lessons.map(l => {
        const done = !!progress[l.id]
        if (done) completed++
        return { ...l, done }
      })
      return { ...s, lessons, completed }
    })
    this.setData({ sections })
  },

  toggleSection(e) {
    const id = e.currentTarget.dataset.id
    const sections = this.data.sections.map(s => ({
      ...s,
      expanded: s.id === id ? !s.expanded : s.expanded,
    }))
    this.setData({ sections })
  },

  startLesson(e) {
    const { section, lesson, slug } = e.currentTarget.dataset
    wx.navigateTo({
      url: `/learn/lesson?section=${section}&lesson=${lesson}&slug=${slug}`,
    })
  },

  goBack() {
    wx.navigateBack({ fail: () => wx.switchTab({ url: '/pages/index/index' }) })
  },
})

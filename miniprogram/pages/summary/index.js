var apiModule = require('../../utils/api')
var api = apiModule.api
var app = getApp()

var completeAudio = wx.createInnerAudioContext()
completeAudio.src = '/audio/complete.mp3'

var ENCOURAGE = {
  perfect: {
    emojis: ['🎉', '🏆', '⭐'],
    titles: ['完美通关！', '太厉害了！', '全部正确！'],
    subtitles: ['三题全对，棋力飞升！', '今天状态超棒！', '继续保持！'],
  },
  good: {
    emojis: ['👏', '💪', '😊'],
    titles: ['做得不错！', '继续加油！', '有进步！'],
    subtitles: ['再接再厉，明天更好！', '坚持练习，棋力会稳步提升', '错题复盘一下，印象更深'],
  },
  ok: {
    emojis: ['🤔', '📚', '💡'],
    titles: ['今日已打卡', '完成练习！', '坚持就是胜利'],
    subtitles: ['做错不要紧，关键是坚持', '每天进步一点点', '复盘错题，下次一定行！'],
  },
  zero: {
    emojis: ['💪', '🌱', '🎯'],
    titles: ['勇气可嘉！', '今日已完成', '加油！'],
    subtitles: ['勇于挑战就很棒', '围棋之路，贵在坚持', '多练习就能提高'],
  },
}

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)] }

Page({
  data: {
    statusBarHeight: 20,
    step: 0,
    emoji: '🎉',
    confettiColors: ['#58CC02', '#FF4B4B', '#FFC800', '#1C94E0', '#9B59B6'],
    title: '',
    subtitle: '',
    circles: [],
    totalChangeText: '+0',
    totalChangeColor: '#58CC02',
    levelName: '',
    rating: 0,
    levelProgress: 0,
    showStreak: false,
    streakDays: 0,
  },

  onLoad: function () {
    this.setData({ statusBarHeight: app.globalData.statusBarHeight })

    var state = app.globalData.summaryState
    if (!state) { wx.switchTab({ url: '/pages/index/index' }); return }

    var results = state.results || []
    var correct = 0, totalChange = 0, circles = []

    for (var i = 0; i < results.length; i++) {
      if (results[i].is_correct) correct++
      totalChange += results[i].rating_change || 0
      circles.push({
        number: i + 1,
        status: results[i].is_correct ? 'correct' : 'wrong',
        ratingChange: results[i].rating_change,
      })
    }
    for (var j = results.length; j < 3; j++) {
      circles.push({ number: j + 1, status: 'pending', ratingChange: null })
    }

    var rate = correct / Math.max(results.length, 1)
    var group = rate >= 1 ? ENCOURAGE.perfect : rate >= 0.6 ? ENCOURAGE.good : rate > 0 ? ENCOURAGE.ok : ENCOURAGE.zero

    this.setData({
      emoji: pick(group.emojis),
      title: pick(group.titles),
      subtitle: pick(group.subtitles),
      circles: circles,
      totalChangeText: (totalChange >= 0 ? '+' : '') + totalChange,
      totalChangeColor: totalChange >= 0 ? '#58CC02' : '#FF4B4B',
    })

    // 获取最新 stats
    var that = this
    api.getStats().then(function (stats) {
      that.setData({
        levelName: stats.level_name || '',
        rating: stats.rating || 0,
        levelProgress: Math.min(100, ((stats.rating % 400) / 400) * 100),
        showStreak: (stats.streak_days || 0) > 1,
        streakDays: stats.streak_days || 0,
      })
    }).catch(function () {})

    // 播放完成音效 + 分步动画
    try { completeAudio.stop(); completeAudio.play() } catch (e) {}
    this._runAnimation()
  },

  _runAnimation: function () {
    var that = this
    var delays = [0, 400, 800, 1400, 2000, 2800]
    for (var i = 0; i < delays.length; i++) {
      ;(function (step, delay) {
        setTimeout(function () {
          that.setData({ step: step + 1 })
        }, delay)
      })(i, delays[i])
    }
  },

  handleShare: function () {
    var that = this
    wx.showLoading({ title: '生成中...' })

    var query = this.createSelectorQuery()
    query.select('#shareCanvas').fields({ node: true, size: true }).exec(function (res) {
      if (!res || !res[0]) { wx.hideLoading(); return }

      var canvas = res[0].node
      var ctx = canvas.getContext('2d')
      var dpr = 2
      canvas.width = 600 * dpr
      canvas.height = 400 * dpr
      ctx.scale(dpr, dpr)

      // 背景
      ctx.fillStyle = '#FFFFFF'
      ctx.fillRect(0, 0, 600, 400)

      // 顶部绿色条
      ctx.fillStyle = '#58CC02'
      ctx.fillRect(0, 0, 600, 8)

      // 标题
      ctx.fillStyle = '#4B4B4B'
      ctx.font = 'bold 28px sans-serif'
      ctx.textAlign = 'left'
      ctx.fillText('黑白天天练', 40, 60)

      ctx.fillStyle = '#AFAFAF'
      ctx.font = '16px sans-serif'
      ctx.textAlign = 'right'
      ctx.fillText('棋力 ' + (that.data.rating || '--'), 560, 60)

      // Emoji + 标题
      ctx.textAlign = 'center'
      ctx.font = '48px sans-serif'
      ctx.fillText(that.data.emoji, 300, 130)

      ctx.fillStyle = '#4B4B4B'
      ctx.font = 'bold 24px sans-serif'
      ctx.fillText(that.data.title, 300, 170)

      // 3 circles
      var circles = that.data.circles
      var startX = 180
      for (var i = 0; i < circles.length; i++) {
        var cx = startX + i * 120
        var cy = 220

        // 连线
        if (i > 0) {
          ctx.strokeStyle = circles[i].status !== 'pending' ? '#58CC02' : '#E5E5E5'
          ctx.lineWidth = 3
          ctx.beginPath()
          ctx.moveTo(cx - 96, cy)
          ctx.lineTo(cx - 24, cy)
          ctx.stroke()
        }

        // 圆
        ctx.beginPath()
        ctx.arc(cx, cy, 22, 0, Math.PI * 2)
        if (circles[i].status === 'correct') {
          ctx.fillStyle = '#58CC02'
        } else if (circles[i].status === 'wrong') {
          ctx.fillStyle = '#FF4B4B'
        } else {
          ctx.fillStyle = '#E5E5E5'
        }
        ctx.fill()

        // 图标
        ctx.fillStyle = '#FFFFFF'
        ctx.font = 'bold 18px sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        if (circles[i].status === 'correct') {
          ctx.fillText('✓', cx, cy)
        } else if (circles[i].status === 'wrong') {
          ctx.fillText('✕', cx, cy)
        } else {
          ctx.fillText(String(circles[i].number), cx, cy)
        }
        ctx.textBaseline = 'alphabetic'

        // 分数
        var rc = circles[i].ratingChange
        if (rc) {
          ctx.font = '14px sans-serif'
          ctx.fillStyle = rc > 0 ? '#58CC02' : '#FF4B4B'
          ctx.fillText((rc > 0 ? '+' : '') + rc, cx, cy + 40)
        }
      }

      // 棋力变化
      ctx.fillStyle = '#4B4B4B'
      ctx.font = '16px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('棋力变化', 230, 310)

      ctx.font = 'bold 32px sans-serif'
      ctx.fillStyle = that.data.totalChangeColor
      ctx.fillText(that.data.totalChangeText, 370, 315)

      // streak
      if (that.data.showStreak) {
        ctx.font = '16px sans-serif'
        ctx.fillStyle = '#FF9600'
        ctx.fillText('🔥 连续 ' + that.data.streakDays + ' 天', 300, 360)
      }

      // 底部
      ctx.fillStyle = '#CCCCCC'
      ctx.font = '12px sans-serif'
      ctx.fillText('扫码一起练棋 · 黑白天天练', 300, 390)

      // 导出
      wx.canvasToTempFilePath({
        canvas: canvas,
        success: function (res2) {
          wx.hideLoading()
          wx.previewImage({ urls: [res2.tempFilePath] })
        },
        fail: function () {
          wx.hideLoading()
          wx.showToast({ title: '生成失败', icon: 'none' })
        }
      })
    })
  },

  handleContinue: function () {
    wx.showLoading({ title: '选题中...' })
    api.getContinueProblem().then(function (res) {
      wx.hideLoading()
      if (res.problem) {
        app.globalData.playState = {
          problems: [res.problem],
          currentIndex: 0,
          resultsAccumulated: [],
          isContinueMode: true,
        }
        wx.redirectTo({ url: '/pages/play/index' })
      } else {
        wx.showToast({ title: '没有更多题目了', icon: 'none' })
      }
    }).catch(function () {
      wx.hideLoading()
      wx.showToast({ title: '获取失败', icon: 'none' })
    })
  },

  handleBack: function () {
    wx.switchTab({ url: '/pages/index/index' })
  },
})

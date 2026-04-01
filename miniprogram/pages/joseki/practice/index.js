var josekiData = require('../../../data/joseki')
var getJosekiById = josekiData.getJosekiById
var getNextJoseki = josekiData.getNextJoseki
var JOSEKI_VIEW_REGION = josekiData.JOSEKI_VIEW_REGION

Page({
  data: {
    statusBarHeight: 0,
    navBarHeight: 44,
    joseki: null,
    currentStep: 0,
    totalMoves: 0,
    isDone: false,
    hintMsg: '',
    visibleStones: [],
    lastMove: null,
    nextExpected: null,
    hasNext: false,
    viewRegion: null,
    progressPercent: 0,
    stepText: '',
  },

  _josekiId: '',
  _stoneSound: null,
  _hintTimer: null,

  onLoad: function (options) {
    var app = getApp()
    this.setData({
      statusBarHeight: app.globalData.statusBarHeight,
      navBarHeight: app.globalData.navBarHeight,
    })

    // Init sound
    this._stoneSound = wx.createInnerAudioContext()
    this._stoneSound.src = '/audio/stone.mp3'

    this._josekiId = options.id || ''
    this._loadJoseki(this._josekiId)
  },

  onUnload: function () {
    if (this._stoneSound) {
      this._stoneSound.destroy()
      this._stoneSound = null
    }
    if (this._hintTimer) {
      clearTimeout(this._hintTimer)
    }
  },

  _loadJoseki: function (id) {
    var joseki = getJosekiById(id)
    if (!joseki) {
      this.setData({ joseki: null })
      return
    }

    var nextJoseki = getNextJoseki(id)
    this._josekiId = id

    this.setData({
      joseki: joseki,
      totalMoves: joseki.moves.length,
      hasNext: !!nextJoseki,
      currentStep: 0,
      isDone: false,
      hintMsg: '',
      viewRegion: JOSEKI_VIEW_REGION,
    })

    this._updateBoard()
  },

  _updateBoard: function () {
    var joseki = this.data.joseki
    if (!joseki) return

    var step = this.data.currentStep
    var total = this.data.totalMoves
    var isDone = step >= total

    var visibleStones = joseki.moves.slice(0, step).map(function (m) {
      return { x: m.x, y: m.y, color: m.color }
    })

    var lastMove = step > 0
      ? { x: joseki.moves[step - 1].x, y: joseki.moves[step - 1].y }
      : null

    var nextExpected = step < total ? joseki.moves[step] : null
    var progressPercent = total > 0 ? (step / total) * 100 : 0
    var stepText = isDone
      ? '共 ' + total + ' 手 · 完成'
      : '第 ' + (step + 1) + ' / ' + total + ' 手'

    this.setData({
      visibleStones: visibleStones,
      lastMove: lastMove,
      nextExpected: nextExpected,
      isDone: isDone,
      progressPercent: progressPercent,
      stepText: stepText,
    })
  },

  _playSound: function () {
    if (this._stoneSound) {
      this._stoneSound.stop()
      this._stoneSound.play()
    }
  },

  onBoardMove: function (e) {
    if (this.data.isDone || !this.data.nextExpected) return

    var x = e.detail.x
    var y = e.detail.y
    var expected = this.data.nextExpected

    if (x === expected.x && y === expected.y) {
      this._advance()
    } else {
      this._showHint('不对哦，再想想')
    }
  },

  _advance: function () {
    if (this.data.currentStep < this.data.totalMoves) {
      this._playSound()
      this.setData({ currentStep: this.data.currentStep + 1, hintMsg: '' })
      this._updateBoard()
    }
  },

  onTapPrev: function () {
    if (this.data.currentStep > 0) {
      this.setData({ currentStep: this.data.currentStep - 1, hintMsg: '' })
      this._updateBoard()
    }
  },

  onTapNext: function () {
    this._advance()
  },

  onTapReset: function () {
    this.setData({ currentStep: 0, hintMsg: '' })
    this._updateBoard()
  },

  onTapNextJoseki: function () {
    var nextJoseki = getNextJoseki(this._josekiId)
    if (nextJoseki) {
      this._loadJoseki(nextJoseki.id)
    } else {
      this.onTapBack()
    }
  },

  onTapBack: function () {
    wx.navigateBack({ delta: 1 })
  },

  onTapBackToList: function () {
    wx.navigateBack({ delta: 1 })
  },

  _showHint: function (msg) {
    var self = this
    if (this._hintTimer) clearTimeout(this._hintTimer)
    this.setData({ hintMsg: msg })
    this._hintTimer = setTimeout(function () {
      self.setData({ hintMsg: '' })
    }, 1500)
  },
})

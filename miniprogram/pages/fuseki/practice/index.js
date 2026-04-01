var fusekiData = require('../../../data/fuseki')
var getFusekiById = fusekiData.getFusekiById
var getNextFuseki = fusekiData.getNextFuseki

Page({
  data: {
    statusBarHeight: 0,
    navBarHeight: 44,
    fuseki: null,
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
    currentColorLabel: '',
  },

  _fusekiId: '',
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

    this._fusekiId = options.id || ''
    this._loadFuseki(this._fusekiId)
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

  _loadFuseki: function (id) {
    var fuseki = getFusekiById(id)
    if (!fuseki) {
      this.setData({ fuseki: null })
      return
    }

    var nextFuseki = getNextFuseki(id)
    this._fusekiId = id

    this.setData({
      fuseki: fuseki,
      totalMoves: fuseki.moves.length,
      hasNext: !!nextFuseki,
      currentStep: 0,
      isDone: false,
      hintMsg: '',
      viewRegion: null,
    })

    this._updateBoard()
  },

  _updateBoard: function () {
    var fuseki = this.data.fuseki
    if (!fuseki) return

    var step = this.data.currentStep
    var total = this.data.totalMoves
    var isDone = step >= total

    var visibleStones = fuseki.moves.slice(0, step).map(function (m) {
      return { x: m.x, y: m.y, color: m.color }
    })

    var lastMove = step > 0
      ? { x: fuseki.moves[step - 1].x, y: fuseki.moves[step - 1].y }
      : null

    var nextExpected = step < total ? fuseki.moves[step] : null
    var progressPercent = total > 0 ? (step / total) * 100 : 0
    var stepText = isDone
      ? '共 ' + total + ' 手 · 完成'
      : '第 ' + (step + 1) + ' / ' + total + ' 手'

    var currentColorLabel = ''
    if (nextExpected) {
      currentColorLabel = nextExpected.color === 'black' ? '黑' : '白'
    }

    this.setData({
      visibleStones: visibleStones,
      lastMove: lastMove,
      nextExpected: nextExpected,
      isDone: isDone,
      progressPercent: progressPercent,
      stepText: stepText,
      currentColorLabel: currentColorLabel,
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

  onTapNextFuseki: function () {
    var nextFuseki = getNextFuseki(this._fusekiId)
    if (nextFuseki) {
      this._loadFuseki(nextFuseki.id)
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

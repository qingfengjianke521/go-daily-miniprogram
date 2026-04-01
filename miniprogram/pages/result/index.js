var goLogic = require('../../utils/go-logic')

var app = getApp()

var PRAISE = ['太棒了！', '完美！', '厉害！', '漂亮！']

Page({
  data: {
    statusBarHeight: 20,
    isCorrect: true,
    ratingChange: 0,
    displayedChange: 0,
    message: '',
    bgGradient: '',
    iconColor: '',
    btnColor: '',
    btnLabel: '',
    isLast: false,
    // Replay board (for wrong answers)
    showReplay: false,
    boardSize: 13,
    replayStones: [],
    viewRegion: null,
    replayLastMove: null,
  },

  _resultState: null,
  _countTimer: null,
  _replayTimer: null,

  onLoad: function () {
    this.setData({ statusBarHeight: app.globalData.statusBarHeight })

    var resultState = app.globalData.resultState
    if (!resultState) {
      wx.navigateBack()
      return
    }

    this._resultState = resultState

    var isCorrect = resultState.isCorrect
    var ratingChange = resultState.ratingChange || 0
    var problem = resultState.problem
    var isLast = resultState.currentIndex + 1 >= resultState.problems.length

    var message = isCorrect
      ? PRAISE[Math.floor(Math.random() * PRAISE.length)]
      : '没关系，看看正解'

    this.setData({
      isCorrect: isCorrect,
      ratingChange: ratingChange,
      displayedChange: 0,
      message: message,
      bgGradient: isCorrect
        ? 'linear-gradient(to bottom, #DFFFC0, #F7F7F7)'
        : 'linear-gradient(to bottom, #FFDDDD, #F7F7F7)',
      iconColor: isCorrect ? '#58CC02' : '#FF4B4B',
      btnColor: isCorrect ? '#58CC02' : '#FF4B4B',
      btnLabel: isLast ? '查看总结' : '继续',
      isLast: isLast,
      showReplay: !isCorrect,
      boardSize: problem.board_size || 13,
      replayStones: problem.initial_stones ? [].concat(problem.initial_stones) : [],
      viewRegion: problem.view_region || null,
      replayLastMove: null,
    })

    // Count-up animation
    this._animateCount(Math.abs(ratingChange))

    // Replay for wrong answers
    if (!isCorrect && resultState.correctSequence && resultState.correctSequence.length > 0) {
      this._startReplay(problem, resultState.correctSequence)
    }
  },

  onUnload: function () {
    if (this._countTimer) clearInterval(this._countTimer)
    if (this._replayTimer) clearInterval(this._replayTimer)
  },

  _animateCount: function (target) {
    if (target === 0) {
      this.setData({ displayedChange: 0 })
      return
    }

    var that = this
    var current = 0
    var step = Math.max(1, Math.ceil(target / 20))

    this._countTimer = setInterval(function () {
      current = Math.min(current + step, target)
      that.setData({ displayedChange: current })
      if (current >= target) {
        clearInterval(that._countTimer)
      }
    }, 40)
  },

  _startReplay: function (problem, correctSequence) {
    var that = this
    var boardSize = problem.board_size || 13
    var uc = (problem.description && problem.description.indexOf('白先') !== -1) ? 'white' : 'black'
    var oc = uc === 'black' ? 'white' : 'black'

    var currentBoard = goLogic.placeStones(goLogic.createBoard(boardSize), problem.initial_stones || [])
    var i = 0

    this._replayTimer = setInterval(function () {
      if (i >= correctSequence.length) {
        clearInterval(that._replayTimer)
        return
      }

      var coord = correctSequence[i]
      var color = i % 2 === 0 ? uc : oc
      var result = goLogic.playMove(currentBoard, coord[0], coord[1], color)
      currentBoard = result.newBoard

      var newStones = []
      for (var y = 0; y < currentBoard.length; y++) {
        for (var x = 0; x < currentBoard[y].length; x++) {
          if (currentBoard[y][x]) {
            newStones.push({ x: x, y: y, color: currentBoard[y][x] })
          }
        }
      }

      that.setData({
        replayStones: newStones,
        replayLastMove: { x: coord[0], y: coord[1] },
      })

      i++
    }, 800)
  },

  handleReplay: function () {
    // Reset replay
    if (this._replayTimer) clearInterval(this._replayTimer)

    var resultState = this._resultState
    var problem = resultState.problem

    this.setData({
      replayStones: problem.initial_stones ? [].concat(problem.initial_stones) : [],
      replayLastMove: null,
    })

    if (resultState.correctSequence && resultState.correctSequence.length > 0) {
      this._startReplay(problem, resultState.correctSequence)
    }
  },

  handleContinue: function () {
    var resultState = this._resultState
    var nextIndex = resultState.currentIndex + 1

    if (nextIndex >= resultState.problems.length) {
      // Go to summary
      app.globalData.summaryState = {
        results: resultState.resultsAccumulated,
        problems: resultState.problems,
      }
      wx.redirectTo({ url: '/pages/summary/index' })
    } else {
      // Go to next play
      app.globalData.playState = {
        problems: resultState.problems,
        currentIndex: nextIndex,
        resultsAccumulated: resultState.resultsAccumulated,
      }
      wx.redirectTo({ url: '/pages/play/index' })
    }
  },
})

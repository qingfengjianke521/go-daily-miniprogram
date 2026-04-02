var apiModule = require('../../utils/api')
var api = apiModule.api
var goLogic = require('../../utils/go-logic')

var app = getApp()

// 音效
var stoneAudio = wx.createInnerAudioContext()
stoneAudio.src = '/audio/stone.mp3'
var correctAudio = wx.createInnerAudioContext()
correctAudio.src = '/audio/correct.mp3'
var wrongAudio = wx.createInnerAudioContext()
wrongAudio.src = '/audio/wrong.mp3'

// 随机鼓励语
var CORRECT_TEXTS = ['妙手！', '完美！', '好眼力！', '太棒了！', '正确！', '一步到位！']
var WRONG_TEXTS = ['不对哦', '差一点', '再看看', '这步有问题']

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)]
}

function userColor(description) {
  if (description && description.indexOf('白先') !== -1) return 'white'
  return 'black'
}

function boardToStones(board) {
  var stones = []
  for (var y = 0; y < board.length; y++) {
    for (var x = 0; x < board[y].length; x++) {
      if (board[y][x]) {
        stones.push({ x: x, y: y, color: board[y][x] })
      }
    }
  }
  return stones
}

Page({
  data: {
    statusBarHeight: 20,
    problemIndex: 0,
    totalProblems: 0,
    description: '',
    category: '',
    categoryClass: '',
    boardSize: 13,
    stones: [],
    viewRegion: null,
    interactive: false,
    currentColor: 'black',
    lastMove: null,
    moveHistory: [],
    highlightPoints: [],
    currentStep: 0,
    totalMoves: 0,
    isDone: false,
    advancing: false,
    hintMsg: '',
    ratingChange: 0,
    submitting: false,
    progressPercent: 0,
    showHint: false,
    isWrong: false,
    showingSolution: false,
    // 反馈面板
    feedbackVisible: false,
    feedbackType: '',       // 'correct' | 'wrong' | 'skip'
    feedbackText: '',
    feedbackScore: 0,
    feedbackCanContinue: false,
    feedbackButtonText: '继续',
    // 段位升级
    showLevelUp: false,
    levelUpName: '',
  },

  _board: null,
  _playHistory: [],
  _seq: [],
  _uc: 'black',
  _oc: 'white',
  _problem: null,
  _playState: null,
  _startTime: 0,
  _hintTimer: null,
  _opponentTimer: null,

  onLoad: function () {
    this.setData({ statusBarHeight: app.globalData.statusBarHeight })

    var playState = app.globalData.playState
    if (!playState) {
      wx.navigateBack()
      return
    }

    this._playState = playState
    this._initProblem()
  },

  onUnload: function () {
    if (this._hintTimer) clearTimeout(this._hintTimer)
    if (this._opponentTimer) clearTimeout(this._opponentTimer)
  },

  _initProblem: function () {
    var playState = this._playState
    var problem = playState.problems[playState.currentIndex]
    if (!problem) {
      wx.navigateBack()
      return
    }

    this._problem = problem
    var uc = userColor(problem.description)
    var oc = uc === 'black' ? 'white' : 'black'
    this._uc = uc
    this._oc = oc

    var seq = (problem.correct_sequences && problem.correct_sequences[0]) || []
    this._seq = seq
    var totalMoves = seq.length
    var boardSize = problem.board_size || 13

    var initBoard = goLogic.placeStones(goLogic.createBoard(boardSize), problem.initial_stones || [])
    this._board = initBoard
    this._playHistory = []
    this._startTime = Date.now()

    var cat = problem.category || ''
    var catMap = { '死活': 'tag-life', '手筋': 'tag-tesuji', '官子': 'tag-endgame', '入门': 'tag-beginner', '定式': 'tag-joseki', '中盘': 'tag-middle' }
    var categoryClass = catMap[cat] || ''

    this.setData({
      problemIndex: playState.currentIndex + 1,
      totalProblems: playState.problems.length,
      description: problem.description || '',
      goalHint: problem.hint || '',
      category: cat,
      categoryClass: categoryClass,
      boardSize: boardSize,
      stones: problem.initial_stones ? [].concat(problem.initial_stones) : [],
      viewRegion: problem.view_region || null,
      interactive: totalMoves > 0,
      currentColor: uc,
      lastMove: null,
      moveHistory: [],
      highlightPoints: [],
      currentStep: 0,
      totalMoves: totalMoves,
      isDone: totalMoves === 0,
      advancing: false,
      hintMsg: '',
      ratingChange: 0,
      submitting: false,
      progressPercent: this._calcProgress(0, false),
      showHint: false,
      isWrong: false,
      showingSolution: false,
      feedbackVisible: false,
      feedbackType: '',
      feedbackText: '',
      feedbackScore: 0,
      feedbackCanContinue: false,
      feedbackButtonText: '继续',
    })
  },

  _calcProgress: function (currentStep, isDone) {
    var playState = this._playState
    var totalProblems = playState.problems.length
    var totalMoves = this._seq.length || 1
    var fraction = isDone ? 1 : currentStep / totalMoves
    return ((playState.currentIndex + fraction) / totalProblems) * 100
  },

  _placeStep: function (stepIdx, currentBoard, currentHistory) {
    var seq = this._seq
    if (stepIdx >= seq.length) return { newBoard: currentBoard, newHistory: currentHistory }

    var coord = seq[stepIdx]
    var color = stepIdx % 2 === 0 ? this._uc : this._oc
    var result = goLogic.playMove(currentBoard, coord[0], coord[1], color)
    var newHistory = currentHistory.concat([{ x: coord[0], y: coord[1], color: color }])
    return { newBoard: result.newBoard, newHistory: newHistory }
  },

  // ========== 用户操作 ==========

  handleAdvance: function () {
    if (this.data.advancing || this.data.isDone || this.data.feedbackVisible) return
    var step = this.data.currentStep
    if (step >= this.data.totalMoves) return

    var that = this
    var seq = this._seq

    that.setData({ advancing: true })

    var result = that._placeStep(step, that._board, that._playHistory)
    that._board = result.newBoard
    that._playHistory = result.newHistory

    var coord = seq[step]
    var nextStep = step + 1

    that.setData({
      stones: boardToStones(that._board),
      lastMove: { x: coord[0], y: coord[1] },
      moveHistory: that._playHistory.slice(),
      currentStep: nextStep,
      progressPercent: that._calcProgress(nextStep, false),
    })

    try { stoneAudio.stop(); stoneAudio.play() } catch (e) {}
    wx.vibrateShort({ type: 'light' }).catch(function () {})

    // 所有步骤完成
    if (nextStep >= that.data.totalMoves) {
      that.setData({ advancing: false, interactive: false })
      that._finishCorrect()
      return
    }

    // 对手应手（奇数步）
    if (nextStep % 2 === 1) {
      that.setData({ interactive: false })

      that._opponentTimer = setTimeout(function () {
        try { stoneAudio.stop(); stoneAudio.play() } catch (e) {}
        wx.vibrateShort({ type: 'light' }).catch(function () {})

        var oppResult = that._placeStep(nextStep, that._board, that._playHistory)
        that._board = oppResult.newBoard
        that._playHistory = oppResult.newHistory

        var oppCoord = seq[nextStep]
        var afterOpp = nextStep + 1

        that.setData({
          stones: boardToStones(that._board),
          lastMove: { x: oppCoord[0], y: oppCoord[1] },
          moveHistory: that._playHistory.slice(),
          currentStep: afterOpp,
          advancing: false,
          interactive: afterOpp < that.data.totalMoves && afterOpp % 2 === 0,
          progressPercent: that._calcProgress(afterOpp, false),
        })

        if (afterOpp >= that.data.totalMoves) {
          that._finishCorrect()
        }
      }, 600)
    } else {
      that.setData({ advancing: false, interactive: true })
    }
  },

  onBoardMove: function (e) {
    if (this.data.advancing || this.data.isDone || this.data.feedbackVisible) return
    var step = this.data.currentStep
    if (step >= this.data.totalMoves || step % 2 !== 0) return

    var detail = e.detail
    var x = detail.x
    var y = detail.y
    var expected = this._seq[step]

    console.log('[play] move:', x, y, 'expected:', JSON.stringify(expected), 'step:', step, 'seqLen:', this._seq.length)
    console.log('[play] allSeqs first moves:', (this._problem.correct_sequences||[]).map(function(s){return s&&s[0]?JSON.stringify(s[0]):'null'}).join(', '))

    // Check against ALL correct sequences, not just the first one
    var allSeqs = (this._problem.correct_sequences || [])
    var isCorrectMove = false

    if (expected && expected[0] === x && expected[1] === y) {
      isCorrectMove = true
    } else if (step === 0) {
      // First move: check if it matches the first move of ANY correct sequence
      for (var si = 0; si < allSeqs.length; si++) {
        var altSeq = allSeqs[si]
        if (altSeq && altSeq[0] && altSeq[0][0] === x && altSeq[0][1] === y) {
          // Switch to this sequence for subsequent moves
          this._seq = altSeq
          isCorrectMove = true
          break
        }
      }
    }

    if (isCorrectMove) {
      this.handleAdvance()
    } else {
      this._showWrongMove(x, y)
    }
  },

  // ========== 答对流程 ==========

  _finishCorrect: function () {
    if (this.data.submitting) return
    var that = this
    that.setData({ submitting: true })

    var timeSpentMs = Date.now() - that._startTime
    var problem = that._problem

    api.submitAnswer(
      problem.problem_id, that._seq, timeSpentMs, true,
      problem.difficulty_rating || 0, problem.expected_time_ms || 60000
    ).then(function (res) {
      that.setData({
        ratingChange: res.rating_change || 0,
        isDone: true,
        interactive: false,
        submitting: false,
        progressPercent: that._calcProgress(that.data.totalMoves, true),
      })
      // 检测段位变化
      if (res.level_changed && res.new_level) {
        that.setData({ levelUpName: res.new_level, showLevelUp: true })
        setTimeout(function () { that.setData({ showLevelUp: false }) }, 3000)
      }

      // 播放答对音效 + 显示绿色反馈面板
      try { correctAudio.stop(); correctAudio.play() } catch (e) {}
      that._showFeedback('correct', pickRandom(CORRECT_TEXTS), res.rating_change || 0)
    }).catch(function () {
      that.setData({ isDone: true, interactive: false, submitting: false })
      that._showFeedback('correct', '完成！', 0)
    })
  },

  // ========== 答错流程 ==========

  _showWrongMove: function (x, y) {
    var that = this
    var color = that._uc

    wx.vibrateLong().catch(function () {})
    try { wrongAudio.stop(); wrongAudio.play() } catch (e) {}

    // 在棋盘上显示错误落子
    var wrongStone = { x: x, y: y, color: color }
    var currentStones = that.data.stones.slice()
    currentStones.push(wrongStone)

    // 标出正确位置（绿色闪烁点）
    var expected = that._seq[that.data.currentStep]
    var highlight = expected ? [{ x: expected[0], y: expected[1] }] : []

    that.setData({
      stones: currentStones,
      lastMove: { x: x, y: y },
      interactive: false,
      isWrong: true,
      highlightPoints: highlight,
    })

    // 提交错误结果
    var timeSpentMs = Date.now() - that._startTime
    var problem = that._problem
    api.submitAnswer(
      problem.problem_id, [], timeSpentMs, false,
      problem.difficulty_rating || 0, problem.expected_time_ms || 60000
    ).then(function (res) {
      that.setData({ ratingChange: res.rating_change || 0 })
      // 显示红色反馈面板
      that._showFeedback('wrong', pickRandom(WRONG_TEXTS), res.rating_change || 0)
    }).catch(function () {
      that._showFeedback('wrong', pickRandom(WRONG_TEXTS), 0)
    })

    // 1.5秒后自动播放正解
    setTimeout(function () {
      that._playSolution()
    }, 1500)
  },

  // ========== 反馈面板 ==========

  _showFeedback: function (type, text, score) {
    var playState = this._playState
    var isContinue = playState.isContinueMode
    var isLastProblem = playState.currentIndex >= playState.problems.length - 1

    var buttonText = '继续'
    if (type === 'wrong') {
      // 答错时等正解播完才能继续
      buttonText = '继续'
    } else if (isContinue) {
      buttonText = '再来一题 →'
    } else if (isLastProblem) {
      buttonText = '查看总结 →'
    } else {
      buttonText = '继续'
    }

    this.setData({
      feedbackVisible: true,
      feedbackType: type,
      feedbackText: text,
      feedbackScore: score,
      feedbackCanContinue: type !== 'wrong', // 答错要等正解播完
      feedbackButtonText: buttonText,
    })
  },

  // 正解播放完毕时启用继续按钮
  _enableFeedbackContinue: function () {
    var playState = this._playState
    var isContinue = playState.isContinueMode
    var isLastProblem = playState.currentIndex >= playState.problems.length - 1

    var buttonText = '继续'
    if (isContinue) buttonText = '再来一题 →'
    else if (isLastProblem) buttonText = '查看总结 →'

    this.setData({
      feedbackCanContinue: true,
      feedbackButtonText: buttonText,
      showingSolution: false,
    })
  },

  // 点击反馈面板的"继续"按钮
  handleFeedbackContinue: function () {
    if (!this.data.feedbackCanContinue) return

    // 隐藏面板
    this.setData({
      feedbackVisible: false,
      highlightPoints: [],
    })

    // 延迟一下让动画完成
    var that = this
    setTimeout(function () {
      that._goToNext()
    }, 300)
  },

  // ========== 导航到下一题 ==========

  _goToNext: function () {
    var that = this
    var playState = this._playState
    var isCorrect = !this.data.isWrong
    var newResults = playState.resultsAccumulated.concat([{
      problem_id: this._problem.problem_id,
      is_correct: isCorrect,
      rating_change: this.data.ratingChange,
    }])

    var nextIndex = playState.currentIndex + 1

    // 继续练习模式
    if (playState.isContinueMode) {
      wx.showLoading({ title: '选题中...' })
      api.getContinueProblem().then(function (res) {
        wx.hideLoading()
        if (res.problem) {
          playState.problems = [res.problem]
          playState.currentIndex = 0
          playState.resultsAccumulated = []
          app.globalData.playState = playState
          that._playState = playState
          that._initProblem()
        } else {
          wx.showToast({ title: '没有更多题目了', icon: 'none' })
          setTimeout(function () { wx.navigateBack() }, 1500)
        }
      }).catch(function () {
        wx.hideLoading()
        wx.showToast({ title: '获取失败', icon: 'none' })
      })
      return
    }

    // 打卡模式：做完3题后显示总结
    if (nextIndex >= playState.problems.length) {
      app.globalData.summaryState = {
        results: newResults,
        problems: playState.problems,
      }
      wx.redirectTo({ url: '/pages/summary/index' })
    } else {
      // 还有题，继续下一题（同页面切换）
      playState.currentIndex = nextIndex
      playState.resultsAccumulated = newResults
      app.globalData.playState = playState
      this._playState = playState
      this._initProblem()
    }
  },

  // ========== 正解动画 ==========

  _playSolution: function () {
    var that = this
    var problem = that._problem
    var boardSize = problem.board_size || 13
    var seq = that._seq

    // 重置棋盘到初始状态
    var board = goLogic.placeStones(goLogic.createBoard(boardSize), problem.initial_stones || [])
    var history = []

    that.setData({
      stones: problem.initial_stones ? [].concat(problem.initial_stones) : [],
      lastMove: null,
      moveHistory: [],
      showingSolution: true,
      showHint: false,
      hintMsg: '',
      highlightPoints: [],
    })

    var step = 0
    function playNext() {
      if (step >= seq.length) {
        // 正解播完，启用继续按钮
        that.setData({ showingSolution: false, isDone: true })
        that._enableFeedbackContinue()
        return
      }

      var coord = seq[step]
      var color = step % 2 === 0 ? that._uc : that._oc
      var result = goLogic.playMove(board, coord[0], coord[1], color)
      board = result.newBoard
      history = history.concat([{ x: coord[0], y: coord[1], color: color }])

      that.setData({
        stones: boardToStones(board),
        lastMove: { x: coord[0], y: coord[1] },
        moveHistory: history.slice(),
      })

      try { stoneAudio.stop(); stoneAudio.play() } catch (e) {}

      step++
      setTimeout(playNext, 700)
    }

    setTimeout(playNext, 500)
  },

  handleReset: function () {
    if (this.data.feedbackVisible) return
    var problem = this._problem
    if (!problem) return

    var boardSize = problem.board_size || 13
    var initBoard = goLogic.placeStones(goLogic.createBoard(boardSize), problem.initial_stones || [])
    this._board = initBoard
    this._playHistory = []

    this.setData({
      stones: problem.initial_stones ? [].concat(problem.initial_stones) : [],
      lastMove: null,
      moveHistory: [],
      highlightPoints: [],
      currentStep: 0,
      isDone: false,
      advancing: false,
      hintMsg: '',
      showHint: false,
      interactive: this._seq.length > 0,
      progressPercent: this._calcProgress(0, false),
    })
  },

  handleBack: function () {
    wx.navigateBack()
  },
})

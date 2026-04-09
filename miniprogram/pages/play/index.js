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
var captureAudio = wx.createInnerAudioContext()
captureAudio.src = '/audio/capture.mp3'

// 随机鼓励语
var CORRECT_TEXTS = ['一步到位！', '秒杀！', '厉害了！', '这都能看到？', '妙手！', '读棋高手！', '准确！', '小黑佩服！']
var WRONG_TEXTS = ['没关系，看看正解~', '差一点点！', '这题确实有点难', '别灰心，下一题！', '想想再试试？']
var STREAK_MSGS = { 2: '连对2题！', 3: '连对3题！', 5: '🔥 火力全开！', 10: '🔥🔥 无人能挡！' }

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
    userLevel: '7K',
    userRating: 520,
    dailyDone: 0,
    dailyProgress: 0,
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
    freePlay: false,
    answerRevealed: false,
    wrongShowingSolution: false,
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
    // 新手村模式
    isVillageMode: false,
    villageNodeName: '',
    villageProgress: 0,
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
    this._isVillageMode = !!playState.isVillageMode
    this._villageCorrect = 0

    // 加载用户等级和每日进度
    var dailyDone = playState.completedCount || 0
    this.setData({
      userLevel: playState.userLevel || '7K',
      userRating: playState.userRating || 520,
      dailyDone: dailyDone,
      dailyProgress: Math.min(100, Math.round(dailyDone / 3 * 100)),
      isVillageMode: this._isVillageMode,
      villageNodeName: playState.villageNodeName || '',
    })

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
    // 校验多步答案：如果后续步骤在view_region外，截断为1步题
    var vr = problem.view_region
    if (vr && seq.length > 1) {
      var pad = 1
      for (var si = 1; si < seq.length; si++) {
        var mx = seq[si][0], my = seq[si][1]
        if (mx < vr.x1 - pad || mx > vr.x2 + pad || my < vr.y1 - pad || my > vr.y2 + pad) {
          console.log('[play] 截断多步答案: step' + si + ' (' + mx + ',' + my + ') 超出view_region')
          seq = seq.slice(0, si)
          break
        }
      }
    }
    this._seq = seq
    var totalMoves = seq.length
    var boardSize = problem.board_size || 13

    var initBoard = goLogic.placeStones(goLogic.createBoard(boardSize), problem.initial_stones || [])
    this._board = initBoard
    this._playHistory = []
    this._startTime = Date.now()
    this._wrongSubmitted = false
    this._wrongScore = undefined
    this._answerSubmitted = false
    this._userRating = (app.globalData.userInfo && app.globalData.userInfo.rating) || wx.getStorageSync('userRating') || 520

    var cat = problem.category || ''
    var catMap = { '死活': 'tag-life', '手筋': 'tag-tesuji', '官子': 'tag-endgame', '入门': 'tag-beginner', '定式': 'tag-joseki', '中盘': 'tag-middle' }
    var categoryClass = catMap[cat] || ''

    var villageProgress = 0
    if (this._isVillageMode) {
      villageProgress = Math.round(playState.currentIndex / playState.problems.length * 100)
    }
    this.setData({
      problemIndex: playState.currentIndex + 1,
      totalProblems: playState.problems.length,
      villageProgress: villageProgress,
      description: problem.description || '',
      goalHint: problem.hint || '',
      category: cat,
      categoryClass: categoryClass,
      debugInfo: (function() {
        var sf = problem.source_file || ''
        var src = '未知'
        if (sf.indexOf('Ishigure') !== -1 && sf.indexOf('Basic') !== -1) src = '石榑基础(16K-11K)'
        else if (sf.indexOf('Yamada') !== -1 && sf.indexOf('Basic') !== -1) src = '山田基础(16K-14K)'
        else if (sf.indexOf('Hashimoto') !== -1 && sf.indexOf('Elementary') !== -1) src = '桥本初级(16K-11K)'
        else if (sf.indexOf('Elementary') !== -1) src = '赵治勋初级(10K-5K)'
        else if (sf.indexOf('Fujisawa') !== -1 && sf.indexOf('Elementary') !== -1) src = '藤泽初级(10K-5K)'
        else if (sf.indexOf('Intermediate') !== -1 && sf.indexOf('1b.') !== -1) src = '赵治勋中级(5K-1K)'
        else if (sf.indexOf('Hashimoto') !== -1 && sf.indexOf('Intermediate') !== -1) src = '桥本中级(5K-1K)'
        else if (sf.indexOf('Maeda') !== -1 && sf.indexOf('10k') !== -1) src = '前田10K-5K'
        else if (sf.indexOf('Maeda') !== -1 && sf.indexOf('1k-5k') !== -1) src = '前田1K-5K'
        else if (sf.indexOf('Maeda') !== -1 && sf.indexOf('1k-1d') !== -1) src = '前田1K-1D'
        else if (sf.indexOf('Maeda') !== -1) src = '前田诘棋'
        else if (sf.indexOf('Ishida') !== -1 && sf.indexOf('Kyu') !== -1) src = '石田级位(5K-1K)'
        else if (sf.indexOf('Ishida') !== -1 && sf.indexOf('High') !== -1) src = '石田高段(3D+)'
        else if (sf.indexOf('Ishida') !== -1 && sf.indexOf('Pro') !== -1) src = '石田职业(5D+)'
        else if (sf.indexOf('Ishida') !== -1) src = '石田段位(1K-3D)'
        else if (sf.indexOf('Ishigure') !== -1) src = '石榑初段(1K-1D)'
        else if (sf.indexOf('Advanced') !== -1 || sf.indexOf('1c.') !== -1) src = '赵治勋高级(1D-3D)'
        else if (sf.indexOf('Hashimoto') !== -1 && sf.indexOf('Advanced') !== -1) src = '桥本高级(1K-3D)'
        else if (sf.indexOf('Fujisawa') !== -1 && sf.indexOf('High') !== -1) src = '藤泽高段(3D-5D)'
        else if (sf.indexOf('Fujisawa') !== -1) src = '藤泽秀行'
        else if (sf.indexOf('Hashimoto') !== -1) src = '桥本宇太郎'
        else if (sf.indexOf('Yamada') !== -1) src = '山田三段之路(1D-3D)'
        else if (sf.indexOf('Lee Changho') !== -1) src = '李昌镐手筋(10K-1K)'
        else if (sf.indexOf('Tesuji Great') !== -1 || sf.indexOf('Great Tesuji') !== -1) src = '手筋大辞典(5K-1D)'
        else if (sf.indexOf('Kobayashi') !== -1) src = '小林觉手筋(1K-3D)'
        else if (sf.indexOf('Go Seigen') !== -1) src = '吴清源手筋(5K-1D)'
        var r = problem.difficulty_rating || 0
        // 等级名
        var lvl = '7K'
        var tiers = [
          [520,'7K'],[560,'6K'],[600,'5K'],[645,'4K'],[695,'3K'],
          [745,'2K'],[795,'1K'],
          [845,'1D'],[900,'2D'],[960,'3D'],[1020,'4D'],[1080,'5D'],
        ]
        for (var i = tiers.length - 1; i >= 0; i--) { if (r >= tiers[i][0]) { lvl = tiers[i][1]; break } }
        return '难度' + r + '(' + lvl + ') · ' + src
      })(),
      boardSize: boardSize,
      stones: goLogic.normalizeStones(problem.initial_stones),
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
      showMoveNumbers: false,
      isWrong: false,
      freePlay: false,
      answerRevealed: false,
      wrongShowingSolution: false,
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
    return { newBoard: result.newBoard, newHistory: newHistory, captured: result.captured || [] }
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

    // 音效：提子用提子音效
    try {
      if (result.captured && result.captured.length > 0) {
        captureAudio.stop(); captureAudio.play()
      } else {
        stoneAudio.stop(); stoneAudio.play()
      }
    } catch (e) {}

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
    // 自由推演模式：答对后可以继续落子
    if (this.data.freePlay) {
      this._freePlayMove(e)
      return
    }
    if (this.data.advancing || this.data.isDone) return
    // 答错面板显示时允许继续尝试
    if (this.data.feedbackVisible && this.data.feedbackType !== 'wrong') return
    var step = this.data.currentStep
    if (step >= this.data.totalMoves || step % 2 !== 0) return

    var detail = e.detail
    var x = detail.x
    var y = detail.y
    var expected = this._seq[step]

    console.log('[play] move:', x, y, 'expected:', JSON.stringify(expected), 'step:', step, 'seqLen:', this._seq.length)
    console.log('[play] allSeqs first moves:', (this._problem.correct_sequences||[]).map(function(s){return s&&s[0]?JSON.stringify(s[0]):'null'}).join(', '))

    // Check against ALL correct sequences at every step (not just step 0)
    var allSeqs = (this._problem.correct_sequences || [])
    var isCorrectMove = false

    if (expected && expected[0] === x && expected[1] === y) {
      isCorrectMove = true
    } else {
      // Check all sequences: find one that matches ALL previous moves AND this move
      for (var si = 0; si < allSeqs.length; si++) {
        var altSeq = allSeqs[si]
        if (!altSeq || altSeq.length <= step) continue
        if (altSeq[step][0] !== x || altSeq[step][1] !== y) continue
        var prevMatch = true
        for (var pi = 0; pi < step; pi++) {
          var prev = this._seq[pi]
          if (!prev || !altSeq[pi] || prev[0] !== altSeq[pi][0] || prev[1] !== altSeq[pi][1]) {
            prevMatch = false
            break
          }
        }
        if (prevMatch) {
          this._seq = altSeq
          // 切换到更短/更长的序列时同步 totalMoves
          if (altSeq.length !== this.data.totalMoves) {
            this.setData({ totalMoves: altSeq.length })
          }
          isCorrectMove = true
          break
        }
      }
    }

    // 宽松验证（仅新手村模式，且仅多步题的最后一步）：
    // 只接受有明确战术效果的走法 - 提子 或 打吃
    // 死活题等需要精确关键点的题目，严格按存储正解判定
    if (!isCorrectMove && this._isVillageMode && step > 0 && step === this.data.totalMoves - 1) {
      var testColor = step % 2 === 0 ? this._uc : this._oc
      var testResult = goLogic.playMove(this._board, x, y, testColor)
      if (testResult.isValid) {
        var accepted = false

        // (a) 能提子 → 算对
        if (testResult.captured.length > 0) {
          accepted = true
          console.log('[play] 宽松验证(提子)：(' + x + ',' + y + ') 提 ' + testResult.captured.length + ' 子')
        }

        // (b) 让对方相邻棋组气=0（已在提子中覆盖）或气=1（打吃且是致命打吃）
        // 注意：只有打吃规模 ≥ 正解的打吃规模才算对
        if (!accepted && expected) {
          var opp = testColor === 'black' ? 'white' : 'black'
          // 先计算用户打吃的最小气数
          var userAtariLibs = 99
          var userNeighbors = goLogic.getNeighbors(x, y, this._board.length)
          for (var ni = 0; ni < userNeighbors.length; ni++) {
            var nb = userNeighbors[ni]
            if (testResult.newBoard[nb.y][nb.x] === opp) {
              var libs = goLogic.getLiberties(testResult.newBoard, nb.x, nb.y)
              if (libs < userAtariLibs) userAtariLibs = libs
            }
          }
          // 再计算正解打吃的最小气数
          var expResult = goLogic.playMove(this._board, expected[0], expected[1], testColor)
          if (expResult.isValid) {
            var expAtariLibs = 99
            var expNeighbors = goLogic.getNeighbors(expected[0], expected[1], this._board.length)
            for (var eni = 0; eni < expNeighbors.length; eni++) {
              var en = expNeighbors[eni]
              if (expResult.newBoard[en.y][en.x] === opp) {
                var elibs = goLogic.getLiberties(expResult.newBoard, en.x, en.y)
                if (elibs < expAtariLibs) expAtariLibs = elibs
              }
            }
            // 用户打吃规模 ≤ 正解（气数更少意味着压力更大）
            if (userAtariLibs <= 1 && userAtariLibs <= expAtariLibs) {
              accepted = true
              console.log('[play] 宽松验证(打吃)：用户气=' + userAtariLibs + ' 正解气=' + expAtariLibs)
            }
          }
        }

        if (accepted) {
          var newSeq = this._seq.slice(0, step)
          newSeq.push([x, y])
          this._seq = newSeq
          if (newSeq.length !== this.data.totalMoves) {
            this.setData({ totalMoves: this._seq.length })
          }
          isCorrectMove = true
        }
      }
    }

    if (isCorrectMove) {
      if (this.data.feedbackVisible) {
        this.setData({ feedbackVisible: false })
      }
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

    // 如果已经提交过（答错或答对），不再重复提交
    if (that._answerSubmitted) {
      that.setData({
        isDone: true, interactive: true, submitting: false, freePlay: true,
        progressPercent: that._calcProgress(that.data.totalMoves, true),
      })
      that._freeColor = that._uc === 'black' ? 'white' : 'black'
      that._fullHistory = that.data.moveHistory.slice()
      that._consecutiveCorrect = 0
      try { correctAudio.stop(); correctAudio.play() } catch (e) {}
      that._showFeedback('correct', '答对了！（不重复计分）', 0)
      return
    }

    that._answerSubmitted = true
    // 新手村模式：不调云函数，不影响天梯rating
    if (that._isVillageMode) {
      that._villageCorrect = (that._villageCorrect || 0) + 1
      that.setData({
        isDone: true,
        interactive: true,
        submitting: false,
        freePlay: true,
        progressPercent: that._calcProgress(that.data.totalMoves, true),
      })
      that._freeColor = that._uc === 'black' ? 'white' : 'black'
      that._fullHistory = that.data.moveHistory.slice()
      that._consecutiveCorrect = (that._consecutiveCorrect || 0) + 1
      var cc2 = that._consecutiveCorrect
      var text2 = pickRandom(CORRECT_TEXTS)
      if (STREAK_MSGS[cc2]) text2 = STREAK_MSGS[cc2]
      try { correctAudio.stop(); correctAudio.play() } catch (e) {}
      that._showFeedback('correct', text2, 0)
      return
    }
    api.submitAnswer(
      problem.problem_id, that._seq, timeSpentMs, true,
      problem.difficulty_rating || 0, problem.expected_time_ms || 60000
    ).then(function (res) {
      var newDone = that.data.dailyDone + 1
      that.setData({
        ratingChange: res.rating_change || 0,
        isDone: true,
        interactive: true,
        submitting: false,
        freePlay: true,
        progressPercent: that._calcProgress(that.data.totalMoves, true),
        userRating: res.new_rating || that.data.userRating,
        userLevel: res.new_level || that.data.userLevel,
        dailyDone: newDone,
        dailyProgress: Math.min(100, Math.round(newDone / 3 * 100)),
      })
      app.globalData.latestRating = res.new_rating || that.data.userRating
      app.globalData.latestLevel = res.new_level || that.data.userLevel
      wx.setStorageSync('_latestRating', app.globalData.latestRating)
      wx.setStorageSync('_latestLevel', app.globalData.latestLevel)
      // 答对后下一步是对方（白棋）
      that._freeColor = that._uc === 'black' ? 'white' : 'black'
      that._fullHistory = that.data.moveHistory.slice()
      // 检测段位变化
      if (res.level_changed && res.new_level) {
        that.setData({ levelUpName: res.new_level, showLevelUp: true })
        setTimeout(function () { that.setData({ showLevelUp: false }) }, 3000)
      }

      // 连对计数
      that._consecutiveCorrect = (that._consecutiveCorrect || 0) + 1
      var cc = that._consecutiveCorrect
      var text = pickRandom(CORRECT_TEXTS)
      // 连对加成文案
      if (STREAK_MSGS[cc]) text = STREAK_MSGS[cc]

      // 播放答对音效 + 显示绿色反馈面板
      try { correctAudio.stop(); correctAudio.play() } catch (e) {}
      that._showFeedback('correct', text, res.rating_change || 0)
    }).catch(function () {
      that.setData({ isDone: true, interactive: false, submitting: false })
      that._showFeedback('correct', '完成！', 0)
    })
  },

  // ========== 答错流程 ==========

  _showWrongMove: function (x, y) {
    var that = this
    var color = that._uc
    var problem = that._problem

    that._consecutiveCorrect = 0
    try { stoneAudio.stop(); stoneAudio.play() } catch (e) {}
    setTimeout(function () {
      try { wrongAudio.stop(); wrongAudio.play() } catch (e) {}
    }, 300)

    // 显示错误落子 + 同时弹出面板
    // 保留之前正确步骤的 moveHistory，追加错误落子
    var currentStones = that.data.stones.slice()
    currentStones.push({ x: x, y: y, color: color })

    var wrongHistory = that._playHistory.slice()
    wrongHistory.push({ x: x, y: y, color: color })

    that.setData({
      stones: currentStones,
      lastMove: { x: x, y: y },
      moveHistory: wrongHistory,
      showMoveNumbers: false,
      interactive: false,
      isWrong: true,
      wrongShowingSolution: false,
    })

    // 新手村模式：不提交错误、不扣分，鼓励学习
    if (that._isVillageMode) {
      that._showFeedback('wrong', '试试看正解吧~', 0)
    } else {
      // 提交错误结果获取扣分
      if (!that._answerSubmitted) {
        that._wrongSubmitted = true
        that._answerSubmitted = true
        var timeSpentMs = Date.now() - that._startTime
        api.submitAnswer(
          problem.problem_id, [], timeSpentMs, false,
          problem.difficulty_rating || 0, problem.expected_time_ms || 60000
        ).then(function (res) {
          var score = res.rating_change || 0
          var nr = res.new_rating || that.data.userRating
          var nl = res.new_level || that.data.userLevel
          that.setData({ ratingChange: score, feedbackScore: score, userRating: nr, userLevel: nl })
          app.globalData.latestRating = nr
          app.globalData.latestLevel = nl
          wx.setStorageSync('_latestRating', nr)
          wx.setStorageSync('_latestLevel', nl)
        }).catch(function () {})
      }

      // 第一次答错才扣分和显示分数
      if (that._wrongSubmitted && that._wrongScore !== undefined) {
        that._showFeedback('wrong', pickRandom(WRONG_TEXTS), that._wrongScore)
      } else {
        var estExpected = 1 / (1 + Math.pow(10, ((problem.difficulty_rating || 300) - (that._userRating || 520)) / 400))
        var estScore = Math.round(10 * (0 - estExpected))
        that._wrongScore = estScore
        var estNewRating = Math.max(520, that.data.userRating + estScore)
        that.setData({ userRating: estNewRating })
        app.globalData.latestRating = estNewRating
        app.globalData.latestLevel = that.data.userLevel
        wx.setStorageSync('_latestRating', estNewRating)
        wx.setStorageSync('_latestLevel', that.data.userLevel)
        console.log('[play] 写入latestRating:', estNewRating, 'level:', that.data.userLevel)
        that._showFeedback('wrong', pickRandom(WRONG_TEXTS), estScore)
      }
    }

    // 1秒后恢复棋盘到当前正确步骤的状态（保留之前的黑1白2等）
    setTimeout(function () {
      var boardSize = problem.board_size || 13
      var board = goLogic.placeStones(goLogic.createBoard(boardSize), problem.initial_stones || [])
      var history = []

      // 重放已走过的正确步骤
      var step = that.data.currentStep
      var seq = that._seq
      for (var i = 0; i < step; i++) {
        var coord = seq[i]
        if (!coord) break
        var c = i % 2 === 0 ? that._uc : that._oc
        var r = goLogic.playMove(board, coord[0], coord[1], c)
        if (r && r.isValid) board = r.newBoard
        history.push({ x: coord[0], y: coord[1], color: c })
      }

      that._board = board
      that._playHistory = history

      that.setData({
        stones: boardToStones(board),
        lastMove: history.length > 0 ? { x: history[history.length-1].x, y: history[history.length-1].y } : null,
        moveHistory: history,
        showMoveNumbers: false,
        isWrong: false,
        interactive: true,
        isDone: false,
      })
    }, 1000)
  },

  // 查看正解按钮（答错面板里）
  handleShowSolution: function () {
    var that = this
    var expected = that._seq[0]
    if (!expected) return

    // 落子音效
    stoneAudio.stop()
    stoneAudio.play()

    // 在棋盘上标记正解
    var result = goLogic.playMove(that._board, expected[0], expected[1], that._uc)
    if (result && result.isValid) that._board = result.newBoard

    that.setData({
      stones: boardToStones(that._board),
      lastMove: { x: expected[0], y: expected[1] },
      moveHistory: [{ x: expected[0], y: expected[1], color: that._uc }],
      showMoveNumbers: true,
      interactive: true,
      freePlay: true,
      wrongShowingSolution: true,
      feedbackButtonText: '下一题 →',
    })
    that._freeColor = that._uc === 'black' ? 'white' : 'black'
      that._fullHistory = that.data.moveHistory.slice()

    // 如果还没提交过，现在提交
    if (!that._answerSubmitted) {
      that._wrongSubmitted = true
      that._answerSubmitted = true
      var problem = that._problem
      var timeSpentMs = Date.now() - that._startTime
      api.submitAnswer(
        problem.problem_id, [], timeSpentMs, false,
        problem.difficulty_rating || 0, problem.expected_time_ms || 60000
      ).then(function (res) {
        that.setData({ ratingChange: res.rating_change || 0, feedbackScore: res.rating_change || 0 })
      }).catch(function () {})
    }
  },

  // ========== 自由推演模式 ==========

  _freePlayMove: function (e) {
    var detail = e.detail
    var x = detail.x, y = detail.y
    var that = this

    // 交替黑白落子（白2、黑3、白4...）
    var color = that._freeColor || (that._uc === 'black' ? 'white' : 'black')
    var result = goLogic.playMove(that._board, x, y, color)
    if (!result || !result.isValid) return

    that._board = result.newBoard
    that._freeColor = color === 'black' ? 'white' : 'black'

    // 追加到完整 moveHistory（编号=数组索引+1，不跳号）
    // go-board 组件的 moveHistory 模式会自动跳过被提的棋子
    if (!that._fullHistory) that._fullHistory = that.data.moveHistory.slice()
    that._fullHistory.push({ x: x, y: y, color: color })

    that.setData({
      stones: boardToStones(that._board),
      lastMove: { x: x, y: y },
      moveHistory: that._fullHistory,
      showMoveNumbers: false,  // 用 moveHistory 模式，保持编号不跳
      currentColor: that._freeColor,
    })

    // 音效：提子用提子音效，普通落子用落子音效
    try {
      if (result.captured && result.captured.length > 0) {
        captureAudio.stop(); captureAudio.play()
      } else {
        stoneAudio.stop(); stoneAudio.play()
      }
    } catch (e) {}
  },

  // ========== 反馈面板 ==========

  _showFeedback: function (type, text, score) {
    var playState = this._playState
    var isContinue = playState.isContinueMode
    var isVillage = this._isVillageMode
    var isLastProblem = playState.currentIndex >= playState.problems.length - 1

    var buttonText = '下一题 →'
    if (type === 'wrong') {
      buttonText = '💡 查看正解'
    } else if (isVillage && isLastProblem) {
      buttonText = '完成关卡 →'
    } else if (isLastProblem && !isContinue) {
      buttonText = '查看总结 →'
    }

    this.setData({
      feedbackVisible: true,
      feedbackType: type,
      feedbackText: text,
      feedbackScore: score,
      feedbackCanContinue: true, // 直接显示继续按钮
      feedbackButtonText: buttonText,
    })
  },

  // 正解播放完毕时启用继续按钮
  _enableFeedbackContinue: function () {
    var playState = this._playState
    var isContinue = playState.isContinueMode
    var isVillage = this._isVillageMode
    var isLastProblem = playState.currentIndex >= playState.problems.length - 1

    var buttonText = '继续'
    if (isContinue) buttonText = '再来一题 →'
    else if (isVillage && isLastProblem) buttonText = '完成关卡 →'
    else if (isVillage) buttonText = '下一题 →'
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

    // 答错且还没看正解 → 显示正解
    if (this.data.feedbackType === 'wrong' && !this.data.wrongShowingSolution) {
      this.handleShowSolution()
      return
    }

    // 隐藏面板，跳下一题
    this.setData({
      feedbackVisible: false,
      highlightPoints: [],
      freePlay: false,
    })

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

    // 新手村模式：同页面切换，做完所有题保存进度并返回
    if (this._isVillageMode) {
      if (nextIndex >= playState.problems.length) {
        this._saveVillageCompletion()
        return
      }
      playState.currentIndex = nextIndex
      playState.resultsAccumulated = newResults
      app.globalData.playState = playState
      this._playState = playState
      this._initProblem()
      return
    }

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
      stones: goLogic.normalizeStones(problem.initial_stones),
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

  handleRevealAnswer: function () {
    var that = this
    var problem = that._problem
    if (!problem || that.data.answerRevealed) return

    var expected = that._seq[0]
    if (!expected) return

    // 落子音效
    stoneAudio.stop()
    stoneAudio.play()

    // 在棋盘上标记正确位置
    var currentStones = that.data.stones.slice()
    currentStones.push({ x: expected[0], y: expected[1], color: that._uc })

    // 落到内部棋盘
    var result = goLogic.playMove(that._board, expected[0], expected[1], that._uc)
    if (result && result.isValid) that._board = result.newBoard

    that.setData({
      stones: boardToStones(that._board),
      lastMove: { x: expected[0], y: expected[1] },
      moveHistory: [{ x: expected[0], y: expected[1], color: that._uc }],
      showMoveNumbers: true,
      interactive: true,
      isDone: true,
      freePlay: true,
      answerRevealed: true,
    })
    that._freeColor = that._uc === 'black' ? 'white' : 'black'
      that._fullHistory = that.data.moveHistory.slice()

    // 如果还没提交过，现在提交
    if (!that._answerSubmitted) {
      that._wrongSubmitted = true
      that._answerSubmitted = true
      var timeSpentMs = Date.now() - that._startTime
      api.submitAnswer(
        problem.problem_id, [], timeSpentMs, false,
        problem.difficulty_rating || 0, problem.expected_time_ms || 60000
      ).catch(function () {})
    }

    var revealTexts = ['记住这个手筋哦~', '下次你一定行！', '学到了吧~', '看懂了就是进步！']
    that._showFeedback('reveal', revealTexts[Math.floor(Math.random() * revealTexts.length)], 0)
  },

  handlePrevProblem: function () {
    var playState = this._playState
    if (playState.currentIndex <= 0) return
    playState.currentIndex--
    app.globalData.playState = playState
    this._initProblem()
  },

  handleNextProblem: function () {
    var playState = this._playState
    if (!playState) return
    // 如果当前题还没做完，跳过（不提交）
    playState.currentIndex++
    if (playState.currentIndex >= playState.problems.length) {
      // 新手村模式：全部做完，保存进度返回
      if (this._isVillageMode) {
        this._saveVillageCompletion()
        return
      }
      // 没有更多题了，请求新题
      var that = this
      wx.showLoading({ title: '选题中...' })
      api.getContinueProblem().then(function (res) {
        wx.hideLoading()
        if (res.problem) {
          playState.problems.push(res.problem)
          app.globalData.playState = playState
          that._initProblem()
        } else {
          wx.showToast({ title: '没有更多题了', icon: 'none' })
          playState.currentIndex--
        }
      }).catch(function () {
        wx.hideLoading()
        wx.showToast({ title: '获取失败', icon: 'none' })
        playState.currentIndex--
      })
      return
    }
    app.globalData.playState = playState
    this._initProblem()
  },

  _saveVillageCompletion: function () {
    var playState = this._playState
    var nodeId = playState.villageNodeId
    var level = playState.villageLevel
    var correct = this._villageCorrect || 0

    // 更新本地进度
    var progress = wx.getStorageSync('village_progress') || {}
    var nodeProgress = progress[nodeId] || { completedLevel: 0, scores: {} }
    nodeProgress.scores[level] = Math.max(nodeProgress.scores[level] || 0, correct)
    if (level > nodeProgress.completedLevel) {
      nodeProgress.completedLevel = level
    }
    progress[nodeId] = nodeProgress
    wx.setStorageSync('village_progress', progress)

    // 同步到云端
    api.saveVillageProgress(nodeId, nodeProgress.completedLevel, nodeProgress.scores).catch(function () {})

    wx.showToast({ title: '关卡完成！答对 ' + correct + ' 题', icon: 'none', duration: 2000 })
    setTimeout(function () {
      wx.navigateBack()
    }, 1500)
  },

  handleReset: function () {
    if (this.data.feedbackVisible) return
    this._doRetry()
  },

  handleRetry: function () {
    this._doRetry()
  },

  _doRetry: function () {
    var problem = this._problem
    if (!problem) return

    var boardSize = problem.board_size || 13
    var initBoard = goLogic.placeStones(goLogic.createBoard(boardSize), problem.initial_stones || [])
    this._board = initBoard
    this._playHistory = []
    // 重置答案序列
    var seq = (problem.correct_sequences && problem.correct_sequences[0]) || []
    this._seq = seq

    this.setData({
      stones: goLogic.normalizeStones(problem.initial_stones),
      lastMove: null,
      moveHistory: [],
      highlightPoints: [],
      currentStep: 0,
      isDone: false,
      advancing: false,
      freePlay: false,
      answerRevealed: false,
      isWrong: false,
      wrongShowingSolution: false,
      feedbackVisible: false,
      submitting: false,
      hintMsg: '',
      showHint: false,
      showMoveNumbers: false,
      interactive: seq.length > 0,
      progressPercent: this._calcProgress(0, false),
    })
  },

  handleBack: function () {
    // 把最新分数传回首页
    app.globalData.latestRating = this.data.userRating
    app.globalData.latestLevel = this.data.userLevel
    wx.setStorageSync('_latestRating', this.data.userRating)
    wx.setStorageSync('_latestLevel', this.data.userLevel)
    wx.navigateBack()
  },
})

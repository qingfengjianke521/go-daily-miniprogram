const goLogic = require('../utils/go-logic')

function loadSection(id) {
  if (id === 1) return require('./tutorial-section-1.js')
  if (id === 2) return require('./tutorial-section-2.js')
  if (id === 3) return require('./tutorial-section-3.js')
  if (id === 4) return require('./tutorial-section-4.js')
  if (id === 5) return require('./tutorial-section-5.js')
  if (id === 6) return require('./tutorial-section-6.js')
  if (id === 7) return require('./tutorial-section-7.js')
  return null
}

Page({
  data: {
    statusBarHeight: 0,
    topPadding: 44,
    lessonId: '',
    lessonTitle: '',
    currentPage: 1,
    totalPages: 0,
    progressPercent: 0,
    pageText: '',
    showBoard: false,
    boardSize: 9,
    stones: [],
    viewRegion: null,
    interactive: false,
    currentColor: 'black',
    lastMove: null,
    highlightPoints: [],
    quizOptions: [],
    feedback: false,
    feedbackType: '',
    canNext: false,
  },

  _sectionData: null,
  _lessonData: null,
  _pageData: null,
  _board: null,

  onLoad(opts) {
    const app = getApp()
    const sbh = app.globalData.statusBarHeight || wx.getWindowInfo().statusBarHeight || 20
    this.setData({ statusBarHeight: sbh, topPadding: sbh + 44 })

    const sectionId = parseInt(opts.section) || 1
    const lessonId = opts.lesson || '1.1'

    // Load section data
    this._sectionData = loadSection(sectionId)
    if (!this._sectionData) {
      wx.showToast({ title: '加载失败', icon: 'none' })
      return
    }

    // Find the lesson
    const lesson = this._sectionData.lessons.find(l => l.id === lessonId)
    if (!lesson) {
      wx.showToast({ title: '课程不存在', icon: 'none' })
      return
    }

    this._lessonData = lesson
    this.setData({
      lessonId: lesson.id,
      lessonTitle: lesson.title,
      totalPages: lesson.pages.length,
    })

    this._loadPage(1)
  },

  _loadPage(pageNum) {
    const page = this._lessonData.pages[pageNum - 1]
    if (!page) return

    this._pageData = page
    const boardSize = page.bs || 9

    // Build stones array from initial state
    const stones = []
    if (page.ib) {
      for (const p of page.ib) {
        stones.push({ x: p[0], y: p[1], color: 'black' })
      }
    }
    if (page.iw) {
      for (const p of page.iw) {
        stones.push({ x: p[0], y: p[1], color: 'white' })
      }
    }

    // Calculate view region from bounds
    let viewRegion = null
    if (page.bounds) {
      viewRegion = {
        x1: page.bounds.left || 0,
        y1: page.bounds.top || 0,
        x2: page.bounds.right || boardSize - 1,
        y2: page.bounds.bottom || boardSize - 1,
      }
    }

    // Build quiz options if present
    let quizOptions = []
    const isQuiz = page.mode === 'quiz' || page.mode === 'finished'
    if (isQuiz && page.qo) {
      quizOptions = page.qo.map((text, i) => ({
        text,
        correct: i === page.qa,
        selected: false,
      }))
    }

    const showBoard = !isQuiz && page.mode === 'puzzle'
    const hasMoves = page.cm && page.cm.length > 0
    const interactive = showBoard && hasMoves
    const initialPlayer = page.ip || 'black'

    // Build board for game logic
    this._board = goLogic.createBoard(boardSize)
    for (const s of stones) {
      this._board[s.y][s.x] = s.color
    }

    this.setData({
      currentPage: pageNum,
      progressPercent: Math.round((pageNum / this._lessonData.pages.length) * 100),
      pageText: page.text || '',
      showBoard,
      boardSize,
      stones,
      viewRegion,
      interactive,
      currentColor: initialPlayer,
      lastMove: null,
      highlightPoints: [],
      quizOptions,
      feedback: false,
      feedbackType: '',
      canNext: !interactive && !isQuiz, // Auto-advance for text-only pages
    })
  },

  onBoardMove(e) {
    if (!this.data.interactive) return
    const { x, y } = e.detail
    const page = this._pageData
    if (!page) return

    // Check if this move is in the correct_moves list
    const isCorrect = page.cm && page.cm.some(m => {
      if (Array.isArray(m[0])) {
        // Multi-move sequence: first move matches
        return m[0][0] === x && m[0][1] === y
      }
      return m[0] === x && m[1] === y
    })

    const isWrong = page.wm && page.wm.some(m => {
      if (Array.isArray(m[0])) {
        return m[0][0] === x && m[0][1] === y
      }
      return m[0] === x && m[1] === y
    })

    if (isCorrect) {
      // Play the move on the board
      const result = goLogic.playMove(this._board, x, y, this.data.currentColor, this.data.boardSize)
      if (result) {
        this._board = result.board
        const newStones = this._boardToStones(this._board, this.data.boardSize)
        this.setData({
          stones: newStones,
          lastMove: { x, y },
          interactive: false,
          feedback: true,
          feedbackType: 'correct',
          canNext: true,
        })
      }
    } else if (isWrong) {
      this.setData({
        feedback: true,
        feedbackType: 'wrong',
        highlightPoints: page.cm
          ? page.cm.slice(0, 1).map(m => {
              if (Array.isArray(m[0])) return { x: m[0][0], y: m[0][1] }
              return { x: m[0], y: m[1] }
            })
          : [],
      })
      // Reset feedback after 1s
      setTimeout(() => {
        this.setData({ feedback: false, highlightPoints: [] })
      }, 1200)
    } else {
      // Any move not in wrong_moves is treated as correct for "any move" pages
      if (!page.wm || page.wm.length === 0) {
        const result = goLogic.playMove(this._board, x, y, this.data.currentColor, this.data.boardSize)
        if (result) {
          this._board = result.board
          const newStones = this._boardToStones(this._board, this.data.boardSize)
          this.setData({
            stones: newStones,
            lastMove: { x, y },
            interactive: false,
            feedback: true,
            feedbackType: 'correct',
            canNext: true,
          })
        }
      }
    }
  },

  onQuizSelect(e) {
    const idx = e.currentTarget.dataset.index
    const quizOptions = this.data.quizOptions.map((opt, i) => ({
      ...opt,
      selected: i === idx,
    }))
    const isCorrect = quizOptions[idx].correct
    this.setData({
      quizOptions,
      feedback: true,
      feedbackType: isCorrect ? 'correct' : 'wrong',
      canNext: isCorrect,
    })
  },

  nextPage() {
    const next = this.data.currentPage + 1
    if (next > this.data.totalPages) {
      // Lesson complete - save progress
      const progress = wx.getStorageSync('learn_progress') || {}
      progress[this.data.lessonId] = true
      wx.setStorageSync('learn_progress', progress)
      wx.showToast({ title: '课程完成!', icon: 'success' })
      setTimeout(() => wx.navigateBack(), 1000)
      return
    }
    this._loadPage(next)
  },

  _boardToStones(board, size) {
    const stones = []
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        if (board[y][x]) {
          stones.push({ x, y, color: board[y][x] })
        }
      }
    }
    return stones
  },

  handleBack() {
    wx.navigateBack({ fail: () => wx.switchTab({ url: '/pages/index/index' }) })
  },
})

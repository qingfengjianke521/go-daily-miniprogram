const STAR_POINTS = {
  9: [
    { x: 2, y: 2 }, { x: 2, y: 6 }, { x: 4, y: 4 },
    { x: 6, y: 2 }, { x: 6, y: 6 },
  ],
  13: [
    { x: 3, y: 3 }, { x: 3, y: 9 }, { x: 6, y: 6 },
    { x: 9, y: 3 }, { x: 9, y: 9 },
  ],
  19: [
    { x: 3, y: 3 }, { x: 3, y: 9 }, { x: 3, y: 15 },
    { x: 9, y: 3 }, { x: 9, y: 9 }, { x: 9, y: 15 },
    { x: 15, y: 3 }, { x: 15, y: 9 }, { x: 15, y: 15 },
  ],
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.arcTo(x + w, y, x + w, y + r, r)
  ctx.lineTo(x + w, y + h - r)
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r)
  ctx.lineTo(x + r, y + h)
  ctx.arcTo(x, y + h, x, y + h - r, r)
  ctx.lineTo(x, y + r)
  ctx.arcTo(x, y, x + r, y, r)
  ctx.closePath()
}

Component({
  properties: {
    boardSize: { type: Number, value: 13 },
    stones: { type: Array, value: [] },
    viewRegion: { type: Object, value: null },
    interactive: { type: Boolean, value: false },
    currentColor: { type: String, value: 'black' },
    lastMove: { type: Object, value: null },
    highlightPoints: { type: Array, value: [] },
    showMoveNumbers: { type: Boolean, value: false },
    moveHistory: { type: Array, value: [] },
  },

  data: {
    canvasHeight: 300,
  },

  observers: {
    'boardSize, stones, viewRegion, interactive, currentColor, lastMove, highlightPoints, showMoveNumbers, moveHistory': function () {
      this._drawBoard()
    },
  },

  lifetimes: {
    ready() {
      this._initCanvas()
    },
  },

  methods: {
    _initCanvas() {
      const query = this.createSelectorQuery()
      query.select('#goboard').fields({ node: true, size: true }).exec((res) => {
        if (!res || !res[0]) return
        const { node: canvas, width: cssWidth } = res[0]
        const dpr = wx.getWindowInfo().pixelRatio || 2

        this._canvas = canvas
        this._ctx = canvas.getContext('2d')
        this._dpr = dpr
        this._cssWidth = cssWidth

        // Calculate canvas height based on view region aspect ratio
        this._updateCanvasSize()
      })
    },

    _updateCanvasSize() {
      if (!this._canvas) return

      const region = this._getRegion()
      const cols = region.x2 - region.x1
      const rows = region.y2 - region.y1
      const aspectRatio = rows / (cols || 1)
      const cssWidth = this._cssWidth
      // 限制最大高度为屏幕高度的 55%，防止溢出
      const sysInfo = wx.getWindowInfo()
      const maxHeight = Math.round(sysInfo.windowHeight * 0.55)
      const canvasHeight = Math.min(Math.round(cssWidth * aspectRatio), maxHeight)
      const dpr = this._dpr

      this._canvas.width = Math.round(cssWidth * dpr)
      this._canvas.height = Math.round(canvasHeight * dpr)

      this.setData({ canvasHeight }, () => {
        this._drawBoard()
      })
    },

    _getRegion() {
      const { boardSize, viewRegion } = this.data
      if (viewRegion && viewRegion.x1 !== undefined) {
        return {
          x1: Math.max(0, viewRegion.x1),
          y1: Math.max(0, viewRegion.y1),
          x2: Math.min(boardSize - 1, viewRegion.x2),
          y2: Math.min(boardSize - 1, viewRegion.y2),
        }
      }
      return { x1: 0, y1: 0, x2: boardSize - 1, y2: boardSize - 1 }
    },

    _drawBoard() {
      const ctx = this._ctx
      if (!ctx) return

      const dpr = this._dpr
      const region = this._getRegion()
      const { boardSize, stones, viewRegion, lastMove, highlightPoints, showMoveNumbers, moveHistory } = this.data

      const cols = region.x2 - region.x1
      const rows = region.y2 - region.y1

      // Calculate cell size in canvas pixels (fit both width and height)
      const canvasWidth = this._canvas.width
      const canvasHeight = this._canvas.height
      const padding = 0.5 // in cell units

      const cellSizeW = canvasWidth / (cols + padding * 2)
      const cellSizeH = canvasHeight / (rows + padding * 2)
      const cellSize = Math.min(cellSizeW, cellSizeH)
      const paddingPx = cellSize * padding

      // Center the board if there's extra space
      const usedWidth = cellSize * (cols + padding * 2)
      const usedHeight = cellSize * (rows + padding * 2)
      const offsetX = (canvasWidth - usedWidth) / 2
      const offsetY = (canvasHeight - usedHeight) / 2

      const toX = (x) => (x - region.x1) * cellSize + paddingPx + offsetX
      const toY = (y) => (y - region.y1) * cellSize + paddingPx + offsetY

      const stoneRadius = cellSize * 0.47
      const starRadius = cellSize * 0.08
      const lastMoveRadius = cellSize * 0.12

      // Build stone map for quick lookup
      const stoneMap = new Map()
      for (const s of stones) {
        stoneMap.set(`${s.x},${s.y}`, s.color)
      }

      // Edge detection
      const isLeftEdge = region.x1 === 0
      const isRightEdge = region.x2 === boardSize - 1
      const isTopEdge = region.y1 === 0
      const isBottomEdge = region.y2 === boardSize - 1

      // Clear canvas
      ctx.clearRect(0, 0, canvasWidth, canvasHeight)

      // 1. Board background
      ctx.fillStyle = '#D4A76A'
      roundRect(ctx, 0, 0, canvasWidth, canvasHeight, cellSize * 0.15)
      ctx.fill()

      // 2. Grid lines
      ctx.strokeStyle = 'rgba(92, 64, 51, 0.3)'
      ctx.lineWidth = cellSize * 0.02

      // Vertical lines
      for (let i = 0; i <= cols; i++) {
        const x = region.x1 + i
        const sx = toX(x)
        ctx.beginPath()
        ctx.moveTo(sx, toY(region.y1))
        ctx.lineTo(sx, toY(region.y2))
        ctx.stroke()
      }

      // Horizontal lines
      for (let i = 0; i <= rows; i++) {
        const y = region.y1 + i
        const sy = toY(y)
        ctx.beginPath()
        ctx.moveTo(toX(region.x1), sy)
        ctx.lineTo(toX(region.x2), sy)
        ctx.stroke()
      }

      // 3. Border lines (thicker at actual board edges)
      ctx.strokeStyle = 'rgba(92, 64, 51, 0.5)'
      ctx.lineWidth = cellSize * 0.04
      ctx.setLineDash([])

      if (isLeftEdge) {
        ctx.beginPath()
        ctx.moveTo(toX(0), toY(region.y1))
        ctx.lineTo(toX(0), toY(region.y2))
        ctx.stroke()
      }
      if (isRightEdge) {
        ctx.beginPath()
        ctx.moveTo(toX(boardSize - 1), toY(region.y1))
        ctx.lineTo(toX(boardSize - 1), toY(region.y2))
        ctx.stroke()
      }
      if (isTopEdge) {
        ctx.beginPath()
        ctx.moveTo(toX(region.x1), toY(0))
        ctx.lineTo(toX(region.x2), toY(0))
        ctx.stroke()
      }
      if (isBottomEdge) {
        ctx.beginPath()
        ctx.moveTo(toX(region.x1), toY(boardSize - 1))
        ctx.lineTo(toX(region.x2), toY(boardSize - 1))
        ctx.stroke()
      }

      // 4. Dashed lines for viewRegion edges that are not board edges
      if (viewRegion) {
        ctx.strokeStyle = 'rgba(92, 64, 51, 0.5)'
        ctx.lineWidth = cellSize * 0.02
        ctx.setLineDash([cellSize * 0.1, cellSize * 0.1])

        if (!isLeftEdge) {
          ctx.beginPath()
          ctx.moveTo(toX(region.x1), toY(region.y1) - paddingPx * 0.5)
          ctx.lineTo(toX(region.x1), toY(region.y2) + paddingPx * 0.5)
          ctx.stroke()
        }
        if (!isRightEdge) {
          ctx.beginPath()
          ctx.moveTo(toX(region.x2), toY(region.y1) - paddingPx * 0.5)
          ctx.lineTo(toX(region.x2), toY(region.y2) + paddingPx * 0.5)
          ctx.stroke()
        }
        if (!isTopEdge) {
          ctx.beginPath()
          ctx.moveTo(toX(region.x1) - paddingPx * 0.5, toY(region.y1))
          ctx.lineTo(toX(region.x2) + paddingPx * 0.5, toY(region.y1))
          ctx.stroke()
        }
        if (!isBottomEdge) {
          ctx.beginPath()
          ctx.moveTo(toX(region.x1) - paddingPx * 0.5, toY(region.y2))
          ctx.lineTo(toX(region.x2) + paddingPx * 0.5, toY(region.y2))
          ctx.stroke()
        }

        ctx.setLineDash([])
      }

      // 5. Star points
      const starPoints = STAR_POINTS[boardSize] || []
      for (const p of starPoints) {
        if (p.x >= region.x1 && p.x <= region.x2 && p.y >= region.y1 && p.y <= region.y2) {
          ctx.fillStyle = '#5C4033'
          ctx.beginPath()
          ctx.arc(toX(p.x), toY(p.y), starRadius, 0, Math.PI * 2)
          ctx.fill()
        }
      }

      // 6. Highlight points
      if (highlightPoints && highlightPoints.length > 0) {
        for (const p of highlightPoints) {
          if (p.x >= region.x1 && p.x <= region.x2 && p.y >= region.y1 && p.y <= region.y2) {
            ctx.fillStyle = 'rgba(88, 204, 2, 0.7)'
            ctx.beginPath()
            ctx.arc(toX(p.x), toY(p.y), stoneRadius * 0.35, 0, Math.PI * 2)
            ctx.fill()
          }
        }
      }

      // 7. Stones with radial gradients
      const lastMoveKey = lastMove ? `${lastMove.x},${lastMove.y}` : null

      for (const s of stones) {
        if (s.x < region.x1 || s.x > region.x2 || s.y < region.y1 || s.y > region.y2) continue

        const cx = toX(s.x)
        const cy = toY(s.y)

        // Radial gradient
        const gradient = ctx.createRadialGradient(
          cx - stoneRadius * 0.1, cy - stoneRadius * 0.3, stoneRadius * 0.1,
          cx, cy, stoneRadius
        )

        if (s.color === 'black') {
          gradient.addColorStop(0, '#444')
          gradient.addColorStop(1, '#000')
        } else {
          gradient.addColorStop(0, '#fff')
          gradient.addColorStop(1, '#ddd')
        }

        ctx.fillStyle = gradient
        ctx.beginPath()
        ctx.arc(cx, cy, stoneRadius, 0, Math.PI * 2)
        ctx.fill()

        // White stone border
        if (s.color === 'white') {
          ctx.strokeStyle = '#999'
          ctx.lineWidth = cellSize * 0.015
          ctx.stroke()
        }
      }

      // 8. Last move marker (skip when moveHistory has numbers to show)
      if (lastMove && !showMoveNumbers && !(moveHistory && moveHistory.length > 0)) {
        const key = `${lastMove.x},${lastMove.y}`
        const color = stoneMap.get(key)
        if (color && lastMove.x >= region.x1 && lastMove.x <= region.x2 && lastMove.y >= region.y1 && lastMove.y <= region.y2) {
          ctx.fillStyle = color === 'black' ? '#fff' : '#000'
          ctx.beginPath()
          ctx.arc(toX(lastMove.x), toY(lastMove.y), lastMoveRadius, 0, Math.PI * 2)
          ctx.fill()
        }
      }

      // 9. Move numbers (showMoveNumbers uses stone index)
      if (showMoveNumbers) {
        for (let i = 0; i < stones.length; i++) {
          const s = stones[i]
          if (s.x < region.x1 || s.x > region.x2 || s.y < region.y1 || s.y > region.y2) continue

          const num = i + 1
          const fontSize = stoneRadius * (num >= 10 ? 0.68 : 0.85)
          ctx.font = `bold ${fontSize}px sans-serif`
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillStyle = s.color === 'black' ? '#fff' : '#000'
          ctx.fillText(String(num), toX(s.x), toY(s.y))
        }
      }

      // 10. Move history sequence numbers (only for non-captured stones)
      // 同一位置只画最后一个编号（提子后再落子的情况）
      if (moveHistory && moveHistory.length > 0 && !showMoveNumbers) {
        // 先找每个位置最后出现的 moveHistory 索引
        const lastAtPos = new Map()
        for (let i = 0; i < moveHistory.length; i++) {
          const s = moveHistory[i]
          lastAtPos.set(`${s.x},${s.y}`, i)
        }

        for (let i = 0; i < moveHistory.length; i++) {
          const s = moveHistory[i]
          if (s.x < region.x1 || s.x > region.x2 || s.y < region.y1 || s.y > region.y2) continue
          if (!stoneMap.has(`${s.x},${s.y}`)) continue // captured stone, skip
          if (lastAtPos.get(`${s.x},${s.y}`) !== i) continue // 同位置只画最后一个

          const num = i + 1
          const fontSize = stoneRadius * (num >= 10 ? 0.8 : 1.0)
          ctx.font = `bold ${fontSize}px -apple-system, sans-serif`
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          // 先画描边增加清晰度
          ctx.strokeStyle = s.color === 'black' ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.5)'
          ctx.lineWidth = fontSize * 0.08
          ctx.strokeText(String(num), toX(s.x), toY(s.y))
          ctx.fillStyle = s.color === 'black' ? '#fff' : '#000'
          ctx.fillText(String(num), toX(s.x), toY(s.y))
        }
      }
    },

    onTouchEnd(e) {
      if (!this.data.interactive) return
      if (!this._canvas) return

      const touch = e.changedTouches && e.changedTouches[0]
      if (!touch) return

      const region = this._getRegion()
      const cols = region.x2 - region.x1
      const rows = region.y2 - region.y1
      const cssWidth = this._cssWidth
      const cssHeight = this.data.canvasHeight
      const padding = 0.5

      const cellSizeW = cssWidth / (cols + padding * 2)
      const cellSizeH = cssHeight / (rows + padding * 2)
      const cellSize = Math.min(cellSizeW, cellSizeH)
      const paddingPx = cellSize * padding
      const offsetX = (cssWidth - cellSize * (cols + padding * 2)) / 2
      const offsetY = (cssHeight - cellSize * (rows + padding * 2)) / 2

      // Touch coordinates are in CSS pixels relative to the component
      const touchX = touch.x !== undefined ? touch.x : touch.clientX
      const touchY = touch.y !== undefined ? touch.y : touch.clientY

      // Convert touch position to board coordinates
      const boardX = Math.round((touchX - paddingPx - offsetX) / cellSize + region.x1)
      const boardY = Math.round((touchY - paddingPx - offsetY) / cellSize + region.y1)

      // Check within region bounds
      if (boardX < region.x1 || boardX > region.x2 || boardY < region.y1 || boardY > region.y2) return

      // Check that there's no existing stone at this position
      const key = `${boardX},${boardY}`
      for (const s of this.data.stones) {
        if (`${s.x},${s.y}` === key) return
      }

      this.triggerEvent('move', { x: boardX, y: boardY })
    },
  },
})

#!/usr/bin/env node
/**
 * 自动生成围棋题库 — 入门 + 初级 + 中级
 * 用法: node scripts/generate-puzzles.js
 */

const fs = require('fs')
const path = require('path')

// ========== 围棋规则引擎 ==========
function createBoard(size) {
  const b = []
  for (let i = 0; i < size; i++) { const r = []; for (let j = 0; j < size; j++) r.push(null); b.push(r) }
  return b
}
function neighbors(x, y, size) {
  const pts = []
  if (x > 0) pts.push([x-1, y]); if (x < size-1) pts.push([x+1, y])
  if (y > 0) pts.push([x, y-1]); if (y < size-1) pts.push([x, y+1])
  return pts
}
function getGroup(board, x, y, size) {
  const color = board[y][x]; if (!color) return { group: [], liberties: 0, libSet: {} }
  const visited = {}, group = [], libSet = {}, stack = [[x, y]]
  while (stack.length > 0) {
    const [px, py] = stack.pop(), k = px + ',' + py
    if (visited[k]) continue; visited[k] = true; group.push([px, py])
    for (const [nx, ny] of neighbors(px, py, size)) {
      const nk = nx + ',' + ny
      if (board[ny][nx] === null) libSet[nk] = true
      else if (board[ny][nx] === color && !visited[nk]) stack.push([nx, ny])
    }
  }
  return { group, liberties: Object.keys(libSet).length, libSet }
}
function playMove(board, x, y, color, size) {
  if (board[y][x] !== null) return null
  const nb = board.map(r => r.slice())
  nb[y][x] = color
  const opp = color === 'black' ? 'white' : 'black'
  let captured = []
  for (const [nx, ny] of neighbors(x, y, size)) {
    if (nb[ny][nx] === opp) {
      const g = getGroup(nb, nx, ny, size)
      if (g.liberties === 0) {
        for (const [gx, gy] of g.group) { nb[gy][gx] = null; captured.push([gx, gy]) }
      }
    }
  }
  if (captured.length === 0) {
    const self = getGroup(nb, x, y, size)
    if (self.liberties === 0) return null // suicide
  }
  return { board: nb, captured }
}
function libertyCount(board, x, y, size) {
  if (!board[y][x]) return 0
  return getGroup(board, x, y, size).liberties
}
function libertyPoints(board, x, y, size) {
  if (!board[y][x]) return []
  const g = getGroup(board, x, y, size)
  return Object.keys(g.libSet).map(k => k.split(',').map(Number))
}

// ========== 随机工具 ==========
let seed = 42
function rand() { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff }
function randInt(min, max) { return min + Math.floor(rand() * (max - min + 1)) }
function shuffle(arr) { for (let i = arr.length - 1; i > 0; i--) { const j = randInt(0, i); [arr[i], arr[j]] = [arr[j], arr[i]] } return arr }

// ========== view region 计算 ==========
function calcRegion(stones, moves, size, pad) {
  pad = pad || 2
  let x1 = size, y1 = size, x2 = 0, y2 = 0
  for (const [x, y] of stones) { x1 = Math.min(x1, x); y1 = Math.min(y1, y); x2 = Math.max(x2, x); y2 = Math.max(y2, y) }
  for (const m of moves) { x1 = Math.min(x1, m[0]); y1 = Math.min(y1, m[1]); x2 = Math.max(x2, m[0]); y2 = Math.max(y2, m[1]) }
  return { x1: Math.max(0, x1-pad), y1: Math.max(0, y1-pad), x2: Math.min(size-1, x2+pad), y2: Math.min(size-1, y2+pad) }
}

// ========== 验证题目 ==========
function validatePuzzle(p, size) {
  const board = createBoard(size)
  for (const [x, y] of p.initial_stones.black) board[y][x] = 'black'
  for (const [x, y] of p.initial_stones.white) board[y][x] = 'white'
  // check no dead groups in initial state
  const checked = {}
  const allStones = [...p.initial_stones.black.map(s => [...s, 'black']), ...p.initial_stones.white.map(s => [...s, 'white'])]
  for (const [x, y, c] of allStones) {
    const k = x + ',' + y
    if (checked[k]) continue
    const g = getGroup(board, x, y, size)
    for (const [gx, gy] of g.group) checked[gx + ',' + gy] = true
    if (g.liberties === 0) return false
  }
  // check correct move is valid
  for (const seq of p.correct_moves) {
    const m = seq[0]
    if (board[m[1]][m[0]] !== null) return false
    const r = playMove(board, m[0], m[1], 'black', size)
    if (!r) return false
  }
  return true
}

// ========== 题目唯一性检查 ==========
const usedPositions = new Set()
function posKey(blacks, whites) {
  const sorted = [...blacks.map(p => 'b' + p[0] + ',' + p[1]), ...whites.map(p => 'w' + p[0] + ',' + p[1])].sort()
  return sorted.join('|')
}

// ========== 生成入门题 ==========
const ALL = []
let idCounter = 0

function addPuzzle(p) {
  const key = posKey(p.initial_stones.black, p.initial_stones.white)
  if (usedPositions.has(key)) return false
  usedPositions.add(key)
  if (!validatePuzzle(p, p.board_size)) return false
  ALL.push(p)
  return true
}

function makeId(prefix) { return prefix + '_' + String(++idCounter).padStart(4, '0') }

// ─── 1. 吃子题：1颗白棋只剩1口气 (50道) ───
function genCapture1lib(count) {
  const SIZE = 9
  let made = 0
  // 角上
  for (const [wx, wy] of [[0,0],[8,0],[0,8],[8,8]]) {
    if (made >= count) break
    const nbs = neighbors(wx, wy, SIZE)
    // 白在角, 黑占满除1口气
    for (let leave = 0; leave < nbs.length && made < count; leave++) {
      const blacks = nbs.filter((_, i) => i !== leave)
      const answer = nbs[leave]
      const p = {
        id: makeId('cap1'), category: '吃子', subcategory: '1步吃子',
        difficulty_rating: 400 + made * 3,
        level_range: '25级-22级', description: '黑先·吃子·1手',
        board_size: SIZE, initial_stones: { black: blacks, white: [[wx, wy]] },
        correct_moves: [[answer]], view_region: calcRegion([...blacks, [wx,wy]], [answer], SIZE),
        source: 'auto_generated', steps: 1, hint: '吃掉白子'
      }
      if (addPuzzle(p)) made++
    }
  }
  // 边上
  for (let pos = 1; pos <= 7 && made < count; pos += 1) {
    for (const [wx, wy] of [[pos, 0], [0, pos], [pos, 8], [8, pos]]) {
      if (made >= count) break
      const nbs = neighbors(wx, wy, SIZE)
      for (let leave = 0; leave < nbs.length && made < count; leave++) {
        const blacks = nbs.filter((_, i) => i !== leave)
        const answer = nbs[leave]
        // Check answer is not occupied
        if (blacks.some(b => b[0] === answer[0] && b[1] === answer[1])) continue
        const p = {
          id: makeId('cap1'), category: '吃子', subcategory: '1步吃子',
          difficulty_rating: 420 + made * 2,
          level_range: '25级-22级', description: '黑先·吃子·1手',
          board_size: SIZE, initial_stones: { black: blacks, white: [[wx, wy]] },
          correct_moves: [[answer]], view_region: calcRegion([...blacks, [wx,wy]], [answer], SIZE),
          source: 'auto_generated', steps: 1, hint: '吃掉白子'
        }
        if (addPuzzle(p)) made++
      }
    }
  }
  // 中腹
  for (let wx = 2; wx <= 6 && made < count; wx += 2) {
    for (let wy = 2; wy <= 6 && made < count; wy += 2) {
      const nbs = neighbors(wx, wy, SIZE)
      for (let leave = 0; leave < nbs.length && made < count; leave++) {
        const blacks = nbs.filter((_, i) => i !== leave)
        const answer = nbs[leave]
        const p = {
          id: makeId('cap1'), category: '吃子', subcategory: '1步吃子',
          difficulty_rating: 440 + made,
          level_range: '25级-22级', description: '黑先·吃子·1手',
          board_size: SIZE, initial_stones: { black: blacks, white: [[wx, wy]] },
          correct_moves: [[answer]], view_region: calcRegion([...blacks, [wx,wy]], [answer], SIZE),
          source: 'auto_generated', steps: 1, hint: '吃掉白子'
        }
        if (addPuzzle(p)) made++
      }
    }
  }
  console.log(`  吃子·1气单子: ${made}/${count}`)
}

// ─── 2. 吃子题：2-3颗白棋只剩1口气 (50道) ───
function genCaptureGroup1lib(count) {
  const SIZE = 9
  let made = 0
  // 2子横排边上
  for (let x = 0; x <= 7 && made < count; x++) {
    for (const y of [0, 8]) {
      if (made >= count) break
      const whites = [[x, y], [x+1, y]]
      const board = createBoard(SIZE)
      whites.forEach(([wx,wy]) => board[wy][wx] = 'white')
      // 找白棋的气
      const libs = libertyPoints(board, x, y, SIZE)
      if (libs.length < 2) continue
      // 黑棋堵住除1口
      for (let leave = 0; leave < libs.length && made < count; leave++) {
        const blacks = libs.filter((_, i) => i !== leave)
        const answer = libs[leave]
        // 验证黑棋自己不会没气
        const testBoard = createBoard(SIZE)
        whites.forEach(([wx,wy]) => testBoard[wy][wx] = 'white')
        let blackOk = true
        for (const [bx, by] of blacks) {
          testBoard[by][bx] = 'black'
          if (getGroup(testBoard, bx, by, SIZE).liberties === 0) { blackOk = false; break }
        }
        if (!blackOk) continue
        const p = {
          id: makeId('cap2'), category: '吃子', subcategory: '1步吃多子',
          difficulty_rating: 480 + made * 2,
          level_range: '24级-21级', description: '黑先·吃子·1手',
          board_size: SIZE, initial_stones: { black: blacks, white: whites },
          correct_moves: [[answer]], view_region: calcRegion([...blacks, ...whites], [answer], SIZE),
          source: 'auto_generated', steps: 1, hint: '吃掉白棋'
        }
        if (addPuzzle(p)) made++
      }
    }
  }
  // 2子竖排
  for (let y = 0; y <= 7 && made < count; y++) {
    for (const x of [0, 8]) {
      if (made >= count) break
      const whites = [[x, y], [x, y+1]]
      const board = createBoard(SIZE)
      whites.forEach(([wx,wy]) => board[wy][wx] = 'white')
      const libs = libertyPoints(board, x, y, SIZE)
      if (libs.length < 2) continue
      for (let leave = 0; leave < libs.length && made < count; leave++) {
        const blacks = libs.filter((_, i) => i !== leave)
        const answer = libs[leave]
        const testBoard = createBoard(SIZE)
        whites.forEach(([wx,wy]) => testBoard[wy][wx] = 'white')
        let blackOk = true
        for (const [bx, by] of blacks) {
          testBoard[by][bx] = 'black'
          if (getGroup(testBoard, bx, by, SIZE).liberties === 0) { blackOk = false; break }
        }
        if (!blackOk) continue
        const p = {
          id: makeId('cap2'), category: '吃子', subcategory: '1步吃多子',
          difficulty_rating: 500 + made * 2,
          level_range: '24级-21级', description: '黑先·吃子·1手',
          board_size: SIZE, initial_stones: { black: blacks, white: whites },
          correct_moves: [[answer]], view_region: calcRegion([...blacks, ...whites], [answer], SIZE),
          source: 'auto_generated', steps: 1, hint: '吃掉白棋'
        }
        if (addPuzzle(p)) made++
      }
    }
  }
  // 3子L形中腹
  for (let x = 2; x <= 6 && made < count; x += 2) {
    for (let y = 2; y <= 6 && made < count; y += 2) {
      const whites = [[x,y],[x+1,y],[x,y+1]]
      const board = createBoard(SIZE)
      whites.forEach(([wx,wy]) => board[wy][wx] = 'white')
      const libs = libertyPoints(board, x, y, SIZE)
      if (libs.length < 2) continue
      for (let leave = 0; leave < libs.length && made < count; leave++) {
        const blacks = libs.filter((_, i) => i !== leave)
        const answer = libs[leave]
        const testBoard = createBoard(SIZE)
        whites.forEach(([wx,wy]) => testBoard[wy][wx] = 'white')
        let blackOk = true
        for (const [bx, by] of blacks) {
          if (testBoard[by][bx] !== null) { blackOk = false; break }
          testBoard[by][bx] = 'black'
        }
        if (!blackOk) continue
        // verify all black stones have liberties
        for (const [bx, by] of blacks) {
          if (getGroup(testBoard, bx, by, SIZE).liberties === 0) { blackOk = false; break }
        }
        if (!blackOk) continue
        const p = {
          id: makeId('cap2'), category: '吃子', subcategory: '1步吃多子',
          difficulty_rating: 530 + made * 2,
          level_range: '23级-20级', description: '黑先·吃子·1手',
          board_size: SIZE, initial_stones: { black: blacks, white: whites },
          correct_moves: [[answer]], view_region: calcRegion([...blacks, ...whites], [answer], SIZE),
          source: 'auto_generated', steps: 1, hint: '吃掉白棋'
        }
        if (addPuzzle(p)) made++
      }
    }
  }
  console.log(`  吃子·多子1气: ${made}/${count}`)
}

// ─── 3. 白棋2气，黑棋打吃 (50道) ───
function genLadder(count) {
  const SIZE = 9
  let made = 0
  // 白1子有2口气, 黑围住其余方向, 黑先紧1气打吃
  for (let cx = 1; cx <= 7 && made < count; cx++) {
    for (let cy = 1; cy <= 7 && made < count; cy++) {
      const nbs = neighbors(cx, cy, SIZE)
      if (nbs.length < 3) continue
      // Try leaving 2 liberties, blocking the rest
      for (let a = 0; a < nbs.length && made < count; a++) {
        for (let b = a + 1; b < nbs.length && made < count; b++) {
          const blocked = nbs.filter((_, i) => i !== a && i !== b)
          const freeA = nbs[a], freeB = nbs[b]
          // Black occupies blocked positions
          const board = createBoard(SIZE)
          board[cy][cx] = 'white'
          let ok = true
          for (const [bx, by] of blocked) {
            board[by][bx] = 'black'
          }
          // Verify white has exactly 2 libs
          if (libertyCount(board, cx, cy, SIZE) !== 2) continue
          // Verify black stones are alive
          for (const [bx, by] of blocked) {
            if (getGroup(board, bx, by, SIZE).liberties === 0) { ok = false; break }
          }
          if (!ok) continue
          // Answer: play at freeA to put white in atari
          const r = playMove(board, freeA[0], freeA[1], 'black', SIZE)
          if (!r) continue
          if (r.captured.length > 0) continue // direct capture = too easy, skip
          // White should now be in atari
          const wLibs = libertyCount(r.board, cx, cy, SIZE)
          if (wLibs !== 1) continue
          const p = {
            id: makeId('atk2'), category: '吃子', subcategory: '打吃',
            difficulty_rating: 580 + made * 3,
            level_range: '22级-20级', description: '黑先·打吃·1手',
            board_size: SIZE, initial_stones: { black: blocked, white: [[cx, cy]] },
            correct_moves: [[freeA]], view_region: calcRegion([...blocked, [cx,cy]], [freeA], SIZE),
            source: 'auto_generated', steps: 1, hint: '打吃白棋'
          }
          if (addPuzzle(p)) made++
        }
      }
    }
  }
  console.log(`  打吃·2气: ${made}/${count}`)
}

// ─── 4. 堵逃跑口 (50道) ───
function genBlockEscape(count) {
  const SIZE = 9
  let made = 0
  // 白棋1子, 被围3面有1口逃路, 但逃路旁边有黑棋等着
  for (let cx = 1; cx <= 7 && made < count; cx++) {
    for (let cy = 1; cy <= 7 && made < count; cy++) {
      const dirs = [[1,0],[-1,0],[0,1],[0,-1]]
      for (let escape = 0; escape < 4 && made < count; escape++) {
        const [dx, dy] = dirs[escape]
        const ex = cx + dx, ey = cy + dy
        if (ex < 0 || ex >= SIZE || ey < 0 || ey >= SIZE) continue
        // Black surrounds white on 3 sides, escape direction has 1 empty
        const blacks = dirs.filter((_, i) => i !== escape).map(([ddx, ddy]) => [cx+ddx, cy+ddy]).filter(([x,y]) => x >= 0 && x < SIZE && y >= 0 && y < SIZE)
        if (blacks.length < 2) continue
        // The answer is to block the escape
        const answer = [ex, ey]
        // Make sure answer point is valid
        const board = createBoard(SIZE)
        board[cy][cx] = 'white'
        blacks.forEach(([bx,by]) => board[by][bx] = 'black')
        const wlibs = libertyCount(board, cx, cy, SIZE)
        if (wlibs !== 1) continue // should be exactly 1 lib = the escape point
        const r = playMove(board, answer[0], answer[1], 'black', SIZE)
        if (!r || r.captured.length === 0) continue // must capture
        const p = {
          id: makeId('blk'), category: '吃子', subcategory: '堵住逃路',
          difficulty_rating: 550 + made * 3,
          level_range: '23级-20级', description: '黑先·吃子·1手',
          board_size: SIZE, initial_stones: { black: blacks, white: [[cx, cy]] },
          correct_moves: [[answer]], view_region: calcRegion([...blacks, [cx,cy]], [answer], SIZE),
          source: 'auto_generated', steps: 1, hint: '堵住白棋逃路'
        }
        if (addPuzzle(p)) made++
      }
    }
  }
  console.log(`  堵逃路: ${made}/${count}`)
}

// ─── 5. 逃跑题：黑棋2气找逃路 (50道) ───
function genEscape(count) {
  const SIZE = 9
  let made = 0
  for (let cx = 1; cx <= 7 && made < count; cx++) {
    for (let cy = 1; cy <= 7 && made < count; cy++) {
      const dirs = [[1,0],[-1,0],[0,1],[0,-1]]
      // 黑在(cx,cy), 白围3面, 黑需要向空的方向逃
      for (let openDir = 0; openDir < 4 && made < count; openDir++) {
        const [dx, dy] = dirs[openDir]
        const ox = cx + dx, oy = cy + dy
        if (ox < 0 || ox >= SIZE || oy < 0 || oy >= SIZE) continue
        const whites = dirs.filter((_, i) => i !== openDir).map(([ddx, ddy]) => [cx+ddx, cy+ddy]).filter(([x,y]) => x >= 0 && x < SIZE && y >= 0 && y < SIZE)
        if (whites.length < 2) continue
        const board = createBoard(SIZE)
        board[cy][cx] = 'black'
        whites.forEach(([wx,wy]) => board[wy][wx] = 'white')
        const blibs = libertyCount(board, cx, cy, SIZE)
        if (blibs !== 1) continue
        const answer = [ox, oy]
        const r = playMove(board, answer[0], answer[1], 'black', SIZE)
        if (!r) continue
        // After escaping, black should have more than 1 liberty
        const newLibs = libertyCount(r.board, cx, cy, SIZE)
        if (newLibs < 2) continue
        const p = {
          id: makeId('esc'), category: '逃跑', subcategory: '逃出包围',
          difficulty_rating: 500 + made * 3,
          level_range: '24级-21级', description: '黑先·逃跑·1手',
          board_size: SIZE, initial_stones: { black: [[cx, cy]], white: whites },
          correct_moves: [[answer]], view_region: calcRegion([[cx,cy], ...whites], [answer], SIZE),
          source: 'auto_generated', steps: 1, hint: '救出黑子'
        }
        if (addPuzzle(p)) made++
      }
    }
  }
  console.log(`  逃跑·找出路: ${made}/${count}`)
}

// ─── 6. 连接题：找到连接点 (50道) ───
function genConnect(count) {
  const SIZE = 9
  let made = 0
  for (let cx = 1; cx <= 5 && made < count; cx++) {
    for (let cy = 1; cy <= 7 && made < count; cy++) {
      // 两颗黑棋间隔1格, 中间点是答案, 白棋在两侧威胁
      // 横向连接
      const bLeft = [cx, cy], bRight = [cx+2, cy], answer = [cx+1, cy]
      const wUp = [cx+1, cy-1], wDown = [cx+1, cy+1]
      if (bRight[0] >= SIZE || wUp[1] < 0 || wDown[1] >= SIZE) continue
      const p = {
        id: makeId('conn'), category: '连接', subcategory: '连接两子',
        difficulty_rating: 650 + made * 2,
        level_range: '22级-20级', description: '黑先·连接·1手',
        board_size: SIZE, initial_stones: { black: [bLeft, bRight], white: [wUp, wDown] },
        correct_moves: [[answer]], view_region: calcRegion([bLeft, bRight, wUp, wDown], [answer], SIZE),
        source: 'auto_generated', steps: 1, hint: '连接黑子'
      }
      if (addPuzzle(p)) made++
      if (made >= count) break
      // 纵向连接
      if (cy + 2 >= SIZE) continue
      const bTop = [cx, cy], bBot = [cx, cy+2], answer2 = [cx, cy+1]
      const wL = [cx-1, cy+1], wR = [cx+1, cy+1]
      if (wL[0] < 0 || wR[0] >= SIZE) continue
      const p2 = {
        id: makeId('conn'), category: '连接', subcategory: '连接两子',
        difficulty_rating: 660 + made * 2,
        level_range: '22级-20级', description: '黑先·连接·1手',
        board_size: SIZE, initial_stones: { black: [bTop, bBot], white: [wL, wR] },
        correct_moves: [[answer2]], view_region: calcRegion([bTop, bBot, wL, wR], [answer2], SIZE),
        source: 'auto_generated', steps: 1, hint: '连接黑子'
      }
      if (addPuzzle(p2)) made++
    }
  }
  console.log(`  连接: ${made}/${count}`)
}

// ─── 7. 数气题：简单对杀 (100道) ───
function genLibCount(count) {
  const SIZE = 9
  let made = 0
  // 两块棋相邻对杀, 黑多1气, 黑先紧气能赢
  for (let cx = 1; cx <= 5 && made < count; cx++) {
    for (let cy = 1; cy <= 5 && made < count; cy++) {
      // 黑2子vs白2子竖排, 共享气
      // 黑: (cx,cy),(cx,cy+1)  白: (cx+1,cy),(cx+1,cy+1)
      // 外围黑棋封住白棋大部分气
      const blacks = [[cx,cy],[cx,cy+1]]
      const whites = [[cx+1,cy],[cx+1,cy+1]]
      // 白棋的气点
      const board = createBoard(SIZE)
      blacks.forEach(([x,y]) => board[y][x] = 'black')
      whites.forEach(([x,y]) => board[y][x] = 'white')
      const wLibPts = libertyPoints(board, cx+1, cy, SIZE)
      if (wLibPts.length < 2 || wLibPts.length > 4) continue
      // 添加外围黑棋封住白棋的一些气, 留2气
      const extraBlack = []
      const shuffledLibs = shuffle([...wLibPts])
      for (let i = 2; i < shuffledLibs.length; i++) {
        const [lx, ly] = shuffledLibs[i]
        // 不能放在已有子的地方, 不能自杀
        if (board[ly][lx] !== null) continue
        board[ly][lx] = 'black'
        if (getGroup(board, lx, ly, SIZE).liberties === 0) { board[ly][lx] = null; continue }
        extraBlack.push([lx, ly])
      }
      const allBlack = [...blacks, ...extraBlack]
      // 重新计算
      const board2 = createBoard(SIZE)
      allBlack.forEach(([x,y]) => board2[y][x] = 'black')
      whites.forEach(([x,y]) => board2[y][x] = 'white')
      const wlibs2 = libertyCount(board2, cx+1, cy, SIZE)
      const blibs2 = libertyCount(board2, cx, cy, SIZE)
      if (wlibs2 < 1 || wlibs2 > 3) continue
      if (blibs2 <= wlibs2) continue // black must have more libs
      // Answer: play at one of white's liberty points
      const wLibPts2 = libertyPoints(board2, cx+1, cy, SIZE)
      if (wLibPts2.length === 0) continue
      const answer = wLibPts2[0]
      const r = playMove(board2, answer[0], answer[1], 'black', SIZE)
      if (!r) continue
      const p = {
        id: makeId('lib'), category: '数气', subcategory: '对杀紧气',
        difficulty_rating: 600 + made * 2,
        level_range: '23级-20级', description: '黑先·紧气·1手',
        board_size: SIZE, initial_stones: { black: allBlack, white: whites },
        correct_moves: [[answer]], view_region: calcRegion([...allBlack, ...whites], [answer], SIZE),
        source: 'auto_generated', steps: 1, hint: '紧白棋的气'
      }
      if (addPuzzle(p)) made++
    }
  }
  console.log(`  数气·对杀: ${made}/${count}`)
}

// ─── 8. 基础眼形：做眼 (100道) ───
function genMakeEye(count) {
  const SIZE = 9
  let made = 0
  // 边上4子围空, 中间1点是眼, 黑先在关键点做眼
  for (let x = 0; x <= 5 && made < count; x++) {
    for (const y of [0, 8]) {
      if (made >= count) break
      // 上边/下边: 黑占据 x..x+3 一排, 外围白棋包围
      const dy = y === 0 ? 1 : -1
      const blacks = [[x,y],[x+1,y],[x+2,y],[x+3,y],[x,y+dy],[x+3,y+dy]]
      // 验证坐标合法
      if (blacks.some(([bx,by]) => bx < 0 || bx >= SIZE || by < 0 || by >= SIZE)) continue
      const whites = []
      // 白棋封住外围
      for (const [bx, by] of blacks) {
        for (const [nx, ny] of neighbors(bx, by, SIZE)) {
          if (!blacks.some(([bbx,bby]) => bbx===nx&&bby===ny) && !whites.some(([wx,wy]) => wx===nx&&wy===ny)) {
            whites.push([nx, ny])
          }
        }
      }
      // 眼位: (x+1,y+dy) 或 (x+2,y+dy)
      const eye1 = [x+1, y+dy], eye2 = [x+2, y+dy]
      // 去掉眼位从白棋列表
      const finalWhites = whites.filter(([wx,wy]) => !(wx===eye1[0]&&wy===eye1[1]) && !(wx===eye2[0]&&wy===eye2[1]))
      if (finalWhites.length < 2) continue
      const answer = eye1
      const board = createBoard(SIZE)
      blacks.forEach(([bx,by]) => board[by][bx] = 'black')
      finalWhites.forEach(([wx,wy]) => board[wy][wx] = 'white')
      // verify
      const r = playMove(board, answer[0], answer[1], 'black', SIZE)
      if (!r) continue
      const p = {
        id: makeId('eye'), category: '做眼', subcategory: '做出两眼',
        difficulty_rating: 700 + made * 2,
        level_range: '22级-20级', description: '黑先·做眼·1手',
        board_size: SIZE, initial_stones: { black: blacks, white: finalWhites },
        correct_moves: [[answer]], view_region: calcRegion([...blacks, ...finalWhites], [answer], SIZE),
        source: 'auto_generated', steps: 1, hint: '做出两只眼'
      }
      if (addPuzzle(p)) made++
    }
  }
  // 角上做眼
  for (let i = 0; i < 4 && made < count; i++) {
    const cx = i < 2 ? 0 : 8, cy = i % 2 === 0 ? 0 : 8
    const dx = cx === 0 ? 1 : -1, ddy = cy === 0 ? 1 : -1
    const blacks = [[cx,cy],[cx+dx,cy],[cx,cy+ddy],[cx+dx*2,cy],[cx,cy+ddy*2]]
    const filtered = blacks.filter(([bx,by]) => bx >= 0 && bx < SIZE && by >= 0 && by < SIZE)
    if (filtered.length < 4) continue
    const answer = [cx+dx, cy+ddy]
    if (answer[0] < 0 || answer[0] >= SIZE || answer[1] < 0 || answer[1] >= SIZE) continue
    const board = createBoard(SIZE)
    filtered.forEach(([bx,by]) => board[by][bx] = 'black')
    const r = playMove(board, answer[0], answer[1], 'black', SIZE)
    if (!r) continue
    const whites = []
    for (const [bx, by] of filtered) {
      for (const [nx, ny] of neighbors(bx, by, SIZE)) {
        if (board[ny][nx] === null && !(nx===answer[0]&&ny===answer[1]) && !whites.some(([wx,wy])=>wx===nx&&wy===ny)) {
          whites.push([nx,ny])
        }
      }
    }
    const p = {
      id: makeId('eye'), category: '做眼', subcategory: '做出两眼',
      difficulty_rating: 720 + made,
      level_range: '22级-20级', description: '黑先·做眼·1手',
      board_size: SIZE, initial_stones: { black: filtered, white: whites.slice(0, 6) },
      correct_moves: [[answer]], view_region: calcRegion([...filtered, ...whites.slice(0,6)], [answer], SIZE),
      source: 'auto_generated', steps: 1, hint: '做出两只眼'
    }
    if (addPuzzle(p)) made++
  }
  console.log(`  做眼: ${made}/${count}`)
}

// ========== 初级死活常型 (800-1200) ==========

// ─── 直三 ───
function genStraight3(count) {
  const SIZE = 9
  let made = 0
  for (let x = 0; x <= 4 && made < count; x++) {
    for (const y of [0, 8]) {
      if (made >= count) break
      const dy = y === 0 ? 1 : -1
      // 白棋直三: 3子一排在边上, 两端封住
      const whites = [[x+1,y],[x+2,y],[x+3,y]]
      const whiteWall = [[x+1,y+dy],[x+2,y+dy],[x+3,y+dy]]
      const blacks = [[x,y],[x+4,y],[x,y+dy],[x+4,y+dy], ...whiteWall]
      const allValid = [...blacks, ...whites].every(([px,py]) => px >= 0 && px < SIZE && py >= 0 && py < SIZE)
      if (!allValid) continue
      // 答案: 点中间做眼
      const answer = [x+2, y]
      // This is actually for killing - black plays center to kill
      const board = createBoard(SIZE)
      whites.forEach(([wx,wy]) => board[wy][wx] = 'white')
      blacks.forEach(([bx,by]) => board[by][bx] = 'black')
      // 白棋空间只有3格一排, 黑点中间 => 白死
      const r = playMove(board, answer[0], answer[1], 'black', SIZE)
      if (!r) continue
      const p = {
        id: makeId('ld3'), category: '死活', subcategory: '直三',
        difficulty_rating: 850 + made * 5,
        level_range: '19级-15级', description: '黑先·杀棋·1手',
        board_size: SIZE, initial_stones: { black: blacks, white: whites },
        correct_moves: [[answer]], view_region: calcRegion([...blacks, ...whites], [answer], SIZE),
        source: 'auto_generated', steps: 1, hint: '点眼杀棋'
      }
      if (addPuzzle(p)) made++
    }
  }
  console.log(`  直三: ${made}/${count}`)
}

// ─── 弯三 ───
function genBent3(count) {
  const SIZE = 9
  let made = 0
  for (let x = 0; x <= 4 && made < count; x++) {
    for (const y of [0]) {
      if (made >= count) break
      // 角上弯三: 白(x,0)(x+1,0)(x,1), 黑封住
      const whites = [[x,y],[x+1,y],[x,y+1]]
      const blacks = [[x+2,y],[x+1,y+1],[x,y+2],[x+2,y+1]]
      const allValid = [...blacks, ...whites].every(([px,py]) => px >= 0 && px < SIZE && py >= 0 && py < SIZE)
      if (!allValid) continue
      const answer = [x+1, y+1]
      const board = createBoard(SIZE)
      whites.forEach(([wx,wy]) => board[wy][wx] = 'white')
      blacks.forEach(([bx,by]) => board[by][bx] = 'black')
      if (board[answer[1]][answer[0]] !== null) continue
      const r = playMove(board, answer[0], answer[1], 'black', SIZE)
      if (!r) continue
      const p = {
        id: makeId('ld3b'), category: '死活', subcategory: '弯三',
        difficulty_rating: 880 + made * 5,
        level_range: '19级-15级', description: '黑先·杀棋·1手',
        board_size: SIZE, initial_stones: { black: blacks, white: whites },
        correct_moves: [[answer]], view_region: calcRegion([...blacks, ...whites], [answer], SIZE),
        source: 'auto_generated', steps: 1, hint: '点眼杀棋'
      }
      if (addPuzzle(p)) made++
    }
  }
  console.log(`  弯三: ${made}/${count}`)
}

// ─── 扑和倒扑 ───
function genSnapback(count) {
  const SIZE = 9
  let made = 0
  // 倒扑: 黑先扑入, 白吃, 黑反打吃
  for (let cx = 1; cx <= 6 && made < count; cx++) {
    for (let cy = 1; cy <= 6 && made < count; cy++) {
      // 白2子被围, 有1个假气(扑的点), 黑扑入制造倒扑
      const whites = [[cx,cy],[cx+1,cy]]
      const blacks = [[cx-1,cy],[cx,cy-1],[cx+1,cy-1],[cx+2,cy],[cx+1,cy+1]]
      const answer = [cx, cy+1] // 扑入点
      if (answer[1] >= SIZE) continue
      const allValid = [...blacks, ...whites, [answer]].every(([px,py]) => px >= 0 && px < SIZE && py >= 0 && py < SIZE)
      if (!allValid) continue
      // 检查是否有重叠
      const allPts = [...blacks, ...whites]
      const ptSet = new Set(allPts.map(([x,y]) => x+','+y))
      if (ptSet.size !== allPts.length) continue
      if (ptSet.has(answer[0]+','+answer[1])) continue
      const board = createBoard(SIZE)
      blacks.forEach(([bx,by]) => board[by][bx] = 'black')
      whites.forEach(([wx,wy]) => board[wy][wx] = 'white')
      const r = playMove(board, answer[0], answer[1], 'black', SIZE)
      if (!r) continue
      const p = {
        id: makeId('snap'), category: '手筋', subcategory: '倒扑',
        difficulty_rating: 900 + made * 5,
        level_range: '18级-14级', description: '黑先·手筋·1手',
        board_size: SIZE, initial_stones: { black: blacks, white: whites },
        correct_moves: [[answer]], view_region: calcRegion([...blacks, ...whites], [answer], SIZE),
        source: 'auto_generated', steps: 1, hint: '扑入'
      }
      if (addPuzzle(p)) made++
    }
  }
  console.log(`  倒扑: ${made}/${count}`)
}

// ─── 枷吃 ───
function genNet(count) {
  const SIZE = 9
  let made = 0
  for (let cx = 2; cx <= 6 && made < count; cx++) {
    for (let cy = 1; cy <= 6 && made < count; cy++) {
      // 白1子, 黑用小飞罩住
      const white = [cx, cy]
      const answer = [cx+1, cy+1]
      // 黑棋在白子附近
      const blacks = [[cx-1, cy], [cx, cy-1]]
      const allValid = [...blacks, white, answer].every(([px,py]) => px >= 0 && px < SIZE && py >= 0 && py < SIZE)
      if (!allValid) continue
      const board = createBoard(SIZE)
      board[cy][cx] = 'white'
      blacks.forEach(([bx,by]) => board[by][bx] = 'black')
      // White has 2 libs, net is the correct answer
      const wlibs = libertyCount(board, cx, cy, SIZE)
      if (wlibs !== 2) continue
      const r = playMove(board, answer[0], answer[1], 'black', SIZE)
      if (!r) continue
      // After net, white can't escape (all escape routes covered)
      const p = {
        id: makeId('net'), category: '手筋', subcategory: '枷吃',
        difficulty_rating: 950 + made * 4,
        level_range: '17级-13级', description: '黑先·枷吃·1手',
        board_size: SIZE, initial_stones: { black: blacks, white: [white] },
        correct_moves: [[answer]], view_region: calcRegion([...blacks, white], [answer], SIZE),
        source: 'auto_generated', steps: 1, hint: '用枷吃住白棋'
      }
      if (addPuzzle(p)) made++
    }
  }
  console.log(`  枷吃: ${made}/${count}`)
}

// ─── 手筋: 尖/飞/跳/断/挖 ───
function genTesuji(count) {
  const SIZE = 9
  let made = 0
  // 断: 白棋2子间1格空, 黑冲进去断
  for (let cx = 1; cx <= 5 && made < count; cx++) {
    for (let cy = 1; cy <= 7 && made < count; cy++) {
      const whites = [[cx, cy], [cx+2, cy]]
      const answer = [cx+1, cy]
      const blacks = [[cx+1, cy-1], [cx+1, cy+1]]
      if (blacks.some(([x,y]) => y < 0 || y >= SIZE)) continue
      const p = {
        id: makeId('tsj'), category: '手筋', subcategory: '断',
        difficulty_rating: 1000 + made * 3,
        level_range: '15级-11级', description: '黑先·切断·1手',
        board_size: SIZE, initial_stones: { black: blacks, white: whites },
        correct_moves: [[answer]], view_region: calcRegion([...blacks, ...whites], [answer], SIZE),
        source: 'auto_generated', steps: 1, hint: '切断白棋'
      }
      if (addPuzzle(p)) made++
    }
  }
  console.log(`  手筋: ${made}/${count}`)
}


// ========== 主流程 ==========
console.log('=== 生成入门题 (400-800) ===')
genCapture1lib(50)
genCaptureGroup1lib(50)
genLadder(50)
genBlockEscape(50)
genEscape(50)
genConnect(50)
genLibCount(100)
genMakeEye(100)

console.log('\n=== 生成初级题 (800-1200) ===')
genStraight3(30)
genBent3(30)
genSnapback(30)
genNet(30)
genTesuji(100)

console.log('\n=== 总计 ===')
console.log('有效题目:', ALL.length)

// 按 category 统计
const catCount = {}
for (const p of ALL) { catCount[p.category] = (catCount[p.category] || 0) + 1 }
for (const [k, v] of Object.entries(catCount).sort((a,b) => b[1]-a[1])) {
  console.log('  ' + k + ': ' + v)
}

// 按 rating 区间统计
const ratingBuckets = {}
for (const p of ALL) {
  const b = Math.floor(p.difficulty_rating / 200) * 200
  const key = b + '-' + (b + 199)
  ratingBuckets[key] = (ratingBuckets[key] || 0) + 1
}
console.log('\n按 rating:')
for (const [k, v] of Object.entries(ratingBuckets).sort((a,b) => parseInt(a) - parseInt(b))) {
  console.log('  ' + k + ': ' + v)
}

// 写入文件
const outPath = path.join(__dirname, '..', 'generated-puzzles.json')
fs.writeFileSync(outPath, JSON.stringify(ALL, null, 0))
console.log('\n已写入:', outPath, '(' + (fs.statSync(outPath).size / 1024).toFixed(0) + 'KB)')

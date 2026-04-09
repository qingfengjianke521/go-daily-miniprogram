#!/usr/bin/env node
/**
 * 扩充新手村题库
 * 每个 skill_node 至少 30 题，混合来源：
 *   1. 现有题（OGS+主题库+生成）
 *   2. 镜像变体（4-8 个对称变换）
 *   3. cap1_* 类额外用代码生成新题
 *   4. eyes_* 类追加更多 sanderland 主题库低分题
 *
 * 输出：覆盖 miniprogram/data/beginner-puzzles.js
 */

var fs = require('fs')
var path = require('path')
var goLogic = require(path.join(__dirname, '..', 'miniprogram', 'utils', 'go-logic.js'))

var IN_FILE = path.join(__dirname, '..', 'miniprogram', 'data', 'beginner-puzzles.js')
var MAIN_FILE = path.join(__dirname, '..', 'problems_all.json')
var OUT_FILE = IN_FILE
var TARGET_PER_TAG = 30

// ============================================================
// 加载现有题库
// ============================================================

function loadExistingPuzzles() {
  // 读取 JS 模块
  delete require.cache[require.resolve(IN_FILE)]
  var bp = require(IN_FILE)
  return bp.BEGINNER_PUZZLES_BY_TAG
}

// ============================================================
// 镜像/旋转变换
// ============================================================

function transformPoint(x, y, size, op) {
  var n = size - 1
  switch (op) {
    case 'identity': return { x: x, y: y }
    case 'flipH':    return { x: n - x, y: y }       // 水平翻转
    case 'flipV':    return { x: x, y: n - y }       // 垂直翻转
    case 'rot180':   return { x: n - x, y: n - y }   // 180 度旋转
    case 'flipDiag': return { x: y, y: x }           // 主对角线翻转
    case 'flipAnti': return { x: n - y, y: n - x }   // 副对角线翻转
    case 'rot90':    return { x: n - y, y: x }       // 90 度顺时针
    case 'rot270':   return { x: y, y: n - x }       // 270 度顺时针
  }
  return { x: x, y: y }
}

function transformPuzzle(puzzle, op, suffix) {
  var size = puzzle.board_size
  var stones = puzzle.initial_stones.map(function (s) {
    var p = transformPoint(s.x, s.y, size, op)
    return { x: p.x, y: p.y, color: s.color }
  })
  var seqs = (puzzle.correct_sequences || []).map(function (seq) {
    return seq.map(function (move) {
      var p = transformPoint(move[0], move[1], size, op)
      return [p.x, p.y]
    })
  })
  var vr = puzzle.view_region
  var newVr = vr ? (function () {
    var p1 = transformPoint(vr.x1, vr.y1, size, op)
    var p2 = transformPoint(vr.x2, vr.y2, size, op)
    return {
      x1: Math.min(p1.x, p2.x),
      y1: Math.min(p1.y, p2.y),
      x2: Math.max(p1.x, p2.x),
      y2: Math.max(p1.y, p2.y),
    }
  })() : null

  return {
    problem_id: puzzle.problem_id + '_' + suffix,
    category: puzzle.category,
    difficulty_rating: puzzle.difficulty_rating,
    board_size: puzzle.board_size,
    description: puzzle.description,
    expected_time_ms: puzzle.expected_time_ms,
    initial_stones: stones,
    view_region: newVr,
    correct_sequences: seqs,
    level_tier: puzzle.level_tier,
    steps: puzzle.steps,
    hint: puzzle.hint,
    source_file: puzzle.source_file,
    skill_node: puzzle.skill_node,
  }
}

// 验证一道题：所有正解序列都能正常走完
function verifyPuzzle(p) {
  if (!p.initial_stones || !p.correct_sequences || p.correct_sequences.length === 0) return false
  // 初始位置不能有非法重叠
  var posSet = {}
  for (var i = 0; i < p.initial_stones.length; i++) {
    var s = p.initial_stones[i]
    if (s.x < 0 || s.x >= p.board_size || s.y < 0 || s.y >= p.board_size) return false
    var k = s.x + ',' + s.y
    if (posSet[k]) return false
    posSet[k] = true
  }
  var board = goLogic.placeStones(goLogic.createBoard(p.board_size), p.initial_stones)
  // 初始位置不能有 0 气棋组
  for (var y = 0; y < p.board_size; y++) {
    for (var x = 0; x < p.board_size; x++) {
      if (board[y][x] && goLogic.getLiberties(board, x, y) === 0) return false
    }
  }
  // 验证至少第一条序列能走通
  var seq = p.correct_sequences[0]
  if (!seq || seq.length === 0) return false
  var userColor = (p.description || '').indexOf('白先') !== -1 ? 'white' : 'black'
  var oppColor = userColor === 'black' ? 'white' : 'black'
  var b = board
  for (var si = 0; si < seq.length; si++) {
    var move = seq[si]
    if (!move || move.length !== 2) return false
    var color = si % 2 === 0 ? userColor : oppColor
    var r = goLogic.playMove(b, move[0], move[1], color)
    if (!r.isValid) return false
    b = r.newBoard
  }
  return true
}

// ============================================================
// 镜像扩充：从一组现有题生成所有变体
// ============================================================

function expandWithMirrors(puzzles, targetCount) {
  var result = []
  var seenSig = {}

  // 用题目"指纹"去重（初始棋子位置 + 首步）
  function puzzleSig(p) {
    var stones = p.initial_stones.slice().sort(function (a, b) {
      return a.y * 100 + a.x - b.y * 100 - b.x
    })
    var stonesStr = stones.map(function (s) { return s.color[0] + s.x + ',' + s.y }).join('|')
    var firstMove = (p.correct_sequences[0] && p.correct_sequences[0][0]) || []
    return stonesStr + '#' + firstMove.join(',')
  }

  // 先加入所有原始题
  for (var i = 0; i < puzzles.length; i++) {
    var sig = puzzleSig(puzzles[i])
    if (!seenSig[sig]) {
      seenSig[sig] = true
      result.push(puzzles[i])
    }
  }

  // 9路棋盘用 8 个对称（D4），19路棋盘对称没有意义（盘大），用 4 个
  var ops9 = ['flipH', 'flipV', 'rot180', 'flipDiag', 'flipAnti', 'rot90', 'rot270']
  var ops19 = ['flipH', 'flipV', 'rot180']

  // 对每道原始题尝试所有变体
  for (var i = 0; i < puzzles.length && result.length < targetCount; i++) {
    var orig = puzzles[i]
    var ops = orig.board_size <= 9 ? ops9 : ops19
    for (var oi = 0; oi < ops.length && result.length < targetCount; oi++) {
      var v = transformPuzzle(orig, ops[oi], ops[oi])
      var sig = puzzleSig(v)
      if (!seenSig[sig] && verifyPuzzle(v)) {
        seenSig[sig] = true
        result.push(v)
      }
    }
  }
  return result
}

// ============================================================
// cap1_* 原创吃子题生成
// ============================================================

function makeStone(x, y, color) { return { x: x, y: y, color: color } }

function calcViewRegion(stones, ans) {
  var all = stones.slice()
  if (ans) all.push({ x: ans[0], y: ans[1] })
  var minX = 8, minY = 8, maxX = 0, maxY = 0
  all.forEach(function (s) {
    if (s.x < minX) minX = s.x
    if (s.x > maxX) maxX = s.x
    if (s.y < minY) minY = s.y
    if (s.y > maxY) maxY = s.y
  })
  var pad = 2
  return {
    x1: Math.max(0, minX - pad),
    y1: Math.max(0, minY - pad),
    x2: Math.min(8, maxX + pad),
    y2: Math.min(8, maxY + pad),
  }
}

function makePuzzle(id, tag, rating, blacks, whites, answer, fullSeq) {
  var stones = []
  blacks.forEach(function (b) { stones.push(makeStone(b[0], b[1], 'black')) })
  whites.forEach(function (w) { stones.push(makeStone(w[0], w[1], 'white')) })
  var seq = fullSeq || [answer]
  return {
    problem_id: id,
    category: '入门',
    difficulty_rating: rating,
    board_size: 9,
    description: '黑先 吃子',
    expected_time_ms: 30000,
    initial_stones: stones,
    view_region: calcViewRegion(stones, answer),
    correct_sequences: [seq],
    level_tier: 'beginner',
    steps: seq.length,
    hint: '黑先',
    source_file: 'beginner/cap1_extra',
    skill_node: tag,
  }
}

// 生成单子吃子题：白棋单子，4个邻居中3个被黑/边界占据，黑下最后一气
function generateCap1Single() {
  var puzzles = []
  var idx = 0
  // 中腹位置 (3-5, 3-5)
  for (var wx = 2; wx <= 6 && idx < 20; wx++) {
    for (var wy = 2; wy <= 6 && idx < 20; wy++) {
      // 选哪个方向作为最后一气（4 个方向轮换）
      for (var dir = 0; dir < 4 && idx < 20; dir++) {
        var dx = [0, 0, -1, 1][dir]
        var dy = [-1, 1, 0, 0][dir]
        var ax = wx + dx, ay = wy + dy
        if (ax < 0 || ax >= 9 || ay < 0 || ay >= 9) continue
        // 其他 3 个方向放黑
        var blacks = []
        var ok = true
        for (var d2 = 0; d2 < 4; d2++) {
          if (d2 === dir) continue
          var bdx = [0, 0, -1, 1][d2]
          var bdy = [-1, 1, 0, 0][d2]
          var bx = wx + bdx, by = wy + bdy
          if (bx < 0 || bx >= 9 || by < 0 || by >= 9) { ok = false; break }
          blacks.push([bx, by])
        }
        if (!ok) continue
        var p = makePuzzle('gen_cap1_single_extra_' + (++idx).toString().padStart(3, '0'),
          'cap1_single', 100 + idx * 2, blacks, [[wx, wy]], [ax, ay])
        if (verifyPuzzle(p)) puzzles.push(p)
      }
    }
  }
  return puzzles
}

// 生成两子吃子题：白棋两子相连，最后一气
function generateCap1Double() {
  var puzzles = []
  var idx = 0
  // 横向两子
  for (var wx = 1; wx <= 5 && idx < 20; wx++) {
    for (var wy = 1; wy <= 6 && idx < 20; wy++) {
      // 白子在 (wx, wy) 和 (wx+1, wy)
      var w1 = [wx, wy], w2 = [wx + 1, wy]
      // 上方留一气，其他方向用黑围
      var blacks = []
      var ax = wx, ay = wy - 1
      if (ay < 0) continue
      // 围住其他方向
      var coords = [
        [wx - 1, wy], [wx + 2, wy],
        [wx, wy + 1], [wx + 1, wy + 1],
      ]
      var ok = true
      for (var i = 0; i < coords.length; i++) {
        var c = coords[i]
        if (c[0] < 0 || c[0] >= 9 || c[1] < 0 || c[1] >= 9) { ok = false; break }
        blacks.push(c)
      }
      if (!ok) continue
      var p = makePuzzle('gen_cap1_double_extra_' + (++idx).toString().padStart(3, '0'),
        'cap1_double', 120 + idx * 2, blacks, [w1, w2], [ax, ay])
      if (verifyPuzzle(p)) puzzles.push(p)
    }
  }
  return puzzles
}

// 生成角部吃子题
function generateCap1Corner() {
  var puzzles = []
  var idx = 0
  // 4 个角，每个角生成多种角部死活形状
  var corners = [
    { cx: 0, cy: 0, dx: 1, dy: 1 },
    { cx: 8, cy: 0, dx: -1, dy: 1 },
    { cx: 0, cy: 8, dx: 1, dy: -1 },
    { cx: 8, cy: 8, dx: -1, dy: -1 },
  ]
  corners.forEach(function (c) {
    // 形状 1: 角上一颗白子，黑两子封住
    var w = [[c.cx, c.cy]]
    var b = [[c.cx + c.dx, c.cy], [c.cx, c.cy + c.dy]]
    var ans = [c.cx + c.dx, c.cy + c.dy]
    // 这道形状本身就是 1 气，需要验证答案
    var p = makePuzzle('gen_cap1_corner_extra_' + (++idx).toString().padStart(3, '0'),
      'cap1_corner', 110 + idx * 3, b, w, ans)
    if (verifyPuzzle(p)) puzzles.push(p)

    // 形状 2: 角上两颗白子（横向），黑围住三面
    var w2 = [[c.cx, c.cy], [c.cx + c.dx, c.cy]]
    var b2 = [
      [c.cx + 2 * c.dx, c.cy],
      [c.cx, c.cy + c.dy],
      [c.cx + c.dx, c.cy + c.dy],
    ]
    // 留 (cx + 2dx, cy + dy) 这里...实际上白还有1气没围住，重新设计
    // 角上两子 (0,0)(1,0): 邻居 (0,1)(1,1)(2,0). 想让白只剩(0,1)一气
    // 黑封 (1,1)(2,0)
    var w3 = [[c.cx, c.cy], [c.cx + c.dx, c.cy]]
    var b3 = [[c.cx + c.dx, c.cy + c.dy], [c.cx + 2 * c.dx, c.cy]]
    var ans3 = [c.cx, c.cy + c.dy]
    if (ans3[0] >= 0 && ans3[0] < 9 && ans3[1] >= 0 && ans3[1] < 9) {
      var p3 = makePuzzle('gen_cap1_corner_extra_' + (++idx).toString().padStart(3, '0'),
        'cap1_corner', 120 + idx * 3, b3, w3, ans3)
      if (verifyPuzzle(p3)) puzzles.push(p3)
    }

    // 形状 3: 角上两颗白子（纵向）
    var w4 = [[c.cx, c.cy], [c.cx, c.cy + c.dy]]
    var b4 = [[c.cx + c.dx, c.cy], [c.cx + c.dx, c.cy + c.dy]]
    var ans4 = [c.cx, c.cy + 2 * c.dy]
    if (ans4[0] >= 0 && ans4[0] < 9 && ans4[1] >= 0 && ans4[1] < 9) {
      var p4 = makePuzzle('gen_cap1_corner_extra_' + (++idx).toString().padStart(3, '0'),
        'cap1_corner', 130 + idx * 3, b4, w4, ans4)
      if (verifyPuzzle(p4)) puzzles.push(p4)
    }
  })
  return puzzles
}

// 生成边上吃子题
function generateCap1Edge() {
  var puzzles = []
  var idx = 0
  // 四条边
  // 顶边 y=0
  for (var x = 1; x < 8; x++) {
    var w = [[x, 0]]
    var b = [[x - 1, 0], [x + 1, 0]]
    var ans = [x, 1]
    var p = makePuzzle('gen_cap1_edge_extra_' + (++idx).toString().padStart(3, '0'),
      'cap1_edge', 150 + idx * 2, b, w, ans)
    if (verifyPuzzle(p)) puzzles.push(p)
  }
  // 左边 x=0
  for (var y = 1; y < 8; y++) {
    var w = [[0, y]]
    var b = [[0, y - 1], [0, y + 1]]
    var ans = [1, y]
    var p = makePuzzle('gen_cap1_edge_extra_' + (++idx).toString().padStart(3, '0'),
      'cap1_edge', 160 + idx * 2, b, w, ans)
    if (verifyPuzzle(p)) puzzles.push(p)
  }
  // 右边 x=8
  for (var y = 1; y < 8; y++) {
    var w = [[8, y]]
    var b = [[8, y - 1], [8, y + 1]]
    var ans = [7, y]
    var p = makePuzzle('gen_cap1_edge_extra_' + (++idx).toString().padStart(3, '0'),
      'cap1_edge', 170 + idx * 2, b, w, ans)
    if (verifyPuzzle(p)) puzzles.push(p)
  }
  // 底边 y=8
  for (var x = 1; x < 8; x++) {
    var w = [[x, 8]]
    var b = [[x - 1, 8], [x + 1, 8]]
    var ans = [x, 7]
    var p = makePuzzle('gen_cap1_edge_extra_' + (++idx).toString().padStart(3, '0'),
      'cap1_edge', 180 + idx * 2, b, w, ans)
    if (verifyPuzzle(p)) puzzles.push(p)
  }
  return puzzles
}

// ============================================================
// eyes_* 用主题库赵治勋初级题追加
// ============================================================

function loadMainPuzzles() {
  return JSON.parse(fs.readFileSync(MAIN_FILE, 'utf8'))
}

function convertMainPuzzle(p, tag, ratingOverride) {
  // 转 initial_stones: {black:[],white:[]} -> [{x,y,color}]
  var stones = []
  if (p.initial_stones && p.initial_stones.black) {
    p.initial_stones.black.forEach(function (s) { stones.push({ x: s[0], y: s[1], color: 'black' }) })
  }
  if (p.initial_stones && p.initial_stones.white) {
    p.initial_stones.white.forEach(function (s) { stones.push({ x: s[0], y: s[1], color: 'white' }) })
  }
  var seq = p.full_solution || [p.correct_first_move]
  return {
    problem_id: 'main_' + tag + '_' + p.id,
    category: '初级',
    difficulty_rating: ratingOverride || p.difficulty_rating,
    board_size: p.board_size,
    description: '黑先 死活',
    expected_time_ms: 30000,
    initial_stones: stones,
    view_region: p.view_region,
    correct_sequences: p.all_solutions || [seq],
    level_tier: 'beginner',
    steps: seq.length,
    hint: '黑先',
    source_file: p.source_file,
    skill_node: tag,
  }
}

// ============================================================
// 主流程
// ============================================================

function main() {
  console.log('========== 扩充新手村题库 ==========')
  console.log('目标：每个 tag ≥ ' + TARGET_PER_TAG + ' 题')
  console.log('')

  var current = loadExistingPuzzles()
  var tags = Object.keys(current).sort()
  console.log('当前 tag 数: ' + tags.length)

  var mainPuzzles = null
  var mainPool = null
  function getMainEyesPool() {
    if (mainPool) return mainPool
    mainPuzzles = loadMainPuzzles()
    mainPool = mainPuzzles.filter(function (p) {
      return p.category === '死活' && p.difficulty_rating >= 542 && p.difficulty_rating <= 600
    })
    console.log('  主题库死活池: ' + mainPool.length + ' 题')
    return mainPool
  }

  // 预生成 cap1 原创题
  var capExtras = {
    cap1_single: generateCap1Single(),
    cap1_double: generateCap1Double(),
    cap1_corner: generateCap1Corner(),
    cap1_edge: generateCap1Edge(),
  }
  Object.keys(capExtras).forEach(function (k) {
    console.log('  原创 ' + k + ': ' + capExtras[k].length + ' 题')
  })
  console.log('')

  var newCounts = {}

  tags.forEach(function (tag) {
    var existing = current[tag] || []
    var combined = existing.slice()

    // 1) 镜像扩充
    combined = expandWithMirrors(combined, TARGET_PER_TAG)

    // 2) cap1_* 追加原创题
    if (capExtras[tag]) {
      var extras = capExtras[tag]
      var seenSig = {}
      combined.forEach(function (p) {
        var stones = p.initial_stones.slice().sort(function (a, b) {
          return a.y * 100 + a.x - b.y * 100 - b.x
        })
        var sig = stones.map(function (s) { return s.color[0] + s.x + ',' + s.y }).join('|')
        seenSig[sig] = true
      })
      for (var i = 0; i < extras.length && combined.length < TARGET_PER_TAG; i++) {
        var ep = extras[i]
        var stones = ep.initial_stones.slice().sort(function (a, b) {
          return a.y * 100 + a.x - b.y * 100 - b.x
        })
        var sig = stones.map(function (s) { return s.color[0] + s.x + ',' + s.y }).join('|')
        if (!seenSig[sig]) {
          seenSig[sig] = true
          combined.push(ep)
        }
      }
      // 还不够再镜像一次
      combined = expandWithMirrors(combined, TARGET_PER_TAG)
    }

    // 3) eyes_* 追加主题库低分死活题
    if (tag.indexOf('eyes_') === 0 && combined.length < TARGET_PER_TAG) {
      var pool = getMainEyesPool()
      var ratingMap = {
        eyes_basic: [400, 430],
        eyes_make:  [430, 450],
        eyes_kill:  [440, 460],
        eyes_mixed: [450, 470],
      }
      var range = ratingMap[tag] || [420, 460]
      var existingIds = {}
      combined.forEach(function (p) { existingIds[p.problem_id] = true })
      for (var i = 0; i < pool.length && combined.length < TARGET_PER_TAG; i++) {
        var src = pool[i]
        var newId = 'main_' + tag + '_' + src.id
        if (existingIds[newId]) continue
        var t = (combined.length - 8) / Math.max(1, TARGET_PER_TAG - 8)
        var rating = Math.round(range[0] + (range[1] - range[0]) * t)
        var converted = convertMainPuzzle(src, tag, rating)
        if (verifyPuzzle(converted)) {
          existingIds[newId] = true
          combined.push(converted)
        }
      }
    }

    newCounts[tag] = combined.length
    current[tag] = combined
  })

  // 打印统计
  console.log('========== 扩充结果 ==========')
  var totalBefore = 0, totalAfter = 0
  tags.forEach(function (tag) {
    var before = (loadExistingPuzzles()[tag] || []).length
    var after = newCounts[tag]
    totalBefore += before
    totalAfter += after
    var icon = after >= TARGET_PER_TAG ? '✓' : '⚠'
    console.log('  ' + icon + ' ' + tag + ': ' + before + ' → ' + after)
  })
  console.log('')
  console.log('总计: ' + totalBefore + ' → ' + totalAfter + ' (+' + (totalAfter - totalBefore) + ')')

  // 写回
  var content = '// 新手村本地题库（自动生成，请勿手动修改）\n'
  content += '// 扩充版本：每个 tag ≥ ' + TARGET_PER_TAG + ' 题，含镜像/原创/主题库追加\n\n'
  content += 'var BEGINNER_PUZZLES_BY_TAG = ' + JSON.stringify(current) + '\n\n'
  content += 'function getPuzzlesByTag(tag) {\n'
  content += '  var arr = BEGINNER_PUZZLES_BY_TAG[tag] || []\n'
  content += '  var copy = arr.slice()\n'
  content += '  for (var i = copy.length - 1; i > 0; i--) {\n'
  content += '    var j = Math.floor(Math.random() * (i + 1))\n'
  content += '    var tmp = copy[i]; copy[i] = copy[j]; copy[j] = tmp\n'
  content += '  }\n'
  content += '  return copy\n'
  content += '}\n\n'
  content += 'module.exports = { getPuzzlesByTag: getPuzzlesByTag, BEGINNER_PUZZLES_BY_TAG: BEGINNER_PUZZLES_BY_TAG }\n'

  fs.writeFileSync(OUT_FILE, content)
  var stat = fs.statSync(OUT_FILE)
  console.log('')
  console.log('写入: ' + OUT_FILE)
  console.log('  大小: ' + (stat.size / 1024).toFixed(1) + ' KB')
}

main()

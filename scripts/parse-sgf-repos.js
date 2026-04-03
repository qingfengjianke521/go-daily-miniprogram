#!/usr/bin/env node
/**
 * 解析 sanderland/tsumego + tasuki/tsumego 的SGF题库
 * 输出 problems_all.json
 */
const fs = require('fs')
const path = require('path')

// ========== SGF 坐标 ==========
// sanderland/tsumego 的坐标系: sgf2ix = (col, boardSize - 1 - row)
// 参见 move.py: return SGF_COORD.index(sgfmove[0]), board_size - SGF_COORD.index(sgfmove[1]) - 1
var _currentBoardSize = 19 // 会在解析每道题时更新
function sgf2xy(s) {
  if (!s || s.length < 2) return null
  const x = s.charCodeAt(0) - 97
  const rawY = s.charCodeAt(1) - 97
  if (x < 0 || x > 18 || rawY < 0 || rawY > 18) return null
  const y = _currentBoardSize - 1 - rawY // Y轴翻转！
  return [x, y]
}

// ========== 难度映射 ==========
const DIFFICULTY_MAP = {
  // sanderland directories
  'Cho Chikun Encyclopedia Life And Death - Elementary': { diff: 'cho_elementary', rating: 800, cat: '死活' },
  'Fujisawa Shuuko - Collection Or Original Tsumego - Elementary': { diff: 'fujisawa_elementary', rating: 750, cat: '死活' },
  'Ishigure Ikuro 123 Basic Tsumego': { diff: 'ishigure_basic', rating: 700, cat: '死活' },
  'Yamada Kimio - Basic Tsumego': { diff: 'yamada_basic', rating: 650, cat: '死活' },
  'Cho Chikun Encyclopedia Life And Death - Intermediate': { diff: 'cho_intermediate', rating: 1100, cat: '死活' },
  'Fujisawa Shuuko - Collection Of Original Tsumego - Intermediate': { diff: 'fujisawa_intermediate', rating: 1050, cat: '死活' },
  'Ishida Akira Tsumego Masterpiece Kyu Level': { diff: 'ishida_kyu', rating: 1000, cat: '死活' },
  'Maeda Nobuaki Newly Selected Tsumego 100 Problems For 1-8k': { diff: 'maeda_1_8k', rating: 1100, cat: '死活' },
  'Maeda Tsumego Collection - 10k-5k': { diff: 'maeda_10k_5k', rating: 1000, cat: '死活' },
  'Maeda Tsumego Collection - 1k-5k': { diff: 'maeda_1k_5k', rating: 1200, cat: '死活' },
  'Yamada Kimio - High Speed Attack Tsumego': { diff: 'yamada_attack', rating: 1050, cat: '死活' },
  'Cho Chikun Encyclopedia Life And Death - Advanced': { diff: 'cho_advanced', rating: 1400, cat: '死活' },
  'Fujisawa Shuuko - Collection Or Original Tsumego - Advanced': { diff: 'fujisawa_advanced', rating: 1350, cat: '死活' },
  'Fujisawa Shuuko - Collection Or Original Tsumego - High Dan': { diff: 'fujisawa_highdan', rating: 1700, cat: '死活' },
  'Ishida Akira Tsumego Masterpiece Dan Level': { diff: 'ishida_dan', rating: 1500, cat: '死活' },
  'Ishida Akira Tsumego Masterpiece High Dan Level': { diff: 'ishida_highdan', rating: 1700, cat: '死活' },
  'Ishida Akira Tsumego Masterpiece Pro Level': { diff: 'ishida_pro', rating: 1900, cat: '死活' },
  'Ishigure Ikuro - Challenging Shodan Tsumego': { diff: 'ishigure_shodan', rating: 1300, cat: '死活' },
  'Maeda Tsumego Collection - 1k-1d': { diff: 'maeda_1k_1d', rating: 1300, cat: '死活' },
  'Yamada Kimio - Road To 3 Dan': { diff: 'yamada_3dan', rating: 1400, cat: '死活' },
  // Hashimoto
  'Moves To Attack And Protect - Elementary': { diff: 'hashimoto_elementary', rating: 800, cat: '死活' },
  'Moves To Attack And Protect - Intermediate': { diff: 'hashimoto_intermediate', rating: 1100, cat: '死活' },
  'Moves To Attack And Protect - Advanced': { diff: 'hashimoto_advanced', rating: 1400, cat: '死活' },
  '1 Year Tsumego': { diff: 'hashimoto_1year', rating: 1100, cat: '死活' },
  'Enjoy Tsumego And Get Stronger': { diff: 'hashimoto_enjoy', rating: 1000, cat: '死活' },
  'Famous Creations Three Hundred Selections': { diff: 'hashimoto_famous', rating: 1200, cat: '死活' },
  'Moments Of The Wind Vol.1': { diff: 'hashimoto_wind1', rating: 1100, cat: '死活' },
  'Moments Of The Wind Vol.2': { diff: 'hashimoto_wind2', rating: 1200, cat: '死活' },
  'Moments Of The Wind Vol.3': { diff: 'hashimoto_wind3', rating: 1300, cat: '死活' },
  'Fifty Three To Go': { diff: 'hashimoto_53', rating: 1200, cat: '死活' },
  'Tsumego For The Millions Vol.2': { diff: 'hashimoto_millions', rating: 1000, cat: '死活' },
  // Tesuji
  'Go Seigen - Segoe Tesuji Dictionary': { diff: 'tesuji_dictionary', rating: 1200, cat: '手筋' },
  'Kobayashi Satoru 105 Basic Tesuji For 1~3 Dan': { diff: 'kobayashi_tesuji', rating: 1300, cat: '手筋' },
  'Tesuji Great Dictionary': { diff: 'tesuji_great', rating: 1200, cat: '手筋' },
  '1. Fighting And Capturing': { diff: 'lee_fighting', rating: 900, cat: '手筋' },
  '2. Snapback And Shortage Of Liberties': { diff: 'lee_snapback', rating: 950, cat: '手筋' },
  '3.1 Connecting Groups': { diff: 'lee_connecting', rating: 1000, cat: '手筋' },
  '3.2 Splitting Groups': { diff: 'lee_splitting', rating: 1050, cat: '手筋' },
  '3.3 Settling Groups': { diff: 'lee_settling', rating: 1100, cat: '手筋' },
  '3.4 Endgame': { diff: 'lee_endgame', rating: 1050, cat: '官子' },
  '4. Net And Squeeze Tactics': { diff: 'lee_net', rating: 1000, cat: '手筋' },
  '5.1 Connecting': { diff: 'lee_adv_connecting', rating: 1150, cat: '手筋' },
  '5.2 Making Shape': { diff: 'lee_shape', rating: 1150, cat: '手筋' },
  '5.3 End Game': { diff: 'lee_adv_endgame', rating: 1200, cat: '官子' },
  '5.4 Life And Death': { diff: 'lee_adv_life', rating: 1200, cat: '死活' },
  '5.5 Attack': { diff: 'lee_attack', rating: 1200, cat: '手筋' },
  '5.6 Escape': { diff: 'lee_escape', rating: 1200, cat: '手筋' },
  '6.1 Capturing Race': { diff: 'lee_race', rating: 1300, cat: '死活' },
  '6.2 Attack': { diff: 'lee_adv_attack', rating: 1300, cat: '手筋' },
  '6.3 Endgame': { diff: 'lee_adv_endgame2', rating: 1300, cat: '官子' },
}

function getDifficulty(dirName) {
  for (const [key, val] of Object.entries(DIFFICULTY_MAP)) {
    if (dirName.includes(key)) return val
  }
  // Fallback by parent dir
  if (dirName.includes('Beginner') || dirName.includes('Elementary')) return { diff: 'beginner', rating: 800, cat: '死活' }
  if (dirName.includes('Intermediate')) return { diff: 'intermediate', rating: 1100, cat: '死活' }
  if (dirName.includes('Advanced')) return { diff: 'advanced', rating: 1400, cat: '死活' }
  if (dirName.includes('Tesuji')) return { diff: 'tesuji', rating: 1200, cat: '手筋' }
  return { diff: 'unknown', rating: 1000, cat: '死活' }
}

// ========== 解析 sanderland JSON ==========
function parseSanderlandJSON(filePath, dirName) {
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'))
  const size = parseInt(data.SZ) || 19
  _currentBoardSize = size // 必须在 sgf2xy 之前设置！
  const blacks = (data.AB || []).map(sgf2xy).filter(Boolean)
  const whites = (data.AW || []).map(sgf2xy).filter(Boolean)

  if (blacks.length === 0 && whites.length === 0) return null

  // Parse SOL: [["B","ba","Correct.",""], ["B","ca","",""]]
  const solutions = []
  if (data.SOL && Array.isArray(data.SOL)) {
    for (const sol of data.SOL) {
      const moves = []
      for (let i = 0; i < sol.length; i += 2) {
        if (sol[i] === 'B' || sol[i] === 'W') {
          const pt = sgf2xy(sol[i + 1])
          if (pt) moves.push(pt)
        }
      }
      if (moves.length > 0) solutions.push(moves)
    }
  }
  if (solutions.length === 0) return null

  const diff = getDifficulty(dirName)
  const probNum = parseInt(path.basename(filePath).replace(/[^0-9]/g, '')) || 0
  // Spread rating within book: +0 to +200 based on problem number
  const adjustedRating = diff.rating + Math.min(Math.floor(probNum / 5), 200)

  // 用目录缩写+文件名生成唯一ID (避免不同目录同名文件冲突)
  const relPath = filePath.replace('/tmp/tsumego-repo/problems/', '')
  const dirShort = (dirName || 'x').replace(/[^a-zA-Z0-9]/g, '').substring(0, 40).toLowerCase()
  const fileName = path.basename(filePath, '.json')

  return {
    id: 'sl_' + dirShort + '_' + fileName,
    source: 'sanderland/tsumego',
    source_file: relPath,
    category: diff.cat,
    board_size: size,
    initial_stones: { black: blacks, white: whites },
    correct_first_move: solutions[0][0],
    full_solution: solutions[0],
    all_solutions: solutions,
    difficulty_source: diff.diff,
    difficulty_rating: adjustedRating,
  }
}

// ========== 解析 tasuki SGF ==========
function parseTasukiSGF(filePath) {
  const content = fs.readFileSync(filePath, 'utf8')
  // tasuki SGF files contain multiple problems separated by top-level (;...)
  const problems = []
  // Simple split by top-level game trees
  const matches = content.match(/\(;[^()]*(?:\([^()]*\))*[^()]*\)/g) || []

  for (const match of matches) {
    const sizeMatch = match.match(/SZ\[(\d+)\]/)
    const size = sizeMatch ? parseInt(sizeMatch[1]) : 19

    // Extract AB and AW
    const blacks = [], whites = []
    const abMatches = match.match(/AB(?:\[[a-s]{2}\])+/g) || []
    for (const ab of abMatches) {
      const pts = ab.match(/\[([a-s]{2})\]/g) || []
      for (const p of pts) { const xy = sgf2xy(p.slice(1,3)); if (xy) blacks.push(xy) }
    }
    const awMatches = match.match(/AW(?:\[[a-s]{2}\])+/g) || []
    for (const aw of awMatches) {
      const pts = aw.match(/\[([a-s]{2})\]/g) || []
      for (const p of pts) { const xy = sgf2xy(p.slice(1,3)); if (xy) whites.push(xy) }
    }

    if (blacks.length === 0 && whites.length === 0) continue

    // Extract first move (correct answer)
    const firstMoveMatch = match.match(/;([BW])\[([a-s]{2})\]/)
    if (!firstMoveMatch) continue
    const firstMove = sgf2xy(firstMoveMatch[2])
    if (!firstMove) continue

    problems.push({
      board_size: size,
      initial_stones: { black: blacks, white: whites },
      correct_first_move: firstMove,
      full_solution: [firstMove],
    })
  }
  return problems
}

// ========== 主流程 ==========
console.log('=== 解析 sanderland/tsumego ===')
const allProblems = []
let totalFiles = 0, parsed = 0, failed = 0

function walkDir(dir, parentDir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      walkDir(full, entry.name)
    } else if (entry.name.endsWith('.json')) {
      totalFiles++
      try {
        const p = parseSanderlandJSON(full, parentDir || '')
        if (p) { allProblems.push(p); parsed++ }
        else failed++
      } catch (e) { failed++ }
      if (totalFiles % 2000 === 0) process.stdout.write('\r  ' + totalFiles + ' files...')
    }
  }
}

walkDir('/tmp/tsumego-repo/problems', '')
console.log(`\r  sanderland: ${parsed} 成功 / ${failed} 失败 / ${totalFiles} 总计`)

// Tasuki
console.log('\n=== 解析 tasuki/tsumego ===')
const tasukiDir = '/tmp/tsumego-tasuki/books'
if (fs.existsSync(tasukiDir)) {
  const sgfFiles = []
  function findSGF(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.isDirectory()) findSGF(path.join(dir, e.name))
      else if (e.name.endsWith('.sgf')) sgfFiles.push(path.join(dir, e.name))
    }
  }
  findSGF('/tmp/tsumego-tasuki')
  console.log('  SGF files:', sgfFiles.length)
  for (const f of sgfFiles) {
    const probs = parseTasukiSGF(f)
    for (const p of probs) {
      allProblems.push({
        id: 'tasuki_' + path.basename(f, '.sgf') + '_' + allProblems.length,
        source: 'tasuki/tsumego',
        source_file: f.replace('/tmp/tsumego-tasuki/', ''),
        category: '死活',
        ...p,
        difficulty_source: 'tasuki_' + path.basename(f, '.sgf'),
        difficulty_rating: 1100,
      })
    }
  }
}

// ========== 步骤5: 统计 ==========
console.log('\n========== 统计报告 ==========')
console.log('总题数:', allProblems.length)

// 按来源
const bySource = {}
for (const p of allProblems) { bySource[p.source] = (bySource[p.source] || 0) + 1 }
console.log('\n按来源:')
for (const [k,v] of Object.entries(bySource)) console.log('  ' + k + ': ' + v)

// 按难度分类
const byDiff = {}
for (const p of allProblems) { byDiff[p.difficulty_source] = (byDiff[p.difficulty_source] || 0) + 1 }
console.log('\n按难度分类:')
for (const [k,v] of Object.entries(byDiff).sort((a,b) => b[1] - a[1])) console.log('  ' + k + ': ' + v)

// 按 rating 区间
const byRating = {}
for (const p of allProblems) {
  const b = Math.floor(p.difficulty_rating / 200) * 200
  byRating[b + '-' + (b+199)] = (byRating[b + '-' + (b+199)] || 0) + 1
}
console.log('\n按rating区间:')
for (const [k,v] of Object.entries(byRating).sort((a,b) => parseInt(a) - parseInt(b))) console.log('  ' + k + ': ' + v)

// 按类别
const byCat = {}
for (const p of allProblems) { byCat[p.category] = (byCat[p.category] || 0) + 1 }
console.log('\n按类别:')
for (const [k,v] of Object.entries(byCat)) console.log('  ' + k + ': ' + v)

// 随机抽10道打印
console.log('\n========== 随机抽样 10 道 ==========')
const cols = 'ABCDEFGHJKLMNOPQRST'
for (let sample = 0; sample < 10; sample++) {
  const idx = Math.floor(Math.random() * allProblems.length)
  const p = allProblems[idx]
  console.log('\n--- #' + (sample+1) + ': ' + p.id + ' ---')
  console.log('来源:', p.source_file)
  console.log('难度:', p.difficulty_source, 'rating:', p.difficulty_rating)
  console.log('类别:', p.category, '棋盘:', p.board_size + '路')
  console.log('黑子:', p.initial_stones.black.length, '颗')
  console.log('白子:', p.initial_stones.white.length, '颗')
  console.log('答案第一手:', p.correct_first_move, '= ' + cols[p.correct_first_move[0]] + (p.board_size - p.correct_first_move[1]))
  console.log('完整答案:', p.full_solution.map(m => cols[m[0]] + (p.board_size - m[1])).join(' → '))

  // ASCII 棋盘 (只显示有棋子的区域)
  const allPts = [...p.initial_stones.black, ...p.initial_stones.white, p.correct_first_move]
  let x1=99,y1=99,x2=0,y2=0
  for (const [x,y] of allPts) { x1=Math.min(x1,x);y1=Math.min(y1,y);x2=Math.max(x2,x);y2=Math.max(y2,y) }
  x1=Math.max(0,x1-1);y1=Math.max(0,y1-1);x2=Math.min(p.board_size-1,x2+1);y2=Math.min(p.board_size-1,y2+1)

  const board = []
  for (let y=0;y<p.board_size;y++){const r=[];for(let x=0;x<p.board_size;x++)r.push('·');board.push(r)}
  for (const [x,y] of p.initial_stones.black) board[y][x]='●'
  for (const [x,y] of p.initial_stones.white) board[y][x]='○'
  board[p.correct_first_move[1]][p.correct_first_move[0]] = '★'

  let header = '   '
  for (let x=x1;x<=x2;x++) header += cols[x] + ' '
  console.log(header)
  for (let y=y1;y<=y2;y++) {
    let row = String(p.board_size-y).padStart(2) + ' '
    for (let x=x1;x<=x2;x++) row += board[y][x] + ' '
    console.log(row)
  }
}

// 保存
const outPath = path.join(__dirname, '..', 'problems_all.json')
fs.writeFileSync(outPath, JSON.stringify(allProblems))
console.log('\n已保存:', outPath, '(' + (fs.statSync(outPath).size / 1024 / 1024).toFixed(1) + 'MB)')

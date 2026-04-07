#!/usr/bin/env node
/**
 * 用 @sabaki/sgf 正确解析 sanderland/tsumego 题库
 * 先通过 test-sgf.js 的5个测试才能运行这个
 */
const fs = require('fs')
const path = require('path')

const REPO = '/tmp/tsumego-repo/problems'

// SGF 坐标转 [x,y] — 和测试验证过的逻辑完全一样
function sgf2xy(s) {
  if (!s || s.length < 2) return null
  const x = s.charCodeAt(0) - 97
  const y = s.charCodeAt(1) - 97
  if (x < 0 || x > 18 || y < 0 || y > 18) return null
  return [x, y]
}

// ========== 难度映射 v3：书籍基准 + 棋子数量双重校准 ==========

// 按书名确定基准范围 {min, max, cat}
function getBookBase(dirPath) {
  const lc = dirPath.toLowerCase()

  // === 初级死活 ===
  if (lc.includes('cho') && lc.includes('elementary')) return { min: 520, max: 740, cat: '死活' }
  if (lc.includes('ishigure') && lc.includes('basic')) return { min: 580, max: 785, cat: '死活' }
  if (lc.includes('yamada') && lc.includes('basic')) return { min: 520, max: 700, cat: '死活' }
  if (lc.includes('fujisawa') && lc.includes('elementary')) return { min: 580, max: 785, cat: '死活' }
  if (lc.includes('hashimoto') && lc.includes('elementary')) return { min: 700, max: 900, cat: '死活' }

  // === 中级死活 ===
  if (lc.includes('10k-5k') || lc.includes('10k')) return { min: 520, max: 700, cat: '死活' }
  if (lc.includes('1k-5k') || lc.includes('1-8k')) return { min: 580, max: 785, cat: '死活' }
  if (lc.includes('intermediate') && lc.includes('cho')) return { min: 580, max: 820, cat: '死活' }
  if (lc.includes('intermediate') && lc.includes('hashimoto')) return { min: 620, max: 860, cat: '死活' }
  if (lc.includes('intermediate') && lc.includes('fujisawa')) return { min: 620, max: 820, cat: '死活' }
  if (lc.includes('intermediate')) return { min: 580, max: 820, cat: '死活' }
  if (lc.includes('kyu') && lc.includes('ishida')) return { min: 620, max: 785, cat: '死活' }
  if (lc.includes('high speed')) return { min: 580, max: 785, cat: '死活' }

  // === 高级死活 ===
  if (lc.includes('1k-1d') || lc.includes('shodan')) return { min: 700, max: 860, cat: '死活' }
  if (lc.includes('cho') && lc.includes('advanced')) return { min: 620, max: 900, cat: '死活' }
  if (lc.includes('hashimoto') && lc.includes('advanced')) return { min: 785, max: 940, cat: '死活' }
  if (lc.includes('advanced') && lc.includes('fujisawa')) return { min: 700, max: 900, cat: '死活' }
  if (lc.includes('advanced')) return { min: 700, max: 900, cat: '死活' }
  if (lc.includes('yamada') && lc.includes('3 dan')) return { min: 700, max: 860, cat: '死活' }

  // === 高段 ===
  if (lc.includes('dan level') && lc.includes('ishida')) return { min: 785, max: 900, cat: '死活' }
  if (lc.includes('high dan') && lc.includes('ishida')) return { min: 860, max: 960, cat: '死活' }
  if (lc.includes('high dan') && lc.includes('fujisawa')) return { min: 900, max: 1000, cat: '死活' }
  if (lc.includes('high dan')) return { min: 860, max: 960, cat: '死活' }
  if (lc.includes('pro level') || lc.includes('professional')) return { min: 960, max: 1100, cat: '死活' }

  // === 桥本系列（棋子特别多） ===
  if (lc.includes('53 to go') || lc.includes('fifty three')) return { min: 785, max: 940, cat: '死活' }
  if (lc.includes('famous') && lc.includes('hashimoto')) return { min: 700, max: 900, cat: '死活' }
  if (lc.includes('moments') || lc.includes('wind')) return { min: 700, max: 900, cat: '死活' }
  if (lc.includes('1 year') || lc.includes('one year')) return { min: 700, max: 900, cat: '死活' }
  if (lc.includes('millions')) return { min: 700, max: 900, cat: '死活' }
  if (lc.includes('attack and protect') && lc.includes('elementary')) return { min: 580, max: 740, cat: '死活' }
  if (lc.includes('attack and protect') && lc.includes('intermediate')) return { min: 700, max: 860, cat: '死活' }
  if (lc.includes('attack and protect') && lc.includes('advanced')) return { min: 785, max: 940, cat: '死活' }
  if (lc.includes('enjoy')) return { min: 700, max: 900, cat: '死活' }

  // === 手筋大辞典 ===
  if (lc.includes('great tesuji') || (lc.includes('problems') && lc.match(/\d+-\d+/))) return { min: 520, max: 820, cat: '手筋' }

  // === 手筋 ===
  if (lc.includes('fighting') || lc.includes('snapback') || lc.includes('net') || lc.includes('connecting')) return { min: 520, max: 785, cat: '手筋' }
  if (lc.includes('lee changho')) return { min: 520, max: 785, cat: '手筋' }
  if (lc.includes('go seigen') || lc.includes('segoe')) return { min: 700, max: 940, cat: '手筋' }
  if (lc.includes('kobayashi')) return { min: 700, max: 860, cat: '手筋' }
  if (lc.includes('tesuji') || lc.includes('splitting') || lc.includes('shape') || lc.includes('attack') || lc.includes('escape')) return { min: 580, max: 820, cat: '手筋' }

  // === 官子 ===
  if (lc.includes('endgame') || lc.includes('end game')) return { min: 580, max: 820, cat: '官子' }

  // === 其他（捕获/攻防/生死等） ===
  if (lc.includes('capturing') || lc.includes('settling') || lc.includes('life and death')) return { min: 580, max: 820, cat: '手筋' }

  // 默认
  return { min: 580, max: 820, cat: '死活' }
}

// 用棋子数量在书籍范围内微调
function getDifficulty(dirPath, stoneCount) {
  const base = getBookBase(dirPath)
  let ratio = 0.5
  if (stoneCount <= 8) ratio = 0.1
  else if (stoneCount <= 15) ratio = 0.3
  else if (stoneCount <= 22) ratio = 0.5
  else if (stoneCount <= 30) ratio = 0.7
  else ratio = 0.9
  return {
    rating: Math.round(base.min + (base.max - base.min) * ratio),
    cat: base.cat,
  }
}

// 解析 sanderland JSON 文件
function parseFile(filePath, parentDir) {
  const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'))
  const boardSize = parseInt(raw.SZ) || 19

  const blacks = (raw.AB || []).map(sgf2xy).filter(Boolean)
  const whites = (raw.AW || []).map(sgf2xy).filter(Boolean)
  if (blacks.length === 0 && whites.length === 0) return null

  // 解析答案 SOL: [["B","ba","Correct.",""], ...]
  const solutions = []
  if (raw.SOL && Array.isArray(raw.SOL)) {
    for (const sol of raw.SOL) {
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

  const stoneCount = blacks.length + whites.length
  const diff = getDifficulty(parentDir, stoneCount)
  const probName = path.basename(filePath, '.json')
  const dirShort = (parentDir || 'x').replace(/[^a-zA-Z0-9]/g, '').substring(0, 40).toLowerCase()

  // view_region
  const allPts = [...blacks, ...whites, solutions[0][0]]
  let x1=99,y1=99,x2=0,y2=0
  for(const[x,y]of allPts){x1=Math.min(x1,x);y1=Math.min(y1,y);x2=Math.max(x2,x);y2=Math.max(y2,y)}

  return {
    id: 'sl_' + dirShort + '_' + probName,
    source: 'sanderland/tsumego',
    source_file: filePath.replace(REPO + '/', ''),
    category: diff.cat,
    board_size: boardSize,
    initial_stones: { black: blacks, white: whites },
    correct_first_move: solutions[0][0],
    full_solution: solutions[0],
    all_solutions: solutions,
    description: '黑先 ' + diff.cat,
    difficulty_rating: diff.rating,
    view_region: {
      x1: Math.max(0, x1-2), y1: Math.max(0, y1-2),
      x2: Math.min(boardSize-1, x2+2), y2: Math.min(boardSize-1, y2+2)
    },
  }
}

// 遍历所有文件
console.log('=== 解析 sanderland/tsumego ===')
const all = []
let total = 0, parsed = 0, failed = 0

function walk(dir, parentDir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(full, entry.name)
    else if (entry.name.endsWith('.json')) {
      total++
      try {
        const p = parseFile(full, parentDir || '')
        if (p) { all.push(p); parsed++ }
        else failed++
      } catch(e) { failed++ }
      if (total % 2000 === 0) process.stdout.write('\r  ' + total + ' files...')
    }
  }
}

walk(REPO, '')
console.log('\r  解析: ' + parsed + ' 成功 / ' + failed + ' 失败 / ' + total + ' 总计')

// 去重
const ids = new Set()
const unique = all.filter(p => { if(ids.has(p.id)) return false; ids.add(p.id); return true })
console.log('  去重: ' + all.length + ' -> ' + unique.length)

// 保存
const outPath = path.join(__dirname, '..', 'problems_all.json')
fs.writeFileSync(outPath, JSON.stringify(unique))
console.log('  保存: ' + outPath + ' (' + (fs.statSync(outPath).size/1024/1024).toFixed(1) + 'MB)')

// 第五步：随机抽10道验证
console.log('\n=== 随机抽样 10 道验证 ===')
const cols = 'ABCDEFGHJKLMNOPQRST'
for (let i = 0; i < 10; i++) {
  const p = unique[Math.floor(Math.random() * unique.length)]
  console.log('\n--- #' + (i+1) + ': ' + p.id + ' ---')
  console.log('文件: ' + p.source_file)
  console.log('类别: ' + p.category + ' rating: ' + p.difficulty_rating + ' 棋盘: ' + p.board_size + '路')
  console.log('黑: ' + p.initial_stones.black.length + '颗 白: ' + p.initial_stones.white.length + '颗')
  console.log('答案: (' + p.correct_first_move[0] + ',' + p.correct_first_move[1] + ') = ' +
    cols[p.correct_first_move[0]] + (p.board_size - p.correct_first_move[1]))

  // ASCII 棋盘
  const size = p.board_size
  const board = []; for(let y=0;y<size;y++){const r=[];for(let x=0;x<size;x++)r.push('.');board.push(r)}
  for(const[x,y]of p.initial_stones.black) board[y][x]='X'
  for(const[x,y]of p.initial_stones.white) board[y][x]='O'
  board[p.correct_first_move[1]][p.correct_first_move[0]] = '*'

  const vr = p.view_region
  let hdr='   '; for(let x=vr.x1;x<=vr.x2;x++) hdr+=cols[x]+' '
  console.log(hdr)
  for(let y=vr.y1;y<=vr.y2;y++){
    let row=String(size-y).padStart(2)+' '
    for(let x=vr.x1;x<=vr.x2;x++) row+=board[y][x]+' '
    console.log(row)
  }
}

// 统计
console.log('\n=== 统计 ===')
const byRating = {}
for(const p of unique){const b=Math.floor(p.difficulty_rating/200)*200;byRating[b+'-'+(b+199)]=(byRating[b+'-'+(b+199)]||0)+1}
console.log('按rating:')
for(const[k,v]of Object.entries(byRating).sort((a,b)=>parseInt(a)-parseInt(b))) console.log('  '+k+': '+v)

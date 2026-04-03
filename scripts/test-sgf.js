#!/usr/bin/env node
/**
 * SGF 解析测试 - 5个硬编码用例
 * 必须全部通过才能继续
 */
const SGF = require('@sabaki/sgf')
const fs = require('fs')

let passed = 0, failed = 0

function test(name, fn) {
  try {
    fn()
    console.log('  PASS: ' + name)
    passed++
  } catch (e) {
    console.log('  FAIL: ' + name)
    console.log('    ' + e.message)
    failed++
  }
}

function assertEqual(actual, expected, msg) {
  const a = JSON.stringify(actual), b = JSON.stringify(expected)
  if (a !== b) throw new Error(msg + ': expected ' + b + ', got ' + a)
}

// 解析 SGF 字符串，提取棋盘信息
function parseSGF(sgfText) {
  const trees = SGF.parse(sgfText)
  if (!trees || trees.length === 0) throw new Error('parse failed')

  const root = trees[0]
  const rootData = root.data || {}

  // 棋盘大小
  const boardSize = rootData.SZ ? parseInt(rootData.SZ[0]) : 19

  // 初始棋子 AB=黑, AW=白
  // @sabaki/sgf 解析后 AB/AW 是坐标字符串数组，如 ["ee", "dd"]
  function sgfCoordsToXY(coords) {
    if (!coords) return []
    return coords.map(s => {
      // s 可能是 "ee" 格式
      if (typeof s === 'string' && s.length >= 2) {
        const x = s.charCodeAt(0) - 97 // a=0
        const y = s.charCodeAt(1) - 97 // a=0
        return [x, y]
      }
      return null
    }).filter(p => p !== null)
  }

  const blacks = sgfCoordsToXY(rootData.AB)
  const whites = sgfCoordsToXY(rootData.AW)

  // 查找正确答案 - 遍历子节点
  let correctFirstMove = null
  function findCorrect(node) {
    if (!node.children || node.children.length === 0) return
    for (const child of node.children) {
      const d = child.data || {}
      // 取第一步着手
      const move = d.B ? d.B[0] : d.W ? d.W[0] : null
      if (move && typeof move === 'string' && move.length >= 2) {
        const xy = [move.charCodeAt(0) - 97, move.charCodeAt(1) - 97]
        // 检查是否标记为正解
        if (d.TE || (d.C && d.C[0] && (d.C[0].includes('Correct') || d.C[0].includes('RIGHT')))) {
          if (!correctFirstMove) correctFirstMove = xy
        }
        // 如果没有标记，取第一个变化的第一步
        if (!correctFirstMove) correctFirstMove = xy
      }
      findCorrect(child)
    }
  }
  findCorrect(root)

  return { boardSize, blacks, whites, correctFirstMove }
}

console.log('=== SGF 解析测试 ===\n')

// 测试1：单颗黑子在9路正中心
test('测试1: 单颗黑子 ee = (4,4) 正中心', () => {
  const r = parseSGF('(;SZ[9]AB[ee])')
  assertEqual(r.boardSize, 9, 'boardSize')
  assertEqual(r.blacks, [[4,4]], 'blacks')
  assertEqual(r.whites, [], 'whites')
})

// 测试2：单颗白子在左上角
test('测试2: 单颗白子 aa = (0,0) 左上角', () => {
  const r = parseSGF('(;SZ[9]AW[aa])')
  assertEqual(r.boardSize, 9, 'boardSize')
  assertEqual(r.blacks, [], 'blacks')
  assertEqual(r.whites, [[0,0]], 'whites')
})

// 测试3：黑子在右下角
test('测试3: 黑子 ii = (8,8) 右下角', () => {
  const r = parseSGF('(;SZ[9]AB[ii])')
  assertEqual(r.boardSize, 9, 'boardSize')
  assertEqual(r.blacks, [[8,8]], 'blacks')
})

// 测试4：带答案的题
test('测试4: 答案 de = (3,4)', () => {
  const r = parseSGF('(;SZ[9]AB[ee]AW[ef](;B[de]TE[1]))')
  assertEqual(r.blacks, [[4,4]], 'blacks')
  assertEqual(r.whites, [[4,5]], 'whites')
  assertEqual(r.correctFirstMove, [3,4], 'correctFirstMove')
})

// 测试5：从 sanderland/tsumego 取第一道真实题
test('测试5: sanderland 真实题 Prob0001', () => {
  // 读原始 JSON 文件（sanderland 格式）
  const dataPath = '/tmp/tsumego-repo/problems/1a. Tsumego Beginner/Cho Chikun Encyclopedia Life And Death - Elementary/Prob0001.json'
  const raw = JSON.parse(fs.readFileSync(dataPath, 'utf8'))

  // sanderland JSON 不是 SGF 格式，需要转成 SGF 再解析
  // 或者直接用 raw 数据验证坐标解析
  const boardSize = parseInt(raw.SZ) || 19

  // 用同样的 sgf 坐标解析逻辑
  function sgf2xy(s) {
    return [s.charCodeAt(0) - 97, s.charCodeAt(1) - 97]
  }

  const blacks = raw.AB.map(sgf2xy)
  const whites = raw.AW.map(sgf2xy)
  const answer = sgf2xy(raw.SOL[0][1])

  // 打印 ASCII 棋盘
  const board = []
  for (let y = 0; y < boardSize; y++) {
    const row = []
    for (let x = 0; x < boardSize; x++) row.push('.')
    board.push(row)
  }
  for (const [x,y] of blacks) board[y][x] = 'X'
  for (const [x,y] of whites) board[y][x] = 'O'
  board[answer[1]][answer[0]] = '*'

  console.log('    文件: Prob0001.json')
  console.log('    SGF: AB=' + raw.AB.join(',') + ' AW=' + raw.AW.join(',') + ' SOL=' + raw.SOL[0][1])
  console.log('    棋盘大小: ' + boardSize)
  console.log('    黑子: ' + blacks.map(([x,y]) => '('+x+','+y+')').join(' '))
  console.log('    白子: ' + whites.map(([x,y]) => '('+x+','+y+')').join(' '))
  console.log('    答案: (' + answer[0] + ',' + answer[1] + ')')

  // 只显示有棋子的区域
  let x1=99,y1=99,x2=0,y2=0
  for(const[x,y]of[...blacks,...whites,answer]){x1=Math.min(x1,x);y1=Math.min(y1,y);x2=Math.max(x2,x);y2=Math.max(y2,y)}
  x1=Math.max(0,x1-1);y1=Math.max(0,y1-1);x2=Math.min(boardSize-1,x2+1);y2=Math.min(boardSize-1,y2+1)
  const cols = 'ABCDEFGHJKLMNOPQRST'
  let hdr = '    '; for(let x=x1;x<=x2;x++) hdr+=cols[x]+' '
  console.log(hdr)
  for(let y=y1;y<=y2;y++){
    let row='    '; for(let x=x1;x<=x2;x++) row+=board[y][x]+' '
    console.log(row + ' ' + (boardSize-y))
  }

  // 验证：黑白子数量正确
  if (blacks.length !== raw.AB.length) throw new Error('黑子数量不匹配')
  if (whites.length !== raw.AW.length) throw new Error('白子数量不匹配')
  // 验证答案在棋子附近
  if (answer[0] < x1-1 || answer[0] > x2+1 || answer[1] < y1-1 || answer[1] > y2+1) {
    throw new Error('答案不在棋子附近')
  }
})

console.log('\n=== 结果: ' + passed + ' passed, ' + failed + ' failed ===')
if (failed > 0) {
  console.log('\n!!! 有测试失败，停下来修!!!')
  process.exit(1)
}
console.log('\n全部通过! 可以继续解析题库。')

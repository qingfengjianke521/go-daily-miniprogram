#!/usr/bin/env node
/**
 * 把 beginner_problems.json 转换成 miniprogram/data/beginner-puzzles.js 本地模块
 * - 将所有 "白先" 题目反转为 "黑先"（交换黑白子，保持正解不变）
 * - 保证新手村模式下用户始终执黑
 * - 按 skill_node 分组
 */

var fs = require('fs')
var path = require('path')

var IN_FILE = path.join(__dirname, '..', 'beginner_problems.json')
var OUT_FILE = path.join(__dirname, '..', 'miniprogram', 'data', 'beginner-puzzles.js')

function invertColors(stones) {
  return stones.map(function (s) {
    return { x: s.x, y: s.y, color: s.color === 'black' ? 'white' : 'black' }
  })
}

function convertPuzzle(p) {
  // 扁平化 initial_stones: {black:[], white:[]} -> [{x,y,color}]
  var stones = []
  if (p.initial_stones && p.initial_stones.black) {
    p.initial_stones.black.forEach(function (s) {
      stones.push({ x: s[0], y: s[1], color: 'black' })
    })
  }
  if (p.initial_stones && p.initial_stones.white) {
    p.initial_stones.white.forEach(function (s) {
      stones.push({ x: s[0], y: s[1], color: 'white' })
    })
  }
  // 如果已经是扁平化格式（之前的 generated 题目），直接用
  if (Array.isArray(p.initial_stones) && p.initial_stones.length > 0 && p.initial_stones[0].color) {
    stones = p.initial_stones.slice()
  }

  // 主序列：优先 full_solution（多步），再 all_solutions[0]
  var primarySeq
  if (p.full_solution && p.full_solution.length >= 1) {
    primarySeq = p.full_solution
  } else {
    primarySeq = (p.all_solutions && p.all_solutions[0]) || [p.correct_first_move]
  }

  // 所有正解序列（保留全部，不去重 — 可能同一首步有不同后续）
  var allSols = []
  if (p.all_solutions && p.all_solutions.length > 0) {
    // 把 full_solution 放在第一位（如果它更长的话）
    var added = {}
    if (primarySeq.length > 0) {
      allSols.push(primarySeq)
      added[JSON.stringify(primarySeq)] = true
    }
    for (var i = 0; i < p.all_solutions.length; i++) {
      var alt = p.all_solutions[i]
      if (alt && alt.length > 0) {
        var key = JSON.stringify(alt)
        if (!added[key]) {
          allSols.push(alt)
          added[key] = true
        }
      }
    }
  }
  if (allSols.length === 0) allSols = [primarySeq]

  // 检测是否白先，并反转为黑先
  var desc = p.description || '黑先'
  var isWhiteFirst = desc.indexOf('白先') !== -1
  if (isWhiteFirst) {
    stones = invertColors(stones)
    // 描述强制改成黑先
    desc = desc.replace('白先', '黑先')
    if (desc.indexOf('黑先') === -1) desc = '黑先 ' + desc
  }

  return {
    problem_id: p.id,
    category: p.category || '入门',
    difficulty_rating: p.difficulty_rating || 200,
    board_size: p.board_size || 9,
    description: desc,
    expected_time_ms: 30000,
    initial_stones: stones,
    view_region: p.view_region,
    correct_sequences: allSols,
    level_tier: 'beginner',
    steps: primarySeq.length,
    hint: '黑先',
    source_file: p.source_file || '',
    skill_node: p.skill_node || '',
  }
}

function main() {
  console.log('读取:', IN_FILE)
  var puzzles = JSON.parse(fs.readFileSync(IN_FILE, 'utf8'))
  console.log('  原始: ' + puzzles.length + ' 道')

  var inverted = 0
  var converted = puzzles.map(function (p) {
    if ((p.description || '').indexOf('白先') !== -1) inverted++
    return convertPuzzle(p)
  })
  console.log('  反转 白先→黑先: ' + inverted + ' 道')

  // 按 skill_node 分组
  var byTag = {}
  converted.forEach(function (p) {
    var tag = p.skill_node
    if (!byTag[tag]) byTag[tag] = []
    byTag[tag].push(p)
  })

  // 生成 JS 模块
  var content = '// 新手村本地题库（自动生成，请勿手动修改）\n'
  content += '// 由 scripts/rebundle-village-puzzles.js 生成\n'
  content += '// 所有白先题目已反转为黑先（交换黑白子），村模式下用户始终执黑\n\n'
  content += 'var BEGINNER_PUZZLES_BY_TAG = ' + JSON.stringify(byTag) + '\n\n'
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
  console.log('写入:', OUT_FILE)
  console.log('  大小: ' + (stat.size / 1024).toFixed(1) + ' KB')
  console.log('  标签数: ' + Object.keys(byTag).length)
}

main()

#!/usr/bin/env node
/**
 * 从 ogs_puzzles.json 构建新手村题库
 * - 保留 cap1_* 系列（25K-20K 简单吃子，来自 generate-beginner-puzzles.js）
 * - 其余 skill_node 从 OGS LearningHub 直接取材（按 source_file 匹配）
 * - 输出 beginner_problems.json 覆盖原有
 */

var fs = require('fs')
var path = require('path')

var OGS_FILE = path.join(__dirname, '..', 'ogs_puzzles.json')
var GEN_FILE = path.join(__dirname, '..', 'beginner_problems.json')
var MAIN_FILE = path.join(__dirname, '..', 'problems_all.json')
var OUT_FILE = path.join(__dirname, '..', 'beginner_problems.json')

// ============================================================
// 配置：skill_node → OGS 源文件匹配
// 每一项包含: count, files (按顺序取 puzzle), rating 范围
// ============================================================

var SKILL_MAPPING = [
  // === Phase 2: 吃子进阶 (20K-16K, 200-300) ===
  { tag: 'cap2_center', count: 8, rating: [200, 230], files: ['Capture2'] },
  { tag: 'cap2_multi', count: 8, rating: [230, 260], files: ['Capture3', 'DoubleAtari'] },
  { tag: 'cap2_mixed', count: 10, rating: [260, 300], files: ['Capture4', 'SerialAtari', 'Capture5'] },

  // === Phase 2: 逃跑 (200-300) ===
  { tag: 'escape_basic', count: 8, rating: [220, 250], files: ['Escape', 'FindEscape', 'Stretch'] },
  { tag: 'escape_connect', count: 8, rating: [250, 280], files: ['BSEscape', 'HangingConnection'] },
  { tag: 'escape_mixed', count: 10, rating: [280, 300], files: ['EscapeFromNet', 'FindEscape'] },

  // === Phase 2: 连接切断 (270-330) ===
  { tag: 'connect_basic', count: 8, rating: [270, 290], files: ['Connect1', 'Connect2', 'Connect'] },
  { tag: 'connect_cut', count: 8, rating: [290, 310], files: ['Cut1', 'Cut2', 'Cut'] },
  { tag: 'connect_mixed', count: 10, rating: [310, 330], files: ['ConnectCut1', 'ConnectCut2', 'Connect3'] },

  // === Phase 3: 征子 (330-430) ===
  { tag: 'ladder_basic', count: 8, rating: [330, 370], files: ['Ladder'] },
  { tag: 'ladder_judge', count: 8, rating: [370, 400], files: ['Ladder', 'CalculateLadder'] },
  { tag: 'ladder_mixed', count: 10, rating: [400, 430], files: ['Ladder', 'ChaseDown'] },

  // === Phase 3: 倒扑 (340-440) ===
  { tag: 'snapback_basic', count: 8, rating: [340, 380], files: ['Snapback'] },
  { tag: 'snapback_apply', count: 8, rating: [380, 420], files: ['Snapback'] },
  { tag: 'snapback_mixed', count: 10, rating: [420, 440], files: ['Snapback'] },

  // === Phase 3: 死活 (400-470) === 用赵治勋死活大全（经典tsumego，主题库 sanderland）
  // files 里带 'MAIN:' 前缀表示从 problems_all.json 拿
  { tag: 'eyes_basic', count: 8, rating: [400, 430], files: ['MAIN:死活:542-620'] },
  { tag: 'eyes_make', count: 8, rating: [430, 450], files: ['MAIN:死活:542-620'] },
  { tag: 'eyes_kill', count: 8, rating: [440, 460], files: ['MAIN:死活:542-620'] },
  { tag: 'eyes_mixed', count: 10, rating: [450, 470], files: ['MAIN:死活:542-620'] },

  // === Phase 4: 对杀 (460-520) ===
  { tag: 'semeai_basic', count: 8, rating: [460, 480], files: ['CapturingRace1'] },
  { tag: 'semeai_liberties', count: 8, rating: [480, 500], files: ['CapturingRace2'] },
  { tag: 'semeai_mixed', count: 10, rating: [500, 520], files: ['CapturingRace3', 'CapturingRace4', 'ShortageLiberties'] },

  // === Phase 4: 手筋入门 (470-520) ===
  { tag: 'tesuji_net', count: 8, rating: [470, 490], files: ['Net'] },
  { tag: 'tesuji_throw', count: 8, rating: [490, 510], files: ['ThrowIn2', 'ThrowIn1'] },
  { tag: 'tesuji_mixed', count: 10, rating: [510, 520], files: ['LifeDeath6', 'LifeDeath7', 'Skills2'] },
]

// 保留的生成题目（25K-20K 基础吃子）
var KEEP_GENERATED_TAGS = ['cap1_single', 'cap1_double', 'cap1_corner', 'cap1_edge']

// ============================================================
// 主流程
// ============================================================

function getFileName(sourceFile) {
  var m = (sourceFile || '').match(/\/([^\/]+)\.tsx$/)
  return m ? m[1] : ''
}

function getMainPool(mainPuzzles, spec) {
  // spec format: "MAIN:category:ratingMin-ratingMax"
  var parts = spec.substring(5).split(':')
  var cat = parts[0]
  var range = parts[1].split('-').map(Number)
  return mainPuzzles.filter(function (p) {
    return p.category === cat && p.difficulty_rating >= range[0] && p.difficulty_rating < range[1]
  })
}

function main() {
  console.log('读取 OGS 题库...')
  var ogsPuzzles = JSON.parse(fs.readFileSync(OGS_FILE, 'utf8'))
  console.log('  OGS 总数: ' + ogsPuzzles.length)

  console.log('读取主题库（sanderland）...')
  var mainPuzzles = JSON.parse(fs.readFileSync(MAIN_FILE, 'utf8'))
  console.log('  主题库总数: ' + mainPuzzles.length)

  console.log('读取现有生成题库（保留 cap1_*）...')
  var genPuzzles = JSON.parse(fs.readFileSync(GEN_FILE, 'utf8'))
  var keptGenerated = genPuzzles.filter(function (p) {
    return KEEP_GENERATED_TAGS.indexOf(p.skill_node) >= 0
  })
  console.log('  保留 ' + keptGenerated.length + ' 道生成题（cap1_*）')

  // 按 source_file 分组
  var ogsByFile = {}
  ogsPuzzles.forEach(function (p) {
    var fname = getFileName(p.source_file)
    if (!ogsByFile[fname]) ogsByFile[fname] = []
    ogsByFile[fname].push(p)
  })

  console.log('')
  console.log('按 skill_node 选题...')
  var result = keptGenerated.slice()
  var usedIds = {}
  keptGenerated.forEach(function (p) { usedIds[p.id] = true })

  SKILL_MAPPING.forEach(function (config) {
    var selected = []
    var sources = []

    // 按文件顺序取题，跳过已用
    for (var i = 0; i < config.files.length && selected.length < config.count; i++) {
      var fname = config.files[i]
      var pool
      if (fname.indexOf('MAIN:') === 0) {
        pool = getMainPool(mainPuzzles, fname)
      } else {
        pool = ogsByFile[fname] || []
      }
      for (var j = 0; j < pool.length && selected.length < config.count; j++) {
        var p = pool[j]
        if (usedIds[p.id]) continue
        usedIds[p.id] = true
        selected.push(p)
        sources.push(fname)
      }
    }

    if (selected.length < config.count) {
      console.log('  ⚠ ' + config.tag + ': 只找到 ' + selected.length + '/' + config.count + ' 道')
    }

    // 分配 rating 和重写 skill_node
    var ratingRange = config.rating
    selected.forEach(function (p, idx) {
      var t = selected.length > 1 ? idx / (selected.length - 1) : 0
      var newRating = Math.round(ratingRange[0] + (ratingRange[1] - ratingRange[0]) * t)
      // 新建副本（避免修改原对象）
      var newP = {
        id: 'ogs_' + config.tag + '_' + String(idx + 1).padStart(3, '0'),
        source: p.source,
        source_file: p.source_file,
        category: p.category || '初级',
        board_size: p.board_size,
        initial_stones: p.initial_stones,
        correct_first_move: p.correct_first_move,
        full_solution: p.full_solution,
        all_solutions: p.all_solutions,
        description: p.description || '黑先',
        difficulty_rating: newRating,
        view_region: p.view_region,
        skill_node: config.tag,
      }
      result.push(newP)
    })

    console.log('  ' + config.tag + ': ' + selected.length + ' 道 (rating ' + ratingRange[0] + '-' + ratingRange[1] + ')')
  })

  console.log('')
  console.log('总计: ' + result.length + ' 道')

  // 按 skill_node 统计
  var byTag = {}
  result.forEach(function (p) {
    byTag[p.skill_node] = (byTag[p.skill_node] || 0) + 1
  })
  console.log('')
  console.log('按 skill_node 统计:')
  Object.keys(byTag).sort().forEach(function (tag) {
    console.log('  ' + tag + ': ' + byTag[tag])
  })

  // 写入
  fs.writeFileSync(OUT_FILE, JSON.stringify(result, null, 2))
  console.log('')
  console.log('写入: ' + OUT_FILE)
}

main()

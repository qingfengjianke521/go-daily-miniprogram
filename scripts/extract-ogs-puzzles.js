#!/usr/bin/env node
/**
 * 从 OGS (online-go.com) 仓库的 LearningHub 提取围棋题目
 * 输出格式兼容 problems_all.json
 *
 * 用法:
 *   node scripts/extract-ogs-puzzles.js
 *   # 输出到 ogs_puzzles.json
 */
var fs = require('fs')
var path = require('path')
var childProcess = require('child_process')

var REPO_URL = 'https://github.com/online-go/online-go.com'
var REPO_DIR = '/tmp/ogs-repo'
var SECTIONS_REL = 'src/views/LearningHub/Sections'
var OUTPUT_FILE = path.join(__dirname, '..', 'ogs_puzzles.json')

// ============ Category → difficulty mapping ============

var CATEGORY_MAP = {
  'Fundamentals':     { min: 280, max: 300, cat: '入门', node: 'ogs_fundamentals' },
  'BasicPrinciples':  { min: 300, max: 330, cat: '入门', node: 'ogs_basic_principles' },
  'BasicSkills':      { min: 330, max: 370, cat: '入门', node: 'ogs_basic_skills' },
  'BeginnerLevel1':   { min: 370, max: 395, cat: '入门', node: 'ogs_beginner1' },
  'BeginnerLevel2':   { min: 395, max: 410, cat: '入门', node: 'ogs_beginner2' },
  'BeginnerLevel3':   { min: 410, max: 425, cat: '入门', node: 'ogs_beginner3' },
  'BeginnerLevel4':   { min: 425, max: 435, cat: '入门', node: 'ogs_beginner4' },
}

// ============ Helpers ============

/**
 * Decode OGS paired-letter position string to array of [x, y]
 * e.g. "afbe" → [[0,5], [1,4]]
 */
function decodePairs(s) {
  if (!s || s.length === 0) return []
  var result = []
  for (var i = 0; i + 1 < s.length; i += 2) {
    var x = s.charCodeAt(i) - 97     // 'a' = 0
    var y = s.charCodeAt(i + 1) - 97
    if (x >= 0 && x <= 18 && y >= 0 && y <= 18) {
      result.push([x, y])
    }
  }
  return result
}

/**
 * Decode a move sequence string to array of [x, y]
 * e.g. "hdic" → [[7,3], [8,2]]
 */
function decodeMoves(s) {
  return decodePairs(s)
}

/**
 * Compute view_region from all stones and moves
 */
function computeViewRegion(stones, moves, boardSize) {
  var allPoints = []
  if (stones.black) allPoints = allPoints.concat(stones.black)
  if (stones.white) allPoints = allPoints.concat(stones.white)
  moves.forEach(function (seq) {
    allPoints = allPoints.concat(seq)
  })

  if (allPoints.length === 0) {
    return { x1: 0, y1: 0, x2: boardSize - 1, y2: boardSize - 1 }
  }

  var minX = boardSize, minY = boardSize, maxX = 0, maxY = 0
  allPoints.forEach(function (p) {
    if (p[0] < minX) minX = p[0]
    if (p[1] < minY) minY = p[1]
    if (p[0] > maxX) maxX = p[0]
    if (p[1] > maxY) maxY = p[1]
  })

  // Add 1-cell padding, clamp to board
  minX = Math.max(0, minX - 1)
  minY = Math.max(0, minY - 1)
  maxX = Math.min(boardSize - 1, maxX + 1)
  maxY = Math.min(boardSize - 1, maxY + 1)

  // For small boards (9x9), just show the whole board
  if (boardSize <= 9) {
    return { x1: 0, y1: 0, x2: boardSize - 1, y2: boardSize - 1 }
  }

  return { x1: minX, y1: minY, x2: maxX, y2: maxY }
}

/**
 * Make a safe ID from file path and page number
 */
function makeId(category, fileName, pageNum) {
  var base = fileName.replace(/\.tsx$/i, '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase()
  var pg = String(pageNum)
  while (pg.length < 2) pg = '0' + pg
  return 'ogs_' + category.toLowerCase() + '_' + base + '_page' + pg
}

// ============ TSX Parsing ============

/**
 * Extract all puzzle pages from a single TSX file
 */
function extractFromFile(filePath, category) {
  var content
  try {
    content = fs.readFileSync(filePath, 'utf8')
  } catch (e) {
    console.error('WARNING: cannot read ' + filePath + ': ' + e.message)
    return []
  }

  // Split by class definitions to isolate each page
  // Match: class PageNN extends ...
  var classPattern = /class\s+(Page(\d+))\s+extends\s+\w+/g
  var classMatches = []
  var m
  while ((m = classPattern.exec(content)) !== null) {
    classMatches.push({
      name: m[1],
      pageNum: parseInt(m[2], 10),
      startIdx: m.index
    })
  }

  if (classMatches.length === 0) {
    return []
  }

  // Extract the text region for each class
  var puzzles = []
  for (var i = 0; i < classMatches.length; i++) {
    var startIdx = classMatches[i].startIdx
    var endIdx = (i + 1 < classMatches.length) ? classMatches[i + 1].startIdx : content.length
    var classText = content.substring(startIdx, endIdx)

    var puzzle = parseClassBlock(classText, classMatches[i].pageNum, filePath, category)
    if (puzzle) {
      puzzles.push(puzzle)
    }
  }

  return puzzles
}

/**
 * Parse a single class block to extract puzzle config
 */
function parseClassBlock(text, pageNum, filePath, category) {
  // Must have config() method to be a puzzle
  if (text.indexOf('config()') === -1 && text.indexOf('config ()') === -1) {
    return null
  }

  // Must have initial_state or move_tree to be a puzzle (not just text tutorial)
  if (text.indexOf('initial_state') === -1 && text.indexOf('move_tree') === -1) {
    return null
  }

  // Extract width and height
  var widthMatch = text.match(/width\s*:\s*(\d+)/)
  var heightMatch = text.match(/height\s*:\s*(\d+)/)
  var width = widthMatch ? parseInt(widthMatch[1], 10) : 9
  var height = heightMatch ? parseInt(heightMatch[1], 10) : 9
  var boardSize = Math.max(width, height)

  // Extract initial_player
  var playerMatch = text.match(/initial_player\s*:\s*"(black|white)"/)
  var initialPlayer = playerMatch ? playerMatch[1] : 'black'

  // Extract initial_state
  var blackStones = []
  var whiteStones = []

  // Try multi-line initial_state block
  var stateMatch = text.match(/initial_state\s*:\s*\{([^}]*)\}/s)
  if (stateMatch) {
    var stateBlock = stateMatch[1]
    var bMatch = stateBlock.match(/black\s*:\s*"([^"]*)"/)
    var wMatch = stateBlock.match(/white\s*:\s*"([^"]*)"/)
    if (bMatch) blackStones = decodePairs(bMatch[1])
    if (wMatch) whiteStones = decodePairs(wMatch[1])
  }

  // Extract move_tree via makePuzzleMoveTree
  var correctSeqs = []
  var wrongSeqs = []

  // Pattern: makePuzzleMoveTree( [...], [...], N, N )
  // The arrays can span multiple lines
  var moveTreeIdx = text.indexOf('makePuzzleMoveTree')
  if (moveTreeIdx === -1) {
    moveTreeIdx = text.indexOf('this.makePuzzleMoveTree')
  }

  if (moveTreeIdx !== -1) {
    // Find the opening paren
    var parenStart = text.indexOf('(', moveTreeIdx)
    if (parenStart !== -1) {
      // Extract content between parens, handling nested brackets
      var moveContent = extractBalancedParens(text, parenStart)
      if (moveContent) {
        // Parse the two arrays from moveContent
        var arrays = extractTwoArrays(moveContent)
        if (arrays) {
          // Decode correct sequences
          arrays.correct.forEach(function (s) {
            var moves = decodeMoves(s)
            if (moves.length > 0) {
              correctSeqs.push(moves)
            }
          })
          // Decode wrong sequences (for reference, not used in output)
          arrays.wrong.forEach(function (s) {
            var moves = decodeMoves(s)
            if (moves.length > 0) {
              wrongSeqs.push(moves)
            }
          })
        }
      }
    }
  }

  // Must have at least one correct sequence to be a valid puzzle
  if (correctSeqs.length === 0) {
    return null
  }

  // Build the puzzle object
  var firstMove = correctSeqs[0][0]
  var fullSolution = correctSeqs[0]

  var relPath = filePath
  var sectionsIdx = filePath.indexOf('Sections/')
  if (sectionsIdx !== -1) {
    relPath = 'LearningHub/' + filePath.substring(sectionsIdx)
  }

  var fileName = path.basename(filePath)

  var puzzle = {
    id: makeId(category, fileName, pageNum),
    source: 'online-go/online-go.com',
    source_file: relPath,
    category: getCategoryInfo(category).cat,
    board_size: boardSize,
    initial_stones: {
      black: blackStones,
      white: whiteStones
    },
    correct_first_move: firstMove,
    full_solution: fullSolution,
    all_solutions: correctSeqs,
    description: (initialPlayer === 'black' ? '黑先' : '白先') + ' ' + getCategoryInfo(category).cat,
    difficulty_rating: 0, // filled in later
    view_region: computeViewRegion(
      { black: blackStones, white: whiteStones },
      correctSeqs,
      boardSize
    ),
    skill_node: getCategoryInfo(category).node
  }

  return puzzle
}

/**
 * Extract balanced parentheses content (excluding outer parens)
 */
function extractBalancedParens(text, openIdx) {
  var depth = 0
  var start = openIdx
  for (var i = openIdx; i < text.length; i++) {
    if (text[i] === '(') depth++
    else if (text[i] === ')') {
      depth--
      if (depth === 0) {
        return text.substring(start + 1, i)
      }
    }
  }
  return null
}

/**
 * Extract two string arrays from makePuzzleMoveTree arguments
 * Input looks like: ["hdichc", "hdichcibiahbg"], ["hdicib"], 9, 9
 */
function extractTwoArrays(content) {
  // Find first [ ... ] and second [ ... ]
  var arrays = []
  var idx = 0

  for (var a = 0; a < 2; a++) {
    var bracketStart = content.indexOf('[', idx)
    if (bracketStart === -1) break

    var bracketEnd = findMatchingBracket(content, bracketStart)
    if (bracketEnd === -1) break

    var arrContent = content.substring(bracketStart + 1, bracketEnd)
    var strings = extractStringsFromArray(arrContent)
    arrays.push(strings)
    idx = bracketEnd + 1
  }

  if (arrays.length < 2) {
    // If only one array found, treat it as correct with empty wrong
    if (arrays.length === 1) {
      return { correct: arrays[0], wrong: [] }
    }
    return null
  }

  return { correct: arrays[0], wrong: arrays[1] }
}

/**
 * Find matching closing bracket
 */
function findMatchingBracket(text, openIdx) {
  var depth = 0
  for (var i = openIdx; i < text.length; i++) {
    if (text[i] === '[') depth++
    else if (text[i] === ']') {
      depth--
      if (depth === 0) return i
    }
  }
  return -1
}

/**
 * Extract quoted strings from array content
 * e.g. '"hdichc", "hdichcibiahbg"' → ["hdichc", "hdichcibiahbg"]
 */
function extractStringsFromArray(content) {
  var strings = []
  var re = /"([^"]*)"/g
  var m
  while ((m = re.exec(content)) !== null) {
    strings.push(m[1])
  }
  return strings
}

/**
 * Get category info with fallback
 */
function getCategoryInfo(category) {
  if (CATEGORY_MAP[category]) return CATEGORY_MAP[category]
  return { min: 300, max: 400, cat: '入门', node: 'ogs_other' }
}

// ============ Directory scanning ============

/**
 * Recursively find all .tsx files in a directory
 */
function findTsxFiles(dir) {
  var results = []
  var entries
  try {
    entries = fs.readdirSync(dir)
  } catch (e) {
    return results
  }
  entries.forEach(function (entry) {
    var fullPath = path.join(dir, entry)
    var stat
    try {
      stat = fs.statSync(fullPath)
    } catch (e) {
      return
    }
    if (stat.isDirectory()) {
      results = results.concat(findTsxFiles(fullPath))
    } else if (entry.endsWith('.tsx')) {
      results.push(fullPath)
    }
  })
  return results
}

/**
 * Determine category from file path
 * e.g. .../Sections/BasicSkills/Capture.tsx → "BasicSkills"
 */
function getCategoryFromPath(filePath, sectionsDir) {
  var rel = path.relative(sectionsDir, filePath)
  var parts = rel.split(path.sep)
  if (parts.length >= 2) {
    return parts[0]
  }
  return 'Other'
}

// ============ Main ============

function main() {
  // Step 1: Clone repo if needed
  if (!fs.existsSync(REPO_DIR)) {
    console.log('Cloning OGS repository to ' + REPO_DIR + ' ...')
    try {
      // Skip git-lfs to avoid errors if lfs is not installed
      childProcess.execSync(
        'GIT_LFS_SKIP_SMUDGE=1 git clone --depth 1 ' + REPO_URL + ' ' + REPO_DIR,
        { stdio: 'inherit', timeout: 120000 }
      )
    } catch (e) {
      // Clone may "fail" due to lfs but still create the repo
      if (fs.existsSync(path.join(REPO_DIR, '.git'))) {
        console.log('Clone had warnings but repo exists, attempting checkout...')
        try {
          childProcess.execSync(
            'GIT_LFS_SKIP_SMUDGE=1 git checkout HEAD -- ' + SECTIONS_REL,
            { cwd: REPO_DIR, stdio: 'inherit', timeout: 60000 }
          )
        } catch (e2) {
          console.error('ERROR: Failed to checkout sections: ' + e2.message)
          process.exit(1)
        }
      } else {
        console.error('ERROR: Failed to clone repository: ' + e.message)
        process.exit(1)
      }
    }
  } else {
    console.log('Repository already exists at ' + REPO_DIR)
  }

  // Step 2: Find TSX files
  var sectionsDir = path.join(REPO_DIR, SECTIONS_REL)
  if (!fs.existsSync(sectionsDir)) {
    console.error('ERROR: Sections directory not found at ' + sectionsDir)
    console.error('The OGS repo structure may have changed.')
    process.exit(1)
  }

  var tsxFiles = findTsxFiles(sectionsDir)
  console.log('Found ' + tsxFiles.length + ' TSX files')

  // Step 3: Extract puzzles from each file
  var allPuzzles = []
  var categoryCounts = {}
  var skippedFiles = 0

  tsxFiles.forEach(function (filePath) {
    var category = getCategoryFromPath(filePath, sectionsDir)
    var puzzles = extractFromFile(filePath, category)

    if (puzzles.length === 0) {
      skippedFiles++
      return
    }

    puzzles.forEach(function (p) {
      if (!categoryCounts[category]) categoryCounts[category] = 0
      categoryCounts[category]++
      allPuzzles.push(p)
    })
  })

  // Step 4: Assign difficulty ratings within each category
  // Group puzzles by category
  var byCategory = {}
  allPuzzles.forEach(function (p) {
    var cat = p.skill_node
    if (!byCategory[cat]) byCategory[cat] = []
    byCategory[cat].push(p)
  })

  Object.keys(byCategory).forEach(function (nodeKey) {
    var puzzles = byCategory[nodeKey]
    // Find the category config from node key
    var catConfig = null
    Object.keys(CATEGORY_MAP).forEach(function (k) {
      if (CATEGORY_MAP[k].node === nodeKey) catConfig = CATEGORY_MAP[k]
    })
    if (!catConfig) catConfig = { min: 300, max: 400 }

    var count = puzzles.length
    puzzles.forEach(function (p, idx) {
      if (count <= 1) {
        p.difficulty_rating = Math.round((catConfig.min + catConfig.max) / 2)
      } else {
        p.difficulty_rating = Math.round(
          catConfig.min + (catConfig.max - catConfig.min) * idx / (count - 1)
        )
      }
    })
  })

  // Step 5: Output
  console.log('\n========== Summary ==========')
  console.log('Total puzzles extracted: ' + allPuzzles.length)
  console.log('Files skipped (no puzzles): ' + skippedFiles)
  console.log('\nPer-category counts:')
  Object.keys(categoryCounts).sort().forEach(function (cat) {
    var info = CATEGORY_MAP[cat] || { min: '?', max: '?', node: 'unknown' }
    console.log('  ' + cat + ': ' + categoryCounts[cat] + ' puzzles (rating ' + info.min + '-' + info.max + ')')
  })

  // Write output
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(allPuzzles, null, 2), 'utf8')
  console.log('\nOutput written to: ' + OUTPUT_FILE)
}

main()

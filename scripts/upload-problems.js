#!/usr/bin/env node
/**
 * 上传 problems_all.json 到微信云数据库
 * 用法:
 *   node scripts/upload-problems.js          # 清空+上传全部
 *   node scripts/upload-problems.js --clear  # 只清空
 *   node scripts/upload-problems.js --count  # 只查数量
 *   node scripts/upload-problems.js --reset-users  # 重置所有用户rating=300
 *   node scripts/upload-problems.js --upload-only  # 只上传（不清空）
 */
var fs = require('fs')
var path = require('path')

// 读取 .env
var envPath = path.join(__dirname, '..', '.env')
var envContent = fs.readFileSync(envPath, 'utf8')
var env = {}
envContent.split('\n').forEach(function (line) {
  var m = line.match(/^(\w+)=(.+)$/)
  if (m) env[m[1]] = m[2].trim()
})

var cloudbase = require('@cloudbase/node-sdk')

var app = cloudbase.init({
  env: env.CLOUD_ENV,
  secretId: env.TENCENT_SECRET_ID,
  secretKey: env.TENCENT_SECRET_KEY,
})

var db = app.database()
var _ = db.command

// 带重试的请求
async function withRetry(fn, maxRetries) {
  maxRetries = maxRetries || 3
  for (var attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn()
    } catch (e) {
      if (attempt === maxRetries - 1) throw e
      // 等待后重试，逐步增加等待时间
      await new Promise(function (r) { setTimeout(r, 1000 * (attempt + 1)) })
    }
  }
}

// 批量删除集合中所有记录（串行，每批10条并发，防止超时）
async function clearCollection(name) {
  console.log('清空集合: ' + name)
  var total = 0
  var BATCH = 10
  while (true) {
    var res = await withRetry(function () {
      return db.collection(name).limit(100).get()
    })
    if (res.data.length === 0) break

    // 每10条并发删除
    for (var i = 0; i < res.data.length; i += BATCH) {
      var chunk = res.data.slice(i, i + BATCH)
      var promises = chunk.map(function (d) {
        return withRetry(function () {
          return db.collection(name).doc(d._id).remove()
        })
      })
      await Promise.all(promises)
      total += chunk.length
    }
    process.stdout.write('\r  已删除: ' + total)
  }
  console.log('\r  共删除: ' + total + ' 条')
}

// 把 problems_all.json 格式转成云数据库格式
function convertProblem(p) {
  // 转换 initial_stones: {black:[[x,y],...],white:[[x,y],...]} → [{x,y,color},...]
  var stones = []
  if (p.initial_stones && p.initial_stones.black) {
    for (var i = 0; i < p.initial_stones.black.length; i++) {
      stones.push({ x: p.initial_stones.black[i][0], y: p.initial_stones.black[i][1], color: 'black' })
    }
  }
  if (p.initial_stones && p.initial_stones.white) {
    for (var i = 0; i < p.initial_stones.white.length; i++) {
      stones.push({ x: p.initial_stones.white[i][0], y: p.initial_stones.white[i][1], color: 'white' })
    }
  }

  // correct_sequences: 保留原始 [[x,y],...] 格式
  var seqs = p.all_solutions || [p.full_solution || [p.correct_first_move]]

  // category 映射提示
  var CAT_HINTS = {
    '死活': '黑先', '手筋': '找到妙手', '官子': '收官妙手'
  }
  var hint = CAT_HINTS[p.category] || '黑先'

  // steps
  var steps = seqs.length > 0 ? seqs[0].length : 1

  return {
    problem_id: p.id,
    source: p.source || 'sanderland/tsumego',
    source_file: p.source_file || '',
    category: p.category || '死活',
    board_size: p.board_size || 19,
    difficulty_rating: p.difficulty_rating || 500,
    description: p.category || '死活',
    hint: hint,
    steps: steps,
    expected_time_ms: steps <= 1 ? 30000 : steps <= 3 ? 60000 : 120000,
    initial_stones: stones,
    view_region: p.view_region || { x1: 0, y1: 0, x2: 18, y2: 18 },
    correct_sequences: seqs,
    level_tier: getLevelTier(p.difficulty_rating),
    created_at: new Date(),
  }
}

function getLevelTier(rating) {
  if (rating < 360) return 'beginner'
  if (rating < 675) return 'elementary'
  if (rating < 825) return 'intermediate'
  return 'advanced'
}

// 并发上传（每批 CONCURRENCY 条并行，带重试）
async function uploadProblems() {
  var filePath = path.join(__dirname, '..', 'problems_all.json')
  var raw = JSON.parse(fs.readFileSync(filePath, 'utf8'))
  console.log('读取题库: ' + raw.length + ' 道')

  var CONCURRENCY = 10 // 并发数（保守值，避免超时）
  var uploaded = 0
  var failed = 0
  var startTime = Date.now()

  for (var start = 0; start < raw.length; start += CONCURRENCY) {
    var batch = raw.slice(start, start + CONCURRENCY)
    var promises = batch.map(function (p) {
      var doc = convertProblem(p)
      return withRetry(function () {
        return db.collection('problems').add(doc)
      }).then(function () {
        uploaded++
      }).catch(function (e) {
        failed++
        if (failed <= 5) console.log('\n  失败 ' + p.id + ': ' + e.message)
      })
    })
    await Promise.all(promises)

    if ((start + CONCURRENCY) % 100 === 0 || start + CONCURRENCY >= raw.length) {
      var elapsed = ((Date.now() - startTime) / 1000).toFixed(0)
      var speed = (uploaded / (Math.max(1, elapsed))).toFixed(1)
      var eta = ((raw.length - uploaded) / Math.max(1, parseFloat(speed))).toFixed(0)
      process.stdout.write('\r  上传: ' + uploaded + '/' + raw.length +
        ' 失败: ' + failed + ' ' + elapsed + 's ' + speed + '/s ETA: ' + eta + 's   ')
    }
  }
  console.log('\n完成! 上传: ' + uploaded + ' 失败: ' + failed +
    ' 总耗时: ' + ((Date.now() - startTime) / 1000).toFixed(0) + 's')
}

// 重置所有用户到 rating=300
async function resetUsers() {
  console.log('重置所有用户 rating=300 ...')
  var total = 0
  while (true) {
    var res = await db.collection('users').limit(100).get()
    if (res.data.length === 0) break
    for (var i = 0; i < res.data.length; i++) {
      await withRetry(function () {
        return db.collection('users').doc(res.data[i]._id).update({
          rating: 0,
          rating_deviation: 350,
          level_name: '25K',
          total_solved: 0,
          total_correct: 0,
          streak_days: 0,
          last_play_date: '',
        })
      })
      total++
    }
    if (res.data.length < 100) break
  }
  console.log('  重置: ' + total + ' 个用户')
}

// 查看数量
async function countProblems() {
  try {
    var res = await db.collection('problems').count()
    console.log('云数据库 problems 数量: ' + res.total)
  } catch (e) {
    console.log('查询失败: ' + e.message)
  }
}

// 清空 sessions
async function clearSessions() {
  await clearCollection('daily_sessions')
  await clearCollection('attempts')
  console.log('sessions 和 attempts 已清空')
}

// 主流程
async function main() {
  var args = process.argv.slice(2)

  if (args.indexOf('--count') >= 0) {
    return await countProblems()
  }

  if (args.indexOf('--clear') >= 0) {
    await clearCollection('problems')
    return
  }

  if (args.indexOf('--reset-users') >= 0) {
    await resetUsers()
    await clearSessions()
    return
  }

  if (args.indexOf('--upload-only') >= 0) {
    await uploadProblems()
    await countProblems()
    return
  }

  // 默认：清空 + 上传全部
  console.log('=== 上传题库到云数据库 ===')
  console.log('Step 1: 清空旧题...')
  await clearCollection('problems')

  console.log('\nStep 2: 上传新题...')
  await uploadProblems()

  console.log('\nStep 3: 验证...')
  await countProblems()

  // 查看样本
  var sample = await db.collection('problems').limit(1).get()
  if (sample.data.length > 0) {
    var s = sample.data[0]
    console.log('样本: id=' + s.problem_id + ' rating=' + s.difficulty_rating +
      ' stones=' + s.initial_stones.length + ' seqs=' + s.correct_sequences.length)
  }
}

main().catch(function (e) {
  console.error('错误:', e.message || e)
  process.exit(1)
})

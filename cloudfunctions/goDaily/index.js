// 云函数入口
const cloud = require('wx-server-sdk')

cloud.init({
  env: 'cloud1-2gna4pn73d7fe81e'
})

const db = cloud.database()
const _ = db.command

// ========== 工具函数 ==========

// 等级分表（前后端统一，12级）
var LEVEL_TIERS = [
  [520, '7K'],  [560, '6K'],  [600, '5K'],  [645, '4K'],  [695, '3K'],
  [745, '2K'],  [795, '1K'],
  [845, '1D'],  [900, '2D'],  [960, '3D'],  [1020, '4D'], [1080, '5D'],
]

function getLevelName(rating) {
  if (rating < 520) return '7K'
  for (var i = LEVEL_TIERS.length - 1; i >= 0; i--) {
    if (rating >= LEVEL_TIERS[i][0]) return LEVEL_TIERS[i][1]
  }
  return '7K'
}

function getTodayDate() {
  var now = new Date()
  var utc8 = new Date(now.getTime() + 8 * 60 * 60 * 1000)
  return utc8.toISOString().slice(0, 10)
}

function calculateRating(userRating, userRD, problemRating, isCorrect) {
  // 简化ELO: K=10, 无时间系数, 无RD
  var K = 10
  var expected = 1 / (1 + Math.pow(10, (problemRating - userRating) / 400))
  var actual = isCorrect ? 1.0 : 0.0
  var change = Math.round(K * (actual - expected))
  // 等级分最低为520（7K）
  if (userRating + change < 520) change = 520 - userRating
  return { change: change, newRD: userRD || 350 }
}

// 根据用户rating获取对应的level_tier
function getUserLevelTier(rating) {
  if (rating < 360) return 'beginner'    // 25K-10K
  if (rating < 675) return 'elementary'  // 10K-1K
  if (rating < 825) return 'intermediate' // 1K-3D
  return 'advanced'                       // 3D+
}

// 从指定 rating 范围随机选1题（排除已做过的）
// 优化：不做count，直接随机skip+limit
async function pickFromDB(minR, maxR, exclude) {
  var where = { difficulty_rating: _.gte(minR).and(_.lte(maxR)) }
  // 直接随机 skip，假设每个范围不超过5000题
  var skip = Math.floor(Math.random() * 2000)
  var res = await db.collection('problems').where(where)
    .skip(skip).limit(20).get()
  // 如果 skip 太大没数据，从头取
  if (res.data.length === 0) {
    res = await db.collection('problems').where(where).limit(20).get()
  }
  var cands = res.data.filter(function(p) { return !exclude[p.problem_id] })
  if (cands.length > 0) {
    var picked = cands[Math.floor(Math.random() * cands.length)]
    exclude[picked.problem_id] = true
    return picked
  }
  return null
}

// Compute recent accuracy from last N attempts
function recentAccuracy(attempts) {
  if (!attempts || attempts.length === 0) return 0.5
  var correct = 0
  for (var i = 0; i < attempts.length; i++) {
    if (attempts[i].is_correct) correct++
  }
  return correct / attempts.length
}

// 出题策略（极速版：用随机rating点查询，不用skip）
async function selectProblemsFromDB(userRating, recentIds, openid) {
  var exclude = {}
  if (recentIds) {
    for (var i = 0; i < recentIds.length; i++) exclude[recentIds[i]] = true
  }

  // 用随机起点查询，避免 skip（无索引时 skip 极慢）
  var minR = Math.max(520, userRating - 90)
  var maxR = Math.max(minR + 60, userRating + 90)
  // 在范围内随机一个起点，用 gte 查
  var randStart = minR + Math.floor(Math.random() * (maxR - minR))
  var res = await db.collection('problems').where({
    difficulty_rating: _.gte(randStart).and(_.lte(maxR))
  }).limit(20).get()

  // 如果不够，从范围底部补
  if (res.data.length < 5) {
    var res2 = await db.collection('problems').where({
      difficulty_rating: _.gte(minR).and(_.lt(randStart))
    }).limit(20).get()
    res.data = res.data.concat(res2.data)
  }

  // 过滤+打乱
  var cands = res.data.filter(function(p) { return !exclude[p.problem_id] })
  for (var i = cands.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1))
    var tmp = cands[i]; cands[i] = cands[j]; cands[j] = tmp
  }

  return cands.slice(0, 3)
}

// Pick a single problem for continuation practice (同级±30)
async function pickContinueProblem(userRating, excludeIds) {
  var exclude = {}
  if (excludeIds) {
    for (var i = 0; i < excludeIds.length; i++) exclude[excludeIds[i]] = true
  }
  var p = await pickFromDB(Math.max(0, userRating - 30), userRating + 30, exclude)
  if (p) return p
  p = await pickFromDB(Math.max(0, userRating - 60), userRating + 60, exclude)
  if (p) return p
  p = await pickFromDB(Math.max(0, userRating - 120), userRating + 120, exclude)
  if (p) return p
  return await pickFromDB(0, 950, exclude)
}

// Format a problem from DB for client response
// 根据棋子数量动态调整棋盘大小，去掉 view_region
function adaptBoardSize(problem) {
  var stones = problem.initial_stones || {}
  var blackArr = stones.black || []
  var whiteArr = stones.white || []
  var total = blackArr.length + whiteArr.length
  var origSize = problem.board_size || 19
  var vr = problem.view_region

  if (!vr && origSize <= 13) {
    // 已经是小棋盘且没有 view_region，直接返回
    return problem
  }

  // 计算棋子实际范围
  var allStones = blackArr.concat(whiteArr)
  if (allStones.length === 0) return problem
  var minX = 99, maxX = 0, minY = 99, maxY = 0
  for (var i = 0; i < allStones.length; i++) {
    var s = allStones[i]
    if (s[0] < minX) minX = s[0]
    if (s[0] > maxX) maxX = s[0]
    if (s[1] < minY) minY = s[1]
    if (s[1] > maxY) maxY = s[1]
  }
  // 也考虑正解坐标的范围
  var seqs = problem.correct_sequences || problem.all_solutions || []
  for (var si = 0; si < seqs.length; si++) {
    var seq = seqs[si]
    for (var sj = 0; sj < seq.length; sj++) {
      var sc = seq[sj]
      if (sc[0] < minX) minX = sc[0]
      if (sc[0] > maxX) maxX = sc[0]
      if (sc[1] < minY) minY = sc[1]
      if (sc[1] > maxY) maxY = sc[1]
    }
  }

  var spanX = maxX - minX
  var spanY = maxY - minY
  var span = Math.max(spanX, spanY)

  // 决定目标棋盘大小（留2路边距）
  var targetSize = 9
  if (span + 2 > 8 || total > 20) targetSize = 13
  if (span + 2 > 12 || total > 40) targetSize = 19

  if (targetSize >= origSize) {
    problem.view_region = null
    return problem
  }

  // 平移到目标棋盘，尽量保持靠边（角部题保持在角上）
  var offsetX = 0, offsetY = 0
  // 如果棋子靠近原棋盘边缘，保持靠边
  if (minX <= 2) {
    offsetX = 0 // 靠左边
  } else if (maxX >= origSize - 3) {
    offsetX = (targetSize - 1) - maxX // 靠右边
  } else {
    offsetX = Math.floor(targetSize / 2) - Math.floor((minX + maxX) / 2)
  }
  if (minY <= 2) {
    offsetY = 0
  } else if (maxY >= origSize - 3) {
    offsetY = (targetSize - 1) - maxY
  } else {
    offsetY = Math.floor(targetSize / 2) - Math.floor((minY + maxY) / 2)
  }

  // 边界修正
  if (minX + offsetX < 0) offsetX = -minX
  if (minY + offsetY < 0) offsetY = -minY
  if (maxX + offsetX >= targetSize) offsetX = targetSize - 1 - maxX
  if (maxY + offsetY >= targetSize) offsetY = targetSize - 1 - maxY

  // 最终检查
  if (minX + offsetX < 0 || maxX + offsetX >= targetSize ||
      minY + offsetY < 0 || maxY + offsetY >= targetSize) {
    problem.view_region = null
    return problem
  }

  function shiftCoords(arr) {
    return arr.map(function(c) { return [c[0] + offsetX, c[1] + offsetY] })
  }
  problem.initial_stones = {
    black: shiftCoords(blackArr),
    white: shiftCoords(whiteArr)
  }
  if (problem.correct_sequences) {
    problem.correct_sequences = problem.correct_sequences.map(function(seq) {
      return seq.map(function(c) { return [c[0] + offsetX, c[1] + offsetY] })
    })
  }
  if (problem.all_solutions) {
    problem.all_solutions = problem.all_solutions.map(function(seq) {
      return seq.map(function(c) { return [c[0] + offsetX, c[1] + offsetY] })
    })
  }
  if (problem.correct_first_move) {
    problem.correct_first_move = [
      problem.correct_first_move[0] + offsetX,
      problem.correct_first_move[1] + offsetY
    ]
  }

  problem.board_size = targetSize
  problem.view_region = null
  return problem
}

function formatProblem(p) {
  var result = {
    problem_id: p.problem_id,
    category: p.category,
    difficulty_rating: p.difficulty_rating,
    board_size: p.board_size,
    description: p.description,
    expected_time_ms: p.expected_time_ms,
    initial_stones: p.initial_stones,
    view_region: p.view_region,
    correct_sequences: p.correct_sequences || p.all_solutions || [],
    level_tier: p.level_tier || getUserLevelTier(p.difficulty_rating),
    steps: p.steps || 0,
    hint: p.hint || '',
    source_file: p.source_file || '',
  }
  return adaptBoardSize(result)
}

// ========== 云函数入口 ==========

exports.main = async function(event, context) {
  var wxContext = cloud.getWXContext()
  var openid = wxContext.OPENID

  console.log('goDaily called, action:', event.action, 'openid:', openid)

  // 调试接口：需要管理员身份
  if (event.action === 'debug') {
    if (!openid) return { error: '未授权' }
    var debugUser = await db.collection('users').where({ _openid: openid }).field({ is_admin: true }).get()
    if (!debugUser.data.length || !debugUser.data[0].is_admin) return { error: '需要管理员权限' }
    try {
      var pCount = await db.collection('problems').count()
      return { version: 'v4.7.1', problems_count: pCount.total, timestamp: new Date().toISOString() }
    } catch (e) {
      return { debug_error: e.message || String(e) }
    }
  }

  if (!openid) {
    return { error: '无法获取用户身份' }
  }

  var action = event.action

  try {
    if (action === 'initUser') {
      return await initUser(openid, event.wx_nickname)
    } else if (action === 'setLevel') {
      return await setLevel(openid, event.level_name, event.rating)
    } else if (action === 'getHome') {
      return await getHomeFast(openid)
    } else if (action === 'getDaily') {
      return await getDaily(openid)
    } else if (action === 'submitAnswer') {
      return await submitAnswer(openid, event)
    } else if (action === 'getContinueProblem') {
      return await getContinueProblem(openid)
    } else if (action === 'getStats') {
      return await getStats(openid)
    } else if (action === 'buyStreakFreeze') {
      return await buyStreakFreeze(openid)
    } else if (action === 'getLeaderboard') {
      return await getLeaderboard()
    } else if (action === 'setUsername') {
      return await setUsername(openid, event.username)
    } else if (action === 'getRatingHistory') {
      return await getRatingHistory(openid)
    } else if (action === 'getCalendar') {
      return await getCalendar(openid, event.month)
    } else if (action === 'getVillageProgress') {
      return await getVillageProgress(openid)
    } else if (action === 'saveVillageProgress') {
      return await saveVillageProgress(openid, event.node_id, event.completed_level, event.scores)
    } else if (action === 'claimLoginChest') {
      return await claimLoginChest(openid)
    } else if (action === 'openChest') {
      return await openChest(openid, event.chest_index)
    } else {
      return { error: '未知操作' }
    }
  } catch (e) {
    console.error('goDaily error:', e)
    return { error: e.message || String(e) }
  }
}

// ========== 各 action 处理 ==========

async function initUser(openid, wxNickname) {
  var res = await db.collection('users').where({ _openid: openid }).get()

  if (res.data.length > 0) {
    var u = res.data[0]
    // 如果用户还没设昵称但传了微信昵称，自动设置
    if (!u.username && wxNickname) {
      await db.collection('users').where({ _openid: openid }).update({ data: { username: wxNickname } })
      u.username = wxNickname
    }
    return {
      user: {
        openid: openid,
        username: u.username || wxNickname || '',
        rating: typeof u.rating === 'number' ? u.rating : 520,
        rating_deviation: u.rating_deviation || 350,
        level_name: u.level_name || '7K',
        streak_days: u.streak_days || 0,
        total_solved: u.total_solved || 0,
        total_correct: u.total_correct || 0,
        level_set: u.level_set || false,
      }
    }
  }

  // 新用户
  var defaultName = wxNickname || ''
  await db.collection('users').add({
    data: {
      _openid: openid,
      username: defaultName,
      rating: 520,
      rating_deviation: 350,
      level_name: '7K',
      streak_days: 0,
      last_play_date: '',
      total_solved: 0,
      total_correct: 0,
      level_set: false,
      is_admin: false,
    }
  })

  return {
    user: {
      openid: openid,
      username: defaultName,
      rating: 520,
      rating_deviation: 350,
      level_name: '7K',
      streak_days: 0,
      total_solved: 0,
      total_correct: 0,
      level_set: false,
    }
  }
}

async function setLevel(openid, levelName) {
  // 只信任后端映射表，忽略前端传的 rating
  var LEVEL_RATINGS = {
    '7K': 520, '6K': 560, '5K': 600, '4K': 645, '3K': 695,
    '2K': 745, '1K': 795, '1D': 845, '2D': 900, '3D': 960,
  }
  var rating = typeof LEVEL_RATINGS[levelName] === 'number' ? LEVEL_RATINGS[levelName] : 520

  await db.collection('users').where({ _openid: openid }).update({
    data: { level_name: levelName, rating: rating, level_set: true }
  })

  return { user: { level_name: levelName, rating: rating, level_set: true } }
}

// 格式化 attempt 为前端需要的结构
function formatAttempt(a) {
  return { problem_id: a.problem_id, is_correct: a.is_correct, rating_change: a.rating_change }
}

// 构建 stats（不查 DB，用已查到的 user）
function buildStatsFromUser(user) {
  var rate = user.total_solved > 0 ? Math.round(user.total_correct / user.total_solved * 100) : 0
  return {
    username: user.username || '',
    rating: user.rating,
    level_name: user.level_name,
    streak_days: user.streak_days || 0,
    total_solved: user.total_solved || 0,
    total_correct: user.total_correct || 0,
    correct_rate: rate,
    is_admin: user.is_admin || false,
    coins: user.coins || 0,
    streak_freezes: user.streak_freezes || 0,
    chests: user.chests || [],
    last_chest_login: user.last_chest_login || '',
  }
}

// 首页合并接口：8-10次DB查询 → 3-4次
async function getHomeFast(openid) {
  var today = getTodayDate()

  // 查询1：用户信息
  var userRes = await db.collection('users').where({ _openid: openid }).get()
  if (userRes.data.length === 0) return { error: '用户不存在' }
  var user = userRes.data[0]

  // 查询2+3 并行：今日 session + 今日 attempts
  var sessionResP = db.collection('daily_sessions').where({
    _openid: openid, session_date: today,
  }).get()
  var attemptsResP = db.collection('attempts').where({
    _openid: openid, session_date: today,
  }).orderBy('attempted_at', 'asc').get()
  var pair = await Promise.all([sessionResP, attemptsResP])
  var sessionRes = pair[0]
  var attemptsRes = pair[1]

  var stats = buildStatsFromUser(user)

  // 已有 session
  if (sessionRes.data.length > 0) {
    var session = sessionRes.data[0]
    var problemIds = session.problem_ids || []

    // 本地题库模式
    if (session.useLocal) {
      return {
        stats: stats,
        daily: {
          session_date: today,
          problem_ids: problemIds,
          useLocalProblems: true,
          completed_count: session.completed_count || 0,
          results: attemptsRes.data.map(formatAttempt),
          total_completed: session.completed_count || 0,
        },
      }
    }

    // 查询4：一次性查3道题（_.in 批量）
    var problems = []
    if (problemIds.length > 0) {
      try {
        var pRes = await db.collection('problems')
          .where({ problem_id: _.in(problemIds) })
          .get()
        var pMap = {}
        pRes.data.forEach(function (p) { pMap[p.problem_id] = p })
        for (var i = 0; i < problemIds.length; i++) {
          if (pMap[problemIds[i]]) problems.push(formatProblem(pMap[problemIds[i]]))
        }
      } catch (e) {
        problems = []
      }
    }

    // 题目不够（部分被删），重建 session
    if (problems.length < 3 && problemIds.length > 0) {
      await db.collection('daily_sessions').where({ _openid: openid, session_date: today }).remove()
      return await getHomeFast(openid)
    }

    return {
      stats: stats,
      daily: {
        session_date: today,
        problem_ids: problemIds,
        problems: problems,
        completed_count: session.completed_count || 0,
        results: attemptsRes.data.map(formatAttempt),
        total_completed: session.completed_count || 0,
      },
    }
  }

  // 新建 session：用已查到的 attempts 做排除
  var recentIds = attemptsRes.data.map(function (a) { return a.problem_id })
  var selectedProblems = await selectProblemsFromDB(user.rating, recentIds, openid)
  var newProblemIds = selectedProblems.map(function (p) { return p.problem_id })

  await db.collection('daily_sessions').add({
    data: {
      _openid: openid,
      session_date: today,
      problem_ids: newProblemIds,
      completed_count: 0,
      total_rating_change: 0,
    },
  })

  return {
    stats: stats,
    daily: {
      session_date: today,
      problem_ids: newProblemIds,
      problems: selectedProblems.map(formatProblem),
      completed_count: 0,
      results: [],
      total_completed: 0,
    },
  }
}

async function getDaily(openid) {
  var today = getTodayDate()

  var userRes = await db.collection('users').where({ _openid: openid }).get()
  if (userRes.data.length === 0) return { error: '用户不存在' }
  var user = userRes.data[0]

  // 检查已有 session
  var sessionRes = await db.collection('daily_sessions').where({
    _openid: openid,
    session_date: today,
  }).get()

  if (sessionRes.data.length > 0) {
    var session = sessionRes.data[0]
    var resultsRes = await db.collection('attempts').where({
      _openid: openid,
      session_date: today,
    }).orderBy('attempted_at', 'asc').get()

    // 如果 session 标记了 useLocal，返回本地标记
    if (session.useLocal) {
      return {
        session_date: today,
        problem_ids: session.problem_ids,
        useLocalProblems: true,
        completed_count: session.completed_count || 0,
        results: resultsRes.data.map(function(a) {
          return { problem_id: a.problem_id, is_correct: a.is_correct, rating_change: a.rating_change }
        }),
        total_completed: session.completed_count || 0,
      }
    }

    // 从云数据库获取完整题目
    var problemIds = session.problem_ids || []
    var problems = []
    try {
      for (var i = 0; i < problemIds.length; i++) {
        var pRes = await db.collection('problems').where({ problem_id: problemIds[i] }).limit(1).get()
        if (pRes.data.length > 0) {
          problems.push(formatProblem(pRes.data[0]))
        }
      }
    } catch (e) {
      // problems 集合不存在，返回空列表触发重新选题
      problems = []
    }

    // 如果题目不够（部分被删），删除旧 session 重新选题
    if (problems.length < 3 && problemIds.length > 0) {
      console.log('session 题目不足 (' + problems.length + '/' + problemIds.length + '), 重建')
      await db.collection('daily_sessions').where({ _openid: openid, session_date: today }).remove()
      return await getDaily(openid)
    }

    return {
      session_date: today,
      problem_ids: problemIds,
      problems: problems,
      completed_count: session.completed_count || 0,
      results: resultsRes.data.map(function(a) {
        return { problem_id: a.problem_id, is_correct: a.is_correct, rating_change: a.rating_change }
      }),
      total_completed: session.completed_count || 0,
    }
  }

  // 新建 session — 先检查云数据库有没有题目
  var hasProblems = false
  try {
    var checkProblems = await db.collection('problems').limit(1).get()
    hasProblems = checkProblems.data.length > 0
  } catch (e) {
    hasProblems = false
  }

  if (!hasProblems) {
    // 云数据库没有题目，使用本地题库
    // 从本地200题中随机选3题（由客户端处理）
    var localIds = []
    var usedLocal = {}
    while (localIds.length < 3) {
      var r = Math.floor(Math.random() * 200)
      if (!usedLocal[r]) { localIds.push(r); usedLocal[r] = true }
    }

    await db.collection('daily_sessions').add({
      data: {
        _openid: openid,
        session_date: today,
        problem_ids: localIds,
        useLocal: true,
        completed_count: 0,
        total_rating_change: 0,
      }
    })

    return {
      session_date: today,
      problem_ids: localIds,
      useLocalProblems: true,
      completed_count: 0,
      results: [],
      total_completed: 0,
    }
  }

  // 云数据库有题目，按 rating 匹配选题
  var recentRes = await db.collection('attempts').where({ _openid: openid }).orderBy('attempted_at', 'desc').limit(20).get()
  var recentIds = recentRes.data.map(function(a) { return a.problem_id })
  var recentAttempts = recentRes.data.slice(0, 20) // last 20 for accuracy calc
  var selectedProblems = await selectProblemsFromDB(user.rating, recentIds, openid)
  var problemIds = selectedProblems.map(function(p) { return p.problem_id })

  await db.collection('daily_sessions').add({
    data: {
      _openid: openid,
      session_date: today,
      problem_ids: problemIds,
      completed_count: 0,
      total_rating_change: 0,
    }
  })

  return {
    session_date: today,
    problem_ids: problemIds,
    problems: selectedProblems.map(formatProblem),
    completed_count: 0,
    results: [],
    total_completed: 0,
  }
}

async function submitAnswer(openid, event) {
  var today = getTodayDate()

  var userRes = await db.collection('users').where({ _openid: openid }).get()
  if (userRes.data.length === 0) return { error: '用户不存在' }
  var user = userRes.data[0]

  var problemRating = event.problem_rating || user.rating
  var result = calculateRating(
    user.rating, user.rating_deviation || 350, problemRating, event.is_correct
  )

  var newRating = Math.max(520, user.rating + result.change)
  var newLevel = getLevelName(newRating)

  // 连续打卡 + Streak Freeze
  var streakDays = user.streak_days || 0
  var freezes = user.streak_freezes || 0
  var usedFreeze = false
  var lastPlay = user.last_play_date || ''
  if (lastPlay !== today) {
    var yd = new Date(new Date().getTime() + 8 * 3600000 - 86400000)
    var ydStr = yd.toISOString().slice(0, 10)
    if (lastPlay === ydStr) {
      // 昨天做过，正常+1
      streakDays = streakDays + 1
    } else if (freezes > 0 && lastPlay) {
      // 断签但有freeze，消耗1个freeze保持streak
      streakDays = streakDays + 1
      usedFreeze = true
    } else {
      // 断签且无freeze，streak归1
      streakDays = 1
    }
  }

  await db.collection('attempts').add({
    data: {
      _openid: openid, problem_id: event.problem_id, session_date: today,
      is_correct: event.is_correct, time_spent_ms: event.time_spent_ms,
      moves: event.moves || [], rating_before: user.rating,
      rating_after: newRating, rating_change: result.change,
      attempted_at: new Date(),
    }
  })

  // 错题本：做错记录到 wrong_book（间隔重复：1天→3天→7天）
  if (!event.is_correct) {
    var existWrong = await db.collection('wrong_book').where({
      _openid: openid, problem_id: event.problem_id
    }).get()
    if (existWrong.data.length > 0) {
      var wb = existWrong.data[0]
      var wrongCount = (wb.wrong_count || 1) + 1
      var intervalDays = wrongCount <= 2 ? 1 : wrongCount <= 3 ? 3 : 7
      var nextReview = new Date(Date.now() + intervalDays * 86400000)
      await db.collection('wrong_book').doc(wb._id).update({
        data: { wrong_count: wrongCount, next_review: nextReview, last_wrong: new Date() }
      })
    } else {
      await db.collection('wrong_book').add({ data: {
        _openid: openid, problem_id: event.problem_id,
        wrong_count: 1, next_review: new Date(Date.now() + 86400000),
        last_wrong: new Date(), created: new Date(),
      }})
    }
  } else {
    // 做对了，从错题本移除
    try { await db.collection('wrong_book').where({ _openid: openid, problem_id: event.problem_id }).remove() } catch(e) {}
  }

  var userUpdate = {
    rating: newRating, rating_deviation: result.newRD,
    level_name: newLevel, streak_days: streakDays,
    last_play_date: today,
    total_solved: _.inc(1),
    total_correct: event.is_correct ? _.inc(1) : _.inc(0),
  }
  if (usedFreeze) userUpdate.streak_freezes = _.inc(-1)
  await db.collection('users').where({ _openid: openid }).update({ data: userUpdate })

  // 获取 session 来判断金币
  var sessionRes2 = await db.collection('daily_sessions').where({ _openid: openid, session_date: today }).get()
  var session = sessionRes2.data.length > 0 ? sessionRes2.data[0] : null
  var completedBefore = session ? (session.completed_count || 0) : 0

  await db.collection('daily_sessions').where({ _openid: openid, session_date: today }).update({
    data: { completed_count: _.inc(1), total_rating_change: _.inc(result.change) }
  })

  // 金币奖励逻辑
  var coinsEarned = 0
  var coinReason = ''
  var completedAfter = completedBefore + 1

  if (completedAfter === 3) {
    // 完成今日3题打卡: +10 金币
    coinsEarned = 10
    coinReason = '完成打卡'

    // 检查3题全对: 额外+5
    var todayAttempts = await db.collection('attempts').where({ _openid: openid, session_date: today }).get()
    var allCorrect = todayAttempts.data.length >= 3 && todayAttempts.data.every(function(a) { return a.is_correct })
    if (allCorrect && event.is_correct) {
      coinsEarned += 5
      coinReason = '全对打卡'
    }

    // 连续7天打卡: 额外+20
    if (streakDays > 0 && streakDays % 7 === 0) {
      coinsEarned += 20
      coinReason += ' + 7天连续'
    }
  }

  if (coinsEarned > 0) {
    await db.collection('users').where({ _openid: openid }).update({
      data: { coins: _.inc(coinsEarned) }
    })
  }

  // 完成3题额外掉宝箱
  var chestDropped = null
  if (completedAfter === 3) {
    var drop = await tryDropCompletionChest(openid, user)
    chestDropped = drop.dropped
  }

  return {
    is_correct: event.is_correct, rating_change: result.change,
    new_rating: newRating, new_level: newLevel,
    level_changed: newLevel !== user.level_name, streak_days: streakDays,
    used_freeze: usedFreeze,
    coins_earned: coinsEarned, coin_reason: coinReason,
    total_coins: (user.coins || 0) + coinsEarned,
    chest_dropped: chestDropped,
  }
}

async function getContinueProblem(openid) {
  var userRes = await db.collection('users').where({ _openid: openid }).get()
  if (userRes.data.length === 0) return { error: '用户不存在' }
  var user = userRes.data[0]

  // Exclude today's session problems + recent 90
  var today = getTodayDate()
  var sessionRes = await db.collection('daily_sessions').where({
    _openid: openid, session_date: today,
  }).get()
  var sessionIds = sessionRes.data.length > 0 ? (sessionRes.data[0].problem_ids || []) : []

  var recentRes = await db.collection('attempts').where({ _openid: openid }).orderBy('attempted_at', 'desc').limit(20).get()
  var excludeIds = recentRes.data.map(function(a) { return a.problem_id }).concat(sessionIds)

  var problem = null
  try {
    problem = await pickContinueProblem(user.rating, excludeIds)
  } catch (e) {
    return { error: '题库暂未就绪' }
  }
  if (!problem) return { error: '没有更多题目了' }

  return { problem: formatProblem(problem) }
}

async function getStats(openid) {
  var userRes = await db.collection('users').where({ _openid: openid }).get()
  if (userRes.data.length === 0) return { error: '用户不存在' }
  return buildStatsFromUser(userRes.data[0])
}

async function buyStreakFreeze(openid) {
  var userRes = await db.collection('users').where({ _openid: openid }).get()
  if (userRes.data.length === 0) return { error: '用户不存在' }
  var user = userRes.data[0]

  var coins = user.coins || 0
  var freezes = user.streak_freezes || 0
  var cost = 50

  if (freezes >= 2) return { error: '最多持有2个 Streak Freeze' }
  if (coins < cost) return { error: '金币不足，需要' + cost + '金币' }

  await db.collection('users').where({ _openid: openid }).update({
    data: { coins: _.inc(-cost), streak_freezes: _.inc(1) }
  })

  return { ok: true, coins: coins - cost, streak_freezes: freezes + 1 }
}

async function getLeaderboard(type) {
  // type: 'daily', 'weekly', 'monthly', 默认 'daily'
  type = type || 'daily'

  // 按 rating 排名 (后续可改为按 change 排名)
  var res = await db.collection('users')
    .orderBy('rating', 'desc')
    .limit(50)
    .field({ username: true, rating: true, level_name: true, streak_days: true, total_solved: true })
    .get()

  return {
    type: type,
    leaderboard: res.data.map(function(u, i) {
      return {
        rank: i + 1,
        username: u.username || '匿名棋手',
        rating: u.rating || 0,
        level_name: u.level_name || '',
        streak_days: u.streak_days || 0,
        total_solved: u.total_solved || 0,
      }
    })
  }
}

async function setUsername(openid, username) {
  if (!username || username.length > 12) return { error: '昵称无效' }
  await db.collection('users').where({ _openid: openid }).update({
    data: { username: username }
  })
  return { ok: true, username: username }
}

async function getRatingHistory(openid) {
  // 取最近30天每天最后一次答题的 rating
  var res = await db.collection('attempts')
    .where({ _openid: openid })
    .orderBy('attempted_at', 'desc')
    .limit(200)
    .field({ session_date: true, rating_after: true, attempted_at: true })
    .get()

  // 按日期聚合，取每天最后一次的 rating_after
  var dateMap = {}
  for (var i = 0; i < res.data.length; i++) {
    var d = res.data[i]
    var date = d.session_date
    if (!dateMap[date]) {
      dateMap[date] = d.rating_after || 0
    }
  }

  // 转成数组排序
  var points = []
  for (var key in dateMap) {
    points.push({ date: key, rating: dateMap[key] })
  }
  points.sort(function(a, b) { return a.date < b.date ? -1 : 1 })

  // 只取最近30个
  if (points.length > 30) points = points.slice(points.length - 30)

  return { history: points }
}

async function getCalendar(openid, month) {
  // month = "2026-04"
  if (!month) return { dates: [] }
  var startDate = month + '-01'
  var parts = month.split('-')
  var y = parseInt(parts[0]), m = parseInt(parts[1])
  var endDate = m < 12
    ? y + '-' + String(m + 1).padStart(2, '0') + '-01'
    : (y + 1) + '-01-01'

  var res = await db.collection('daily_sessions').where({
    _openid: openid,
    session_date: _.gte(startDate).and(_.lt(endDate)),
    completed_count: _.gte(1),
  }).field({ session_date: true }).limit(31).get()

  return { dates: res.data.map(function(d) { return d.session_date }) }
}

// ========== 新手村 ==========
// 当前新手村使用本地 beginner-puzzles.js 题库（打包在小程序里），
// 只保留进度同步相关的云函数。

async function getVillageProgress(openid) {
  var res = await db.collection('users').where({ _openid: openid }).field({ village_progress: true }).get()
  if (res.data.length === 0) return { village_progress: {} }
  return { village_progress: res.data[0].village_progress || {} }
}

async function saveVillageProgress(openid, nodeId, completedLevel, scores) {
  if (!nodeId) return { error: '缺少 node_id' }

  var updateData = {}
  updateData['village_progress.' + nodeId] = {
    completedLevel: completedLevel || 0,
    scores: scores || {},
    updated_at: new Date(),
  }

  await db.collection('users').where({ _openid: openid }).update({
    data: updateData,
  })

  return { ok: true }
}

// ========== 宝箱系统 ==========

// 根据连续登录天数决定登录宝箱类型
function getLoginChestType(streakDays) {
  // 1-8 天循环: 木木银银银银金木...
  var cycle = ((streakDays - 1) % 7) + 1
  if (cycle <= 2) return 'wood'
  if (cycle <= 6) return 'silver'
  return 'gold'
}

// 随机掉落宝箱类型 (70%木/25%银/5%金)
function randomChestType() {
  var r = Math.random()
  if (r < 0.05) return 'gold'
  if (r < 0.30) return 'silver'
  return 'wood'
}

// 箱子金币数
function chestCoinAmount(type) {
  if (type === 'gold') return 50 + Math.floor(Math.random() * 51)    // 50-100
  if (type === 'silver') return 15 + Math.floor(Math.random() * 16)  // 15-30
  return 5 + Math.floor(Math.random() * 6)                            // 5-10
}

// 每日登录奖励
async function claimLoginChest(openid) {
  var userRes = await db.collection('users').where({ _openid: openid }).get()
  if (userRes.data.length === 0) return { error: '用户不存在' }
  var user = userRes.data[0]

  var today = getTodayDate()

  // 已经领过了
  if (user.last_chest_login === today) {
    return {
      already_claimed: true,
      chests: user.chests || [],
    }
  }

  // 宝箱栏满了
  var chests = user.chests || []
  if (chests.length >= 4) {
    await db.collection('users').where({ _openid: openid }).update({
      data: { last_chest_login: today }
    })
    return {
      full: true,
      chests: chests,
    }
  }

  // 发放登录宝箱
  var streakDays = user.streak_days || 1
  var chestType = getLoginChestType(streakDays)
  var newChest = {
    type: chestType,
    source: 'login',
    created_at: new Date().toISOString(),
    opened: false,
  }
  chests.push(newChest)

  await db.collection('users').where({ _openid: openid }).update({
    data: {
      chests: chests,
      last_chest_login: today,
    }
  })

  return {
    new_chest: newChest,
    new_chest_index: chests.length - 1,  // push 到末尾，索引为 length-1
    chests: chests,
    streak_days: streakDays,
  }
}

// 打开宝箱
async function openChest(openid, chestIndex) {
  var userRes = await db.collection('users').where({ _openid: openid }).get()
  if (userRes.data.length === 0) return { error: '用户不存在' }
  var user = userRes.data[0]

  var chests = user.chests || []
  if (typeof chestIndex !== 'number' || chestIndex < 0 || chestIndex >= chests.length) {
    return { error: '宝箱不存在' }
  }
  var chest = chests[chestIndex]
  if (chest.opened) return { error: '宝箱已打开' }

  // 计算金币
  var amount = chestCoinAmount(chest.type)

  // 移除已打开的宝箱
  chests.splice(chestIndex, 1)

  await db.collection('users').where({ _openid: openid }).update({
    data: {
      chests: chests,
      coins: _.inc(amount),
    }
  })

  return {
    amount: amount,
    type: chest.type,
    chests: chests,
    total_coins: (user.coins || 0) + amount,
  }
}

// 尝试掉落完成宝箱(供 submitAnswer 完成3题时调用)
async function tryDropCompletionChest(openid, user) {
  var chests = user.chests || []
  if (chests.length >= 4) {
    return { dropped: null, chests: chests }
  }
  var chestType = randomChestType()
  var newChest = {
    type: chestType,
    source: 'complete',
    created_at: new Date().toISOString(),
    opened: false,
  }
  chests.push(newChest)
  await db.collection('users').where({ _openid: openid }).update({
    data: { chests: chests }
  })
  return { dropped: newChest, chests: chests }
}

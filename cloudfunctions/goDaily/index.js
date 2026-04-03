// 云函数入口
const cloud = require('wx-server-sdk')

cloud.init({
  env: 'cloud1-2gna4pn73d7fe81e'
})

const db = cloud.database()
const _ = db.command

// ========== 工具函数 ==========

// 完整30级等级分表（参照完整方案.md）
var LEVEL_TIERS = [
  [0, '25K'], [20, '24K'], [40, '23K'], [60, '22K'], [80, '21K'],
  [100, '20K'], [125, '19K'], [150, '18K'], [175, '17K'], [200, '16K'],
  [225, '15K'], [250, '14K'], [275, '13K'], [300, '12K'], [330, '11K'],
  [360, '10K'], [390, '9K'], [420, '8K'], [450, '7K'], [485, '6K'],
  [520, '5K'], [555, '4K'], [595, '3K'], [635, '2K'], [675, '1K'],
  [720, '1D'], [770, '2D'], [825, '3D'], [885, '4D'], [950, '5D'],
]

function getLevelName(rating) {
  if (rating < 0) return '25K'
  for (var i = LEVEL_TIERS.length - 1; i >= 0; i--) {
    if (rating >= LEVEL_TIERS[i][0]) return LEVEL_TIERS[i][1]
  }
  return '25K'
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
  // 等级分最低为0
  if (userRating + change < 0) change = -userRating
  return { change: change, newRD: userRD || 350 }
}

// 根据用户rating获取对应的level_tier
function getUserLevelTier(rating) {
  if (rating < 360) return 'beginner'    // 25K-10K
  if (rating < 675) return 'elementary'  // 10K-1K
  if (rating < 825) return 'intermediate' // 1K-3D
  return 'advanced'                       // 3D+
}

// Pick one random problem from a rating range, excluding used IDs
// 从指定 rating 范围随机选1题（排除已做过的）
async function pickFromDB(minR, maxR, exclude) {
  var where = { difficulty_rating: _.gte(minR).and(_.lte(maxR)) }
  var countRes = await db.collection('problems').where(where).count()
  var total = countRes.total
  if (total === 0) return null

  for (var attempt = 0; attempt < 3; attempt++) {
    var skip = Math.floor(Math.random() * Math.max(0, total - 5))
    var res = await db.collection('problems').where(where)
      .skip(skip).limit(10).get()
    var cands = res.data.filter(function(p) { return !exclude[p.problem_id] })
    if (cands.length > 0) {
      var picked = cands[Math.floor(Math.random() * cands.length)]
      exclude[picked.problem_id] = true
      return picked
    }
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

// 出题策略（参照完整方案 3.1 + 3.2 错题本）
// 70% 同级题（±30），20% 挑战题（+30~+90），10% 简单题（-30~-90）
// 优先出错题本中到期的题
async function selectProblemsFromDB(userRating, recentIds, openid) {
  var exclude = {}
  if (recentIds) {
    for (var i = 0; i < recentIds.length; i++) exclude[recentIds[i]] = true
  }

  var selected = []

  // 先从错题本中选到期的题（最多1道）
  try {
    var wrongRes = await db.collection('wrong_book').where({
      _openid: openid,
      next_review: _.lte(new Date()),
    }).orderBy('next_review', 'asc').limit(3).get()

    for (var wi = 0; wi < wrongRes.data.length && selected.length < 1; wi++) {
      var wPid = wrongRes.data[wi].problem_id
      if (exclude[wPid]) continue
      var wProbRes = await db.collection('problems').where({ problem_id: wPid }).limit(1).get()
      if (wProbRes.data.length > 0) {
        selected.push(wProbRes.data[0])
        exclude[wPid] = true
      }
    }
  } catch (e) {
    // wrong_book 集合可能不存在，忽略
  }

  // 按方案的 70/20/10 分配剩余题：同级 + 挑战/简单
  var tiers = [
    [Math.max(0, userRating - 30), userRating + 30],  // 同级题1
    [Math.max(0, userRating - 30), userRating + 30],  // 同级题2
    [userRating + 30, userRating + 90],                // 挑战题
  ]
  // 随机决定第3题是挑战还是简单（80%挑战 20%简单）
  if (Math.random() < 0.3) {
    tiers[2] = [Math.max(0, userRating - 90), Math.max(0, userRating - 30)]
  }

  for (var i = 0; i < tiers.length && selected.length < 3; i++) {
    var p = await pickFromDB(tiers[i][0], tiers[i][1], exclude)
    if (p) selected.push(p)
  }

  // Fallback: 如果题不够，逐步放宽范围
  var fallbackRanges = [
    [Math.max(0, userRating - 60), userRating + 60],
    [Math.max(0, userRating - 120), userRating + 120],
    [0, 950],
  ]
  var fi = 0
  while (selected.length < 3 && fi < fallbackRanges.length) {
    var p = await pickFromDB(fallbackRanges[fi][0], fallbackRanges[fi][1], exclude)
    if (p) { selected.push(p); continue }
    fi++
  }

  return selected
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
function formatProblem(p) {
  return {
    problem_id: p.problem_id,
    category: p.category,
    difficulty_rating: p.difficulty_rating,
    board_size: p.board_size,
    description: p.description,
    expected_time_ms: p.expected_time_ms,
    initial_stones: p.initial_stones,
    view_region: p.view_region,
    correct_sequences: p.correct_sequences,
    level_tier: p.level_tier || getUserLevelTier(p.difficulty_rating),
    steps: p.steps || 0,
    hint: p.hint || '',
  }
}

// ========== 云函数入口 ==========

exports.main = async function(event, context) {
  var wxContext = cloud.getWXContext()
  var openid = wxContext.OPENID

  console.log('goDaily called, action:', event.action, 'openid:', openid)

  // 调试接口：不需要 openid
  if (event.action === 'debug') {
    try {
      var pCount = await db.collection('problems').count()
      var sample = await db.collection('problems').limit(1).get()
      var sCount = await db.collection('daily_sessions').count()
      return {
        version: 'v4.0.5_20260403',
        problems_count: pCount.total,
        sessions_count: sCount.total,
        sample_problem: sample.data.length > 0 ? {
          id: sample.data[0].problem_id,
          rating: sample.data[0].difficulty_rating,
          has_stones: !!(sample.data[0].initial_stones),
          has_seqs: !!(sample.data[0].correct_sequences),
        } : null,
        env: 'cloud1-2gna4pn73d7fe81e',
        timestamp: new Date().toISOString(),
      }
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
      return await initUser(openid)
    } else if (action === 'setLevel') {
      return await setLevel(openid, event.level_name, event.rating)
    } else if (action === 'getDaily') {
      return await getDaily(openid)
    } else if (action === 'submitAnswer') {
      return await submitAnswer(openid, event)
    } else if (action === 'getContinueProblem') {
      return await getContinueProblem(openid)
    } else if (action === 'resetSession') {
      var today = getTodayDate()
      await db.collection('daily_sessions').where({ _openid: openid, session_date: today }).remove()
      return { ok: true }
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
    } else {
      return { error: '未知操作' }
    }
  } catch (e) {
    console.error('goDaily error:', e)
    return { error: e.message || String(e) }
  }
}

// ========== 各 action 处理 ==========

async function initUser(openid) {
  var res = await db.collection('users').where({ _openid: openid }).get()

  if (res.data.length > 0) {
    var u = res.data[0]
    return {
      user: {
        openid: openid,
        username: u.username || '',
        rating: typeof u.rating === 'number' ? u.rating : 0,
        rating_deviation: u.rating_deviation || 350,
        level_name: u.level_name || '25K',
        streak_days: u.streak_days || 0,
        total_solved: u.total_solved || 0,
        total_correct: u.total_correct || 0,
        level_set: u.level_set || false,
      }
    }
  }

  // 新用户
  await db.collection('users').add({
    data: {
      _openid: openid,
      username: '',
      rating: 0,
      rating_deviation: 350,
      level_name: '25K',
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
      username: '',
      rating: 0,
      rating_deviation: 350,
      level_name: '25K',
      streak_days: 0,
      total_solved: 0,
      total_correct: 0,
      level_set: false,
    }
  }
}

async function setLevel(openid, levelName, clientRating) {
  // 优先用前端传来的 rating（因为云函数部署可能有延迟）
  var LEVEL_RATINGS = {
    '25K': 0, '20K': 100, '10K': 360, '1K': 675,
    '25级': 0, '20级': 100, '10级': 360, '1级': 675,
  }
  var rating = typeof clientRating === 'number' ? clientRating :
               typeof LEVEL_RATINGS[levelName] === 'number' ? LEVEL_RATINGS[levelName] : 100

  await db.collection('users').where({ _openid: openid }).update({
    data: { level_name: levelName, rating: rating, level_set: true }
  })

  return { user: { level_name: levelName, rating: rating, level_set: true } }
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
  var recentRes = await db.collection('attempts').where({ _openid: openid }).orderBy('attempted_at', 'desc').limit(90).get()
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

  var newRating = Math.max(0, user.rating + result.change)
  var newLevel = getLevelName(newRating)

  // 连续打卡
  var streakDays = user.streak_days || 0
  var lastPlay = user.last_play_date || ''
  if (lastPlay !== today) {
    var yd = new Date(new Date().getTime() + 8 * 3600000 - 86400000)
    var ydStr = yd.toISOString().slice(0, 10)
    streakDays = (lastPlay === ydStr) ? streakDays + 1 : 1
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
        wrong_count: wrongCount, next_review: nextReview, last_wrong: new Date()
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

  await db.collection('users').where({ _openid: openid }).update({
    data: {
      rating: newRating, rating_deviation: result.newRD,
      level_name: newLevel, streak_days: streakDays,
      last_play_date: today,
      total_solved: _.inc(1),
      total_correct: event.is_correct ? _.inc(1) : _.inc(0),
    }
  })

  // 获取 session 来判断棋币
  var sessionRes2 = await db.collection('daily_sessions').where({ _openid: openid, session_date: today }).get()
  var session = sessionRes2.data.length > 0 ? sessionRes2.data[0] : null
  var completedBefore = session ? (session.completed_count || 0) : 0

  await db.collection('daily_sessions').where({ _openid: openid, session_date: today }).update({
    data: { completed_count: _.inc(1), total_rating_change: _.inc(result.change) }
  })

  // 棋币奖励逻辑
  var coinsEarned = 0
  var coinReason = ''
  var completedAfter = completedBefore + 1

  if (completedAfter === 3) {
    // 完成今日3题打卡: +10 棋币
    coinsEarned = 10
    coinReason = '完成打卡'

    // 检查3题全对: 额外+5
    var todayAttempts = await db.collection('attempts').where({ _openid: openid, session_date: today }).get()
    var allCorrect = todayAttempts.data.length >= 2 && todayAttempts.data.every(function(a) { return a.is_correct })
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

  return {
    is_correct: event.is_correct, rating_change: result.change,
    new_rating: newRating, new_level: newLevel,
    level_changed: newLevel !== user.level_name, streak_days: streakDays,
    coins_earned: coinsEarned, coin_reason: coinReason,
    total_coins: (user.coins || 0) + coinsEarned,
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

  var recentRes = await db.collection('attempts').where({ _openid: openid }).orderBy('attempted_at', 'desc').limit(90).get()
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
  var user = userRes.data[0]
  var rate = user.total_solved > 0 ? Math.round(user.total_correct / user.total_solved * 100) : 0

  var problemsTotal = 0
  try {
    var countRes = await db.collection('problems').count()
    problemsTotal = countRes.total
  } catch (e) {}

  return {
    username: user.username || '', rating: user.rating,
    level_name: user.level_name, streak_days: user.streak_days || 0,
    total_solved: user.total_solved || 0, total_correct: user.total_correct || 0,
    correct_rate: rate, is_admin: user.is_admin || false,
    problems_total: problemsTotal,
    coins: user.coins || 0,
    streak_freezes: user.streak_freezes || 0,
  }
}

async function buyStreakFreeze(openid) {
  var userRes = await db.collection('users').where({ _openid: openid }).get()
  if (userRes.data.length === 0) return { error: '用户不存在' }
  var user = userRes.data[0]

  var coins = user.coins || 0
  var freezes = user.streak_freezes || 0
  var cost = 50

  if (freezes >= 2) return { error: '最多持有2个 Streak Freeze' }
  if (coins < cost) return { error: '棋币不足，需要' + cost + '棋币' }

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
    .field({ _openid: true, username: true, rating: true, level_name: true, streak_days: true, total_solved: true })
    .get()

  return {
    type: type,
    leaderboard: res.data.map(function(u, i) {
      return {
        rank: i + 1,
        openid: u._openid,
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

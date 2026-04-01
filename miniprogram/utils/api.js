// Cloud development API - calls goDaily cloud function
function callCloud(action, data) {
  return wx.cloud.callFunction({
    name: 'goDaily',
    data: Object.assign({ action: action }, data || {}),
  }).then(function(res) {
    if (res.result && res.result.error) {
      throw new Error(res.result.error)
    }
    return res.result
  })
}

var api = {
  // Initialize user - get or create by openid
  initUser: function() {
    return callCloud('initUser')
  },

  // Set display name
  setUsername: function(username) {
    return callCloud('setUsername', { username: username })
  },

  // Set level (one-time)
  setLevel: function(levelName) {
    return callCloud('setLevel', { level_name: levelName })
  },

  // Get today's 3 problems (returns problem IDs + session info)
  getDaily: function() {
    return callCloud('getDaily')
  },

  // Submit answer for a problem
  submitAnswer: function(problemId, moves, timeSpentMs, isCorrect, problemRating, expectedTimeMs) {
    return callCloud('submitAnswer', {
      problem_id: problemId,
      moves: moves,
      time_spent_ms: timeSpentMs,
      is_correct: isCorrect,
      problem_rating: problemRating,
      expected_time_ms: expectedTimeMs,
    })
  },

  // Get a single fresh problem for continuation practice
  getContinueProblem: function() {
    return callCloud('getContinueProblem')
  },

  // Get user stats
  getStats: function() {
    return callCloud('getStats')
  },

  // Buy streak freeze (50 coins)
  buyStreakFreeze: function() {
    return callCloud('buyStreakFreeze')
  },

  // Get leaderboard (top 20)
  getLeaderboard: function() {
    return callCloud('getLeaderboard')
  },

  // Get rating history (last 30 days)
  getRatingHistory: function() {
    return callCloud('getRatingHistory')
  },
}

module.exports = {
  api: api,
}

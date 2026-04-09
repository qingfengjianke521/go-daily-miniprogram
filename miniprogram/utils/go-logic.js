/**
 * Go (Weiqi) game logic - ported from go-logic.ts
 * Coordinate convention: (0,0) = top-left, x right, y down
 * Colors: 'black' | 'white' | null
 */

function createBoard(size) {
  var board = []
  for (var i = 0; i < size; i++) {
    var row = []
    for (var j = 0; j < size; j++) {
      row.push(null)
    }
    board.push(row)
  }
  return board
}

// 把 {black:[[x,y]], white:[[x,y]]} 格式转成 [{x,y,color}] 格式
function normalizeStones(stones) {
  if (!stones) return []
  if (Array.isArray(stones)) return stones
  var arr = []
  if (stones.black) {
    for (var i = 0; i < stones.black.length; i++) {
      arr.push({ x: stones.black[i][0], y: stones.black[i][1], color: 'black' })
    }
  }
  if (stones.white) {
    for (var j = 0; j < stones.white.length; j++) {
      arr.push({ x: stones.white[j][0], y: stones.white[j][1], color: 'white' })
    }
  }
  return arr
}

function placeStones(board, stones) {
  var arr = normalizeStones(stones)
  var newBoard = board.map(function (row) { return row.slice() })
  for (var i = 0; i < arr.length; i++) {
    var s = arr[i]
    if (s && typeof s.x === 'number' && typeof s.y === 'number') {
      newBoard[s.y][s.x] = s.color
    }
  }
  return newBoard
}

function getNeighbors(x, y, size) {
  var pts = []
  if (x > 0) pts.push({ x: x - 1, y: y })
  if (x < size - 1) pts.push({ x: x + 1, y: y })
  if (y > 0) pts.push({ x: x, y: y - 1 })
  if (y < size - 1) pts.push({ x: x, y: y + 1 })
  return pts
}

function getGroup(board, x, y) {
  var size = board.length
  var color = board[y][x]
  if (color === null) return []

  var visited = {}
  var group = []
  var stack = [{ x: x, y: y }]

  while (stack.length > 0) {
    var p = stack.pop()
    var key = p.x + ',' + p.y
    if (visited[key]) continue
    visited[key] = true
    group.push(p)

    var neighbors = getNeighbors(p.x, p.y, size)
    for (var i = 0; i < neighbors.length; i++) {
      var n = neighbors[i]
      var nKey = n.x + ',' + n.y
      if (!visited[nKey] && board[n.y][n.x] === color) {
        stack.push(n)
      }
    }
  }

  return group
}

function getLiberties(board, x, y) {
  var size = board.length
  var group = getGroup(board, x, y)
  if (group.length === 0) return 0

  var libertySet = {}
  for (var i = 0; i < group.length; i++) {
    var p = group[i]
    var neighbors = getNeighbors(p.x, p.y, size)
    for (var j = 0; j < neighbors.length; j++) {
      var n = neighbors[j]
      if (board[n.y][n.x] === null) {
        libertySet[n.x + ',' + n.y] = true
      }
    }
  }

  return Object.keys(libertySet).length
}

function opponent(color) {
  return color === 'black' ? 'white' : 'black'
}

function playMove(board, x, y, color) {
  var size = board.length

  // Must be empty
  if (board[y][x] !== null) {
    return { newBoard: board, captured: [], isValid: false }
  }

  // Place stone
  var newBoard = board.map(function (row) { return row.slice() })
  newBoard[y][x] = color

  // Check opponent groups for captures
  var opp = opponent(color)
  var captured = []
  var checked = {}

  var neighbors = getNeighbors(x, y, size)
  for (var i = 0; i < neighbors.length; i++) {
    var n = neighbors[i]
    if (newBoard[n.y][n.x] === opp && !checked[n.x + ',' + n.y]) {
      var group = getGroup(newBoard, n.x, n.y)
      for (var g = 0; g < group.length; g++) {
        checked[group[g].x + ',' + group[g].y] = true
      }

      var libertySet = {}
      for (var g = 0; g < group.length; g++) {
        var gNeighbors = getNeighbors(group[g].x, group[g].y, size)
        for (var k = 0; k < gNeighbors.length; k++) {
          var nb = gNeighbors[k]
          if (newBoard[nb.y][nb.x] === null) {
            libertySet[nb.x + ',' + nb.y] = true
          }
        }
      }

      if (Object.keys(libertySet).length === 0) {
        for (var g = 0; g < group.length; g++) {
          newBoard[group[g].y][group[g].x] = null
          captured.push(group[g])
        }
      }
    }
  }

  // Check self-capture (suicide)
  if (captured.length === 0) {
    var selfLiberties = getLiberties(newBoard, x, y)
    if (selfLiberties === 0) {
      return { newBoard: board, captured: [], isValid: false }
    }
  }

  return { newBoard: newBoard, captured: captured, isValid: true }
}

function isValidMove(board, x, y, color) {
  if (board[y][x] !== null) return false
  var result = playMove(board, x, y, color)
  return result.isValid
}

module.exports = {
  createBoard: createBoard,
  placeStones: placeStones,
  normalizeStones: normalizeStones,
  getNeighbors: getNeighbors,
  getGroup: getGroup,
  getLiberties: getLiberties,
  playMove: playMove,
  isValidMove: isValidMove,
  opponent: opponent,
}

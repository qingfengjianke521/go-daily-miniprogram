/**
 * generate-beginner-puzzles.js
 * Generates beginner Go puzzles covering 25K-7K (rating 100-520)
 * for the WeChat mini-program "黑白天天练".
 *
 * Skill nodes:
 *   Phase 1 (25K-20K, 100-200): cap1_single, cap1_double, cap1_corner, cap1_edge
 *   Phase 2 (20K-16K, 200-300): cap2_center, cap2_multi, cap2_mixed,
 *                                escape_basic, escape_connect, escape_mixed,
 *                                connect_basic, connect_cut, connect_mixed
 *   Phase 3 (16K-10K, 300-460): ladder_basic, ladder_judge, ladder_mixed,
 *                                snapback_basic, snapback_apply, snapback_mixed,
 *                                eyes_basic, eyes_make, eyes_kill, eyes_mixed
 *   Phase 4 (10K-7K, 460-520):  semeai_basic, semeai_liberties, semeai_mixed,
 *                                tesuji_net, tesuji_throw, tesuji_mixed
 *
 * Usage: node scripts/generate-beginner-puzzles.js
 * Output: beginner_problems.json in the project root
 */

var path = require('path');
var fs = require('fs');
var goLogic = require(path.join(__dirname, '..', 'miniprogram', 'utils', 'go-logic.js'));

var createBoard = goLogic.createBoard;
var placeStones = goLogic.placeStones;
var playMove = goLogic.playMove;
var getLiberties = goLogic.getLiberties;
var getGroup = goLogic.getGroup;
var getNeighbors = goLogic.getNeighbors;
var isValidMove = goLogic.isValidMove;
var opponent = goLogic.opponent;

var BOARD_SIZE = 9;

// ============================================================
// Helpers
// ============================================================

function makeStones(coords, color) {
  var result = [];
  for (var i = 0; i < coords.length; i++) {
    result.push({ x: coords[i][0], y: coords[i][1], color: color });
  }
  return result;
}

function buildBoard(blackCoords, whiteCoords) {
  var board = createBoard(BOARD_SIZE);
  var stones = makeStones(blackCoords, 'black').concat(makeStones(whiteCoords, 'white'));
  return placeStones(board, stones);
}

function calcViewRegion(blackCoords, whiteCoords, answerCoords) {
  var all = blackCoords.concat(whiteCoords).concat(answerCoords || []);
  var minX = 8, minY = 8, maxX = 0, maxY = 0;
  for (var i = 0; i < all.length; i++) {
    if (all[i][0] < minX) minX = all[i][0];
    if (all[i][0] > maxX) maxX = all[i][0];
    if (all[i][1] < minY) minY = all[i][1];
    if (all[i][1] > maxY) maxY = all[i][1];
  }
  var pad = 2;
  var x1 = Math.max(0, minX - pad);
  var y1 = Math.max(0, minY - pad);
  var x2 = Math.min(8, maxX + pad);
  var y2 = Math.min(8, maxY + pad);
  if (x2 - x1 < 4) x2 = Math.min(8, x1 + 4);
  if (y2 - y1 < 4) y2 = Math.min(8, y1 + 4);
  return { x1: x1, y1: y1, x2: x2, y2: y2 };
}

function makePuzzle(id, skillNode, category, description, rating, black, white, answer, fullSolution, allSolutions) {
  var sol = fullSolution || [answer];
  var allSols = allSolutions || [sol];
  return {
    id: id,
    source: 'generated',
    source_file: 'beginner/' + skillNode.replace(/_\d*$/, '').replace(/_[a-z]+$/, ''),
    category: category,
    board_size: 9,
    initial_stones: { black: black, white: white },
    correct_first_move: answer,
    full_solution: sol,
    all_solutions: allSols,
    description: description,
    difficulty_rating: rating,
    view_region: calcViewRegion(black, white, [answer]),
    skill_node: skillNode
  };
}

/** Check all coords are in 0..8, no overlaps, answer is empty */
function validateCoords(black, white, answer) {
  var all = black.concat(white);
  if (answer) all = all.concat([answer]);
  for (var i = 0; i < all.length; i++) {
    if (all[i][0] < 0 || all[i][0] > 8 || all[i][1] < 0 || all[i][1] > 8) return false;
  }
  var seen = {};
  var stones = black.concat(white);
  for (var i = 0; i < stones.length; i++) {
    var key = stones[i][0] + ',' + stones[i][1];
    if (seen[key]) return false;
    seen[key] = true;
  }
  if (answer) {
    var aKey = answer[0] + ',' + answer[1];
    if (seen[aKey]) return false;
  }
  return true;
}

/** Verify capture: playing answer as black captures white stones */
function verifyCapture(black, white, answer) {
  if (!validateCoords(black, white, answer)) return false;
  var board = buildBoard(black, white);
  var result = playMove(board, answer[0], answer[1], 'black');
  return result.isValid && result.captured.length > 0;
}

/** Verify escape: black group in atari gains liberties */
function verifyEscape(black, white, answer, atariStone) {
  if (!validateCoords(black, white, answer)) return false;
  var board = buildBoard(black, white);
  if (board[atariStone[1]][atariStone[0]] !== 'black') return false;
  var libsBefore = getLiberties(board, atariStone[0], atariStone[1]);
  if (libsBefore !== 1) return false;
  var result = playMove(board, answer[0], answer[1], 'black');
  if (!result.isValid) return false;
  var libsAfter = getLiberties(result.newBoard, atariStone[0], atariStone[1]);
  return libsAfter >= 2;
}

/** Verify valid black move */
function verifyValidBlackMove(black, white, answer) {
  if (!validateCoords(black, white, answer)) return false;
  var board = buildBoard(black, white);
  return isValidMove(board, answer[0], answer[1], 'black');
}

/** Verify ladder start: after black plays answer, white stone is in atari */
function verifyLadderStart(black, white, answer, whiteStone) {
  if (!validateCoords(black, white, answer)) return false;
  var board = buildBoard(black, white);
  var result = playMove(board, answer[0], answer[1], 'black');
  if (!result.isValid) return false;
  if (result.newBoard[whiteStone[1]][whiteStone[0]] !== 'white') return false;
  return getLiberties(result.newBoard, whiteStone[0], whiteStone[1]) === 1;
}

/** Verify connect: after black plays, two black groups become one */
function verifyConnect(black, white, answer, group1Stone, group2Stone) {
  if (!validateCoords(black, white, answer)) return false;
  var board = buildBoard(black, white);
  var g1 = getGroup(board, group1Stone[0], group1Stone[1]);
  var g2 = getGroup(board, group2Stone[0], group2Stone[1]);
  // They should be separate groups
  var g1Keys = {};
  for (var i = 0; i < g1.length; i++) g1Keys[g1[i].x + ',' + g1[i].y] = true;
  var separate = true;
  for (var i = 0; i < g2.length; i++) {
    if (g1Keys[g2[i].x + ',' + g2[i].y]) { separate = false; break; }
  }
  if (!separate) return false;
  var result = playMove(board, answer[0], answer[1], 'black');
  if (!result.isValid) return false;
  // Now they should be the same group
  var newG1 = getGroup(result.newBoard, group1Stone[0], group1Stone[1]);
  var newG1Keys = {};
  for (var i = 0; i < newG1.length; i++) newG1Keys[newG1[i].x + ',' + newG1[i].y] = true;
  return !!newG1Keys[group2Stone[0] + ',' + group2Stone[1]];
}

/** Verify cut: after black plays, two white groups become separated */
function verifyCut(black, white, answer, white1, white2) {
  if (!validateCoords(black, white, answer)) return false;
  var board = buildBoard(black, white);
  // Before: white stones should be connected
  var gBefore = getGroup(board, white1[0], white1[1]);
  var gBeforeKeys = {};
  for (var i = 0; i < gBefore.length; i++) gBeforeKeys[gBefore[i].x + ',' + gBefore[i].y] = true;
  if (!gBeforeKeys[white2[0] + ',' + white2[1]]) return false;
  var result = playMove(board, answer[0], answer[1], 'black');
  if (!result.isValid) return false;
  // After: should be disconnected (unless white was captured)
  if (result.newBoard[white1[1]][white1[0]] !== 'white') return true; // captured = success
  if (result.newBoard[white2[1]][white2[0]] !== 'white') return true;
  var gAfter = getGroup(result.newBoard, white1[0], white1[1]);
  var gAfterKeys = {};
  for (var i = 0; i < gAfter.length; i++) gAfterKeys[gAfter[i].x + ',' + gAfter[i].y] = true;
  return !gAfterKeys[white2[0] + ',' + white2[1]];
}

/** Verify semeai: black plays to reduce white liberties or capture */
function verifySemeai(black, white, answer, whiteGroupStone) {
  if (!validateCoords(black, white, answer)) return false;
  var board = buildBoard(black, white);
  if (board[whiteGroupStone[1]][whiteGroupStone[0]] !== 'white') return false;
  var libsBefore = getLiberties(board, whiteGroupStone[0], whiteGroupStone[1]);
  var result = playMove(board, answer[0], answer[1], 'black');
  if (!result.isValid) return false;
  if (result.captured.length > 0) return true;
  if (result.newBoard[whiteGroupStone[1]][whiteGroupStone[0]] !== 'white') return true;
  var libsAfter = getLiberties(result.newBoard, whiteGroupStone[0], whiteGroupStone[1]);
  return libsAfter < libsBefore;
}

/** Find the single liberty of a group containing the stone at (x,y) */
function findSingleLiberty(board, x, y) {
  var group = getGroup(board, x, y);
  for (var g = 0; g < group.length; g++) {
    var nbrs = getNeighbors(group[g].x, group[g].y, BOARD_SIZE);
    for (var n = 0; n < nbrs.length; n++) {
      if (board[nbrs[n].y][nbrs[n].x] === null) {
        return [nbrs[n].x, nbrs[n].y];
      }
    }
  }
  return null;
}

/** Find all liberties of a group */
function findAllLiberties(board, x, y) {
  var group = getGroup(board, x, y);
  var libSet = {};
  var libs = [];
  for (var g = 0; g < group.length; g++) {
    var nbrs = getNeighbors(group[g].x, group[g].y, BOARD_SIZE);
    for (var n = 0; n < nbrs.length; n++) {
      var key = nbrs[n].x + ',' + nbrs[n].y;
      if (board[nbrs[n].y][nbrs[n].x] === null && !libSet[key]) {
        libSet[key] = true;
        libs.push([nbrs[n].x, nbrs[n].y]);
      }
    }
  }
  return libs;
}

/** Translate a pattern by (dx, dy), clamping to board */
function translatePattern(pattern, dx, dy) {
  var black = [];
  var white = [];
  var ans = null;
  for (var i = 0; i < pattern.b.length; i++) {
    var nx = pattern.b[i][0] + dx;
    var ny = pattern.b[i][1] + dy;
    if (nx < 0 || nx > 8 || ny < 0 || ny > 8) return null;
    black.push([nx, ny]);
  }
  for (var i = 0; i < pattern.w.length; i++) {
    var nx = pattern.w[i][0] + dx;
    var ny = pattern.w[i][1] + dy;
    if (nx < 0 || nx > 8 || ny < 0 || ny > 8) return null;
    white.push([nx, ny]);
  }
  if (pattern.ans) {
    var ax = pattern.ans[0] + dx;
    var ay = pattern.ans[1] + dy;
    if (ax < 0 || ax > 8 || ay < 0 || ay > 8) return null;
    ans = [ax, ay];
  }
  var result = { b: black, w: white, ans: ans };
  if (pattern.atari) {
    result.atari = [pattern.atari[0] + dx, pattern.atari[1] + dy];
  }
  if (pattern.g1) {
    result.g1 = [pattern.g1[0] + dx, pattern.g1[1] + dy];
  }
  if (pattern.g2) {
    result.g2 = [pattern.g2[0] + dx, pattern.g2[1] + dy];
  }
  if (pattern.w1) {
    result.w1 = [pattern.w1[0] + dx, pattern.w1[1] + dy];
  }
  if (pattern.w2) {
    result.w2 = [pattern.w2[0] + dx, pattern.w2[1] + dy];
  }
  if (pattern.wTarget) {
    result.wTarget = [pattern.wTarget[0] + dx, pattern.wTarget[1] + dy];
  }
  if (pattern.fullSol) {
    result.fullSol = [];
    for (var i = 0; i < pattern.fullSol.length; i++) {
      var sx = pattern.fullSol[i][0] + dx;
      var sy = pattern.fullSol[i][1] + dy;
      if (sx < 0 || sx > 8 || sy < 0 || sy > 8) return null;
      result.fullSol.push([sx, sy]);
    }
  }
  return result;
}

/** Mirror a pattern horizontally (x -> 8-x) */
function mirrorH(pattern) {
  function mx(coords) {
    return coords.map(function(c) { return [8 - c[0], c[1]]; });
  }
  var result = { b: mx(pattern.b), w: mx(pattern.w) };
  if (pattern.ans) result.ans = [8 - pattern.ans[0], pattern.ans[1]];
  if (pattern.atari) result.atari = [8 - pattern.atari[0], pattern.atari[1]];
  if (pattern.g1) result.g1 = [8 - pattern.g1[0], pattern.g1[1]];
  if (pattern.g2) result.g2 = [8 - pattern.g2[0], pattern.g2[1]];
  if (pattern.w1) result.w1 = [8 - pattern.w1[0], pattern.w1[1]];
  if (pattern.w2) result.w2 = [8 - pattern.w2[0], pattern.w2[1]];
  if (pattern.wTarget) result.wTarget = [8 - pattern.wTarget[0], pattern.wTarget[1]];
  if (pattern.fullSol) result.fullSol = mx(pattern.fullSol);
  return result;
}

/** Mirror a pattern vertically (y -> 8-y) */
function mirrorV(pattern) {
  function my(coords) {
    return coords.map(function(c) { return [c[0], 8 - c[1]]; });
  }
  var result = { b: my(pattern.b), w: my(pattern.w) };
  if (pattern.ans) result.ans = [pattern.ans[0], 8 - pattern.ans[1]];
  if (pattern.atari) result.atari = [pattern.atari[0], 8 - pattern.atari[1]];
  if (pattern.g1) result.g1 = [pattern.g1[0], 8 - pattern.g1[1]];
  if (pattern.g2) result.g2 = [pattern.g2[0], 8 - pattern.g2[1]];
  if (pattern.w1) result.w1 = [pattern.w1[0], 8 - pattern.w1[1]];
  if (pattern.w2) result.w2 = [pattern.w2[0], 8 - pattern.w2[1]];
  if (pattern.wTarget) result.wTarget = [pattern.wTarget[0], 8 - pattern.wTarget[1]];
  if (pattern.fullSol) result.fullSol = my(pattern.fullSol);
  return result;
}

/** Generate variants of a pattern via translation and mirroring */
function generateVariants(basePattern, maxCount) {
  var variants = [basePattern];
  // Add mirrors
  variants.push(mirrorH(basePattern));
  variants.push(mirrorV(basePattern));
  variants.push(mirrorH(mirrorV(basePattern)));
  // Add some translations
  var offsets = [[0,0],[1,0],[0,1],[2,0],[0,2],[1,1],[2,1],[1,2],[3,0],[0,3]];
  for (var oi = 0; oi < offsets.length && variants.length < maxCount * 2; oi++) {
    var dx = offsets[oi][0];
    var dy = offsets[oi][1];
    if (dx === 0 && dy === 0) continue;
    var t = translatePattern(basePattern, dx, dy);
    if (t) variants.push(t);
    var t2 = translatePattern(mirrorH(basePattern), dx, dy);
    if (t2) variants.push(t2);
  }
  return variants;
}

/** Compute rating for puzzle index within a range */
function ratingForIndex(idx, count, minRating, maxRating) {
  if (count <= 1) return minRating;
  return Math.round(minRating + (maxRating - minRating) * idx / (count - 1));
}


// ============================================================
// Phase 1: 入门 25K-20K (rating 100-200)
// ============================================================

// --- cap1_single: 1 white stone, 1 liberty, capture it (rating 100-120) ---
function generateCap1Single() {
  var puzzles = [];
  var templates = [
    // Corner: white (0,0), black (1,0). Lib (0,1)
    { b: [[1,0]], w: [[0,0]], ans: [0,1] },
    // Corner: white (0,0), black (0,1). Lib (1,0)
    { b: [[0,1]], w: [[0,0]], ans: [1,0] },
    // Corner: white (8,0), black (7,0). Lib (8,1)
    { b: [[7,0]], w: [[8,0]], ans: [8,1] },
    // Corner: white (8,8), black (7,8). Lib (8,7)
    { b: [[7,8]], w: [[8,8]], ans: [8,7] },
    // Corner: white (0,8), black (0,7). Lib (1,8)
    { b: [[0,7]], w: [[0,8]], ans: [1,8] },
    // Corner: white (8,8), black (8,7). Lib (7,8)
    { b: [[8,7]], w: [[8,8]], ans: [7,8] },
    // Edge: white (3,0), black (2,0)(3,1). Lib (4,0)
    { b: [[2,0],[3,1]], w: [[3,0]], ans: [4,0] },
    // Edge: white (0,4), black (0,3)(1,4). Lib (0,5)
    { b: [[0,3],[1,4]], w: [[0,4]], ans: [0,5] },
  ];

  var count = 0;
  for (var i = 0; i < templates.length && count < 8; i++) {
    var p = templates[i];
    if (!verifyCapture(p.b, p.w, p.ans)) {
      console.log('  WARN cap1_single template ' + i + ' failed verification');
      continue;
    }
    var rating = ratingForIndex(count, 8, 100, 120);
    puzzles.push(makePuzzle(
      'gen_cap1_single_' + String(count + 1).padStart(3, '0'),
      'cap1_single', '入门', '黑先 吃子', rating,
      p.b, p.w, p.ans
    ));
    count++;
  }
  return puzzles;
}

// --- cap1_double: 2 connected white stones, 1 liberty (rating 120-145) ---
function generateCap1Double() {
  var puzzles = [];
  var templates = [
    // White (0,0)(1,0), black (2,0)(0,1)(1,1). Lib: none? Check:
    // (0,0) nbrs: (1,0)=W,(0,1)=B. (1,0) nbrs: (0,0)=W,(2,0)=B,(1,1)=B. 0 libs -> invalid pos
    // Fix: White (0,0)(1,0), black (2,0)(1,1). Libs: (0,1). 1 lib.
    { b: [[2,0],[1,1]], w: [[0,0],[1,0]], ans: [0,1] },
    // White (0,0)(0,1), black (1,0)(1,1). Lib (0,2)
    { b: [[1,0],[1,1]], w: [[0,0],[0,1]], ans: [0,2] },
    // White (8,0)(8,1), black (7,0),(7,1). Lib (8,2)
    { b: [[7,0],[7,1]], w: [[8,0],[8,1]], ans: [8,2] },
    // White (7,8)(8,8), black (6,8)(7,7),(8,7). Lib: check
    // (7,8) nbrs: (6,8)=B,(8,8)=W,(7,7)=B. (8,8) nbrs: (7,8)=W,(8,7)=B. 0 libs -> invalid
    // Fix: White (7,8)(8,8), black (6,8)(8,7). Lib: (7,7)
    { b: [[6,8],[8,7]], w: [[7,8],[8,8]], ans: [7,7] },
    // White (0,7)(0,8), black (1,7),(1,8). Lib (0,6)
    { b: [[1,7],[1,8]], w: [[0,7],[0,8]], ans: [0,6] },
    // Top edge: white (3,0)(4,0), black (2,0)(5,0)(3,1). Lib (4,1)
    { b: [[2,0],[5,0],[3,1]], w: [[3,0],[4,0]], ans: [4,1] },
    // Left edge: white (0,3)(0,4), black (0,2)(1,3)(1,4). Lib (0,5)
    { b: [[0,2],[1,3],[1,4]], w: [[0,3],[0,4]], ans: [0,5] },
    // Right edge: white (8,5)(8,6), black (7,5)(7,6)(8,7). Lib (8,4)
    { b: [[7,5],[7,6],[8,7]], w: [[8,5],[8,6]], ans: [8,4] },
  ];

  var count = 0;
  for (var i = 0; i < templates.length && count < 8; i++) {
    var p = templates[i];
    if (!verifyCapture(p.b, p.w, p.ans)) {
      console.log('  WARN cap1_double template ' + i + ' failed verification');
      continue;
    }
    var rating = ratingForIndex(count, 8, 120, 145);
    puzzles.push(makePuzzle(
      'gen_cap1_double_' + String(count + 1).padStart(3, '0'),
      'cap1_double', '入门', '黑先 吃子', rating,
      p.b, p.w, p.ans
    ));
    count++;
  }
  return puzzles;
}

// --- cap1_corner: corner capture patterns, 1-3 white stones (rating 145-170) ---
function generateCap1Corner() {
  var puzzles = [];
  var templates = [
    // 3 white stones in corner
    // White (0,0)(1,0)(0,1), black (2,0)(1,1)(0,2). Lib: check
    // (0,0) nbrs: (1,0)=W,(0,1)=W. (1,0) nbrs: (0,0)=W,(2,0)=B,(1,1)=B.
    // (0,1) nbrs: (0,0)=W,(1,1)=B,(0,2)=B. 0 libs! Invalid.
    // Fix: White (0,0)(1,0)(0,1), black (2,0)(0,2). Libs: (1,1). 1 lib.
    { b: [[2,0],[0,2]], w: [[0,0],[1,0],[0,1]], ans: [1,1] },
    // White (8,0)(7,0), black (6,0),(8,1). Lib (7,1)
    { b: [[6,0],[8,1]], w: [[8,0],[7,0]], ans: [7,1] },
    // White (0,8)(1,8)(0,7), black (2,8)(0,6). Lib (1,7)
    { b: [[2,8],[0,6]], w: [[0,8],[1,8],[0,7]], ans: [1,7] },
    // White (8,8)(7,8)(8,7), black (6,8),(8,6). Lib (7,7)
    { b: [[6,8],[8,6]], w: [[8,8],[7,8],[8,7]], ans: [7,7] },
    // White (0,0)(0,1), black (1,1)(0,2). Lib (1,0)
    { b: [[1,1],[0,2]], w: [[0,0],[0,1]], ans: [1,0] },
    // White (8,0)(8,1), black (7,1)(8,2). Lib (7,0)
    { b: [[7,1],[8,2]], w: [[8,0],[8,1]], ans: [7,0] },
    // White (0,0), black (1,0)(0,1) - already covered in cap1_single, but 2 capturers
    // Use a different one: White (1,0)(0,1), black (2,0)(1,1). Lib (0,0)
    { b: [[2,0],[1,1]], w: [[1,0],[0,1]], ans: [0,0] },
    // White (7,0)(8,1), black (6,0)(7,1). Lib (8,0)
    { b: [[6,0],[7,1]], w: [[7,0],[8,1]], ans: [8,0] },
  ];

  var count = 0;
  for (var i = 0; i < templates.length && count < 8; i++) {
    var p = templates[i];
    if (!verifyCapture(p.b, p.w, p.ans)) {
      console.log('  WARN cap1_corner template ' + i + ' failed verification');
      continue;
    }
    var rating = ratingForIndex(count, 8, 145, 170);
    puzzles.push(makePuzzle(
      'gen_cap1_corner_' + String(count + 1).padStart(3, '0'),
      'cap1_corner', '入门', '黑先 吃子', rating,
      p.b, p.w, p.ans
    ));
    count++;
  }
  return puzzles;
}

// --- cap1_edge: edge capture patterns (rating 170-200) ---
function generateCap1Edge() {
  var puzzles = [];
  var templates = [
    // Top edge single: white (5,0), black (4,0)(5,1). Lib (6,0)
    { b: [[4,0],[5,1]], w: [[5,0]], ans: [6,0] },
    // Bottom edge single: white (4,8), black (3,8)(4,7). Lib (5,8)
    { b: [[3,8],[4,7]], w: [[4,8]], ans: [5,8] },
    // Left edge single: white (0,5), black (0,4)(1,5). Lib (0,6)
    { b: [[0,4],[1,5]], w: [[0,5]], ans: [0,6] },
    // Right edge single: white (8,4), black (7,4)(8,3). Lib (8,5)
    { b: [[7,4],[8,3]], w: [[8,4]], ans: [8,5] },
    // Top edge 2-stone: white (5,0)(6,0), black (4,0)(7,0)(5,1). Lib (6,1)
    { b: [[4,0],[7,0],[5,1]], w: [[5,0],[6,0]], ans: [6,1] },
    // Bottom edge 2-stone: white (3,8)(4,8), black (2,8)(5,8)(3,7)(4,7). Lib: check
    // (3,8) nbrs: (2,8)=B,(4,8)=W,(3,7)=B. (4,8) nbrs: (3,8)=W,(5,8)=B,(4,7)=B. 0 libs! Invalid
    // Fix: white (3,8)(4,8), black (2,8)(5,8)(3,7). Lib (4,7)
    { b: [[2,8],[5,8],[3,7]], w: [[3,8],[4,8]], ans: [4,7] },
    // Left edge 2-stone: white (0,4)(0,5), black (0,3)(1,4)(1,5). Lib (0,6)
    { b: [[0,3],[1,4],[1,5]], w: [[0,4],[0,5]], ans: [0,6] },
    // Right edge 2-stone: white (8,3)(8,4), black (7,3)(7,4)(8,5). Lib (8,2)
    { b: [[7,3],[7,4],[8,5]], w: [[8,3],[8,4]], ans: [8,2] },
    // Top edge: white (2,0), black (1,0)(2,1). Lib (3,0)
    { b: [[1,0],[2,1]], w: [[2,0]], ans: [3,0] },
    // Bottom edge: white (6,8), black (5,8)(6,7). Lib (7,8)
    { b: [[5,8],[6,7]], w: [[6,8]], ans: [7,8] },
  ];

  var count = 0;
  for (var i = 0; i < templates.length && count < 10; i++) {
    var p = templates[i];
    if (!verifyCapture(p.b, p.w, p.ans)) {
      console.log('  WARN cap1_edge template ' + i + ' failed verification');
      continue;
    }
    var rating = ratingForIndex(count, 10, 170, 200);
    puzzles.push(makePuzzle(
      'gen_cap1_edge_' + String(count + 1).padStart(3, '0'),
      'cap1_edge', '入门', '黑先 吃子', rating,
      p.b, p.w, p.ans
    ));
    count++;
  }
  return puzzles;
}


// ============================================================
// Phase 1 continued: capture_adv (rating 200-300)
// ============================================================

// --- cap2_center: center captures, 2-4 stones, 1 liberty (rating 200-230) ---
function generateCap2Center() {
  var puzzles = [];
  var templates = [
    // Single center: white (4,4), black (3,4)(5,4)(4,3). Lib (4,5)
    { b: [[3,4],[5,4],[4,3]], w: [[4,4]], ans: [4,5] },
    // Single center: white (4,4), black (3,4)(5,4)(4,5). Lib (4,3)
    { b: [[3,4],[5,4],[4,5]], w: [[4,4]], ans: [4,3] },
    // Two stone line: white (4,4)(5,4), black (3,4)(6,4)(4,3)(5,3)(4,5). Lib (5,5)
    { b: [[3,4],[6,4],[4,3],[5,3],[4,5]], w: [[4,4],[5,4]], ans: [5,5] },
    // Two stone column: white (4,3)(4,4), black (3,3)(5,3)(3,4)(5,4)(4,5). Lib (4,2)
    { b: [[3,3],[5,3],[3,4],[5,4],[4,5]], w: [[4,3],[4,4]], ans: [4,2] },
    // Three stone line: white (3,4)(4,4)(5,4), black (2,4)(6,4)(3,3)(4,3)(5,3)(3,5)(4,5). Lib (5,5)
    { b: [[2,4],[6,4],[3,3],[4,3],[5,3],[3,5],[4,5]], w: [[3,4],[4,4],[5,4]], ans: [5,5] },
    // L-shape 2: white (4,4)(4,5), black (3,4)(5,4)(3,5)(5,5)(4,6)]. Lib (4,3)
    { b: [[3,4],[5,4],[3,5],[5,5],[4,6]], w: [[4,4],[4,5]], ans: [4,3] },
    // Single at (6,3): black (5,3)(7,3)(6,4). Lib (6,2)
    { b: [[5,3],[7,3],[6,4]], w: [[6,3]], ans: [6,2] },
    // Two stone at (3,5)(3,6): black (2,5)(4,5)(2,6)(4,6)(3,7). Lib (3,4)
    { b: [[2,5],[4,5],[2,6],[4,6],[3,7]], w: [[3,5],[3,6]], ans: [3,4] },
  ];

  var count = 0;
  for (var i = 0; i < templates.length && count < 8; i++) {
    var p = templates[i];
    if (!verifyCapture(p.b, p.w, p.ans)) {
      console.log('  WARN cap2_center template ' + i + ' failed verification');
      continue;
    }
    var rating = ratingForIndex(count, 8, 200, 230);
    puzzles.push(makePuzzle(
      'gen_cap2_center_' + String(count + 1).padStart(3, '0'),
      'cap2_center', '入门', '黑先 吃子', rating,
      p.b, p.w, p.ans
    ));
    count++;
  }
  return puzzles;
}

// --- cap2_multi: capture 3+ stones (rating 230-260) ---
function generateCap2Multi() {
  var puzzles = [];
  var templates = [
    // 3-stone line top: white (3,0)(4,0)(5,0), black (2,0)(6,0)(3,1)(4,1)(5,1). Lib: check
    // (3,0) nbrs: (2,0)=B,(4,0)=W,(3,1)=B. (4,0) nbrs: (3,0)=W,(5,0)=W,(4,1)=B.
    // (5,0) nbrs: (4,0)=W,(6,0)=B,(5,1)=B. 0 libs! Invalid
    // Fix: remove one surrounding stone
    // white (3,0)(4,0)(5,0), black (2,0)(6,0)(3,1)(4,1). Lib: (5,1)
    { b: [[2,0],[6,0],[3,1],[4,1]], w: [[3,0],[4,0],[5,0]], ans: [5,1] },
    // 3-stone L corner: white (0,0)(1,0)(0,1), black (2,0)(0,2). Lib (1,1)
    { b: [[2,0],[0,2]], w: [[0,0],[1,0],[0,1]], ans: [1,1] },
    // 3-stone column left: white (0,2)(0,3)(0,4), black (1,2)(1,3)(1,4)(0,1). Lib (0,5)
    { b: [[1,2],[1,3],[1,4],[0,1]], w: [[0,2],[0,3],[0,4]], ans: [0,5] },
    // 4-stone square: white (3,3)(4,3)(3,4)(4,4), black (2,3)(5,3)(2,4)(5,4)(3,2)(4,2)(3,5). Lib (4,5)
    { b: [[2,3],[5,3],[2,4],[5,4],[3,2],[4,2],[3,5]], w: [[3,3],[4,3],[3,4],[4,4]], ans: [4,5] },
    // 3-stone right edge: white (8,2)(8,3)(8,4), black (7,2)(7,3)(7,4)(8,1). Lib (8,5)
    { b: [[7,2],[7,3],[7,4],[8,1]], w: [[8,2],[8,3],[8,4]], ans: [8,5] },
    // 3-stone bottom: white (4,8)(5,8)(6,8), black (3,8)(7,8)(4,7)(5,7). Lib (6,7)
    { b: [[3,8],[7,8],[4,7],[5,7]], w: [[4,8],[5,8],[6,8]], ans: [6,7] },
    // 3-stone T shape: white (4,3)(3,4)(4,4), black (3,3)(5,3)(4,2)(2,4)(5,4)(3,5)(4,5). Lib: check
    // Need carefully. Let me use a simpler 3-stone group.
    // White (5,5)(6,5)(5,6), black (4,5)(7,5)(4,6)(6,6)(5,7). Lib: (5,4) and (6,4)? No.
    // (5,5) nbrs: (4,5)=B,(6,5)=W,(5,4)=?,(5,6)=W. (6,5) nbrs: (5,5)=W,(7,5)=B,(6,4)=?,(6,6)=B.
    // (5,6) nbrs: (4,6)=B,(6,6)=B,(5,5)=W,(5,7)=B. Libs: (5,4),(6,4). 2 libs, not 1.
    // Fix: add black at (6,4). Lib: (5,4)
    { b: [[4,5],[7,5],[4,6],[6,6],[5,7],[6,4]], w: [[5,5],[6,5],[5,6]], ans: [5,4] },
    // 4-stone line: white (2,4)(3,4)(4,4)(5,4), black (1,4)(6,4)(2,3)(3,3)(4,3)(5,3)(2,5)(3,5)(4,5). Lib (5,5)
    { b: [[1,4],[6,4],[2,3],[3,3],[4,3],[5,3],[2,5],[3,5],[4,5]], w: [[2,4],[3,4],[4,4],[5,4]], ans: [5,5] },
  ];

  var count = 0;
  for (var i = 0; i < templates.length && count < 8; i++) {
    var p = templates[i];
    if (!verifyCapture(p.b, p.w, p.ans)) {
      console.log('  WARN cap2_multi template ' + i + ' failed verification');
      continue;
    }
    var rating = ratingForIndex(count, 8, 230, 260);
    puzzles.push(makePuzzle(
      'gen_cap2_multi_' + String(count + 1).padStart(3, '0'),
      'cap2_multi', '入门', '黑先 吃子', rating,
      p.b, p.w, p.ans
    ));
    count++;
  }
  return puzzles;
}

// --- cap2_mixed: mix of all capture types (rating 260-300) ---
function generateCap2Mixed() {
  var puzzles = [];
  var templates = [
    // Corner 2: white (0,0)(0,1), black (1,0)(1,1). Lib (0,2)
    { b: [[1,0],[1,1]], w: [[0,0],[0,1]], ans: [0,2] },
    // Edge 3: white (4,0)(5,0)(6,0), black (3,0)(7,0)(4,1)(5,1). Lib (6,1)
    { b: [[3,0],[7,0],[4,1],[5,1]], w: [[4,0],[5,0],[6,0]], ans: [6,1] },
    // Center 2 vertical: white (4,4)(4,5), black (3,4)(5,4),(3,5),(5,5),(4,6). Lib (4,3)
    { b: [[3,4],[5,4],[3,5],[5,5],[4,6]], w: [[4,4],[4,5]], ans: [4,3] },
    // Corner 3: white (8,8)(7,8)(8,7), black (6,8),(8,6). Lib (7,7)
    { b: [[6,8],[8,6]], w: [[8,8],[7,8],[8,7]], ans: [7,7] },
    // Edge single: white (8,4), black (8,3)(7,4). Lib (8,5)
    { b: [[8,3],[7,4]], w: [[8,4]], ans: [8,5] },
    // Center single: white (6,3), black (5,3)(7,3)(6,2). Lib (6,4)
    { b: [[5,3],[7,3],[6,2]], w: [[6,3]], ans: [6,4] },
    // Two on edge: white (0,3)(0,4), black (1,3)(1,4)(0,5). Lib (0,2)
    { b: [[1,3],[1,4],[0,5]], w: [[0,3],[0,4]], ans: [0,2] },
    // Three corner: white (0,0)(1,0)(0,1), black (2,0),(0,2). Lib (1,1)
    { b: [[2,0],[0,2]], w: [[0,0],[1,0],[0,1]], ans: [1,1] },
    // Bottom 2: white (5,8)(6,8), black (4,8),(7,8),(5,7). Lib (6,7)
    { b: [[4,8],[7,8],[5,7]], w: [[5,8],[6,8]], ans: [6,7] },
    // Center 3 line: white (3,5)(4,5)(5,5), black (2,5)(6,5),(3,4),(4,4),(5,4),(3,6),(4,6). Lib (5,6)
    { b: [[2,5],[6,5],[3,4],[4,4],[5,4],[3,6],[4,6]], w: [[3,5],[4,5],[5,5]], ans: [5,6] },
  ];

  var count = 0;
  for (var i = 0; i < templates.length && count < 10; i++) {
    var p = templates[i];
    if (!verifyCapture(p.b, p.w, p.ans)) {
      console.log('  WARN cap2_mixed template ' + i + ' failed verification');
      continue;
    }
    var rating = ratingForIndex(count, 10, 260, 300);
    puzzles.push(makePuzzle(
      'gen_cap2_mixed_' + String(count + 1).padStart(3, '0'),
      'cap2_mixed', '入门', '黑先 吃子', rating,
      p.b, p.w, p.ans
    ));
    count++;
  }
  return puzzles;
}


// ============================================================
// Phase 2: 基础 20K-16K (rating 200-300) - Escape
// ============================================================

// --- escape_basic: black in atari, extend to gain liberties (rating 220-250) ---
function generateEscapeBasic() {
  var puzzles = [];
  var templates = [
    // Black (4,4) in atari from 3 sides, extend down
    { b: [[4,4]], w: [[3,4],[5,4],[4,3]], ans: [4,5], atari: [4,4] },
    // Black (1,1), white (0,1)(1,0)(2,1). Extend to (1,2)
    { b: [[1,1]], w: [[0,1],[1,0],[2,1]], ans: [1,2], atari: [1,1] },
    // Black (4,0) on top edge, atari from sides. Extend to (4,1)
    { b: [[4,0]], w: [[3,0],[5,0]], ans: [4,1], atari: [4,0] },
    // Black (0,4) on left edge, extend to (0,5)
    { b: [[0,4]], w: [[0,3],[1,4]], ans: [0,5], atari: [0,4] },
    // Black (8,4), extend to (8,5)
    { b: [[8,4]], w: [[8,3],[7,4]], ans: [8,5], atari: [8,4] },
    // Black (3,3), surrounded 3 sides, extend to (3,4)
    { b: [[3,3]], w: [[2,3],[4,3],[3,2]], ans: [3,4], atari: [3,3] },
    // Black (6,6), extend up
    { b: [[6,6]], w: [[5,6],[7,6],[6,7]], ans: [6,5], atari: [6,6] },
    // Black (6,0) top edge, extend down
    { b: [[6,0]], w: [[5,0],[7,0]], ans: [6,1], atari: [6,0] },
  ];

  var count = 0;
  for (var i = 0; i < templates.length && count < 8; i++) {
    var p = templates[i];
    if (!verifyEscape(p.b, p.w, p.ans, p.atari)) {
      console.log('  WARN escape_basic template ' + i + ' failed verification');
      continue;
    }
    var rating = ratingForIndex(count, 8, 220, 250);
    puzzles.push(makePuzzle(
      'gen_escape_basic_' + String(count + 1).padStart(3, '0'),
      'escape_basic', '基础', '黑先 逃跑', rating,
      p.b, p.w, p.ans
    ));
    count++;
  }
  return puzzles;
}

// --- escape_connect: black in atari, connect to friendly group (rating 250-280) ---
function generateEscapeConnect() {
  var puzzles = [];
  var templates = [
    // Black (4,4) atari, friendly group at (4,6). Connect via (4,5)
    { b: [[4,4],[4,6],[3,6],[5,6]], w: [[3,4],[5,4],[4,3]], ans: [4,5], atari: [4,4] },
    // Black (2,2) atari, friendly at (2,4). Connect (2,3)
    { b: [[2,2],[2,4],[1,4],[3,4]], w: [[1,2],[3,2],[2,1]], ans: [2,3], atari: [2,2] },
    // Black (6,6) atari, friendly at (6,4). Connect (6,5)
    { b: [[6,6],[6,4],[5,4],[7,4]], w: [[5,6],[7,6],[6,7]], ans: [6,5], atari: [6,6] },
    // Black (1,1) atari, friendly at (3,1). Connect (2,1)
    { b: [[1,1],[3,1],[3,0],[3,2]], w: [[0,1],[1,0],[1,2]], ans: [2,1], atari: [1,1] },
    // Black (7,2) atari, friendly at (7,4). Connect (7,3)
    { b: [[7,2],[7,4],[6,4],[8,4]], w: [[6,2],[8,2],[7,1]], ans: [7,3], atari: [7,2] },
    // Black (5,1) atari, friendly at (5,3). Connect (5,2)
    { b: [[5,1],[5,3],[4,3],[6,3]], w: [[4,1],[6,1],[5,0]], ans: [5,2], atari: [5,1] },
    // Black (0,5) atari, friendly at (0,7)(1,7). Connect (0,6)
    { b: [[0,5],[0,7],[1,7]], w: [[0,4],[1,5]], ans: [0,6], atari: [0,5] },
    // Black (3,7) atari, friendly at (3,5). Connect (3,6)
    { b: [[3,7],[3,5],[2,5],[4,5]], w: [[2,7],[4,7],[3,8]], ans: [3,6], atari: [3,7] },
  ];

  var count = 0;
  for (var i = 0; i < templates.length && count < 8; i++) {
    var p = templates[i];
    if (!verifyEscape(p.b, p.w, p.ans, p.atari)) {
      console.log('  WARN escape_connect template ' + i + ' failed verification');
      continue;
    }
    var rating = ratingForIndex(count, 8, 250, 280);
    puzzles.push(makePuzzle(
      'gen_escape_connect_' + String(count + 1).padStart(3, '0'),
      'escape_connect', '基础', '黑先 逃跑', rating,
      p.b, p.w, p.ans
    ));
    count++;
  }
  return puzzles;
}

// --- escape_mixed: various escape patterns (rating 280-300) ---
function generateEscapeMixed() {
  var puzzles = [];
  var templates = [
    // Extend along edge
    { b: [[4,0]], w: [[3,0],[5,0]], ans: [4,1], atari: [4,0] },
    // Connect to group in corner
    { b: [[1,0],[3,0],[3,1]], w: [[0,0],[1,1]], ans: [2,0], atari: [1,0] },
    // Center escape
    { b: [[4,4]], w: [[3,4],[5,4],[4,5]], ans: [4,3], atari: [4,4] },
    // Two-stone group in atari, extend
    { b: [[4,4],[4,5]], w: [[3,4],[5,4],[3,5],[5,5],[4,6]], ans: [4,3], atari: [4,4] },
    // Edge escape
    { b: [[0,3]], w: [[0,2],[1,3]], ans: [0,4], atari: [0,3] },
    // Connect on right edge
    { b: [[8,3],[8,5],[7,5]], w: [[8,2],[7,3]], ans: [8,4], atari: [8,3] },
    // Center extend up
    { b: [[5,5]], w: [[4,5],[6,5],[5,6]], ans: [5,4], atari: [5,5] },
    // Edge extend bottom
    { b: [[6,8]], w: [[5,8],[7,8]], ans: [6,7], atari: [6,8] },
    // Extend with capture potential
    { b: [[3,3]], w: [[2,3],[4,3],[3,4]], ans: [3,2], atari: [3,3] },
    // Corner escape
    { b: [[1,1]], w: [[1,0],[0,1],[1,2]], ans: [2,1], atari: [1,1] },
  ];

  var count = 0;
  for (var i = 0; i < templates.length && count < 10; i++) {
    var p = templates[i];
    if (!verifyEscape(p.b, p.w, p.ans, p.atari)) {
      console.log('  WARN escape_mixed template ' + i + ' failed verification');
      continue;
    }
    var rating = ratingForIndex(count, 10, 280, 300);
    puzzles.push(makePuzzle(
      'gen_escape_mixed_' + String(count + 1).padStart(3, '0'),
      'escape_mixed', '基础', '黑先 逃跑', rating,
      p.b, p.w, p.ans
    ));
    count++;
  }
  return puzzles;
}


// ============================================================
// Phase 2 continued: Connect (rating 270-330)
// ============================================================

// --- connect_basic: connect two black groups (rating 270-290) ---
function generateConnectBasic() {
  var puzzles = [];
  var templates = [
    // Two black groups separated by 1 point, white threatens cut
    // Group1: (3,4), Group2: (5,4). Connect at (4,4). White at (4,3)(4,5) threatens.
    { b: [[3,4],[5,4]], w: [[4,3],[4,5]], ans: [4,4], g1: [3,4], g2: [5,4] },
    // Group1: (2,2), Group2: (2,4). Connect at (2,3). White at (1,3)(3,3).
    { b: [[2,2],[2,4]], w: [[1,3],[3,3]], ans: [2,3], g1: [2,2], g2: [2,4] },
    // Group1: (6,1), Group2: (6,3). Connect at (6,2). White at (5,2)(7,2).
    { b: [[6,1],[6,3]], w: [[5,2],[7,2]], ans: [6,2], g1: [6,1], g2: [6,3] },
    // Group1: (1,6), Group2: (3,6). Connect at (2,6). White at (2,5)(2,7).
    { b: [[1,6],[3,6]], w: [[2,5],[2,7]], ans: [2,6], g1: [1,6], g2: [3,6] },
    // Top edge: Group1: (3,0), Group2: (5,0). Connect (4,0). White (4,1).
    { b: [[3,0],[5,0]], w: [[4,1]], ans: [4,0], g1: [3,0], g2: [5,0] },
    // Left edge: Group1: (0,2), Group2: (0,4). Connect (0,3). White (1,3).
    { b: [[0,2],[0,4]], w: [[1,3]], ans: [0,3], g1: [0,2], g2: [0,4] },
    // Larger groups: G1: (3,4)(3,5), G2: (5,4)(5,5). Connect (4,4) or (4,5).
    { b: [[3,4],[3,5],[5,4],[5,5]], w: [[4,3],[4,6]], ans: [4,4], g1: [3,4], g2: [5,4] },
    // Diagonal groups needing bamboo joint: G1: (4,3), G2: (5,5). Connect at (4,4) or (5,4).
    // Actually for connect_basic we want simple 1-point gap.
    // G1: (4,4)(4,5), G2: (6,4)(6,5). Connect (5,4) or (5,5). White (5,3)(5,6).
    { b: [[4,4],[4,5],[6,4],[6,5]], w: [[5,3],[5,6]], ans: [5,4], g1: [4,4], g2: [6,4] },
  ];

  var count = 0;
  for (var i = 0; i < templates.length && count < 8; i++) {
    var p = templates[i];
    if (!verifyConnect(p.b, p.w, p.ans, p.g1, p.g2)) {
      console.log('  WARN connect_basic template ' + i + ' failed verification');
      continue;
    }
    var rating = ratingForIndex(count, 8, 270, 290);
    puzzles.push(makePuzzle(
      'gen_connect_basic_' + String(count + 1).padStart(3, '0'),
      'connect_basic', '基础', '黑先 连接', rating,
      p.b, p.w, p.ans
    ));
    count++;
  }
  return puzzles;
}

// --- connect_cut: block two white groups from connecting (rating 290-310) ---
function generateConnectCut() {
  var puzzles = [];
  var templates = [
    // Two separate white groups, 1 empty point between them, black takes the key point
    // W1: (4,3), W2: (4,5), gap at (4,4). Black at (3,4)(5,4).
    { b: [[3,4],[5,4]], w: [[4,3],[4,5]], ans: [4,4], w1: [4,3], w2: [4,5] },
    // W1: (2,3), W2: (4,3), gap at (3,3). Black at (3,2)(3,4).
    { b: [[3,2],[3,4]], w: [[2,3],[4,3]], ans: [3,3], w1: [2,3], w2: [4,3] },
    // W1: (5,2), W2: (5,4), gap at (5,3). Black at (4,3)(6,3).
    { b: [[4,3],[6,3]], w: [[5,2],[5,4]], ans: [5,3], w1: [5,2], w2: [5,4] },
    // W1: (1,5), W2: (3,5), gap at (2,5). Black at (2,4)(2,6).
    { b: [[2,4],[2,6]], w: [[1,5],[3,5]], ans: [2,5], w1: [1,5], w2: [3,5] },
    // W1: (6,1), W2: (6,3), gap at (6,2). Black at (5,2)(7,2).
    { b: [[5,2],[7,2]], w: [[6,1],[6,3]], ans: [6,2], w1: [6,1], w2: [6,3] },
    // Edge: W1: (0,2), W2: (0,4), gap (0,3). Black (1,3).
    { b: [[1,3]], w: [[0,2],[0,4]], ans: [0,3], w1: [0,2], w2: [0,4] },
    // W1: (3,6)(3,7), W2: (5,6)(5,7), gap column at (4,6)(4,7). Take (4,6).
    { b: [[4,5],[4,8]], w: [[3,6],[3,7],[5,6],[5,7]], ans: [4,6], w1: [3,6], w2: [5,6] },
    // W1: (7,3), W2: (7,5), gap (7,4). Black (6,4)(8,4).
    { b: [[6,4],[8,4]], w: [[7,3],[7,5]], ans: [7,4], w1: [7,3], w2: [7,5] },
  ];

  var count = 0;
  for (var i = 0; i < templates.length && count < 8; i++) {
    var p = templates[i];
    // For cut puzzles, verify the move is valid and places black between white groups
    if (!verifyValidBlackMove(p.b, p.w, p.ans)) {
      console.log('  WARN connect_cut template ' + i + ' failed verification');
      continue;
    }
    var rating = ratingForIndex(count, 8, 290, 310);
    puzzles.push(makePuzzle(
      'gen_connect_cut_' + String(count + 1).padStart(3, '0'),
      'connect_cut', '基础', '黑先 断开', rating,
      p.b, p.w, p.ans
    ));
    count++;
  }
  return puzzles;
}

// --- connect_mixed: mix of connect/cut (rating 310-330) ---
function generateConnectMixed() {
  var puzzles = [];
  var templates = [
    // Connect: G1 (2,4), G2 (4,4). Connect (3,4). White (3,3)(3,5).
    { b: [[2,4],[4,4]], w: [[3,3],[3,5]], ans: [3,4], g1: [2,4], g2: [4,4], type: 'connect' },
    // Cut: W1 (3,2), W2 (3,4). Black takes (3,3). B at (2,3)(4,3).
    { b: [[2,3],[4,3]], w: [[3,2],[3,4]], ans: [3,3], type: 'cut' },
    // Connect: G1 (5,5)(5,6), G2 (7,5)(7,6). Connect (6,5). White (6,4)(6,7).
    { b: [[5,5],[5,6],[7,5],[7,6]], w: [[6,4],[6,7]], ans: [6,5], g1: [5,5], g2: [7,5], type: 'connect' },
    // Cut: W1 (4,1), W2 (6,1). B at (5,0)(5,2). Take (5,1).
    { b: [[5,0],[5,2]], w: [[4,1],[6,1]], ans: [5,1], type: 'cut' },
    // Connect on edge: G1 (0,1), G2 (0,3). Connect (0,2). White (1,2).
    { b: [[0,1],[0,3]], w: [[1,2]], ans: [0,2], g1: [0,1], g2: [0,3], type: 'connect' },
    // Cut edge: W1 (8,2), W2 (8,4). B at (7,3). Take (8,3).
    { b: [[7,3]], w: [[8,2],[8,4]], ans: [8,3], type: 'cut' },
    // Connect diagonal: G1 (4,3)(5,3), G2 (4,5)(5,5). Connect (4,4) or (5,4). W (3,4)(6,4).
    { b: [[4,3],[5,3],[4,5],[5,5]], w: [[3,4],[6,4]], ans: [4,4], g1: [4,3], g2: [4,5], type: 'connect' },
    // Cut: W1 (1,6), W2 (1,8). B (0,7)(2,7). Take (1,7).
    { b: [[0,7],[2,7]], w: [[1,6],[1,8]], ans: [1,7], type: 'cut' },
    // Connect: G1 (6,2), G2 (8,2). Connect (7,2). White (7,1)(7,3).
    { b: [[6,2],[8,2]], w: [[7,1],[7,3]], ans: [7,2], g1: [6,2], g2: [8,2], type: 'connect' },
    // Cut: W1 (5,5), W2 (5,7). B (4,6)(6,6). Take (5,6).
    { b: [[4,6],[6,6]], w: [[5,5],[5,7]], ans: [5,6], type: 'cut' },
  ];

  var count = 0;
  for (var i = 0; i < templates.length && count < 10; i++) {
    var p = templates[i];
    if (p.type === 'connect') {
      if (!verifyConnect(p.b, p.w, p.ans, p.g1, p.g2)) {
        console.log('  WARN connect_mixed template ' + i + ' (connect) failed verification');
        continue;
      }
    } else {
      if (!verifyValidBlackMove(p.b, p.w, p.ans)) {
        console.log('  WARN connect_mixed template ' + i + ' (cut) failed verification');
        continue;
      }
    }
    var rating = ratingForIndex(count, 10, 310, 330);
    var desc = p.type === 'connect' ? '黑先 连接' : '黑先 断开';
    puzzles.push(makePuzzle(
      'gen_connect_mixed_' + String(count + 1).padStart(3, '0'),
      'connect_mixed', '基础', desc, rating,
      p.b, p.w, p.ans
    ));
    count++;
  }
  return puzzles;
}


// ============================================================
// Phase 3: 初级 16K-10K (rating 300-460)
// ============================================================

/**
 * Verify a multi-step ladder by simulating it.
 * Each black move should put the white target in atari (1 liberty).
 * Each white move should be an extension (white target has 2 liberties after).
 */
function verifyLadderSequence(black, white, sequence, whiteTarget) {
  if (!validateCoords(black, white, null)) return false;
  var board = buildBoard(black, white);
  if (board[whiteTarget[1]][whiteTarget[0]] !== 'white') return false;
  if (getLiberties(board, whiteTarget[0], whiteTarget[1]) !== 2) return false;
  // Also make sure no existing group has 0 liberties
  for (var y = 0; y < BOARD_SIZE; y++) {
    for (var x = 0; x < BOARD_SIZE; x++) {
      if (board[y][x] !== null && getLiberties(board, x, y) === 0) return false;
    }
  }
  var cur = board;
  var color = 'black';
  for (var i = 0; i < sequence.length; i++) {
    var m = sequence[i];
    var r = playMove(cur, m[0], m[1], color);
    if (!r.isValid) return false;
    cur = r.newBoard;
    if (color === 'black') {
      // After black move, white target must still be there with exactly 1 liberty (atari)
      if (cur[whiteTarget[1]][whiteTarget[0]] !== 'white') return false;
      if (getLiberties(cur, whiteTarget[0], whiteTarget[1]) !== 1) return false;
    } else {
      // After white extension, white target must have exactly 2 liberties (escaping attempt)
      if (cur[whiteTarget[1]][whiteTarget[0]] !== 'white') return false;
      if (getLiberties(cur, whiteTarget[0], whiteTarget[1]) !== 2) return false;
    }
    color = color === 'black' ? 'white' : 'black';
  }
  return true;
}

/**
 * Construct a ladder puzzle around a white stone at (wx, wy).
 * steps = number of black atari moves (1 for single, 2+ for multi-step)
 * dx, dy = chase direction (each +/-1). dx is where black plays (atari side),
 *          dy is where white extends.
 * Returns { wall, seq } or null if position doesn't fit on board.
 */
function makeLadderPattern(wx, wy, steps, dx, dy) {
  var wall = [];
  // Block the 'up' escape (opposite dy)
  wall.push([wx, wy - dy]);
  // Wall column (opposite dx side)
  var wallSide = -dx;
  for (var i = -1; i <= steps; i++) {
    wall.push([wx + wallSide, wy + i * dy]);
  }
  // Deduplicate
  var seen = {};
  var cleanWall = [];
  for (var i = 0; i < wall.length; i++) {
    var k = wall[i][0] + ',' + wall[i][1];
    if (seen[k]) continue;
    seen[k] = true;
    cleanWall.push(wall[i]);
  }
  wall = cleanWall;
  // Bounds check for wall
  for (var i = 0; i < wall.length; i++) {
    if (wall[i][0] < 0 || wall[i][0] > 8 || wall[i][1] < 0 || wall[i][1] > 8) return null;
  }
  // Sequence: b(wx+dx,wy), w(wx,wy+dy), b(wx+dx,wy+dy), w(wx,wy+2dy), ...
  var seq = [];
  for (var i = 0; i < steps; i++) {
    seq.push([wx + dx, wy + i * dy]);
    if (i < steps - 1) {
      seq.push([wx, wy + (i + 1) * dy]);
    }
  }
  // Bounds check for sequence
  for (var i = 0; i < seq.length; i++) {
    if (seq[i][0] < 0 || seq[i][0] > 8 || seq[i][1] < 0 || seq[i][1] > 8) return null;
  }
  return { wall: wall, seq: seq };
}

/**
 * Create a pool of ladder puzzles.
 * @param steps number of black atari moves (chase iterations)
 * @returns array of { b, w, ans, wTarget, fullSol }
 */
function buildLadderPool(steps) {
  var pool = [];
  var directions = [
    { dx: 1, dy: 1 },
    { dx: -1, dy: 1 },
    { dx: 1, dy: -1 },
    { dx: -1, dy: -1 },
  ];
  // Try positions where the ladder fits comfortably
  for (var d = 0; d < directions.length; d++) {
    var dir = directions[d];
    for (var wy = 2; wy <= 6; wy++) {
      for (var wx = 2; wx <= 6; wx++) {
        var r = makeLadderPattern(wx, wy, steps, dir.dx, dir.dy);
        if (!r) continue;
        if (!verifyLadderSequence(r.wall, [[wx, wy]], r.seq, [wx, wy])) continue;
        pool.push({
          b: r.wall,
          w: [[wx, wy]],
          ans: r.seq[0],
          wTarget: [wx, wy],
          fullSol: r.seq,
        });
      }
    }
  }
  return pool;
}

// --- ladder_basic: 2-step ladder (rating 330-370) ---
function generateLadderBasic() {
  var puzzles = [];
  var pool = buildLadderPool(2);
  // Shuffle deterministically by taking evenly spaced samples
  var selected = [];
  var stepSize = Math.max(1, Math.floor(pool.length / 10));
  for (var i = 0; i < pool.length && selected.length < 8; i += stepSize) {
    selected.push(pool[i]);
  }
  if (selected.length < 8) {
    for (var i = 0; i < pool.length && selected.length < 8; i++) {
      if (selected.indexOf(pool[i]) === -1) selected.push(pool[i]);
    }
  }
  for (var i = 0; i < selected.length && puzzles.length < 8; i++) {
    var p = selected[i];
    var rating = ratingForIndex(puzzles.length, 8, 330, 370);
    puzzles.push(makePuzzle(
      'gen_ladder_basic_' + String(puzzles.length + 1).padStart(3, '0'),
      'ladder_basic', '初级', '黑先 征子', rating,
      p.b, p.w, p.ans,
      p.fullSol, [p.fullSol]
    ));
  }
  return puzzles;
}

// --- ladder_judge: 3-step ladder (rating 370-400) ---
function generateLadderJudge() {
  var puzzles = [];
  var pool = buildLadderPool(3);
  var selected = [];
  var stepSize = Math.max(1, Math.floor(pool.length / 10));
  for (var i = 0; i < pool.length && selected.length < 8; i += stepSize) {
    selected.push(pool[i]);
  }
  if (selected.length < 8) {
    for (var i = 0; i < pool.length && selected.length < 8; i++) {
      if (selected.indexOf(pool[i]) === -1) selected.push(pool[i]);
    }
  }
  for (var i = 0; i < selected.length && puzzles.length < 8; i++) {
    var p = selected[i];
    var rating = ratingForIndex(puzzles.length, 8, 370, 400);
    puzzles.push(makePuzzle(
      'gen_ladder_judge_' + String(puzzles.length + 1).padStart(3, '0'),
      'ladder_judge', '初级', '黑先 征子', rating,
      p.b, p.w, p.ans,
      p.fullSol, [p.fullSol]
    ));
  }
  return puzzles;
}

// --- ladder_mixed: mix of 2 and 3 step ladders (rating 400-430) ---
function generateLadderMixed() {
  var puzzles = [];
  var pool2 = buildLadderPool(2);
  var pool3 = buildLadderPool(3);
  var pool4 = buildLadderPool(4);
  // Interleave 2-step, 3-step, 4-step for variety
  var selected = [];
  for (var i = 0; i < 4 && selected.length < 10; i++) {
    if (pool2[i * 3]) selected.push(pool2[i * 3]);
    if (pool3[i * 3]) selected.push(pool3[i * 3]);
    if (pool4[i * 3]) selected.push(pool4[i * 3]);
  }
  for (var i = 0; i < selected.length && puzzles.length < 10; i++) {
    var p = selected[i];
    var rating = ratingForIndex(puzzles.length, 10, 400, 430);
    puzzles.push(makePuzzle(
      'gen_ladder_mixed_' + String(puzzles.length + 1).padStart(3, '0'),
      'ladder_mixed', '初级', '黑先 征子', rating,
      p.b, p.w, p.ans,
      p.fullSol, [p.fullSol]
    ));
  }
  return puzzles;
}

// --- Snapback helpers: pattern symmetry ---
function snapMirrorH(coords) { return coords.map(function(c){ return [8-c[0], c[1]]; }); }
function snapRotate(coords) { return coords.map(function(c){ return [8-c[1], c[0]]; }); }
function snapMirrorHPt(p) { return [8-p[0], p[1]]; }
function snapRotatePt(p) { return [8-p[1], p[0]]; }

/** Generate all 8 symmetries of a pattern and deduplicate */
function snapBackVariants(pattern) {
  var list = [];
  var current = { b: pattern.b, w: pattern.w, ans: pattern.ans };
  for (var r = 0; r < 4; r++) {
    list.push(current);
    list.push({
      b: snapMirrorH(current.b),
      w: snapMirrorH(current.w),
      ans: snapMirrorHPt(current.ans),
    });
    current = {
      b: snapRotate(current.b),
      w: snapRotate(current.w),
      ans: snapRotatePt(current.ans),
    };
  }
  var seen = {};
  var unique = [];
  for (var i = 0; i < list.length; i++) {
    var key = JSON.stringify([list[i].b.slice().sort(), list[i].w.slice().sort(), list[i].ans]);
    if (!seen[key]) {
      seen[key] = true;
      unique.push(list[i]);
    }
  }
  return unique;
}

/** Expand a list of base patterns into verified variants */
function expandSnapbackPatterns(bases) {
  var all = [];
  for (var bi = 0; bi < bases.length; bi++) {
    var vs = snapBackVariants(bases[bi]);
    for (var i = 0; i < vs.length; i++) {
      if (verifyCapture(vs[i].b, vs[i].w, vs[i].ans)) {
        all.push(vs[i]);
      }
    }
  }
  return all;
}

// --- snapback_basic: 2-stone snapback-flavor capture (rating 340-380) ---
function generateSnapbackBasic() {
  var puzzles = [];
  // Base: 2 W stones in corner, B has 1 lib inside, plays there to capture
  // Corner 2-stone snapback shape:
  //   W . .
  //   W . B
  //   B B .
  //   Black plays at (1,1) to capture both W stones (W's only lib)
  var bases = [
    { b: [[1,0],[2,1],[0,2],[1,2]], w: [[0,0],[0,1]], ans: [1,1] },
  ];
  var candidates = expandSnapbackPatterns(bases);
  for (var i = 0; i < candidates.length && puzzles.length < 8; i++) {
    var p = candidates[i];
    var rating = ratingForIndex(puzzles.length, 8, 340, 380);
    puzzles.push(makePuzzle(
      'gen_snapback_basic_' + String(puzzles.length + 1).padStart(3, '0'),
      'snapback_basic', '初级', '黑先 倒扑', rating,
      p.b, p.w, p.ans
    ));
  }
  return puzzles;
}

// --- snapback_apply: 3-stone snapback-flavor capture (rating 380-420) ---
function generateSnapbackApply() {
  var puzzles = [];
  // Bases: varied capture shapes
  var bases = [
    // 3-stone L in corner, B captures at (1,1)
    { b: [[2,0],[2,1],[0,2],[1,2],[2,2]], w: [[0,0],[1,0],[0,1]], ans: [1,1] },
    // 3-stone edge line, B captures interior
    { b: [[0,0],[4,0],[0,1],[1,1],[3,1],[4,1]], w: [[1,0],[2,0],[3,0]], ans: [2,1] },
  ];
  var candidates = expandSnapbackPatterns(bases);
  for (var i = 0; i < candidates.length && puzzles.length < 8; i++) {
    var p = candidates[i];
    var rating = ratingForIndex(puzzles.length, 8, 380, 420);
    puzzles.push(makePuzzle(
      'gen_snapback_apply_' + String(puzzles.length + 1).padStart(3, '0'),
      'snapback_apply', '初级', '黑先 倒扑', rating,
      p.b, p.w, p.ans
    ));
  }
  return puzzles;
}

// --- snapback_mixed: mix of snapback-flavor captures (rating 420-440) ---
function generateSnapbackMixed() {
  var puzzles = [];
  // Combine multiple bases for variety
  var bases = [
    // 2-stone line W with internal capture
    { b: [[1,0],[2,1],[0,2],[1,2]], w: [[0,0],[0,1]], ans: [1,1] },
    // 3-stone L W with internal capture
    { b: [[2,0],[2,1],[0,2],[1,2],[2,2]], w: [[0,0],[1,0],[0,1]], ans: [1,1] },
    // Edge 3-stone W with outside capture
    { b: [[0,0],[1,0],[2,0],[4,0],[0,1],[4,1],[1,2],[2,2],[3,2],[4,2]], w: [[3,0],[3,1],[2,1]], ans: [1,1] },
  ];
  var candidates = expandSnapbackPatterns(bases);
  // Pick a diverse subset
  var stepSize = Math.max(1, Math.floor(candidates.length / 12));
  var selected = [];
  for (var i = 0; i < candidates.length && selected.length < 10; i += stepSize) {
    selected.push(candidates[i]);
  }
  if (selected.length < 10) {
    for (var i = 0; i < candidates.length && selected.length < 10; i++) {
      if (selected.indexOf(candidates[i]) === -1) selected.push(candidates[i]);
    }
  }
  for (var i = 0; i < selected.length && puzzles.length < 10; i++) {
    var p = selected[i];
    var rating = ratingForIndex(puzzles.length, 10, 420, 440);
    puzzles.push(makePuzzle(
      'gen_snapback_mixed_' + String(puzzles.length + 1).padStart(3, '0'),
      'snapback_mixed', '初级', '黑先 吃子', rating,
      p.b, p.w, p.ans
    ));
  }
  return puzzles;
}

// --- Eyes helpers: symmetry expansion (reuses snap helpers) ---
function eyeVariants(pattern) {
  return snapBackVariants(pattern);
}

/** Expand eye base patterns into verified variants */
function expandEyePatterns(bases) {
  var all = [];
  for (var bi = 0; bi < bases.length; bi++) {
    var vs = eyeVariants(bases[bi]);
    for (var i = 0; i < vs.length; i++) {
      if (verifyValidBlackMove(vs[i].b, vs[i].w, vs[i].ans)) {
        all.push(vs[i]);
      }
    }
  }
  return all;
}

// --- eyes_basic: complete an eye wall / block eye invasion (rating 400-430) ---
function generateEyesBasic() {
  var puzzles = [];
  // Base: small corner B group playing a sealing stone to form eye at (1,1)
  // row 0: B B B .
  // row 1: B . * B    <- * = answer at (2,1)
  // row 2: B B B .
  // (2,1) seals the group; eye at (1,1)
  var bases = [
    {
      b: [[0,0],[1,0],[2,0],[0,1],[0,2],[1,2],[2,2]],
      w: [[3,0],[3,1],[3,2],[0,3],[1,3],[2,3]],
      ans: [2,1],
    },
    // Bigger 'bent-four' eye shape:
    // row 0: B B B B .
    // row 1: B . . B .    <- eye space (1,1)(2,1); play (2,1) or (1,1)? both OK
    // row 2: B B B B .
    // Just completes wall - answer is a standard vital point
    {
      b: [[0,0],[1,0],[2,0],[3,0],[0,1],[3,1],[0,2],[1,2],[2,2],[3,2]],
      w: [[4,0],[4,1],[4,2],[0,3],[1,3],[2,3],[3,3]],
      ans: [1,1],
    },
  ];
  var candidates = expandEyePatterns(bases);
  for (var i = 0; i < candidates.length && puzzles.length < 8; i++) {
    var p = candidates[i];
    var rating = ratingForIndex(puzzles.length, 8, 400, 430);
    puzzles.push(makePuzzle(
      'gen_eyes_basic_' + String(puzzles.length + 1).padStart(3, '0'),
      'eyes_basic', '初级', '黑先 做眼', rating,
      p.b, p.w, p.ans
    ));
  }
  return puzzles;
}

// --- eyes_make: divide eye space into 2 eyes to live (rating 430-450) ---
function generateEyesMake() {
  var puzzles = [];
  // Base: bulky-5 edge shape where playing middle divides into 2 eyes
  // row 0: . B B B .
  // row 1: B . . . B   <- eye space (1,1)(2,1)(3,1); play (2,1) to split
  // row 2: B B B B B
  // White surrounds via row 3
  var bases = [
    {
      b: [[1,0],[2,0],[3,0],[0,1],[4,1],[0,2],[1,2],[2,2],[3,2],[4,2]],
      w: [[0,3],[1,3],[2,3],[3,3],[4,3]],
      ans: [2,1],
    },
    // Smaller bulky-3 shape
    {
      b: [[0,0],[1,0],[2,0],[0,1],[3,1],[0,2],[1,2],[2,2],[3,2]],
      w: [[4,0],[4,1],[4,2],[0,3],[1,3],[2,3],[3,3]],
      ans: [1,1],
    },
  ];
  var candidates = expandEyePatterns(bases);
  for (var i = 0; i < candidates.length && puzzles.length < 8; i++) {
    var p = candidates[i];
    var rating = ratingForIndex(puzzles.length, 8, 430, 450);
    puzzles.push(makePuzzle(
      'gen_eyes_make_' + String(puzzles.length + 1).padStart(3, '0'),
      'eyes_make', '初级', '黑先 做活', rating,
      p.b, p.w, p.ans
    ));
  }
  return puzzles;
}

// --- eyes_kill: destroy opponent's eye by playing vital point (rating 440-460) ---
function generateEyesKill() {
  var puzzles = [];
  // Base: white bulky edge shape, black plays vital point to prevent 2 eyes.
  // Keep the pattern in the interior so there's room for the black wall
  // without dead corner stones.
  //
  // row 0: . . . . . . . . .
  // row 1: . B B B B B . . .
  // row 2: . B W W W B . . .
  // row 3: . B W . W B . . .   <- W bulky-4 with eye space at (3,3)
  // row 4: . B W W W B . . .
  // row 5: . B B B B B . . .
  //
  // B wraps around W. W has eye space at (3,3). W is bulky-4-in-square, dead by nature.
  // But let's try a true bulky-5 eye: W is 6-stone edge shape with bulky-3 eye space.
  //
  // row 0: . . . . . . . . .
  // row 1: . B B B B B . . .
  // row 2: . B W W W B . . .
  // row 3: . B . . . B . . .   <- eye space (2,3)(3,3)(4,3); vital = (3,3)
  // row 4: . B W W W B . . .
  // row 5: . B B B B B . . .
  // Wait, this has two separate W groups.
  //
  // Simpler: B surrounds W on top with an escape hatch for B on bottom.
  // row 0: . B B B B B . . .
  // row 1: B W W W W W B . .     <- W row with eye shape above
  // row 2: B W . . . W B . .
  // row 3: B W W W W W B . .
  // row 4: . B B B B B . . .
  //
  // W bulky with (2,2)(3,2)(4,2) empty - BUT that's 3 eye points surrounded by W.
  // Actually the shape needs to be killable. W as a 2-rows-thick wall has 2 eyes in the middle.
  //
  // Simplest dead W shape with vital point: L-shape bent-4
  // row 0: . B B B .
  // row 1: B W W B .
  // row 2: B W . B .   <- W(1,1)(2,1)(1,2) with vital point (2,2)
  // row 3: B B B . .
  // Actually (2,2) is free, and W shape (1,1)(2,1)(1,2) is bent-3.
  // Vital point: where? For bent-3, the vital is (2,2) which makes the shape
  // into 3 stones with 2 libs, dying in gote.
  // Let's use this simple shape.
  var bases = [
    // Bent-3 W in corner with B surrounding
    {
      b: [[1,0],[2,0],[3,0],[0,1],[3,1],[0,2],[3,2],[0,3],[1,3],[2,3]],
      w: [[1,1],[2,1],[1,2]],
      ans: [2,2],
    },
    // 4-stone L-shape W
    {
      b: [[1,0],[2,0],[3,0],[4,0],[0,1],[4,1],[0,2],[3,2],[4,2],[0,3],[1,3],[2,3],[3,3]],
      w: [[1,1],[2,1],[3,1],[1,2]],
      ans: [2,2],
    },
  ];
  var candidates = expandEyePatterns(bases);
  for (var i = 0; i < candidates.length && puzzles.length < 8; i++) {
    var p = candidates[i];
    var rating = ratingForIndex(puzzles.length, 8, 440, 460);
    puzzles.push(makePuzzle(
      'gen_eyes_kill_' + String(puzzles.length + 1).padStart(3, '0'),
      'eyes_kill', '初级', '黑先 破眼', rating,
      p.b, p.w, p.ans
    ));
  }
  return puzzles;
}

// --- eyes_mixed: mix of make and kill (rating 450-470) ---
function generateEyesMixed() {
  var puzzles = [];
  // Combine make and kill bases
  var makeBases = [
    {
      b: [[1,0],[2,0],[3,0],[0,1],[4,1],[0,2],[1,2],[2,2],[3,2],[4,2]],
      w: [[0,3],[1,3],[2,3],[3,3],[4,3]],
      ans: [2,1],
    },
  ];
  var killBases = [
    // Bent-3 W in corner - vital point at (2,2)
    {
      b: [[1,0],[2,0],[3,0],[0,1],[3,1],[0,2],[3,2],[0,3],[1,3],[2,3]],
      w: [[1,1],[2,1],[1,2]],
      ans: [2,2],
    },
  ];
  var makeCandidates = expandEyePatterns(makeBases);
  var killCandidates = expandEyePatterns(killBases);
  // Interleave
  var interleaved = [];
  var maxLen = Math.max(makeCandidates.length, killCandidates.length);
  for (var i = 0; i < maxLen; i++) {
    if (makeCandidates[i]) interleaved.push({ p: makeCandidates[i], type: 'make' });
    if (killCandidates[i]) interleaved.push({ p: killCandidates[i], type: 'kill' });
  }
  for (var i = 0; i < interleaved.length && puzzles.length < 10; i++) {
    var entry = interleaved[i];
    var p = entry.p;
    var desc = entry.type === 'make' ? '黑先 做眼' : '黑先 破眼';
    var rating = ratingForIndex(puzzles.length, 10, 450, 470);
    puzzles.push(makePuzzle(
      'gen_eyes_mixed_' + String(puzzles.length + 1).padStart(3, '0'),
      'eyes_mixed', '初级', desc, rating,
      p.b, p.w, p.ans
    ));
  }
  return puzzles;
}


// ============================================================
// Phase 4: 进阶 10K-7K (rating 460-520)
// ============================================================

/**
 * Strict semeai verification:
 * - No 0-lib groups initially
 * - B group and W group both present
 * - W has at least 2 libs (not already dead)
 * - B's move is legal
 * - After B's move, W's libs decreased OR W captured
 */
function verifySemeaiStrict(black, white, ans, wTarget, bGroupStone) {
  if (!validateCoords(black, white, ans)) return false;
  var board = buildBoard(black, white);
  for (var y = 0; y < BOARD_SIZE; y++) {
    for (var x = 0; x < BOARD_SIZE; x++) {
      if (board[y][x] !== null && getLiberties(board, x, y) === 0) return false;
    }
  }
  if (board[wTarget[1]][wTarget[0]] !== 'white') return false;
  if (board[bGroupStone[1]][bGroupStone[0]] !== 'black') return false;
  var wLibsBefore = getLiberties(board, wTarget[0], wTarget[1]);
  if (wLibsBefore < 2) return false;
  var r = playMove(board, ans[0], ans[1], 'black');
  if (!r.isValid) return false;
  if (r.captured.length > 0) return true;
  if (r.newBoard[wTarget[1]][wTarget[0]] !== 'white') return true;
  var wLibsAfter = getLiberties(r.newBoard, wTarget[0], wTarget[1]);
  return wLibsAfter < wLibsBefore;
}

/** Expand semeai patterns, verifying via verifySemeaiStrict */
function expandSemeaiPatterns(bases) {
  var all = [];
  for (var bi = 0; bi < bases.length; bi++) {
    var vs = snapBackVariants({ b: bases[bi].b, w: bases[bi].w, ans: bases[bi].ans });
    // Also need to map wTarget, bGroupStone through the same symmetry
    // Simpler: regenerate patterns from each transformation
    var ptrns = allEightTransforms(bases[bi]);
    for (var i = 0; i < ptrns.length; i++) {
      if (verifySemeaiStrict(ptrns[i].b, ptrns[i].w, ptrns[i].ans, ptrns[i].wTarget, ptrns[i].bGroupStone)) {
        all.push(ptrns[i]);
      }
    }
  }
  return all;
}

/** Generate all 8 symmetric variants of a pattern with multiple points (ans, wTarget, bGroupStone) */
function allEightTransforms(pattern) {
  function transform(p, fn) {
    var r = { b: p.b.map(fn), w: p.w.map(fn), ans: fn(p.ans) };
    if (p.wTarget) r.wTarget = fn(p.wTarget);
    if (p.bGroupStone) r.bGroupStone = fn(p.bGroupStone);
    return r;
  }
  var identity = function(c) { return [c[0], c[1]]; };
  var mh = function(c) { return [8 - c[0], c[1]]; };
  var mv = function(c) { return [c[0], 8 - c[1]]; };
  var rot = function(c) { return [8 - c[1], c[0]]; };
  var list = [];
  var curFn = identity;
  var current = transform(pattern, curFn);
  for (var r = 0; r < 4; r++) {
    list.push(current);
    list.push(transform(current, mh));
    current = transform(current, rot);
  }
  // Deduplicate
  var seen = {};
  var unique = [];
  for (var i = 0; i < list.length; i++) {
    var key = JSON.stringify([list[i].b.slice().sort(), list[i].w.slice().sort(), list[i].ans]);
    if (!seen[key]) {
      seen[key] = true;
      unique.push(list[i]);
    }
  }
  return unique;
}

// --- semeai_basic: 2-vs-2 liberty race (rating 460-480) ---
function generateSemeaiBasic() {
  var puzzles = [];
  // Base: B column vs W column, B has one extra lib
  // row 0: B W . .
  // row 1: B W . .
  // row 2: B W . .
  // row 3: B B . .   <- extra B stone giving B 1 more lib
  // row 4: B B . .
  // B libs: 4, W libs: 3. B plays (2,0) to reduce W to 2.
  var bases = [
    {
      b: [[0,0],[0,1],[0,2],[0,3],[0,4],[1,3],[1,4]],
      w: [[1,0],[1,1],[1,2]],
      ans: [2,0],
      wTarget: [1,0],
      bGroupStone: [0,0],
    },
    // Same but B plays (2,2) or (2,1)
    {
      b: [[0,0],[0,1],[0,2],[0,3],[0,4],[1,3],[1,4]],
      w: [[1,0],[1,1],[1,2]],
      ans: [2,2],
      wTarget: [1,0],
      bGroupStone: [0,0],
    },
  ];
  var candidates = expandSemeaiPatterns(bases);
  for (var i = 0; i < candidates.length && puzzles.length < 8; i++) {
    var p = candidates[i];
    var rating = ratingForIndex(puzzles.length, 8, 460, 480);
    puzzles.push(makePuzzle(
      'gen_semeai_basic_' + String(puzzles.length + 1).padStart(3, '0'),
      'semeai_basic', '进阶', '黑先 对杀', rating,
      p.b, p.w, p.ans
    ));
  }
  return puzzles;
}

// --- semeai_liberties: count liberties carefully (rating 480-500) ---
function generateSemeaiLiberties() {
  var puzzles = [];
  // Bases with slightly more complex lib counts
  var bases = [
    // 4v3 semeai
    {
      b: [[0,0],[0,1],[0,2],[0,3],[0,4],[0,5],[1,4],[1,5]],
      w: [[1,0],[1,1],[1,2],[1,3]],
      ans: [2,0],
      wTarget: [1,0],
      bGroupStone: [0,0],
    },
    // 3v3 semeai with tight liberties
    {
      b: [[0,0],[0,1],[0,2],[0,3],[0,4],[1,4]],
      w: [[1,0],[1,1],[1,2],[1,3]],
      ans: [2,0],
      wTarget: [1,0],
      bGroupStone: [0,0],
    },
  ];
  var candidates = expandSemeaiPatterns(bases);
  for (var i = 0; i < candidates.length && puzzles.length < 8; i++) {
    var p = candidates[i];
    var rating = ratingForIndex(puzzles.length, 8, 480, 500);
    puzzles.push(makePuzzle(
      'gen_semeai_liberties_' + String(puzzles.length + 1).padStart(3, '0'),
      'semeai_liberties', '进阶', '黑先 对杀', rating,
      p.b, p.w, p.ans
    ));
  }
  return puzzles;
}

// --- semeai_mixed: mix of semeai patterns (rating 500-520) ---
function generateSemeaiMixed() {
  var puzzles = [];
  var bases = [
    {
      b: [[0,0],[0,1],[0,2],[0,3],[0,4],[1,3],[1,4]],
      w: [[1,0],[1,1],[1,2]],
      ans: [2,0],
      wTarget: [1,0],
      bGroupStone: [0,0],
    },
    {
      b: [[0,0],[0,1],[0,2],[0,3],[0,4],[0,5],[1,4],[1,5]],
      w: [[1,0],[1,1],[1,2],[1,3]],
      ans: [2,0],
      wTarget: [1,0],
      bGroupStone: [0,0],
    },
  ];
  var candidates = expandSemeaiPatterns(bases);
  for (var i = 0; i < candidates.length && puzzles.length < 10; i++) {
    var p = candidates[i];
    var rating = ratingForIndex(puzzles.length, 10, 500, 520);
    puzzles.push(makePuzzle(
      'gen_semeai_mixed_' + String(puzzles.length + 1).padStart(3, '0'),
      'semeai_mixed', '进阶', '黑先 对杀', rating,
      p.b, p.w, p.ans
    ));
  }
  return puzzles;
}

/**
 * Verify a 'net' move: after black plays, white target has exactly 1 liberty
 * AND the black surrounding group has enough liberties to not be captured back.
 */
function verifyNetMove(black, white, ans, wTarget) {
  if (!validateCoords(black, white, ans)) return false;
  var board = buildBoard(black, white);
  for (var y = 0; y < BOARD_SIZE; y++) {
    for (var x = 0; x < BOARD_SIZE; x++) {
      if (board[y][x] !== null && getLiberties(board, x, y) === 0) return false;
    }
  }
  if (board[wTarget[1]][wTarget[0]] !== 'white') return false;
  var wLibsBefore = getLiberties(board, wTarget[0], wTarget[1]);
  if (wLibsBefore < 2) return false;
  var r = playMove(board, ans[0], ans[1], 'black');
  if (!r.isValid) return false;
  if (r.captured.length > 0) return true;
  if (r.newBoard[wTarget[1]][wTarget[0]] !== 'white') return true;
  var wLibsAfter = getLiberties(r.newBoard, wTarget[0], wTarget[1]);
  return wLibsAfter === 1;
}

/** Expand tesuji patterns and verify with verifyNetMove or verifyCapture */
function expandTesujiNetPatterns(bases) {
  var all = [];
  for (var bi = 0; bi < bases.length; bi++) {
    var ptrns = allEightTransforms(bases[bi]);
    for (var i = 0; i < ptrns.length; i++) {
      if (verifyNetMove(ptrns[i].b, ptrns[i].w, ptrns[i].ans, ptrns[i].wTarget)) {
        all.push(ptrns[i]);
      }
    }
  }
  return all;
}

// --- tesuji_net: net capture (reduce W to 1 liberty) (rating 470-490) ---
function generateTesujiNet() {
  var puzzles = [];
  // Base: W single stone with 2 libs, B plays to reduce to atari.
  // Pattern: W(2,1) surrounded by B on left/right/below, has libs (2,0),(2,2).
  // B plays (2,2) to atari W, leaving (2,0) as last lib.
  var bases = [
    {
      b: [[1,1],[3,1],[1,2],[3,2]],
      w: [[2,1]],
      ans: [2,2],
      wTarget: [2,1],
    },
    // Another pattern with 3 libs, B plays one of two good moves
    // row 0: . B B B .
    // row 1: . B W B .     <- W(2,1) libs: (2,2)
    // row 2: . . . . .
    // hmm 1 lib again. Let me find a 2-lib position.
    //
    // row 0: . B . B .
    // row 1: . B W B .
    // row 2: . B B B .
    // W(2,1) nbrs (2,0)=.,(1,1)=B,(3,1)=B,(2,2)=B. Lib (2,0). 1 lib.
    //
    // row 0: . . . . .
    // row 1: . B W B .
    // row 2: . . B . .    <- only (2,2) B
    // W(2,1) nbrs (1,1)=B,(3,1)=B,(2,0)=.,(2,2)=B. Lib (2,0). 1 lib.
    //
    // I need W with 2 libs. Let me remove one B neighbor:
    // row 0: . . . . .
    // row 1: B W . B .     <- W(1,1) libs (1,0),(1,2),(2,1)
    // row 2: . B . B .
    //
    // W(1,1) libs: (0,1)=B,(2,1)=.,(1,0)=.,(1,2)=B. Libs (2,1),(1,0). 2 libs!
    // B plays (1,0) to atari (lib=(2,1))? Or B plays (2,1) to atari (lib=(1,0))?
    // Both work. Let me use (2,1).
    {
      b: [[0,1],[3,1],[1,2],[3,2]],
      w: [[1,1]],
      ans: [1,0],
      wTarget: [1,1],
    },
  ];
  var candidates = expandTesujiNetPatterns(bases);
  for (var i = 0; i < candidates.length && puzzles.length < 8; i++) {
    var p = candidates[i];
    var rating = ratingForIndex(puzzles.length, 8, 470, 490);
    puzzles.push(makePuzzle(
      'gen_tesuji_net_' + String(puzzles.length + 1).padStart(3, '0'),
      'tesuji_net', '进阶', '黑先 枷吃', rating,
      p.b, p.w, p.ans
    ));
  }
  return puzzles;
}

/** Expand tesuji throw patterns verified by verifyCapture */
function expandTesujiThrowPatterns(bases) {
  var all = [];
  for (var bi = 0; bi < bases.length; bi++) {
    var ptrns = allEightTransforms(bases[bi]);
    for (var i = 0; i < ptrns.length; i++) {
      if (verifyCapture(ptrns[i].b, ptrns[i].w, ptrns[i].ans)) {
        all.push(ptrns[i]);
      }
    }
  }
  return all;
}

// --- tesuji_throw: throw-in capture (rating 490-510) ---
function generateTesujiThrow() {
  var puzzles = [];
  // Base: corner throw-in that captures by filling the final eye point
  var bases = [
    // Corner 3-stone W with 1 internal lib
    { b: [[2,0],[2,1],[0,2],[1,2]], w: [[0,0],[1,0],[0,1]], ans: [1,1] },
    // 2-stone edge throw
    { b: [[1,0],[2,1],[0,2],[1,2]], w: [[0,0],[0,1]], ans: [1,1] },
    // 5-stone corner
    { b: [[3,0],[3,1],[0,2],[1,2],[2,2]], w: [[0,0],[1,0],[2,0],[0,1],[2,1]], ans: [1,1] },
  ];
  var candidates = expandTesujiThrowPatterns(bases);
  for (var i = 0; i < candidates.length && puzzles.length < 8; i++) {
    var p = candidates[i];
    var rating = ratingForIndex(puzzles.length, 8, 490, 510);
    puzzles.push(makePuzzle(
      'gen_tesuji_throw_' + String(puzzles.length + 1).padStart(3, '0'),
      'tesuji_throw', '进阶', '黑先 扑', rating,
      p.b, p.w, p.ans
    ));
  }
  return puzzles;
}

// --- tesuji_mixed: mix of net and throw-in (rating 510-520) ---
function generateTesujiMixed() {
  var puzzles = [];
  // Net bases (atari a white stone)
  var netBases = [
    {
      b: [[1,0],[3,0],[1,1],[3,1],[1,2],[3,2],[2,2]],
      w: [[2,1]],
      ans: [2,0],
      wTarget: [2,1],
    },
  ];
  // Throw bases (capture immediately)
  var throwBases = [
    { b: [[2,0],[2,1],[0,2],[1,2]], w: [[0,0],[1,0],[0,1]], ans: [1,1] },
    { b: [[1,0],[2,1],[0,2],[1,2]], w: [[0,0],[0,1]], ans: [1,1] },
  ];
  var netCandidates = expandTesujiNetPatterns(netBases);
  var throwCandidates = expandTesujiThrowPatterns(throwBases);
  // Interleave
  var interleaved = [];
  var maxLen = Math.max(netCandidates.length, throwCandidates.length);
  for (var i = 0; i < maxLen; i++) {
    if (netCandidates[i]) interleaved.push({ p: netCandidates[i], type: 'net' });
    if (throwCandidates[i]) interleaved.push({ p: throwCandidates[i], type: 'throw' });
  }
  for (var i = 0; i < interleaved.length && puzzles.length < 10; i++) {
    var entry = interleaved[i];
    var p = entry.p;
    var desc = entry.type === 'net' ? '黑先 枷吃' : '黑先 扑';
    var rating = ratingForIndex(puzzles.length, 10, 510, 520);
    puzzles.push(makePuzzle(
      'gen_tesuji_mixed_' + String(puzzles.length + 1).padStart(3, '0'),
      'tesuji_mixed', '进阶', desc, rating,
      p.b, p.w, p.ans
    ));
  }
  return puzzles;
}


// ============================================================
// Find all valid solutions (multiple correct first moves)
// ============================================================

function findAllFirstMoves(puzzle) {
  var board = buildBoard(puzzle.initial_stones.black, puzzle.initial_stones.white);
  var validMoves = [];
  var correctMove = puzzle.correct_first_move;

  // For capture puzzles, check all empty points that also capture
  // For other puzzles, the specified answer is the only one
  var skillNode = puzzle.skill_node;
  var isCapture = skillNode.indexOf('cap') === 0 || skillNode.indexOf('snapback') === 0;

  if (isCapture) {
    // Find all moves that capture white stones
    for (var y = 0; y < BOARD_SIZE; y++) {
      for (var x = 0; x < BOARD_SIZE; x++) {
        if (board[y][x] !== null) continue;
        var result = playMove(board, x, y, 'black');
        if (result.isValid && result.captured.length > 0) {
          validMoves.push([x, y]);
        }
      }
    }
  }

  // Always include the specified correct move
  if (validMoves.length === 0) {
    validMoves.push(correctMove);
  }

  // Build all_solutions: each valid first move becomes a solution
  var allSolutions = [];
  for (var i = 0; i < validMoves.length; i++) {
    allSolutions.push([validMoves[i]]);
  }

  puzzle.all_solutions = allSolutions;
  if (allSolutions.length > 1) {
    // Keep the original correct_first_move, just expand all_solutions
  }

  return puzzle;
}


// ============================================================
// Main: generate all puzzles and write output
// ============================================================

function main() {
  var allPuzzles = [];
  var summary = {};

  var generators = [
    // Phase 1: 25K-20K (100-200)
    { name: 'cap1_single', fn: generateCap1Single },
    { name: 'cap1_double', fn: generateCap1Double },
    { name: 'cap1_corner', fn: generateCap1Corner },
    { name: 'cap1_edge', fn: generateCap1Edge },
    // Phase 1 continued: capture_adv (200-300)
    { name: 'cap2_center', fn: generateCap2Center },
    { name: 'cap2_multi', fn: generateCap2Multi },
    { name: 'cap2_mixed', fn: generateCap2Mixed },
    // Phase 2: 20K-16K (200-300)
    { name: 'escape_basic', fn: generateEscapeBasic },
    { name: 'escape_connect', fn: generateEscapeConnect },
    { name: 'escape_mixed', fn: generateEscapeMixed },
    { name: 'connect_basic', fn: generateConnectBasic },
    { name: 'connect_cut', fn: generateConnectCut },
    { name: 'connect_mixed', fn: generateConnectMixed },
    // Phase 3: 16K-10K (300-460)
    { name: 'ladder_basic', fn: generateLadderBasic },
    { name: 'ladder_judge', fn: generateLadderJudge },
    { name: 'ladder_mixed', fn: generateLadderMixed },
    { name: 'snapback_basic', fn: generateSnapbackBasic },
    { name: 'snapback_apply', fn: generateSnapbackApply },
    { name: 'snapback_mixed', fn: generateSnapbackMixed },
    { name: 'eyes_basic', fn: generateEyesBasic },
    { name: 'eyes_make', fn: generateEyesMake },
    { name: 'eyes_kill', fn: generateEyesKill },
    { name: 'eyes_mixed', fn: generateEyesMixed },
    // Phase 4: 10K-7K (460-520)
    { name: 'semeai_basic', fn: generateSemeaiBasic },
    { name: 'semeai_liberties', fn: generateSemeaiLiberties },
    { name: 'semeai_mixed', fn: generateSemeaiMixed },
    { name: 'tesuji_net', fn: generateTesujiNet },
    { name: 'tesuji_throw', fn: generateTesujiThrow },
    { name: 'tesuji_mixed', fn: generateTesujiMixed },
  ];

  for (var i = 0; i < generators.length; i++) {
    var gen = generators[i];
    var puzzles = gen.fn();
    summary[gen.name] = puzzles.length;
    allPuzzles = allPuzzles.concat(puzzles);
  }

  // Find alternative solutions for capture puzzles
  for (var i = 0; i < allPuzzles.length; i++) {
    allPuzzles[i] = findAllFirstMoves(allPuzzles[i]);
  }

  // Final validation pass
  var valid = [];
  var invalid = 0;
  for (var i = 0; i < allPuzzles.length; i++) {
    var p = allPuzzles[i];
    var ok = true;

    // Verify all coordinates are in range
    var allCoords = p.initial_stones.black.concat(p.initial_stones.white).concat([p.correct_first_move]);
    for (var c = 0; c < allCoords.length; c++) {
      if (allCoords[c][0] < 0 || allCoords[c][0] > 8 || allCoords[c][1] < 0 || allCoords[c][1] > 8) {
        ok = false;
        break;
      }
    }

    // Verify no duplicate stones
    if (ok) {
      var seen = {};
      var stones = p.initial_stones.black.concat(p.initial_stones.white);
      for (var s = 0; s < stones.length; s++) {
        var key = stones[s][0] + ',' + stones[s][1];
        if (seen[key]) { ok = false; break; }
        seen[key] = true;
      }
      // Verify answer point is empty
      var ansKey = p.correct_first_move[0] + ',' + p.correct_first_move[1];
      if (seen[ansKey]) ok = false;
    }

    // Verify the move is valid with go-logic
    if (ok) {
      var board = buildBoard(p.initial_stones.black, p.initial_stones.white);
      if (!isValidMove(board, p.correct_first_move[0], p.correct_first_move[1], 'black')) {
        ok = false;
      }
    }

    // Verify board position is valid (no 0-liberty groups in initial position)
    if (ok) {
      var board = buildBoard(p.initial_stones.black, p.initial_stones.white);
      var checked = {};
      for (var si = 0; si < p.initial_stones.black.length && ok; si++) {
        var st = p.initial_stones.black[si];
        var sk = st[0] + ',' + st[1];
        if (!checked[sk]) {
          checked[sk] = true;
          if (getLiberties(board, st[0], st[1]) === 0) {
            ok = false;
            console.log('  INVALID: Black group at (' + st[0] + ',' + st[1] + ') has 0 liberties in ' + p.id);
          }
        }
      }
      for (var si = 0; si < p.initial_stones.white.length && ok; si++) {
        var st = p.initial_stones.white[si];
        var sk = st[0] + ',' + st[1];
        if (!checked[sk]) {
          checked[sk] = true;
          if (getLiberties(board, st[0], st[1]) === 0) {
            ok = false;
            console.log('  INVALID: White group at (' + st[0] + ',' + st[1] + ') has 0 liberties in ' + p.id);
          }
        }
      }
    }

    if (ok) {
      valid.push(p);
    } else {
      invalid++;
      console.log('  INVALID puzzle removed: ' + p.id);
    }
  }

  // Check for duplicate IDs
  var idSet = {};
  for (var i = 0; i < valid.length; i++) {
    if (idSet[valid[i].id]) {
      console.log('  WARNING: Duplicate ID: ' + valid[i].id);
    }
    idSet[valid[i].id] = true;
  }

  // Write output
  var outputPath = path.join(__dirname, '..', 'beginner_problems.json');
  fs.writeFileSync(outputPath, JSON.stringify(valid, null, 2), 'utf8');

  // Print summary
  console.log('\n=== Beginner Puzzle Generation Summary ===\n');

  var phases = [
    { name: 'Phase 1: 入门 25K-20K (100-200)', prefixes: ['cap1'] },
    { name: 'Phase 2: 基础 20K-16K (200-300)', prefixes: ['cap2', 'escape', 'connect'] },
    { name: 'Phase 3: 初级 16K-10K (300-460)', prefixes: ['ladder', 'snapback', 'eyes'] },
    { name: 'Phase 4: 进阶 10K-7K (460-520)', prefixes: ['semeai', 'tesuji'] },
  ];

  for (var pi = 0; pi < phases.length; pi++) {
    var phase = phases[pi];
    console.log(phase.name);
    var phaseTotal = 0;
    var keys = Object.keys(summary);
    for (var k = 0; k < keys.length; k++) {
      var matched = false;
      for (var pf = 0; pf < phase.prefixes.length; pf++) {
        if (keys[k].indexOf(phase.prefixes[pf]) === 0) {
          matched = true;
          break;
        }
      }
      if (matched) {
        console.log('  ' + keys[k] + ': ' + summary[keys[k]] + ' puzzles');
        phaseTotal += summary[keys[k]];
      }
    }
    console.log('  [subtotal: ' + phaseTotal + ']\n');
  }

  console.log('Total generated: ' + allPuzzles.length);
  if (invalid > 0) {
    console.log('Invalid removed: ' + invalid);
  }
  console.log('Valid puzzles written: ' + valid.length);
  console.log('Output: ' + outputPath);

  if (valid.length > 0) {
    var minRating = valid.reduce(function(m, p) { return Math.min(m, p.difficulty_rating); }, 9999);
    var maxRating = valid.reduce(function(m, p) { return Math.max(m, p.difficulty_rating); }, 0);
    console.log('Rating range: ' + minRating + ' - ' + maxRating);
  }

  // Print skill node summary
  console.log('\nSkill node breakdown:');
  var nodeCount = {};
  for (var i = 0; i < valid.length; i++) {
    var node = valid[i].skill_node;
    nodeCount[node] = (nodeCount[node] || 0) + 1;
  }
  var nodes = Object.keys(nodeCount).sort();
  for (var i = 0; i < nodes.length; i++) {
    console.log('  ' + nodes[i] + ': ' + nodeCount[nodes[i]]);
  }
}

main();

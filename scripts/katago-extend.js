#!/usr/bin/env node
/**
 * 用 KataGo 为每道题生成多步答案
 * 输入: problems_all.json (只有第1手)
 * 输出: problems_extended.json (3-5步完整序列)
 *
 * 用法: node scripts/katago-extend.js [start] [count]
 */
var fs = require('fs')
var cp = require('child_process')
var path = require('path')

var MODEL = '/opt/homebrew/Cellar/katago/1.16.4/share/katago/g170e-b20c256x2-s5303129600-d1228401921.bin.gz'
var CONFIG = '/opt/homebrew/Cellar/katago/1.16.4/share/katago/configs/gtp_example.cfg'

var COLS = 'ABCDEFGHJKLMNOPQRST' // 围棋列名 (跳过I)

function xyToGTP(x, y, size) {
  return COLS[x] + String(size - y)
}

function gtpToXY(gtp, size) {
  if (!gtp || gtp === 'pass' || gtp === 'resign') return null
  var col = COLS.indexOf(gtp[0].toUpperCase())
  var row = size - parseInt(gtp.substring(1))
  if (col < 0 || isNaN(row)) return null
  return [col, row]
}

// 启动一个 KataGo GTP 进程
function startKataGo() {
  var proc = cp.spawn('katago', ['gtp', '-model', MODEL, '-config', CONFIG], {
    env: Object.assign({}, process.env, { PATH: '/opt/homebrew/bin:/usr/local/bin:' + process.env.PATH }),
    stdio: ['pipe', 'pipe', 'pipe'],
  })
  var buffer = ''
  var resolveNext = null

  proc.stdout.on('data', function (data) {
    buffer += data.toString()
    // GTP 响应以两个换行结尾
    while (buffer.indexOf('\n\n') !== -1) {
      var idx = buffer.indexOf('\n\n')
      var response = buffer.substring(0, idx).trim()
      buffer = buffer.substring(idx + 2)
      if (resolveNext) {
        var r = resolveNext
        resolveNext = null
        r(response)
      }
    }
  })

  proc.stderr.on('data', function () { /* ignore */ })

  function send(cmd) {
    return new Promise(function (resolve) {
      resolveNext = resolve
      proc.stdin.write(cmd + '\n')
    })
  }

  function kill() {
    proc.stdin.write('quit\n')
    setTimeout(function () { proc.kill() }, 1000)
  }

  return { send: send, kill: kill }
}

async function extendProblem(katago, problem) {
  var size = problem.board_size
  var firstMove = problem.correct_first_move

  // 设置棋盘
  await katago.send('boardsize ' + size)
  await katago.send('clear_board')

  // 放置初始棋子
  for (var b of problem.initial_stones.black) {
    await katago.send('play black ' + xyToGTP(b[0], b[1], size))
  }
  for (var w of problem.initial_stones.white) {
    await katago.send('play white ' + xyToGTP(w[0], w[1], size))
  }

  // 下第1手 (已知正解)
  await katago.send('play black ' + xyToGTP(firstMove[0], firstMove[1], size))
  var sequence = [firstMove]

  // 让 KataGo 生成后续变化 (目标3-5步)
  var colors = ['white', 'black', 'white', 'black']
  for (var i = 0; i < 4; i++) {
    var color = colors[i]
    var resp = await katago.send('genmove ' + color)
    var move = resp.replace('= ', '').trim()

    if (move === 'pass' || move === 'resign' || !move) break

    var xy = gtpToXY(move, size)
    if (!xy) break
    sequence.push(xy)
  }

  return sequence
}

async function main() {
  var startIdx = parseInt(process.argv[2]) || 0
  var count = parseInt(process.argv[3]) || 100
  var inputFile = path.join(__dirname, '..', 'problems_all.json')
  var outputFile = path.join(__dirname, '..', 'problems_extended.json')

  var problems = JSON.parse(fs.readFileSync(inputFile, 'utf8'))
  console.log('总题数:', problems.length)
  console.log('处理范围:', startIdx, '-', startIdx + count - 1)

  // 加载已有的扩展结果
  var extended = {}
  if (fs.existsSync(outputFile)) {
    var existing = JSON.parse(fs.readFileSync(outputFile, 'utf8'))
    for (var p of existing) extended[p.id] = p
    console.log('已有扩展结果:', Object.keys(extended).length)
  }

  console.log('启动 KataGo...')
  var katago = startKataGo()

  // 等待 KataGo 初始化
  await katago.send('name')
  console.log('KataGo 就绪')

  var processed = 0
  var endIdx = Math.min(startIdx + count, problems.length)

  for (var i = startIdx; i < endIdx; i++) {
    var p = problems[i]

    // 跳过已处理的
    if (extended[p.id] && extended[p.id].correct_sequences &&
        extended[p.id].correct_sequences[0].length > 1) {
      processed++
      continue
    }

    try {
      var seq = await extendProblem(katago, p)
      p.correct_sequences = [seq]
      p.full_solution = seq
      extended[p.id] = p
      processed++

      if (processed % 10 === 0) {
        process.stdout.write('\r处理: ' + processed + '/' + (endIdx - startIdx) +
          ' (' + i + '/' + problems.length + ') 当前题步数: ' + seq.length)

        // 每100题保存一次
        if (processed % 100 === 0) {
          fs.writeFileSync(outputFile, JSON.stringify(Object.values(extended)))
        }
      }
    } catch (e) {
      console.log('\n错误 #' + i + ':', e.message)
    }
  }

  // 保存
  fs.writeFileSync(outputFile, JSON.stringify(Object.values(extended)))
  console.log('\n\n完成! 处理:', processed, '题')

  // 统计步数分布
  var stepDist = {}
  for (var id in extended) {
    var seqLen = extended[id].correct_sequences[0].length
    stepDist[seqLen] = (stepDist[seqLen] || 0) + 1
  }
  console.log('步数分布:')
  for (var k in stepDist) {
    console.log('  ' + k + '步:', stepDist[k])
  }

  katago.kill()
}

main().catch(function (e) { console.error(e); process.exit(1) })

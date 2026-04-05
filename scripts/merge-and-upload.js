#!/usr/bin/env node
/**
 * 合并3个worker的KataGo结果 + 上传多步题到云数据库
 * 用法: node scripts/merge-and-upload.js
 */
var fs = require('fs')
var path = require('path')

var envPath = path.join(__dirname, '..', '.env')
var envContent = fs.readFileSync(envPath, 'utf8')
var env = {}
envContent.split('\n').forEach(function (l) { var m = l.match(/^(\w+)=(.+)$/); if (m) env[m[1]] = m[2].trim() })

var cloudbase = require('@cloudbase/node-sdk')
var app = cloudbase.init({ env: env.CLOUD_ENV, secretId: env.TENCENT_SECRET_ID, secretKey: env.TENCENT_SECRET_KEY })
var db = app.database()

async function main() {
  // 1. 合并所有结果
  var files = [
    path.join(__dirname, '..', 'problems_extended.json'),
    '/tmp/katago-ext-1.json',
    '/tmp/katago-ext-2.json',
    '/tmp/katago-ext-3.json',
  ]
  var merged = {}
  var totalLoaded = 0
  for (var fi = 0; fi < files.length; fi++) {
    if (!fs.existsSync(files[fi])) { console.log('跳过(不存在):', files[fi]); continue }
    var data = JSON.parse(fs.readFileSync(files[fi], 'utf8'))
    for (var i = 0; i < data.length; i++) {
      var p = data[i]
      // 只保留多步结果，或者更新已有结果
      if (!merged[p.id] || (p.correct_sequences && p.correct_sequences[0].length > (merged[p.id].correct_sequences ? merged[p.id].correct_sequences[0].length : 0))) {
        merged[p.id] = p
      }
    }
    totalLoaded += data.length
    console.log('加载:', files[fi], '→', data.length, '条')
  }

  var all = Object.values(merged)
  var multi = all.filter(function (p) { return p.correct_sequences && p.correct_sequences[0].length > 1 })
  console.log('\n总计:', all.length, '已处理')
  console.log('多步题:', multi.length, '(' + (multi.length / all.length * 100).toFixed(1) + '%)')

  // 保存合并结果
  var mergedFile = path.join(__dirname, '..', 'problems_extended_all.json')
  fs.writeFileSync(mergedFile, JSON.stringify(all))
  console.log('保存到:', mergedFile)

  // 2. 上传多步题到云数据库
  console.log('\n上传多步题到云数据库...')
  var updated = 0, failed = 0
  var BATCH = 10
  for (var i = 0; i < multi.length; i += BATCH) {
    var chunk = multi.slice(i, i + BATCH)
    var promises = chunk.map(function (p) {
      return db.collection('problems').where({ problem_id: p.id }).update({
        correct_sequences: p.correct_sequences,
        steps: p.correct_sequences[0].length,
      }).then(function (res) {
        if (res.updated > 0) updated++
        else failed++
      }).catch(function () { failed++ })
    })
    await Promise.all(promises)
    if ((i + BATCH) % 200 === 0 || i + BATCH >= multi.length) {
      process.stdout.write('\r  更新: ' + Math.min(i + BATCH, multi.length) + '/' + multi.length + ' 成功:' + updated + ' 失败:' + failed)
    }
  }
  console.log('\n完成! 更新:' + updated + ' 失败:' + failed)

  // 步数分布
  var dist = {}
  all.forEach(function (p) {
    var len = p.correct_sequences ? p.correct_sequences[0].length : 1
    dist[len] = (dist[len] || 0) + 1
  })
  console.log('\n步数分布:')
  Object.keys(dist).sort(function (a, b) { return a - b }).forEach(function (k) {
    console.log('  ' + k + '步: ' + dist[k])
  })
}

main().catch(function (e) { console.error(e); process.exit(1) })

#!/usr/bin/env node
/**
 * 部署云函数 + 上传小程序
 * 用法:
 *   node scripts/deploy.js cloud          # 部署 goDaily 云函数
 *   node scripts/deploy.js cloud seed     # 部署 seedProblems 云函数
 *   node scripts/deploy.js mp             # 上传小程序（体验版）
 *   node scripts/deploy.js all            # 部署云函数 + 上传小程序
 */
var path = require('path')
var ci = require('miniprogram-ci')

var APPID = 'wx6afd6434f348034d'
var KEY_PATH = '/Users/qingfengjianke/.miniprogram/private.wx6afd6434f348034d.key'
var PROJECT_PATH = path.join(__dirname, '..')
var ENV_ID = 'cloud1-2gna4pn73d7fe81e'

var project = new ci.Project({
  appid: APPID,
  type: 'miniProgram',
  projectPath: PROJECT_PATH,
  privateKeyPath: KEY_PATH,
  ignores: ['node_modules/**/*', '.git/**/*', 'scripts/**/*'],
})

async function deployCloudFunction(name) {
  console.log('部署云函数: ' + name + ' ...')
  try {
    await ci.cloud.uploadFunction({
      project: project,
      env: ENV_ID,
      name: name,
      path: path.join(PROJECT_PATH, 'cloudfunctions', name),
      remoteNpmInstall: true,
    })
    console.log('  云函数 ' + name + ' 部署成功!')
  } catch (e) {
    console.error('  云函数 ' + name + ' 部署失败:', e.message || e)
  }
}

async function uploadMiniProgram() {
  console.log('上传小程序 ...')
  try {
    var result = await ci.upload({
      project: project,
      version: '4.5.0',
      desc: '等级分表统一+rating下限0+description字段',
      setting: {
        es6: true,
        es7: true,
        minify: true,
        autoPrefixWXSS: true,
        minifyWXML: true,
        minifyWXSS: true,
        minifyJS: true,
      },
    })
    console.log('  小程序上传成功!')
    console.log('  大小:', JSON.stringify(result))
  } catch (e) {
    console.error('  小程序上传失败:', e.message || e)
  }
}

async function main() {
  var cmd = process.argv[2] || 'all'

  if (cmd === 'cloud') {
    var funcName = process.argv[3] || 'goDaily'
    await deployCloudFunction(funcName)
  } else if (cmd === 'mp') {
    await uploadMiniProgram()
  } else if (cmd === 'all') {
    await deployCloudFunction('goDaily')
    await uploadMiniProgram()
  } else {
    console.log('用法: node scripts/deploy.js [cloud|mp|all]')
  }
}

main().catch(function (e) {
  console.error(e)
  process.exit(1)
})

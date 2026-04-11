// 题库管理页面 - 仅管理员可用
// 访问方式: 在 profile 页面或控制台中 wx.navigateTo({url:'/pages/admin/index'})

var apiModule = require('../../utils/api')
var api = apiModule.api

Page({
  data: {
    isAdmin: false,
    running: false,
    logs: [],
    statsResult: null,
    validateProgress: null,
    validateIssues: [],
    classifyProgress: null,
  },

  onLoad: function () {
    var that = this
    api.getStats().then(function (stats) {
      if (!stats.is_admin) {
        wx.showToast({ title: '无权限', icon: 'error' })
        setTimeout(function () { wx.navigateBack() }, 1500)
        return
      }
      that.setData({ isAdmin: true })
    }).catch(function () {
      wx.navigateBack()
    })
  },

  log: function(msg) {
    var logs = this.data.logs.slice()
    var time = new Date().toLocaleTimeString()
    logs.unshift('[' + time + '] ' + msg)
    if (logs.length > 100) logs = logs.slice(0, 100)
    this.setData({ logs: logs })
    console.log('[admin]', msg)
  },

  callCloud: function(params) {
    return wx.cloud.callFunction({
      name: 'seedProblems',
      data: params,
    }).then(function(res) { return res.result })
  },

  // ===== 统计 =====
  onStats: function() {
    var self = this
    self.setData({ running: true })
    self.log('正在获取题库统计...')

    self.callCloud({ action: 'stats' }).then(function(r) {
      self.log('统计完成: 总计 ' + r.total + ' 题')

      var tierList = []
      if (r.by_tier) {
        var keys = Object.keys(r.by_tier)
        for (var i = 0; i < keys.length; i++) {
          tierList.push({ name: keys[i], count: r.by_tier[keys[i]] })
        }
      }

      self.setData({ running: false, statsResult: { total: r.total, tierList: tierList } })
    }).catch(function(e) {
      self.log('统计失败: ' + (e.message || JSON.stringify(e)))
      self.setData({ running: false })
    })
  },

  // ===== 检测(只查) =====
  onValidate: function() {
    this._runValidate(false)
  },

  // ===== 检测+修复 =====
  onValidateFix: function() {
    var self = this
    wx.showModal({
      title: '确认',
      content: '将检测所有题目并删除有问题的题，确认执行？',
      success: function(res) {
        if (res.confirm) self._runValidate(true)
      }
    })
  },

  _runValidate: function(fix) {
    var self = this
    self.setData({
      running: true,
      validateProgress: { batch: 0, checked: 0, issues: 0, deleted: 0 },
      validateIssues: [],
    })
    self.log('开始检测题目...' + (fix ? '(将删除问题题)' : '(仅检查)'))

    var totalChecked = 0, totalIssues = 0, totalDeleted = 0
    var allIssues = []

    function processBatch(batch) {
      var params = { action: 'validate', batch: batch }
      if (fix) params.fix = true

      self.callCloud(params).then(function(r) {
        if (r.done) {
          self.log('检测完成! 共检查 ' + totalChecked + ' 题, 发现 ' + totalIssues + ' 个问题' + (fix ? ', 删除 ' + totalDeleted + ' 题' : ''))
          self.setData({ running: false })
          return
        }

        totalChecked += r.checked || 0
        totalIssues += r.issues_found || 0
        totalDeleted += r.deleted || 0

        if (r.issues && r.issues.length > 0) {
          for (var i = 0; i < r.issues.length; i++) {
            var issue = r.issues[i]
            issue.errors = issue.errors.join(', ')
            allIssues.push(issue)
          }
        }

        self.setData({
          validateProgress: { batch: batch, checked: totalChecked, issues: totalIssues, deleted: totalDeleted },
          validateIssues: allIssues.slice(0, 50),
        })
        self.log('批次 ' + batch + ': 检查 ' + r.checked + ' 题, 问题 ' + r.issues_found + (fix ? ', 删除 ' + r.deleted : ''))

        if (r.next_batch !== null && r.next_batch !== undefined) {
          // 延迟避免频率限制
          setTimeout(function() { processBatch(r.next_batch) }, 500)
        } else {
          self.log('检测完成! 共检查 ' + totalChecked + ' 题, 发现 ' + totalIssues + ' 个问题' + (fix ? ', 删除 ' + totalDeleted + ' 题' : ''))
          self.setData({ running: false })
        }
      }).catch(function(e) {
        self.log('批次 ' + batch + ' 失败: ' + (e.message || JSON.stringify(e)))
        // 重试一次
        setTimeout(function() {
          self.log('重试批次 ' + batch + '...')
          processBatch(batch)
        }, 2000)
      })
    }

    processBatch(0)
  },

  // ===== 重新分级 =====
  onClassify: function() {
    var self = this
    self.setData({
      running: true,
      classifyProgress: { batch: 0, updated: 0 },
    })
    self.log('开始重新分级...')

    var totalUpdated = 0

    function processBatch(batch) {
      self.callCloud({ action: 'classify', batch: batch }).then(function(r) {
        if (r.done) {
          self.log('分级完成! 共更新 ' + totalUpdated + ' 题')
          self.setData({ running: false })
          return
        }

        totalUpdated += r.updated || 0
        self.setData({ classifyProgress: { batch: batch, updated: totalUpdated } })
        self.log('批次 ' + batch + ': 更新 ' + r.updated + ' 题')

        if (r.next_batch !== null && r.next_batch !== undefined) {
          setTimeout(function() { processBatch(r.next_batch) }, 500)
        } else {
          self.log('分级完成! 共更新 ' + totalUpdated + ' 题')
          self.setData({ running: false })
        }
      }).catch(function(e) {
        self.log('批次 ' + batch + ' 失败: ' + (e.message || JSON.stringify(e)))
        setTimeout(function() {
          self.log('重试批次 ' + batch + '...')
          processBatch(batch)
        }, 2000)
      })
    }

    processBatch(0)
  },
})

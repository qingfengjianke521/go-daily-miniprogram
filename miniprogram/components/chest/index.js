/**
 * 宝箱组件
 * <chest type="wood|silver|gold" amount="0" bind:opened="onOpened" />
 *
 * 事件:
 *  - tap: 用户点击
 *  - openStart: 开箱动画开始
 *  - openEnd: 开箱完成
 */
Component({
  properties: {
    type: { type: String, value: 'wood' },
    amount: { type: Number, value: 0 },
    autoOpen: { type: Boolean, value: false }, // summary 页自动开箱
  },

  data: {
    opened: false,
    stageShake: false,
    stageOpen: false,
    stageCoins: false,
    stageTotal: false,
    coinDots: [],
  },

  lifetimes: {
    attached: function () {
      if (this.data.autoOpen) {
        var self = this
        setTimeout(function () { self.open() }, 500)
      }
    },
  },

  methods: {
    onTap: function () {
      if (this.data.opened) return
      this.triggerEvent('tap')
      this.open()
    },

    open: function () {
      if (this.data.opened) return
      var self = this
      self.setData({ opened: true })
      self.triggerEvent('openStart')

      try { wx.vibrateShort({ type: 'light' }) } catch (e) {}

      // 阶段1: 抖动 (0-400ms)
      self.setData({ stageShake: true })

      // 阶段2: 弹开 (400-1000ms)
      setTimeout(function () {
        self.setData({ stageShake: false, stageOpen: true })
        try { wx.vibrateShort({ type: 'medium' }) } catch (e) {}

        // 阶段3: 金币雨 (600-1600ms)
        var dots = []
        for (var i = 0; i < 8; i++) {
          dots.push({
            i: i,
            x: 30 + Math.random() * 40,
            delay: i * 80,
          })
        }
        setTimeout(function () {
          self.setData({ stageCoins: true, coinDots: dots })
        }, 200)

        // 阶段4: 总数飞入 (1200-2000ms)
        setTimeout(function () {
          self.setData({ stageTotal: true })
        }, 800)

        // 阶段5: 完成
        setTimeout(function () {
          self.setData({
            stageOpen: false,
            stageCoins: false,
            stageTotal: false,
          })
          self.triggerEvent('openEnd', { amount: self.data.amount })
        }, 2000)
      }, 400)
    },
  },
})

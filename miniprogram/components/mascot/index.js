/**
 * Q版棋子精灵吉祥物
 * <mascot color="black|white" mood="happy|encourage|celebrate|wait|sleep" size="sm|md|lg" bubble="text" />
 */
Component({
  properties: {
    color: { type: String, value: 'black' },
    mood: { type: String, value: 'wait' },
    size: { type: String, value: 'md' },
    bubble: { type: String, value: '' },
  },

  data: {
    mouthType: 'smile',
    animClass: '',
    blinkClass: 'blink',
  },

  observers: {
    'mood': function (mood) {
      var mouthType = 'smile'
      var animClass = ''
      var blinkClass = 'blink'

      switch (mood) {
        case 'happy':
          mouthType = 'happy'
          animClass = 'squint anim-bounce'
          blinkClass = ''
          break
        case 'encourage':
          mouthType = 'smile'
          animClass = 'anim-nod'
          break
        case 'celebrate':
          mouthType = 'happy'
          animClass = 'squint anim-jump'
          blinkClass = ''
          break
        case 'wait':
          mouthType = 'smile'
          animClass = 'anim-wave'
          break
        case 'sleep':
          mouthType = 'o'
          blinkClass = ''
          animClass = ''
          break
        case 'surprised':
          mouthType = 'o'
          animClass = ''
          break
      }

      this.setData({ mouthType: mouthType, animClass: animClass, blinkClass: blinkClass })
    }
  },
})

/**
 * 棋子精灵吉祥物组件
 * <mascot color="black|white" mood="happy|encourage|celebrate|wait|sleep" size="sm|md|lg" />
 */
Component({
  properties: {
    color: { type: String, value: 'black' },    // black | white
    mood: { type: String, value: 'wait' },       // happy | encourage | celebrate | wait | sleep
    size: { type: String, value: 'md' },         // sm | md | lg
  },

  data: {
    mouthType: 'smile',
    handPose: 'down',
    animClass: '',
    blinkClass: 'blink',
  },

  observers: {
    'mood': function (mood) {
      var mouthType = 'smile'
      var handPose = 'down'
      var animClass = ''
      var blinkClass = 'blink'

      switch (mood) {
        case 'happy':
          mouthType = 'happy'
          handPose = 'up'
          animClass = 'anim-bounce'
          break
        case 'encourage':
          mouthType = 'smile'
          handPose = 'wave'
          animClass = 'anim-nod'
          break
        case 'celebrate':
          mouthType = 'happy'
          handPose = 'up'
          animClass = 'anim-jump'
          break
        case 'wait':
          mouthType = 'smile'
          handPose = 'down'
          break
        case 'sleep':
          mouthType = 'sad'
          handPose = 'down'
          blinkClass = ''
          break
      }

      this.setData({ mouthType, handPose, animClass, blinkClass })
    }
  },
})

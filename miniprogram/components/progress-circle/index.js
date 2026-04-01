Component({
  properties: {
    number: { type: Number, value: 1 },
    status: { type: String, value: 'pending' }, // 'correct' | 'wrong' | 'current' | 'pending'
    ratingChange: { type: Number, value: null },
  },

  data: {
    filled: false,
    borderColor: '#E5E5E5',
    bgColor: 'transparent',
    iconType: '', // 'check' | 'cross' | ''
    numberColor: '#BBBBBB',
    changeText: '',
    changeColor: '',
    showChange: false,
    isPulse: false,
  },

  observers: {
    'status, ratingChange': function (status, ratingChange) {
      var filled = status === 'correct' || status === 'wrong'
      var borderColor = '#E5E5E5'
      var bgColor = 'transparent'
      var iconType = ''
      var numberColor = '#BBBBBB'
      var isPulse = false

      if (status === 'correct') {
        borderColor = '#58CC02'
        bgColor = '#58CC02'
        iconType = 'check'
      } else if (status === 'wrong') {
        borderColor = '#FF4B4B'
        bgColor = '#FF4B4B'
        iconType = 'cross'
      } else if (status === 'current') {
        borderColor = '#58CC02'
        numberColor = '#58CC02'
        isPulse = true
      }

      var showChange = ratingChange !== null && ratingChange !== undefined
      var changeText = ''
      var changeColor = ''
      if (showChange) {
        changeText = (ratingChange >= 0 ? '+' : '') + ratingChange
        changeColor = ratingChange >= 0 ? '#58CC02' : '#FF4B4B'
      }

      this.setData({
        filled: filled,
        borderColor: borderColor,
        bgColor: bgColor,
        iconType: iconType,
        numberColor: numberColor,
        changeText: changeText,
        changeColor: changeColor,
        showChange: showChange,
        isPulse: isPulse,
      })
    },
  },
})

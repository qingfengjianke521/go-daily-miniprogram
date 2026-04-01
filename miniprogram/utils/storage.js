module.exports = {
  getUserInfo: function() { return wx.getStorageSync('userInfo') || null },
  setUserInfo: function(info) { wx.setStorageSync('userInfo', info) },
  getUsername: function() {
    var info = wx.getStorageSync('userInfo')
    return info ? (info.username || '') : ''
  },
  clearAuth: function() {
    wx.removeStorageSync('userInfo')
  },
}

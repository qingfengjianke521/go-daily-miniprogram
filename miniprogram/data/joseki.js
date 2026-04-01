/**
 * joseki.js
 * 定式数据 - 从 OGS Joseki Explorer 抓取的真实定式
 * 自动生成的假数据已清空，真实数据待导入
 */

/** 右上角 viewRegion — 19路棋盘坐标 */
const JOSEKI_VIEW_REGION = { x1: 10, y1: 0, x2: 18, y2: 8 }

/**
 * 坐标系: 19路棋盘, (0,0)=左上角, x向右, y向下
 */

// 真实定式数据将从网络抓取后填入
// 目前为空，待补充
const JOSEKI_DATA = []

const DIFFICULTY_LABELS = {
  1: '基础定式',
  2: '中级定式',
  3: '高级定式',
}

const DIFFICULTY_COLORS = {
  1: { bg: '#F0FBE5', text: '#58CC02' },
  2: { bg: '#FFF3E0', text: '#FF9500' },
  3: { bg: '#FFE8E8', text: '#FF4B4B' },
}

function getJosekiByDifficulty() {
  const map = new Map([[1, []], [2, []], [3, []]])
  for (const j of JOSEKI_DATA) {
    map.get(j.difficulty).push(j)
  }
  return map
}

function getJosekiByCategory() {
  const map = new Map()
  for (const j of JOSEKI_DATA) {
    const list = map.get(j.category) || []
    list.push(j)
    map.set(j.category, list)
  }
  return map
}

function getJosekiById(id) {
  return JOSEKI_DATA.find(j => j.id === id)
}

function getNextJoseki(currentId) {
  const idx = JOSEKI_DATA.findIndex(j => j.id === currentId)
  if (idx >= 0 && idx < JOSEKI_DATA.length - 1) return JOSEKI_DATA[idx + 1]
  return undefined
}

module.exports = {
  JOSEKI_VIEW_REGION,
  JOSEKI_DATA,
  DIFFICULTY_LABELS,
  DIFFICULTY_COLORS,
  getJosekiByDifficulty,
  getJosekiByCategory,
  getJosekiById,
  getNextJoseki,
}

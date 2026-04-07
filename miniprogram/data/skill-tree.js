// 新手村技能树配置
// 解锁规则：前置节点 level 1 完成即解锁当前节点
// 关卡内各级按顺序解锁

var SKILL_TREE = [
  {
    id: 'capture',
    name: '吃子',
    icon: '🎯',
    color: '#4CAF50',
    description: '学会吃掉对方的棋子',
    prerequisites: [],
    levels: [
      { level: 1, name: '角上吃子', tag: 'capture_corner', count: 8 },
      { level: 2, name: '边上吃子', tag: 'capture_edge', count: 8 },
      { level: 3, name: '中腹吃子', tag: 'capture_center', count: 8 },
      { level: 4, name: '吃子综合', tag: 'capture_mixed', count: 10 },
    ],
  },
  {
    id: 'escape',
    name: '逃跑',
    icon: '🏃',
    color: '#2196F3',
    description: '让自己的棋子逃出险境',
    prerequisites: ['capture'],
    levels: [
      { level: 1, name: '简单逃跑', tag: 'escape_basic', count: 8 },
      { level: 2, name: '连接逃跑', tag: 'escape_connect', count: 8 },
      { level: 3, name: '逃跑综合', tag: 'escape_mixed', count: 10 },
    ],
  },
  {
    id: 'ladder',
    name: '征子',
    icon: '⚡',
    color: '#FF9800',
    description: '用征子技巧追吃对方',
    prerequisites: ['escape'],
    levels: [
      { level: 1, name: '基础征子', tag: 'ladder_basic', count: 8 },
      { level: 2, name: '征子判断', tag: 'ladder_judge', count: 8 },
      { level: 3, name: '征子综合', tag: 'ladder_mixed', count: 10 },
    ],
  },
  {
    id: 'snapback',
    name: '倒扑',
    icon: '🪤',
    color: '#9C27B0',
    description: '用倒扑技巧反吃对方',
    prerequisites: ['escape'],
    levels: [
      { level: 1, name: '基础倒扑', tag: 'snapback_basic', count: 8 },
      { level: 2, name: '倒扑应用', tag: 'snapback_apply', count: 8 },
      { level: 3, name: '倒扑综合', tag: 'snapback_mixed', count: 10 },
    ],
  },
  {
    id: 'eyes',
    name: '做眼',
    icon: '👁️',
    color: '#00BCD4',
    description: '给自己的棋做出两个眼',
    prerequisites: ['ladder', 'snapback'],
    levels: [
      { level: 1, name: '一眼活棋', tag: 'eyes_basic', count: 8 },
      { level: 2, name: '做眼求活', tag: 'eyes_make', count: 8 },
      { level: 3, name: '破眼杀棋', tag: 'eyes_kill', count: 8 },
      { level: 4, name: '死活综合', tag: 'eyes_mixed', count: 10 },
    ],
  },
  {
    id: 'semeai',
    name: '对杀',
    icon: '⚔️',
    color: '#F44336',
    description: '在对杀中比气取胜',
    prerequisites: ['eyes'],
    levels: [
      { level: 1, name: '简单对杀', tag: 'semeai_basic', count: 8 },
      { level: 2, name: '比气对杀', tag: 'semeai_liberties', count: 8 },
      { level: 3, name: '对杀综合', tag: 'semeai_mixed', count: 10 },
    ],
  },
]

module.exports = SKILL_TREE

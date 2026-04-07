// 新手村技能树配置
// 覆盖 25K(100) 到 7K(520)
// 解锁规则：前置节点 level 1 完成即解锁当前节点
// 关卡内各级按顺序解锁

var SKILL_TREE = [
  // === 第一阶段: 入门 25K-20K (100-200) ===
  {
    id: 'capture_basic',
    name: '吃子入门',
    icon: '🎯',
    color: '#4CAF50',
    description: '学会提掉对方没气的棋子',
    prerequisites: [],
    levels: [
      { level: 1, name: '提一子', tag: 'cap1_single', count: 8 },
      { level: 2, name: '提两子', tag: 'cap1_double', count: 8 },
      { level: 3, name: '角上吃子', tag: 'cap1_corner', count: 8 },
      { level: 4, name: '边上吃子', tag: 'cap1_edge', count: 10 },
    ],
  },
  {
    id: 'capture_adv',
    name: '吃子进阶',
    icon: '💎',
    color: '#66BB6A',
    description: '学会吃掉多颗棋子',
    prerequisites: ['capture_basic'],
    levels: [
      { level: 1, name: '中腹吃子', tag: 'cap2_center', count: 8 },
      { level: 2, name: '吃三子以上', tag: 'cap2_multi', count: 8 },
      { level: 3, name: '吃子综合', tag: 'cap2_mixed', count: 10 },
    ],
  },

  // === 第二阶段: 基础 20K-16K (200-300) ===
  {
    id: 'escape',
    name: '逃跑',
    icon: '🏃',
    color: '#2196F3',
    description: '让自己的棋子逃出险境',
    prerequisites: ['capture_adv'],
    levels: [
      { level: 1, name: '简单逃跑', tag: 'escape_basic', count: 8 },
      { level: 2, name: '连接逃跑', tag: 'escape_connect', count: 8 },
      { level: 3, name: '逃跑综合', tag: 'escape_mixed', count: 10 },
    ],
  },
  {
    id: 'connect',
    name: '连接切断',
    icon: '🔗',
    color: '#42A5F5',
    description: '连接自己的棋，切断对方',
    prerequisites: ['escape'],
    levels: [
      { level: 1, name: '基础连接', tag: 'connect_basic', count: 8 },
      { level: 2, name: '切断对方', tag: 'connect_cut', count: 8 },
      { level: 3, name: '连断综合', tag: 'connect_mixed', count: 10 },
    ],
  },

  // === 第三阶段: 初级 16K-10K (300-460) ===
  {
    id: 'ladder',
    name: '征子',
    icon: '⚡',
    color: '#FF9800',
    description: '用征子技巧追吃对方',
    prerequisites: ['connect'],
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
    prerequisites: ['connect'],
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

  // === 第四阶段: 进阶 10K-7K (460-520) ===
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
  {
    id: 'tesuji',
    name: '手筋入门',
    icon: '🌟',
    color: '#E91E63',
    description: '学会常见的妙手技巧',
    prerequisites: ['eyes'],
    levels: [
      { level: 1, name: '枷吃', tag: 'tesuji_net', count: 8 },
      { level: 2, name: '扑吃', tag: 'tesuji_throw', count: 8 },
      { level: 3, name: '手筋综合', tag: 'tesuji_mixed', count: 10 },
    ],
  },
]

module.exports = SKILL_TREE

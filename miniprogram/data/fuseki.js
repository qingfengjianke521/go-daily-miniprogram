

/**
 * 坐标系: 19路棋盘, (0,0)=左上角, x向右, y向下
 * 星位: 右上(15,3) 左上(3,3) 右下(15,15) 左下(3,15) 天元(9,9)
 * 小目: R16=(15,2) C16=(2,3) R4=(15,16) C4=(2,15) (实为3-3偏移)
 * 实用坐标:
 *   右上小目: (16,3)=R16  右上高目: (15,4)=Q15
 *   左上小目: (2,3)=C16   左上星: (3,3)=D16
 *   右下小目: (16,15)=R4  左下星: (3,15)=D4
 */
const FUSEKI_DATA = [

  // ==================== 基础 · 星位布局 ====================
  {
    id: 'sanrensei',
    name: '三连星',
    category: '星位布局',
    description: '上中下三颗星位，形成强大外势',
    difficulty: 1,
    moves: [
      { x: 15, y: 3, color: 'black' },   // Q16 右上星
      { x: 3, y: 3, color: 'white' },    // D16 左上星
      { x: 15, y: 9, color: 'black' },   // Q10 右侧边星
      { x: 3, y: 15, color: 'white' },   // D4 左下星
      { x: 15, y: 15, color: 'black' },  // Q4 右下星
    ],
  },
  {
    id: 'nirensei-top',
    name: '二连星·上边',
    category: '星位布局',
    description: '上边两颗星位，重视上方外势',
    difficulty: 1,
    moves: [
      { x: 15, y: 3, color: 'black' },  // Q16 右上星
      { x: 3, y: 3, color: 'white' },   // D16 左上星
      { x: 15, y: 15, color: 'black' }, // Q4 右下星
      { x: 3, y: 15, color: 'white' },  // D4 左下星
    ],
  },
  {
    id: 'diagonal-stars',
    name: '对角星',
    category: '星位布局',
    description: '对角占星，均衡布局',
    difficulty: 1,
    moves: [
      { x: 15, y: 3, color: 'black' },  // Q16 右上星
      { x: 3, y: 15, color: 'white' },  // D4 左下星
      { x: 3, y: 3, color: 'black' },   // D16 左上星
      { x: 15, y: 15, color: 'white' }, // Q4 右下星
    ],
  },
  {
    id: 'empty-triangle-stars',
    name: '三星·L型',
    category: '星位布局',
    description: '三颗星位呈L形，强调一侧外势',
    difficulty: 1,
    moves: [
      { x: 15, y: 3, color: 'black' },  // Q16
      { x: 3, y: 3, color: 'white' },   // D16
      { x: 3, y: 15, color: 'black' },  // D4
      { x: 15, y: 15, color: 'white' }, // Q4
      { x: 9, y: 3, color: 'black' },   // K16 上边中星
    ],
  },
  {
    id: 'tengen-opening',
    name: '天元开局',
    category: '星位布局',
    description: '先占天元，宏观掌握全局',
    difficulty: 2,
    moves: [
      { x: 9, y: 9, color: 'black' },   // K10 天元
      { x: 15, y: 3, color: 'white' },  // Q16 白占右上星
      { x: 3, y: 15, color: 'black' },  // D4 黑占左下星
      { x: 3, y: 3, color: 'white' },   // D16 白占左上星
      { x: 15, y: 15, color: 'black' }, // Q4 黑占右下星
    ],
  },

  // ==================== 基础 · 中国流 ====================
  {
    id: 'chinese-opening-right',
    name: '中国流·右边',
    category: '中国流',
    description: '右边中国流：星位+小目+高位，形成强力模样',
    difficulty: 1,
    moves: [
      { x: 15, y: 3, color: 'black' },  // Q16 右上星
      { x: 3, y: 3, color: 'white' },   // D16 白左上星
      { x: 16, y: 15, color: 'black' }, // R4 右下小目
      { x: 3, y: 15, color: 'white' },  // D4 白左下星
      { x: 15, y: 11, color: 'black' }, // Q8 高位拆二（中国流）
    ],
  },
  {
    id: 'mini-chinese-opening',
    name: '小中国流',
    category: '中国流',
    description: '紧凑的中国流布局，星位+小目+低位',
    difficulty: 1,
    moves: [
      { x: 15, y: 3, color: 'black' },  // Q16 右上星
      { x: 3, y: 3, color: 'white' },   // D16 白左上星
      { x: 16, y: 15, color: 'black' }, // R4 右下小目
      { x: 3, y: 15, color: 'white' },  // D4 白左下星
      { x: 15, y: 13, color: 'black' }, // Q6 低位拆二（小中国流）
    ],
  },
  {
    id: 'high-chinese-opening',
    name: '高中国流',
    category: '中国流',
    description: '高中国流，重视中腹',
    difficulty: 2,
    moves: [
      { x: 15, y: 3, color: 'black' },  // Q16 右上星
      { x: 3, y: 3, color: 'white' },   // D16 白左上星
      { x: 15, y: 15, color: 'black' }, // Q4 右下星（高中国流的星位）
      { x: 3, y: 15, color: 'white' },  // D4 白左下星
      { x: 15, y: 9, color: 'black' },  // Q10 高位中国流
    ],
  },
  {
    id: 'chinese-left-variation',
    name: '中国流·左边变型',
    category: '中国流',
    description: '中国流在左侧展开',
    difficulty: 2,
    moves: [
      { x: 3, y: 15, color: 'black' },  // D4 左下星
      { x: 15, y: 15, color: 'white' }, // Q4 白右下星
      { x: 2, y: 3, color: 'black' },   // C16 左上小目
      { x: 15, y: 3, color: 'white' },  // Q16 白右上星
      { x: 3, y: 7, color: 'black' },   // D12 中国流高位
    ],
  },

  // ==================== 基础 · 小林流 ====================
  {
    id: 'kobayashi-opening',
    name: '小林流',
    category: '小林流',
    description: '黑星位+小目+拆二，积极争夺角地',
    difficulty: 1,
    moves: [
      { x: 15, y: 3, color: 'black' },  // Q16 右上星
      { x: 3, y: 3, color: 'white' },   // D16 白左上星
      { x: 16, y: 15, color: 'black' }, // R4 右下小目
      { x: 3, y: 15, color: 'white' },  // D4 白左下星
      { x: 16, y: 11, color: 'black' }, // R8 小林流拆（低位）
      { x: 9, y: 3, color: 'white' },   // K16 白上边挂
    ],
  },
  {
    id: 'kobayashi-high',
    name: '高小林流',
    category: '小林流',
    description: '高位拆二的小林流变型',
    difficulty: 2,
    moves: [
      { x: 15, y: 3, color: 'black' },  // Q16 右上星
      { x: 3, y: 3, color: 'white' },   // D16 白左上星
      { x: 16, y: 15, color: 'black' }, // R4 右下小目
      { x: 3, y: 15, color: 'white' },  // D4 白左下星
      { x: 16, y: 9, color: 'black' },  // R10 高小林拆
      { x: 9, y: 15, color: 'white' },  // K4 白下边
    ],
  },

  // ==================== 基础 · 小目布局 ====================
  {
    id: 'komoku-orthodox',
    name: '小目正格',
    category: '小目布局',
    description: '四小目对角，传统稳健布局',
    difficulty: 1,
    moves: [
      { x: 16, y: 3, color: 'black' },  // R16 右上小目
      { x: 2, y: 15, color: 'white' },  // C4 左下小目
      { x: 2, y: 3, color: 'black' },   // C16 左上小目
      { x: 16, y: 15, color: 'white' }, // R4 右下小目
    ],
  },
  {
    id: 'komoku-stars-mix',
    name: '小目+星位混合',
    category: '小目布局',
    description: '小目与星位搭配，兼顾实地与外势',
    difficulty: 1,
    moves: [
      { x: 16, y: 3, color: 'black' },  // R16 右上小目
      { x: 3, y: 3, color: 'white' },   // D16 白左上星
      { x: 3, y: 15, color: 'black' },  // D4 左下星
      { x: 16, y: 15, color: 'white' }, // R4 白右下小目
    ],
  },
  {
    id: 'komoku-approach-response',
    name: '小目·挂角应对',
    category: '小目布局',
    description: '小目被挂后的布局方向',
    difficulty: 1,
    moves: [
      { x: 16, y: 3, color: 'black' },  // R16 右上小目
      { x: 3, y: 3, color: 'white' },   // D16 左上星
      { x: 3, y: 15, color: 'black' },  // D4 左下星
      { x: 16, y: 15, color: 'white' }, // R4 右下小目
      { x: 14, y: 2, color: 'black' },  // P17 挂右上小目
      { x: 13, y: 2, color: 'white' },  // O17 白应
    ],
  },

  // ==================== 中级 · 村正妖刀 ====================
  {
    id: 'muramasa',
    name: '村正妖刀',
    category: '特殊布局',
    description: '星位三三速占角，快速建立实地',
    difficulty: 2,
    moves: [
      { x: 15, y: 3, color: 'black' },  // Q16 右上星
      { x: 16, y: 2, color: 'white' },  // R17 白三三
      { x: 15, y: 2, color: 'black' },  // Q17 外挡
      { x: 17, y: 2, color: 'white' },  // S17 白小尖
      { x: 16, y: 3, color: 'black' },  // R16 黑挡
      { x: 3, y: 15, color: 'white' },  // D4 白角
    ],
  },

  // ==================== 中级 · 宇宙流 ====================
  {
    id: 'cosmic-style',
    name: '宇宙流',
    category: '特殊布局',
    description: '天元+四星，追求宏大中腹',
    difficulty: 2,
    moves: [
      { x: 9, y: 9, color: 'black' },   // K10 天元
      { x: 15, y: 3, color: 'white' },  // Q16 白星
      { x: 9, y: 3, color: 'black' },   // K16 上边星
      { x: 3, y: 3, color: 'white' },   // D16 左上星
      { x: 9, y: 15, color: 'black' },  // K4 下边星
      { x: 3, y: 15, color: 'white' },  // D4 白星
    ],
  },

  // ==================== 中级 · 韩国流 ====================
  {
    id: 'korean-opening',
    name: '韩国流',
    category: '韩国流',
    description: '韩国棋手常用的积极侵消布局',
    difficulty: 2,
    moves: [
      { x: 3, y: 3, color: 'black' },   // D16 左上星
      { x: 15, y: 15, color: 'white' }, // Q4 右下星
      { x: 15, y: 3, color: 'black' },  // Q16 右上星
      { x: 3, y: 15, color: 'white' },  // D4 左下星
      { x: 10, y: 2, color: 'black' },  // L17 韩国流跳（上边）
    ],
  },
  {
    id: 'korean-variation',
    name: '韩国流变型',
    category: '韩国流',
    description: '下方发展的韩国流变型',
    difficulty: 2,
    moves: [
      { x: 3, y: 3, color: 'black' },   // D16 左上星
      { x: 15, y: 15, color: 'white' }, // Q4 右下星
      { x: 16, y: 3, color: 'black' },  // R16 右上小目
      { x: 2, y: 15, color: 'white' },  // C4 白左下小目
      { x: 10, y: 16, color: 'black' }, // L3 下边韩国流
    ],
  },

  // ==================== 中级 · 低中国流 ====================
  {
    id: 'low-chinese-opening',
    name: '低中国流',
    category: '中国流',
    description: '低位配置，实地导向布局',
    difficulty: 2,
    moves: [
      { x: 15, y: 3, color: 'black' },  // Q16 右上星
      { x: 3, y: 3, color: 'white' },   // D16 白星
      { x: 16, y: 16, color: 'black' }, // R3 右下三三
      { x: 3, y: 15, color: 'white' },  // D4 白星
      { x: 15, y: 14, color: 'black' }, // Q5 低中国流
    ],
  },

  // ==================== 中级 · 目外布局 ====================
  {
    id: 'mokuhazushi-opening',
    name: '目外布局',
    category: '目外布局',
    description: '目外石的开局布局策略',
    difficulty: 2,
    moves: [
      { x: 15, y: 2, color: 'black' },  // Q17 右上目外
      { x: 3, y: 3, color: 'white' },   // D16 白左上星
      { x: 2, y: 15, color: 'black' },  // C4 左下小目
      { x: 16, y: 15, color: 'white' }, // R4 白右下小目
      { x: 3, y: 15, color: 'black' },  // D4 黑左下星
    ],
  },
  {
    id: 'mokuhazushi-sanrensei',
    name: '目外三连星',
    category: '目外布局',
    description: '目外+星位形成强大模样',
    difficulty: 2,
    moves: [
      { x: 15, y: 2, color: 'black' },  // Q17 目外
      { x: 3, y: 3, color: 'white' },   // D16 白星
      { x: 3, y: 15, color: 'black' },  // D4 左下星
      { x: 15, y: 16, color: 'white' }, // Q3 白三三位
      { x: 9, y: 3, color: 'black' },   // K16 上边星，三连星
    ],
  },

  // ==================== 高级 · 影武者流 ====================
  {
    id: 'kage-musya',
    name: '影武者流',
    category: '特殊布局',
    description: '全部占据高位，追求中腹影响力',
    difficulty: 3,
    moves: [
      { x: 15, y: 4, color: 'black' },  // Q15 右上高目
      { x: 4, y: 4, color: 'white' },   // E15 白左上高目
      { x: 4, y: 14, color: 'black' },  // E5 左下高目
      { x: 14, y: 14, color: 'white' }, // P5 白右下高目
      { x: 9, y: 9, color: 'black' },   // K10 天元
    ],
  },
  {
    id: 'high-target-formation',
    name: '高位+天元布局',
    category: '特殊布局',
    description: '四高目加天元，完全中腹志向',
    difficulty: 3,
    moves: [
      { x: 9, y: 9, color: 'black' },   // K10 天元
      { x: 15, y: 4, color: 'white' },  // Q15 白高目
      { x: 4, y: 4, color: 'black' },   // E15 黑高目
      { x: 4, y: 14, color: 'white' },  // E5 白高目
      { x: 15, y: 14, color: 'black' }, // Q5 黑高目
    ],
  },

  // ==================== 高级 · 特殊开局 ====================
  {
    id: 'approach-star-sansan',
    name: '星位三三速侵入',
    category: '特殊布局',
    description: '白开局就三三入侵，快速确定角地',
    difficulty: 3,
    moves: [
      { x: 15, y: 3, color: 'black' },  // Q16 黑右上星
      { x: 16, y: 2, color: 'white' },  // R17 白三三
      { x: 15, y: 2, color: 'black' },  // Q17 外挡
      { x: 17, y: 2, color: 'white' },  // S17 白尖
      { x: 16, y: 3, color: 'black' },  // R16 黑挡
      { x: 3, y: 3, color: 'white' },   // D16 白左上星
      { x: 3, y: 15, color: 'black' },  // D4 黑左下星
      { x: 15, y: 15, color: 'white' }, // Q4 白右下星
    ],
  },
  {
    id: 'niren-sansan',
    name: '二连星·三三组合',
    category: '特殊布局',
    description: '一方二连星，另一方三三确保实地',
    difficulty: 3,
    moves: [
      { x: 15, y: 3, color: 'black' },  // Q16 右上星
      { x: 3, y: 3, color: 'white' },   // D16 左上星
      { x: 9, y: 3, color: 'black' },   // K16 上边星（三连星）
      { x: 16, y: 2, color: 'white' },  // R17 白三三
      { x: 15, y: 2, color: 'black' },  // Q17 内挡
      { x: 2, y: 15, color: 'white' },  // C4 白三三
    ],
  },
  {
    id: 'both-sansan',
    name: '互占三三',
    category: '特殊布局',
    description: '双方快速先占三三，全实地对局',
    difficulty: 3,
    moves: [
      { x: 16, y: 2, color: 'black' },  // R17 黑三三
      { x: 2, y: 16, color: 'white' },  // C3 白对角三三
      { x: 2, y: 2, color: 'black' },   // C17 黑左上三三
      { x: 16, y: 16, color: 'white' }, // R3 白右下三三
      { x: 9, y: 3, color: 'black' },   // K16 黑上边
    ],
  },

  // ==================== 基础 · 二连星变型 ====================
  {
    id: 'nirensei-vertical',
    name: '竖向二连星',
    category: '星位布局',
    description: '右边上下两颗星位，控制右侧',
    difficulty: 1,
    moves: [
      { x: 15, y: 3, color: 'black' },  // Q16 右上星
      { x: 3, y: 15, color: 'white' },  // D4 左下星
      { x: 15, y: 15, color: 'black' }, // Q4 右下星
      { x: 3, y: 3, color: 'white' },   // D16 白左上星
    ],
  },
  {
    id: 'side-star-formation',
    name: '边星位布局',
    category: '星位布局',
    description: '占据边星，形成中间模样',
    difficulty: 2,
    moves: [
      { x: 15, y: 3, color: 'black' },  // Q16 右上星
      { x: 3, y: 3, color: 'white' },   // D16 左上星
      { x: 15, y: 15, color: 'black' }, // Q4 右下星
      { x: 3, y: 15, color: 'white' },  // D4 左下星
      { x: 9, y: 3, color: 'black' },   // K16 上边星
      { x: 9, y: 15, color: 'white' },  // K4 下边星
    ],
  },
  {
    id: 'shinfuseki-star-komoku',
    name: '新布局·星小目',
    category: '小目布局',
    description: '现代布局：一侧星位一侧小目',
    difficulty: 1,
    moves: [
      { x: 15, y: 3, color: 'black' },  // Q16 右上星
      { x: 2, y: 3, color: 'white' },   // C16 左上小目
      { x: 15, y: 15, color: 'black' }, // Q4 右下星
      { x: 2, y: 15, color: 'white' },  // C4 左下小目
    ],
  },
  {
    id: 'facing-komoku',
    name: '向对小目',
    category: '小目布局',
    description: '对向小目，均衡地重视角地',
    difficulty: 1,
    moves: [
      { x: 16, y: 3, color: 'black' },  // R16 右上小目
      { x: 2, y: 3, color: 'white' },   // C16 左上小目（同边）
      { x: 16, y: 15, color: 'black' }, // R4 右下小目
      { x: 2, y: 15, color: 'white' },  // C4 左下小目
    ],
  },
  {
    id: 'approach-star-extend',
    name: '挂角+守角定形',
    category: '小目布局',
    description: '挂角后守角，形成稳健阵型',
    difficulty: 2,
    moves: [
      { x: 16, y: 3, color: 'black' },  // R16 右上小目
      { x: 3, y: 3, color: 'white' },   // D16 左上星
      { x: 16, y: 15, color: 'black' }, // R4 右下小目
      { x: 14, y: 2, color: 'white' },  // P17 挂右上小目
      { x: 17, y: 5, color: 'black' },  // S14 守角
      { x: 3, y: 15, color: 'white' },  // D4 左下星
    ],
  },
  {
    id: 'ortho-approach',
    name: '正格·挂角变型',
    category: '小目布局',
    description: '小目后挂角定形',
    difficulty: 2,
    moves: [
      { x: 16, y: 3, color: 'black' },  // R16 右上小目
      { x: 2, y: 15, color: 'white' },  // C4 左下小目
      { x: 2, y: 3, color: 'black' },   // C16 左上小目
      { x: 14, y: 2, color: 'white' },  // P17 挂右上小目
      { x: 13, y: 2, color: 'black' },  // O17 一间跳应
      { x: 16, y: 15, color: 'white' }, // R4 右下小目
    ],
  },

  // ==================== 高级 · 现代AI流 ====================
  {
    id: 'ai-33-opening',
    name: 'AI流·三三速占',
    category: '特殊布局',
    description: 'AI常见的开局三三，效率优先',
    difficulty: 3,
    moves: [
      { x: 15, y: 3, color: 'black' },  // Q16 右上星
      { x: 16, y: 2, color: 'white' },  // R17 白三三
      { x: 15, y: 2, color: 'black' },  // Q17 外挡
      { x: 17, y: 2, color: 'white' },  // S17 白尖
      { x: 16, y: 3, color: 'black' },  // R16 黑挡
      { x: 17, y: 4, color: 'white' },  // S15 白延展
      { x: 3, y: 3, color: 'black' },   // D16 黑另角
      { x: 2, y: 16, color: 'white' },  // C3 白三三
    ],
  },
  {
    id: 'ai-complex-opening',
    name: 'AI流·复杂变型',
    category: '特殊布局',
    description: 'AI推荐的现代复杂开局',
    difficulty: 3,
    moves: [
      { x: 15, y: 3, color: 'black' },  // Q16
      { x: 3, y: 3, color: 'white' },   // D16
      { x: 15, y: 15, color: 'black' }, // Q4
      { x: 3, y: 15, color: 'white' },  // D4
      { x: 13, y: 2, color: 'black' },  // O17 肩冲上边
      { x: 14, y: 2, color: 'white' },  // P17 白应
      { x: 16, y: 2, color: 'black' },  // R17 黑三三
    ],
  },
  {
    id: 'ai-asymmetric',
    name: 'AI流·不对称布局',
    category: '特殊布局',
    description: '现代AI不对称快速取地布局',
    difficulty: 3,
    moves: [
      { x: 15, y: 3, color: 'black' },  // Q16 星
      { x: 3, y: 15, color: 'white' },  // D4 星
      { x: 16, y: 16, color: 'black' }, // R3 三三
      { x: 3, y: 3, color: 'white' },   // D16 星
      { x: 2, y: 16, color: 'black' },  // C3 三三
      { x: 15, y: 15, color: 'white' }, // Q4 星
      { x: 9, y: 3, color: 'black' },   // K16 上边
    ],
  },
]

const DIFFICULTY_LABELS = {
  1: '基础布局',
  2: '中级布局',
  3: '高级布局',
}

const DIFFICULTY_COLORS = {
  1: { bg: '#F0FBE5', text: '#58CC02' },
  2: { bg: '#FFF3E0', text: '#FF9500' },
  3: { bg: '#FFE8E8', text: '#FF4B4B' },
}

function getFusekiByDifficulty() {
  const map = new Map([[1, []], [2, []], [3, []]])
  for (const f of FUSEKI_DATA) {
    map.get(f.difficulty).push(f)
  }
  return map
}

function getFusekiByCategory() {
  const map = new Map()
  for (const f of FUSEKI_DATA) {
    if (!map.has(f.category)) map.set(f.category, [])
    map.get(f.category).push(f)
  }
  return map
}

function getFusekiById(id) {
  return FUSEKI_DATA.find(f => f.id === id)
}

function getNextFuseki(id) {
  const idx = FUSEKI_DATA.findIndex(f => f.id === id)
  if (idx === -1 || idx === FUSEKI_DATA.length - 1) return undefined
  return FUSEKI_DATA[idx + 1]
}

module.exports = { FUSEKI_DATA, DIFFICULTY_LABELS, DIFFICULTY_COLORS, getFusekiByDifficulty, getFusekiByCategory, getFusekiById, getNextFuseki }

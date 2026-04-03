# CLAUDE.md

## 项目概述

"黑白天天练"— Duolingo 风格围棋死活题微信小程序。
仓库：https://github.com/qingfengjianke521/go-daily-miniprogram

技术栈：微信小程序原生（WXML/WXSS/JS）+ 微信云开发（云函数+云数据库）。
云环境ID：cloud1-2gna4pn73d7fe81e

## 关键文档

- `docs/黑白天天练-完整方案.md`：产品完整方案（ELO体系、奖励机制、出题策略等）

## 项目结构

```
├── cloudfunctions/
│   ├── goDaily/index.js          # 主云函数（含ELO计算、出题、提交答案、打卡等所有API）
│   └── seedProblems/             # 题库导入云函数
├── miniprogram/
│   ├── pages/
│   │   ├── index/                # 首页（天梯路径）
│   │   ├── ladder/               # 天梯详情
│   │   ├── play/                 # 做题页面（核心）
│   │   ├── result/               # 单题结果
│   │   ├── summary/              # 打卡总结页
│   │   ├── profile/              # 我的
│   │   ├── ranking/              # 排行榜
│   │   ├── leaderboard/          # 排行榜（另一版）
│   │   ├── login/                # 登录
│   │   ├── admin/                # 管理后台
│   │   ├── level-select/         # 级别选择
│   │   ├── fuseki/               # 布局练习
│   │   └── joseki/               # 定式练习
│   ├── components/
│   │   ├── go-board/             # 棋盘渲染组件（Canvas）
│   │   ├── mascot/               # 吉祥物小黑组件
│   │   └── progress-circle/      # 进度环组件
│   ├── utils/
│   │   ├── api.js                # 云函数调用封装
│   │   ├── go-logic.js           # 围棋逻辑（落子、提子、数气）
│   │   └── storage.js            # 本地存储
│   ├── images/                   # 图片素材
│   ├── audio/                    # 音效（stone.mp3, correct.mp3, wrong.mp3）
│   ├── data/                     # 本地数据
│   └── learn/                    # 学习资料
├── scripts/
│   ├── parse-sgf-repos.js        # SGF解析脚本（已有，解析sanderland/tsumego）
│   ├── fetch-101weiqi.js         # 101围棋抓取（已废弃，不要用）
│   ├── fetch-puzzles.js          # OGS题目抓取（已废弃）
│   ├── generate-puzzles.js       # AI生成题目（已废弃，生成质量差）
│   ├── convert-ogs-tutorials.js  # OGS教程转换
│   ├── validate-puzzles.js       # 题目验证脚本
│   └── upload.sh                 # 上传脚本
├── problems_all.json             # 当前题库（12626题，来自sanderland/tsumego）
├── generated-puzzles.json        # AI生成的题（质量差，不要用）
└── scripts/101weiqi-*.json       # 101围棋抓取数据（坐标错误，不要用）
```

## 当前状态

### 已完成
- 12626 道题（problems_all.json），来自 sanderland/tsumego
- 做题页完整流程（落子→判定→反馈→正解动画→下一题）
- 围棋逻辑（go-logic.js：落子、提子、数气、自杀判定）
- 棋盘渲染组件（go-board，Canvas绘制）
- 吉祥物小黑组件
- 云函数：ELO计算、出题、提交答案、打卡、排行榜
- 首页天梯界面（已确认OK）
- 音效（落子、答对、答错）

### 当前问题（最高优先级）
**题目棋盘布局和答案不对！** 用户看到的棋盘位置和正确答案与实际SGF不匹配。可能原因：
1. `scripts/parse-sgf-repos.js` 中 SGF 坐标解析有误
2. `go-board` 组件渲染时 x/y 映射有误
3. `problems_all.json` 数据格式和 `play/index.js` 期望的格式不匹配

**必须先定位并修复这个问题，其他都是次要的。**

## 现有 ELO 体系（云函数中）

```javascript
// cloudfunctions/goDaily/index.js 中的等级分表
var LEVEL_TIERS = [
  [600, '25级'], [700, '22级'], [800, '20级'], [900, '18级'],
  [1000, '15级'], [1100, '12级'], [1200, '10级'], [1300, '8级'],
  [1400, '6级'], [1500, '4级'], [1600, '2级'], [1700, '1级'],
  [1800, '初段'], [1900, '二段'], [2000, '三段'], [2200, '四段'],
  [2400, '五段'], [99999, '六段以上'],
]

// K值动态：RD>300时K=64，RD>200时K=40，RD>100时K=24，否则K=16
// 还有时间系数：做得快奖励更多，做得慢惩罚更重
```

题库 rating 范围：700 - 1900（对应25级到二段左右）

## 数据格式

### problems_all.json 中每道题的格式
```json
{
  "id": "sl_Prob0001",
  "source": "sanderland/tsumego",
  "source_file": "problems/1a. Tsumego Beginner/.../Prob0001.json",
  "category": "死活",
  "board_size": 19,
  "initial_stones": {
    "black": [[4,1],[5,1],[1,2],[2,2],[3,2],[1,4]],
    "white": [[3,0],[0,1],[1,1],[2,1],[3,1]]
  },
  "correct_first_move": [1,0],
  "full_solution": [[1,0]],
  "all_solutions": [[[1,0]]],
  "difficulty_source": "cho_elementary",
  "difficulty_rating": 800
}
```

注意：`initial_stones` 用的是 `{black: [[x,y],...], white: [[x,y],...]}` 格式，
但 `go-logic.js` 的 `placeStones()` 期望 `[{x, y, color}, ...]` 格式。
`play/index.js` 中做了转换（见 `boardToStones` 函数），但 `_initProblem` 中直接把 `problem.initial_stones` 当数组传给了 `placeStones`——这里可能有 bug。

### 云数据库中的格式
题目上传到云数据库 `problems` 集合后，格式会有些不同（由 seedProblems 云函数处理）。
做题记录在 `records` 集合，用户数据在 `users` 集合。

## SGF 坐标规则

```
字母：a=0, b=1, c=2 ... s=18
格式：第一字母=列(x)，第二字母=行(y)
AB[ce] → 黑子在 (2, 4)
```

验证测试：
```
(;SZ[9]AB[ee]AW[ff])
黑子必须在 (4,4)=9路棋盘正中央
白子必须在 (5,5)
```

## 编码规范

- 微信小程序原生，不用框架
- 云函数 Node.js
- 已有代码风格：var 声明、ES5 function、不用箭头函数（兼容旧版微信）
- 保持现有代码风格一致

## 禁止事项

- **不要用 generate-puzzles.js 生成题目** — 已验证质量极差
- **不要用 fetch-101weiqi.js** — robots.txt禁止，数据错误
- **不要用 generated-puzzles.json 和 101weiqi-*.json** — 数据不可靠
- **不要动首页天梯界面** — 已确认OK
- **不要改 ELO 公式前先确认题目坐标是对的** — 题不对，分数体系再完美也没用

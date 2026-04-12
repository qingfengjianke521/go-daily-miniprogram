# CLAUDE.md

## 项目概述

"黑白天天练"— Duolingo 风格围棋死活题微信小程序。
仓库：https://github.com/qingfengjianke521/go-daily-miniprogram

技术栈：微信小程序原生（WXML/WXSS/JS）+ 微信云开发（云函数+云数据库）。
云环境ID：cloud1-2gna4pn73d7fe81e
AppID：wx6afd6434f348034d

## 关键文档

- `docs/黑白天天练-完整方案.md`：产品完整方案（ELO体系、奖励机制、出题策略等）

## 项目结构

```
├── cloudfunctions/
│   ├── goDaily/                   # 主云函数（所有后端API）
│   │   ├── index.js               # 入口（ELO、出题、提交、打卡、排行榜、错题本）
│   │   └── config.json            # 超时20s、内存256MB
│   └── seedProblems/              # 题库导入云函数（旧，已不常用）
├── miniprogram/
│   ├── pages/
│   │   ├── index/                 # 首页（天梯路径）
│   │   ├── play/                  # 做题页面（核心交互）
│   │   ├── summary/               # 打卡总结页
│   │   ├── profile/               # 我的（含打卡日历）
│   │   ├── level-select/          # 级别选择（25K/20K/10K/1K）
│   │   ├── ranking/               # 排行榜
│   │   ├── leaderboard/           # 排行榜（另一版）
│   │   ├── ladder/                # 天梯详情
│   │   ├── result/                # 单题结果
│   │   ├── login/                 # 登录
│   │   ├── admin/                 # 管理后台
│   │   ├── fuseki/                # 布局练习（list + practice）
│   │   └── joseki/                # 定式练习（list + practice）
│   ├── components/
│   │   ├── go-board/              # 棋盘渲染组件（Canvas 2D）
│   │   ├── mascot/                # 吉祥物小黑/小白组件
│   │   └── progress-circle/       # 进度环组件
│   ├── utils/
│   │   ├── api.js                 # 云函数调用封装
│   │   ├── go-logic.js            # 围棋逻辑（落子、提子、数气、自杀判定）
│   │   └── storage.js             # 本地存储
│   ├── audio/                     # 音效（stone/correct/wrong/capture/complete）
│   ├── images/                    # 图片素材
│   ├── data/                      # 本地数据（fuseki/joseki）
│   └── learn/                     # 学习资料
├── scripts/
│   ├── parse-sgf-v2.js            # SGF解析（用@sabaki/sgf，当前主力）
│   ├── test-sgf.js                # SGF坐标验证（5个硬编码测试）
│   ├── katago-extend.js           # KataGo多步答案生成（支持并行）
│   ├── merge-and-upload.js        # 合并KataGo结果 + 上传云数据库
│   ├── upload-problems.js         # 题库上传/清空/重置脚本
│   ├── deploy.js                  # 一键部署（云函数+小程序，用miniprogram-ci）
│   ├── verify-visual.js           # 棋盘可视化验证
│   └── parse-sgf-repos.js         # 旧SGF解析（已被v2替代）
├── problems_all.json              # 当前题库（12,625题，rating 300-949）
└── problems_extended_all.json     # KataGo扩展后题库（12,445题，含多步答案）
```

## 当前状态（v4.1.7）

### 已完成功能
- **题库**：12,625道题，来自 sanderland/tsumego（MIT），用 @sabaki/sgf 解析
- **多步答案**：8,068道题已通过 KataGo v1.16.4 扩展为3-5步序列
- **做题流程**：落子 → 判定 → 多步交互（黑1→白2→黑3...） → 反馈 → 下一题
- **答错处理**：落子音+错误音 → 显示错误位置1秒 → 恢复棋盘 → 橙色面板"查看正解" → 可反复试错
- **答对处理**：绿色面板 → 进入自由推演模式（可继续落子白2、黑3...）
- **正解动画**：点击"查看正解"/"查看答案"播放正解步骤（含落子音效）
- **重做功能**：答对/查看答案后可点"重做"重新作答
- **导航**：上一题/下一题始终可用
- **围棋逻辑**：落子、提子、数气、自杀判定、提子音效
- **棋盘渲染**：Canvas 2D，支持 viewRegion 局部显示、落子编号、星位、坐标标签
- **ELO系统**：K=10，30个等级（25K=100 到 5D=1050）
- **出题策略**：70%同级(±30) + 20%挑战(+30~+90) + 10%简单(-30~-90)
- **错题本**：间隔重复（1天→3天→7天），做对自动移除
- **打卡系统**：每日3题，棋币奖励（打卡+10，全对+5，连续7天+20）
- **排行榜**：按rating排名
- **吉祥物**：小黑（答对happy）/ 小白（答错encourage）
- **音效**：落子(stone)、答对(correct)、答错(wrong)、提子(capture)、完成(complete)
- **首页天梯界面**

### 来源标注
前端 debugInfo 根据 source_file 自动匹配中文来源名，如：
- 赵治勋初级(10K-5K)、中级(5K-1K)、高级(1D-3D)
- 石榑基础(16K-11K)、初段(1K-1D)
- 桥本初级/中级/高级
- 李昌镐手筋、手筋大辞典、小林觉手筋、吴清源手筋 等

## ELO 体系

```javascript
// 30个等级，起点100（25K），终点1050（5D）
var LEVEL_TIERS = [
  [100, '25K'], [120, '24K'], ..., [300, '16K'], ...,
  [460, '10K'], ..., [620, '5K'], ..., [775, '1K'],
  [820, '1D'], [870, '2D'], [925, '3D'], [985, '4D'], [1050, '5D'],
]

// K=10 固定，无RD，无时间系数
// 新用户起始 rating=300（16K），底线=300
// 题库 rating 范围：300-949
```

## 数据格式

### problems_all.json（本地题库）
```json
{
  "id": "sl_chochikunencyclopedialifeanddeathelement_Prob0001",
  "source": "sanderland/tsumego",
  "source_file": "1a. Tsumego Beginner/Cho Chikun .../Prob0001.json",
  "category": "死活",
  "board_size": 19,
  "initial_stones": {
    "black": [[x,y], ...],
    "white": [[x,y], ...]
  },
  "correct_first_move": [x, y],
  "full_solution": [[x,y], ...],
  "all_solutions": [[[x,y], ...], ...],
  "view_region": {"x1":0, "y1":0, "x2":8, "y2":8},
  "difficulty_rating": 362
}
```

### 云数据库格式（problems集合）
上传时由 upload-problems.js 转换：
- `initial_stones`：`[{x, y, color}, ...]` 格式
- `correct_sequences`：`[[[x,y],[x,y],...], ...]` 多步序列
- `steps`：答案步数（1-5）
- 额外字段：`problem_id`, `hint`, `level_tier`, `expected_time_ms`

### 云数据库集合
| 集合 | 说明 |
|------|------|
| `problems` | 12,625道题 |
| `users` | 用户数据（rating、streak、coins等） |
| `daily_sessions` | 每日练习session（3题/天） |
| `attempts` | 做题记录 |
| `wrong_book` | 错题本（间隔重复） |

## SGF 坐标规则

```
字母：a=0, b=1, c=2 ... s=18
格式：第一字母=列(x)，第二字母=行(y)
AB[ce] → 黑子在 (2, 4)
```

**关键：不翻转Y轴。** SGF y=0=棋盘顶部，go-board y=0=棋盘顶部，一致。

验证测试（test-sgf.js）：
```
(;SZ[9]AB[ee]AW[ff])  → 黑(4,4)中央 白(5,5) ✓
(;SZ[9]AB[aa])         → 黑(0,0)左上角 ✓
(;SZ[9]AB[ii])         → 黑(8,8)右下角 ✓
```

## 部署

```bash
# 部署云函数 + 小程序
node scripts/deploy.js all

# 只部署云函数
node scripts/deploy.js cloud

# 只上传小程序
node scripts/deploy.js mp

# 上传题库到云数据库
node scripts/upload-problems.js          # 清空+上传全部
node scripts/upload-problems.js --count  # 查数量
node scripts/upload-problems.js --reset-users  # 重置用户

# KataGo多步答案（支持并行）
node scripts/katago-extend.js 0 100 --config /tmp/katago-fast.cfg --output /tmp/ext.json
node scripts/merge-and-upload.js  # 合并+上传
```

**注意**：`miniprogram-ci cloud` CLI 不可靠，必须用 `ci.cloud.uploadFunction()` Node.js API。
腾讯云凭证在 `.env`（已gitignore）。

## 编码规范

- 微信小程序原生，不用框架
- 云函数 Node.js
- 代码风格：`var` 声明、ES5 `function`、不用箭头函数（兼容旧版微信）
- 保持现有代码风格一致

## 禁止事项

- **不要用 generated-puzzles.json** — AI生成质量极差
- **不要用 fetch-101weiqi.js** — robots.txt禁止，坐标数据有误
- **不要用 101weiqi-*.json** — 数据不可靠
- **不要动首页天梯界面** — 已确认OK
- **不要翻转SGF的Y轴** — 已验证不需要翻转，翻转会导致所有题目错位
- **部署云函数不要用 miniprogram-ci cloud 命令行** — 用 deploy.js 的 Node.js API

## 完成通知
每次完成任务（commit之后），执行以下命令通知用户：
```bash
afplay /System/Library/Sounds/Glass.aiff && osascript -e 'display notification "任务完成，请检查" with title "黑白天天练"'
```

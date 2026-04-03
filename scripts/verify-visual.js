#!/usr/bin/env node
/**
 * 生成可视化验证HTML页面
 * 随机抽10道题，用canvas画棋盘，方便肉眼确认
 */
const fs = require('fs')
const path = require('path')

const all = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'problems_all.json'), 'utf8'))

// 随机抽10道
const samples = []
const used = new Set()
while (samples.length < 10) {
  const idx = Math.floor(Math.random() * all.length)
  if (used.has(idx)) continue
  used.add(idx)
  samples.push(all[idx])
}

const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>围棋题库验证 - 10道随机抽样</title>
<style>
body { font-family: -apple-system, sans-serif; background: #f5f5f5; padding: 20px; }
.puzzle { background: white; border-radius: 12px; padding: 20px; margin: 20px 0; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
.puzzle h3 { margin: 0 0 8px; color: #333; }
.info { font-size: 13px; color: #666; margin-bottom: 10px; }
canvas { display: block; margin: 10px 0; }
.tag { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 12px; color: white; margin-right: 4px; }
.tag-死活 { background: #e74c3c; } .tag-手筋 { background: #3498db; } .tag-官子 { background: #2ecc71; }
</style>
</head>
<body>
<h1>围棋题库验证</h1>
<p>从 ${all.length} 道题中随机抽取 10 道，请肉眼确认棋子位置和答案是否正确。</p>
<p>●=黑子 ○=白子 <span style="color:red;font-weight:bold">★</span>=正确答案位置</p>

${samples.map((p, i) => `
<div class="puzzle" id="p${i}">
  <h3>#${i+1}: ${p.id}</h3>
  <div class="info">
    <span class="tag tag-${p.category}">${p.category}</span>
    来源: ${p.source_file}<br>
    棋盘: ${p.board_size}路 | 黑${p.initial_stones.black.length}颗 白${p.initial_stones.white.length}颗 |
    rating: ${p.difficulty_rating} |
    答案: (${p.correct_first_move[0]},${p.correct_first_move[1]})
  </div>
  <canvas id="c${i}" width="400" height="400"></canvas>
</div>
`).join('')}

<script>
const puzzles = ${JSON.stringify(samples)};
const COLS = 'ABCDEFGHJKLMNOPQRST';

puzzles.forEach((p, i) => {
  const canvas = document.getElementById('c' + i);
  const ctx = canvas.getContext('2d');
  const size = p.board_size;

  // 计算view region
  const allPts = [...p.initial_stones.black, ...p.initial_stones.white, p.correct_first_move];
  let x1=99,y1=99,x2=0,y2=0;
  allPts.forEach(([x,y]) => { x1=Math.min(x1,x);y1=Math.min(y1,y);x2=Math.max(x2,x);y2=Math.max(y2,y); });
  x1=Math.max(0,x1-1);y1=Math.max(0,y1-1);x2=Math.min(size-1,x2+1);y2=Math.min(size-1,y2+1);

  const cols = x2-x1, rows = y2-y1;
  const cellSize = Math.min(380/(cols+1), 380/(rows+1));
  const pad = cellSize * 0.8;
  canvas.width = cellSize * (cols+1) + pad*2;
  canvas.height = cellSize * (rows+1) + pad*2;

  const toX = x => (x-x1)*cellSize + pad;
  const toY = y => (y-y1)*cellSize + pad;

  // 棋盘背景
  ctx.fillStyle = '#D4A76A';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // 网格线
  ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 1;
  for (let x = x1; x <= x2; x++) { ctx.beginPath(); ctx.moveTo(toX(x),toY(y1)); ctx.lineTo(toX(x),toY(y2)); ctx.stroke(); }
  for (let y = y1; y <= y2; y++) { ctx.beginPath(); ctx.moveTo(toX(x1),toY(y)); ctx.lineTo(toX(x2),toY(y)); ctx.stroke(); }

  // 坐标标签
  ctx.fillStyle = '#333'; ctx.font = '12px sans-serif'; ctx.textAlign = 'center';
  for (let x = x1; x <= x2; x++) ctx.fillText(COLS[x], toX(x), toY(y2)+18);
  ctx.textAlign = 'right';
  for (let y = y1; y <= y2; y++) ctx.fillText(String(size-y), toX(x1)-8, toY(y)+4);

  // 棋子
  const r = cellSize * 0.43;
  p.initial_stones.black.forEach(([x,y]) => {
    if (x<x1||x>x2||y<y1||y>y2) return;
    ctx.beginPath(); ctx.arc(toX(x),toY(y),r,0,Math.PI*2);
    ctx.fillStyle='#222'; ctx.fill(); ctx.strokeStyle='#000'; ctx.lineWidth=1; ctx.stroke();
  });
  p.initial_stones.white.forEach(([x,y]) => {
    if (x<x1||x>x2||y<y1||y>y2) return;
    ctx.beginPath(); ctx.arc(toX(x),toY(y),r,0,Math.PI*2);
    ctx.fillStyle='#f0f0f0'; ctx.fill(); ctx.strokeStyle='#666'; ctx.lineWidth=1; ctx.stroke();
  });

  // 答案标记 (红色星号)
  const [ax,ay] = p.correct_first_move;
  ctx.beginPath(); ctx.arc(toX(ax),toY(ay),r*0.5,0,Math.PI*2);
  ctx.fillStyle='rgba(255,0,0,0.7)'; ctx.fill();
  ctx.fillStyle='white'; ctx.font='bold '+Math.round(r*0.7)+'px sans-serif'; ctx.textAlign='center';
  ctx.fillText('★', toX(ax), toY(ay)+r*0.25);
});
</script>
</body>
</html>`;

const outPath = path.join(__dirname, '..', 'verify.html')
fs.writeFileSync(outPath, html)
console.log('已生成: ' + outPath)
console.log('请打开浏览器查看: file://' + outPath)

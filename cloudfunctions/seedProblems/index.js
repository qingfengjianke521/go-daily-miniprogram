// seedProblems - 生成10000道围棋死活题
// 调用方式:
//   { action: 'seed', batch: 0 }  - 导入第0批(0-499), batch=1是500-999, ...共20批
//   { action: 'count' }           - 查询已导入数量
//   { action: 'clear' }           - 清空所有题目

const cloud = require('wx-server-sdk')
cloud.init({ env: 'cloud1-2gna4pn73d7fe81e' })
const db = cloud.database()

// ===== 等级分层筛选标准 =====
// 入门级(25级-20级, rating 400-800): 1步题, 棋子少于4颗, 吃子/逃跑/数气/连接/切断
// 初级(19级-10级, rating 800-1200): 1-3步, 基础死活常型(直三弯三直四弯四)
// 中级(9级-1级, rating 1200-1600): 3-7步
// 高级(初段以上, rating 1600+): 5步以上, 要求有变化分支
var LEVEL_TIERS = {
  beginner:     { min: 400, max: 800,  maxSteps: 1, maxStones: 6, label: '入门' },
  elementary:   { min: 800, max: 1200, maxSteps: 3, label: '初级' },
  intermediate: { min: 1200, max: 1600, maxSteps: 7, label: '中级' },
  advanced:     { min: 1600, max: 2100, minSteps: 5, needVariants: true, label: '高级' }
}

function getLevelTier(rating) {
  if (rating < 800) return 'beginner'
  if (rating < 1200) return 'elementary'
  if (rating < 1600) return 'intermediate'
  return 'advanced'
}

// ===== 工具函数 =====
function S(x,y,c){return{x:x,y:y,color:c}}
function B(x,y){return S(x,y,'black')}
function W(x,y){return S(x,y,'white')}

function inB(x,y){return x>=0&&x<=18&&y>=0&&y<=18}

// 计算 view_region
function vr(stones,seqs,pad){
  pad=pad||2;var x1=18,y1=18,x2=0,y2=0
  for(var i=0;i<stones.length;i++){
    if(stones[i].x<x1)x1=stones[i].x;if(stones[i].y<y1)y1=stones[i].y
    if(stones[i].x>x2)x2=stones[i].x;if(stones[i].y>y2)y2=stones[i].y
  }
  if(seqs){for(var i=0;i<seqs.length;i++)for(var j=0;j<seqs[i].length;j++){
    var m=seqs[i][j];if(m[0]<x1)x1=m[0];if(m[1]<y1)y1=m[1];if(m[0]>x2)x2=m[0];if(m[1]>y2)y2=m[1]
  }}
  return{x1:Math.max(0,x1-pad),y1:Math.max(0,y1-pad),x2:Math.min(18,x2+pad),y2:Math.min(18,y2+pad)}
}

// 平移
function translate(stones,seqs,dx,dy){
  var ns=stones.map(function(s){return S(s.x+dx,s.y+dy,s.color)})
  var nq=seqs.map(function(seq){return seq.map(function(m){return[m[0]+dx,m[1]+dy]})})
  for(var i=0;i<ns.length;i++)if(!inB(ns[i].x,ns[i].y))return null
  for(var i=0;i<nq.length;i++)for(var j=0;j<nq[i].length;j++)if(!inB(nq[i][j][0],nq[i][j][1]))return null
  return{s:ns,q:nq}
}

// 水平翻转
function mirH(stones,seqs){
  return{s:stones.map(function(s){return S(18-s.x,s.y,s.color)}),q:seqs.map(function(seq){return seq.map(function(m){return[18-m[0],m[1]]})})}
}
// 垂直翻转
function mirV(stones,seqs){
  return{s:stones.map(function(s){return S(s.x,18-s.y,s.color)}),q:seqs.map(function(seq){return seq.map(function(m){return[m[0],18-m[1]]})})}
}
// 对角翻转
function mirD(stones,seqs){
  return{s:stones.map(function(s){return S(s.y,s.x,s.color)}),q:seqs.map(function(seq){return seq.map(function(m){return[m[1],m[0]]})})}
}
// 黑白互换
function swapColor(stones){
  return stones.map(function(s){return S(s.x,s.y,s.color==='black'?'white':'black')})
}

// 验证所有坐标在范围内
function allValid(stones,seqs){
  for(var i=0;i<stones.length;i++)if(!inB(stones[i].x,stones[i].y))return false
  for(var i=0;i<seqs.length;i++)for(var j=0;j<seqs[i].length;j++)if(!inB(seqs[i][j][0],seqs[i][j][1]))return false
  return true
}

// 检查答案的第一步是否落在已有棋子上
function moveCollidesWithStones(stones, seqs) {
  if (!seqs || seqs.length === 0) return false
  var posMap = {}
  for (var i = 0; i < stones.length; i++) {
    posMap[stones[i].x + ',' + stones[i].y] = true
  }
  for (var s = 0; s < seqs.length; s++) {
    if (seqs[s].length > 0) {
      var key = seqs[s][0][0] + ',' + seqs[s][0][1]
      if (posMap[key]) return true
    }
  }
  return false
}

// 根据题目类别自动生成提示
var CAT_HINTS = {
  '吃子':'吃掉白子','逃子':'救出黑子','连接':'连接黑子','切断':'切断白子',
  '数气':'紧气吃子','征子':'用征子吃掉白子','枷吃':'用枷吃住白子',
  '扑':'扑后接不归','做眼':'做出两只眼','点眼':'破坏白棋的眼',
  '死活':'黑先活','对杀':'黑先杀白','手筋':'找到妙手','劫':'制造劫争','官子':'收官妙手'
}

// 从一个基础题型生成多个变体（4个镜像 × N个位置）
function expand(base, cat, baseRating, desc, time, positions) {
  var results = []
  var stones = base.stones
  var seqs = base.seqs
  var tier = getLevelTier(baseRating)
  var steps = seqs.length > 0 ? seqs[0].length : 0
  var hint = CAT_HINTS[cat] || cat

  // 4个镜像变体
  var mirrors = [{s:stones,q:seqs}]
  var h = mirH(stones,seqs); if(allValid(h.s,h.q) && !moveCollidesWithStones(h.s,h.q)) mirrors.push(h)
  var v = mirV(stones,seqs); if(allValid(v.s,v.q) && !moveCollidesWithStones(v.s,v.q)) mirrors.push(v)
  var d = mirD(stones,seqs); if(allValid(d.s,d.q) && !moveCollidesWithStones(d.s,d.q)) mirrors.push(d)

  for(var m=0;m<mirrors.length;m++){
    if(positions){
      for(var p=0;p<positions.length;p++){
        var t=translate(mirrors[m].s,mirrors[m].q,positions[p][0],positions[p][1])
        if(t && !moveCollidesWithStones(t.s,t.q)){
          var region=vr(t.s,t.q)
          results.push({
            cat:cat,rating:baseRating+results.length%30,desc:desc,time:time,
            level_tier:tier,steps:steps,hint:hint,
            stones:t.s,seqs:t.q,region:region
          })
        }
      }
    } else {
      var region=vr(mirrors[m].s,mirrors[m].q)
      results.push({
        cat:cat,rating:baseRating+results.length%20,desc:desc,time:time,
        level_tier:tier,steps:steps,hint:hint,
        stones:mirrors[m].s,seqs:mirrors[m].q,region:region
      })
    }
  }

  // 黑白互换版本
  var swapped=swapColor(stones)
  var swapDesc=desc==='黑先'?'白先':'黑先'
  var sw={s:swapped,q:seqs}
  if(allValid(sw.s,sw.q) && !moveCollidesWithStones(sw.s,sw.q)){
    var region=vr(sw.s,sw.q)
    results.push({
      cat:cat,rating:baseRating+5,desc:swapDesc,time:time,
      level_tier:tier,steps:steps,hint:swapDesc==='白先'?(CAT_HINTS[cat]||cat).replace('黑','白').replace('白子','黑子'):hint,
      stones:sw.s,seqs:sw.q,region:region
    })
  }

  return results
}

// ===== 题型模板 =====
// 每个模板是一个函数，返回 [{stones, seqs}] 数组

function generateAll() {
  var ALL = []

  // ========== 第1级: 入门 (400-650) ==========
  // --- 1.1 角上单子吃 ---
  var cornerCaptures = [
    {stones:[W(0,0),B(1,0)], seqs:[[[0,1]]]},
    {stones:[W(0,0),B(0,1)], seqs:[[[1,0]]]},
    {stones:[W(1,0),B(0,0),B(2,0)], seqs:[[[1,1]]]},
    {stones:[W(0,1),B(0,0),B(0,2)], seqs:[[[1,1]]]},
    {stones:[W(1,1),B(0,1),B(1,0),B(2,1)], seqs:[[[1,2]]]},
    {stones:[W(1,1),B(0,1),B(1,0),B(1,2)], seqs:[[[2,1]]]},
    {stones:[W(0,1),B(0,0),B(1,1)], seqs:[[[0,2]]]},
    {stones:[W(1,0),B(0,0),B(1,1)], seqs:[[[2,0]]]},
  ]
  for(var i=0;i<cornerCaptures.length;i++){
    var variants=expand(cornerCaptures[i],'吃子',400+i*8,'黑先',12000,[[0,0],[0,10],[10,0],[10,10]])
    ALL=ALL.concat(variants)
  }

  // --- 1.2 边上吃子 ---
  for(var x=1;x<=15;x+=2){
    ALL.push({cat:'吃子',rating:420+x*2,desc:'黑先',time:13000,
      stones:[W(x,0),B(x-1,0),B(x+1,0)],seqs:[[[x,1]]],region:{x1:Math.max(0,x-2),y1:0,x2:Math.min(18,x+2),y2:3}})
    ALL.push({cat:'吃子',rating:425+x*2,desc:'黑先',time:13000,
      stones:[W(x,18),B(x-1,18),B(x+1,18)],seqs:[[[x,17]]],region:{x1:Math.max(0,x-2),y1:15,x2:Math.min(18,x+2),y2:18}})
  }
  for(var y=1;y<=15;y+=2){
    ALL.push({cat:'吃子',rating:430+y*2,desc:'黑先',time:13000,
      stones:[W(0,y),B(0,y-1),B(0,y+1)],seqs:[[[1,y]]],region:{x1:0,y1:Math.max(0,y-2),x2:3,y2:Math.min(18,y+2)}})
    ALL.push({cat:'吃子',rating:435+y*2,desc:'黑先',time:13000,
      stones:[W(18,y),B(18,y-1),B(18,y+1)],seqs:[[[17,y]]],region:{x1:15,y1:Math.max(0,y-2),x2:18,y2:Math.min(18,y+2)}})
  }

  // --- 1.3 中腹单子吃(3路围1气) ---
  for(var x=2;x<=16;x+=2){
    for(var y=2;y<=16;y+=2){
      ALL.push({cat:'吃子',rating:440+(x+y)%40,desc:'黑先',time:14000,
        stones:[W(x,y),B(x-1,y),B(x+1,y),B(x,y-1)],seqs:[[[x,y+1]]],
        region:{x1:x-2,y1:y-2,x2:x+2,y2:y+2}})
    }
  }

  // --- 1.4 两子吃(边上, 差1手吃) ---
  for(var x=1;x<=14;x+=2){
    // 缺左下方一手
    ALL.push({cat:'吃子',rating:460+x*3,desc:'黑先',time:15000,
      stones:[W(x,0),W(x+1,0),B(x-1,0),B(x+2,0),B(x+1,1)],seqs:[[[x,1]]],
      region:{x1:Math.max(0,x-2),y1:0,x2:Math.min(18,x+3),y2:3}})
    // 缺右下方一手
    ALL.push({cat:'吃子',rating:470+x*3,desc:'黑先',time:16000,
      stones:[W(x,0),W(x+1,0),B(x-1,0),B(x+2,0),B(x,1)],seqs:[[[x+1,1]]],
      region:{x1:Math.max(0,x-2),y1:0,x2:Math.min(18,x+3),y2:3}})
  }

  // --- 1.5 逃子 ---
  for(var x=2;x<=16;x+=3){
    for(var y=2;y<=8;y+=3){
      ALL.push({cat:'逃子',rating:480+(x+y*3)%50,desc:'黑先',time:15000,
        stones:[B(x,y),W(x-1,y),W(x+1,y),W(x,y-1)],seqs:[[[x,y+1]]],
        region:{x1:x-2,y1:y-2,x2:x+2,y2:y+3}})
      ALL.push({cat:'逃子',rating:490+(x+y*3)%50,desc:'黑先',time:15000,
        stones:[B(x,y),W(x-1,y),W(x,y+1),W(x,y-1)],seqs:[[[x+1,y]]],
        region:{x1:x-2,y1:y-2,x2:x+3,y2:y+2}})
    }
  }

  // --- 1.6 连接 ---
  for(var x=2;x<=14;x+=3){
    for(var y=2;y<=10;y+=4){
      ALL.push({cat:'连接',rating:500+(x+y)%40,desc:'黑先',time:14000,
        stones:[B(x,y),B(x+2,y),W(x+1,y-1),W(x+1,y+1)],seqs:[[[x+1,y]]],
        region:{x1:x-1,y1:y-2,x2:x+3,y2:y+2}})
    }
  }

  // ========== 入门补充: 200道超基础题 (rating 400-750) ==========
  // 目标用户: 25级-20级, OGS上此类题极少, 需要大量手工生成

  // --- B1: 50道吃子题 (1步, 吃掉1-2颗棋子) ---
  // B1.1 角上吃单子 (2口气变1口气)
  var beginCapPos = [
    [0,0],[18,0],[0,18],[18,18], // 四角
    [0,9],[18,9],[9,0],[9,18],   // 四边中点
  ]
  for(var p=0;p<beginCapPos.length;p++){
    var px=beginCapPos[p][0],py=beginCapPos[p][1]
    // 角/边上单子, 只剩1口气
    if(px===0&&py===0){
      ALL.push({cat:'吃子',rating:400+p*3,desc:'黑先',time:8000,level_tier:'beginner',steps:1,
        stones:[W(0,0),B(1,0)],seqs:[[[0,1]]],region:{x1:0,y1:0,x2:3,y2:3}})
      ALL.push({cat:'吃子',rating:405+p*3,desc:'黑先',time:8000,level_tier:'beginner',steps:1,
        stones:[W(0,0),B(0,1)],seqs:[[[1,0]]],region:{x1:0,y1:0,x2:3,y2:3}})
    }
    if(px===18&&py===0){
      ALL.push({cat:'吃子',rating:410+p*3,desc:'黑先',time:8000,level_tier:'beginner',steps:1,
        stones:[W(18,0),B(17,0)],seqs:[[[18,1]]],region:{x1:15,y1:0,x2:18,y2:3}})
    }
    if(px===0&&py===18){
      ALL.push({cat:'吃子',rating:415+p*3,desc:'黑先',time:8000,level_tier:'beginner',steps:1,
        stones:[W(0,18),B(1,18)],seqs:[[[0,17]]],region:{x1:0,y1:15,x2:3,y2:18}})
    }
    if(px===18&&py===18){
      ALL.push({cat:'吃子',rating:420+p*3,desc:'黑先',time:8000,level_tier:'beginner',steps:1,
        stones:[W(18,18),B(17,18)],seqs:[[[18,17]]],region:{x1:15,y1:15,x2:18,y2:18}})
    }
  }
  // B1.2 边上吃单子 (3路围住, 下1手吃)
  for(var x=1;x<=17;x+=2){
    ALL.push({cat:'吃子',rating:430+x*2,desc:'黑先',time:8000,level_tier:'beginner',steps:1,
      stones:[W(x,0),B(x-1,0),B(x+1,0)],seqs:[[[x,1]]],
      region:{x1:Math.max(0,x-2),y1:0,x2:Math.min(18,x+2),y2:3}})
  }
  for(var y=1;y<=17;y+=2){
    ALL.push({cat:'吃子',rating:435+y*2,desc:'黑先',time:8000,level_tier:'beginner',steps:1,
      stones:[W(0,y),B(0,y-1),B(0,y+1)],seqs:[[[1,y]]],
      region:{x1:0,y1:Math.max(0,y-2),x2:3,y2:Math.min(18,y+2)}})
  }
  // B1.3 中腹吃单子 (4路围住, 下1手吃, 只剩1气)
  for(var x=2;x<=16;x+=3){
    for(var y=2;y<=16;y+=3){
      ALL.push({cat:'吃子',rating:450+(x+y)%30,desc:'黑先',time:9000,level_tier:'beginner',steps:1,
        stones:[W(x,y),B(x-1,y),B(x+1,y),B(x,y-1)],seqs:[[[x,y+1]]],
        region:{x1:x-2,y1:y-2,x2:x+2,y2:y+2}})
    }
  }
  // B1.4 吃2子 (边上2子, 差1手吃)
  for(var x=1;x<=15;x+=3){
    // 缺左下一手
    ALL.push({cat:'吃子',rating:470+x*2,desc:'黑先',time:10000,level_tier:'beginner',steps:1,
      stones:[W(x,0),W(x+1,0),B(x-1,0),B(x+2,0),B(x+1,1)],seqs:[[[x,1]]],
      region:{x1:Math.max(0,x-2),y1:0,x2:Math.min(18,x+3),y2:3}})
    // 缺右下一手
    ALL.push({cat:'吃子',rating:480+x*2,desc:'黑先',time:10000,level_tier:'beginner',steps:1,
      stones:[W(x,0),W(x+1,0),B(x-1,0),B(x+2,0),B(x,1)],seqs:[[[x+1,1]]],
      region:{x1:Math.max(0,x-2),y1:0,x2:Math.min(18,x+3),y2:3}})
  }

  // --- B2: 50道逃子题 (1步, 让己方棋子逃回安全区) ---
  // B2.1 中腹逃子 (被围3面, 唯一出路)
  for(var x=2;x<=16;x+=2){
    for(var y=2;y<=10;y+=2){
      // 向下逃
      ALL.push({cat:'逃子',rating:500+(x+y)%40,desc:'黑先',time:9000,level_tier:'beginner',steps:1,
        stones:[B(x,y),W(x-1,y),W(x+1,y),W(x,y-1)],seqs:[[[x,y+1]]],
        region:{x1:x-2,y1:y-2,x2:x+2,y2:y+3}})
      // 向右逃
      if(x<=15){
        ALL.push({cat:'逃子',rating:510+(x+y)%40,desc:'黑先',time:9000,level_tier:'beginner',steps:1,
          stones:[B(x,y),W(x-1,y),W(x,y+1),W(x,y-1)],seqs:[[[x+1,y]]],
          region:{x1:x-2,y1:y-2,x2:x+3,y2:y+2}})
      }
    }
  }
  // B2.2 边上逃子
  for(var x=1;x<=17;x+=2){
    ALL.push({cat:'逃子',rating:530+x*2,desc:'黑先',time:9000,level_tier:'beginner',steps:1,
      stones:[B(x,0),W(x-1,0),W(x+1,0)],seqs:[[[x,1]]],
      region:{x1:Math.max(0,x-2),y1:0,x2:Math.min(18,x+2),y2:3}})
  }
  // B2.3 角上逃子 (唯一出口)
  ALL.push({cat:'逃子',rating:540,desc:'黑先',time:8000,level_tier:'beginner',steps:1,
    stones:[B(0,0),W(1,0)],seqs:[[[0,1]]],region:{x1:0,y1:0,x2:3,y2:3}})
  ALL.push({cat:'逃子',rating:542,desc:'黑先',time:8000,level_tier:'beginner',steps:1,
    stones:[B(0,0),W(0,1)],seqs:[[[1,0]]],region:{x1:0,y1:0,x2:3,y2:3}})
  ALL.push({cat:'逃子',rating:544,desc:'黑先',time:8000,level_tier:'beginner',steps:1,
    stones:[B(18,0),W(17,0)],seqs:[[[18,1]]],region:{x1:15,y1:0,x2:18,y2:3}})
  ALL.push({cat:'逃子',rating:546,desc:'黑先',time:8000,level_tier:'beginner',steps:1,
    stones:[B(18,18),W(18,17)],seqs:[[[17,18]]],region:{x1:15,y1:15,x2:18,y2:18}})
  // B2.4 2子逃跑 (一组2子被围, 需要1手连出)
  for(var x=2;x<=14;x+=3){
    for(var y=2;y<=8;y+=3){
      ALL.push({cat:'逃子',rating:560+(x+y)%30,desc:'黑先',time:10000,level_tier:'beginner',steps:1,
        stones:[B(x,y),B(x+1,y),W(x-1,y),W(x+2,y),W(x,y-1),W(x+1,y-1)],seqs:[[[x,y+1]],[[x+1,y+1]]],
        region:{x1:x-2,y1:y-2,x2:x+3,y2:y+3}})
    }
  }

  // --- B3: 50道数气题 (判断哪块棋气多/先紧气吃) ---
  // 用对杀形式: 两块棋互相紧气, 黑先下在白棋的气上
  // B3.1 简单对杀: 黑2气 vs 白1气 (明显黑赢)
  for(var x=2;x<=16;x+=3){
    for(var y=2;y<=10;y+=4){
      ALL.push({cat:'数气',rating:580+(x+y)%30,desc:'黑先',time:10000,level_tier:'beginner',steps:1,
        stones:[B(x,y),W(x+1,y),B(x,y+1),W(x+1,y+1),B(x-1,y),B(x-1,y+1),W(x+2,y)],
        seqs:[[[x+2,y+1]]],// 紧白棋最后1气
        region:{x1:x-2,y1:y-2,x2:x+4,y2:y+3}})
    }
  }
  // B3.2 边上数气: 黑2子vs白1子, 白气少先下
  for(var x=2;x<=16;x+=2){
    // 上边: 黑2子(2气) vs 白1子(1气), 紧白气吃
    ALL.push({cat:'数气',rating:600+x%25,desc:'黑先',time:11000,level_tier:'beginner',steps:1,
      stones:[B(x,0),B(x+1,0),W(x+2,0),B(x-1,0),B(x,1),B(x+1,1)],
      seqs:[[[x+2,1]]],// 紧白棋最后1气
      region:{x1:Math.max(0,x-2),y1:0,x2:Math.min(18,x+4),y2:3}})
  }
  // B3.3 角上数气: 黑角上2气 vs 白1气
  for(var corner=0;corner<4;corner++){
    var cx=corner<2?0:18, cy=corner%2===0?0:18
    var dx=cx===0?1:-1, dy=cy===0?1:-1
    ALL.push({cat:'数气',rating:620+corner*5,desc:'黑先',time:10000,level_tier:'beginner',steps:1,
      stones:[B(cx,cy),W(cx+dx,cy),B(cx,cy+dy)],
      seqs:[[[cx+dx,cy+dy]]],// 吃掉白子
      region:{x1:Math.min(cx,cx+dx*2),y1:Math.min(cy,cy+dy*2),x2:Math.max(cx,cx+dx*2),y2:Math.max(cy,cy+dy*2)}})
  }
  // B3.4 边上数气比较
  for(var x=2;x<=16;x+=2){
    ALL.push({cat:'数气',rating:640+x*2,desc:'黑先',time:11000,level_tier:'beginner',steps:1,
      stones:[B(x,0),W(x+1,0),B(x-1,0),B(x,1),W(x+2,0)],
      seqs:[[[x+1,1]]],// 紧白子的气
      region:{x1:Math.max(0,x-2),y1:0,x2:Math.min(18,x+4),y2:3}})
  }
  // B3.5 中腹2对2数气 (各2子, 黑多1气)
  for(var x=3;x<=15;x+=3){
    for(var y=3;y<=9;y+=3){
      ALL.push({cat:'数气',rating:660+(x+y)%25,desc:'黑先',time:11000,level_tier:'beginner',steps:1,
        stones:[B(x,y),B(x,y+1),W(x+1,y),W(x+1,y+1),
                B(x-1,y),B(x-1,y+1),
                W(x+2,y+1)],
        seqs:[[[x+2,y]]],
        region:{x1:x-2,y1:y-2,x2:x+4,y2:y+3}})
    }
  }

  // --- B4: 50道基础连接/切断题 ---
  // B4.1 连接: 两颗己方棋子中间空1格, 对方虎视
  for(var x=2;x<=14;x+=2){
    for(var y=2;y<=10;y+=3){
      ALL.push({cat:'连接',rating:650+(x+y)%30,desc:'黑先',time:9000,level_tier:'beginner',steps:1,
        stones:[B(x,y),B(x+2,y),W(x+1,y-1),W(x+1,y+1)],seqs:[[[x+1,y]]],
        region:{x1:x-1,y1:y-2,x2:x+3,y2:y+2}})
    }
  }
  // B4.2 连接: 虎口连接 (防止被断)
  for(var x=2;x<=14;x+=3){
    for(var y=2;y<=8;y+=3){
      ALL.push({cat:'连接',rating:670+(x+y)%25,desc:'黑先',time:10000,level_tier:'beginner',steps:1,
        stones:[B(x,y),B(x+2,y+1),W(x+1,y-1),W(x+2,y)],seqs:[[[x+1,y]]],
        region:{x1:x-1,y1:y-2,x2:x+3,y2:y+3}})
    }
  }
  // B4.3 切断: 白棋两子之间空1格, 黑冲进去切
  for(var x=2;x<=14;x+=2){
    for(var y=2;y<=10;y+=3){
      ALL.push({cat:'切断',rating:700+(x+y)%30,desc:'黑先',time:10000,level_tier:'beginner',steps:1,
        stones:[W(x,y),W(x+2,y),B(x+1,y-1),B(x+1,y+1)],seqs:[[[x+1,y]]],
        region:{x1:x-1,y1:y-2,x2:x+3,y2:y+2}})
    }
  }
  // B4.4 切断: 边上切断白棋连接
  for(var x=2;x<=16;x+=3){
    ALL.push({cat:'切断',rating:720+x*2,desc:'黑先',time:10000,level_tier:'beginner',steps:1,
      stones:[W(x,0),W(x+2,0),B(x-1,0),B(x+3,0),B(x,1),B(x+2,1)],seqs:[[[x+1,0]]],
      region:{x1:Math.max(0,x-2),y1:0,x2:Math.min(18,x+4),y2:3}})
    ALL.push({cat:'切断',rating:730+x*2,desc:'黑先',time:10000,level_tier:'beginner',steps:1,
      stones:[W(x,0),W(x+2,0),B(x+1,1)],seqs:[[[x+1,0]]],
      region:{x1:Math.max(0,x-2),y1:0,x2:Math.min(18,x+4),y2:3}})
  }

  // ========== 第2级: 初级 (650-900) ==========
  // --- 2.1 征子(阶梯吃) ---
  var ladderBases = [
    {stones:[B(3,3),B(4,4),W(4,3)],seqs:[[[4,2],[5,3],[5,2],[6,3],[6,2]]]},
    {stones:[B(3,3),B(4,4),W(4,3),W(5,4)],seqs:[[[4,2],[5,3],[5,2],[6,3],[6,2],[7,3]]]},
    {stones:[B(2,2),B(3,3),W(3,2)],seqs:[[[3,1],[4,2],[4,1],[5,2],[5,1]]]},
  ]
  for(var i=0;i<ladderBases.length;i++){
    var vs=expand(ladderBases[i],'征子',650+i*25,'黑先',25000,[[0,0],[5,5],[0,8]])
    ALL=ALL.concat(vs)
  }

  // --- 2.2 枷吃(罩) ---
  var netBases = [
    {stones:[W(3,1),B(2,1),B(3,0)],seqs:[[[4,2]]]},// 小飞罩
    {stones:[W(3,1),B(2,0),B(3,0),B(2,2)],seqs:[[[4,2]]]},
    {stones:[W(4,1),B(3,0),B(4,0),B(3,1)],seqs:[[[5,2]]]},
    {stones:[W(3,2),B(2,1),B(3,1),B(2,3)],seqs:[[[4,3]]]},
  ]
  for(var i=0;i<netBases.length;i++){
    var vs=expand(netBases[i],'枷吃',700+i*20,'黑先',22000,[[0,0],[6,0],[0,8],[6,8]])
    ALL=ALL.concat(vs)
  }

  // --- 2.3 抱吃/门吃 ---
  for(var x=1;x<=15;x+=3){
    for(var y=1;y<=9;y+=4){
      ALL.push({cat:'吃子',rating:720+(x+y)%50,desc:'黑先',time:20000,
        stones:[W(x,y),W(x+1,y),B(x-1,y),B(x,y-1),B(x+1,y-1),B(x+2,y)],seqs:[[[x,y+1],[x+1,y+1],[x+2,y+1]]],
        region:{x1:Math.max(0,x-2),y1:Math.max(0,y-2),x2:Math.min(18,x+4),y2:Math.min(18,y+3)}})
    }
  }

  // --- 2.4 扑吃(接不归) ---
  var throwInBases = [
    {stones:[W(1,0),W(2,0),W(1,1),B(0,0),B(3,0),B(2,1),B(0,1),B(0,2)],seqs:[[[1,2],[2,2],[2,0]]]},
    {stones:[W(0,0),W(1,0),W(0,1),B(2,0),B(1,1),B(0,2)],seqs:[[[1,2],[0,2],[2,1]]]},
  ]
  for(var i=0;i<throwInBases.length;i++){
    var vs=expand(throwInBases[i],'扑',750+i*30,'黑先',25000,[[0,0],[10,0],[0,10]])
    ALL=ALL.concat(vs)
  }

  // --- 2.5 做眼基础 (rating 800+, 归入初级) ---
  for(var x=0;x<=12;x+=4){
    ALL.push({cat:'做眼',rating:800+x*5,desc:'黑先',time:22000,
      stones:[B(x,0),B(x+1,0),B(x+2,0),B(x+3,0),B(x,1),B(x+3,1),W(x+1,2),W(x+2,2),W(x,2),W(x+3,2)],
      seqs:[[[x+1,1]]],
      region:{x1:Math.max(0,x-1),y1:0,x2:Math.min(18,x+4),y2:3}})
    ALL.push({cat:'做眼',rating:810+x*5,desc:'黑先',time:22000,
      stones:[B(x,0),B(x+1,0),B(x+2,0),B(x+3,0),B(x,1),B(x+3,1),W(x+1,2),W(x+2,2),W(x,2),W(x+3,2)],
      seqs:[[[x+2,1]]],
      region:{x1:Math.max(0,x-1),y1:0,x2:Math.min(18,x+4),y2:3}})
  }

  // --- 2.6 切断 ---
  for(var x=2;x<=14;x+=3){
    for(var y=2;y<=10;y+=4){
      ALL.push({cat:'切断',rating:800+(x+y)%40,desc:'黑先',time:20000,
        stones:[W(x,y),W(x+1,y),W(x+2,y),B(x,y-1),B(x+2,y-1),B(x,y+1),B(x+2,y+1)],
        seqs:[[[x+1,y-1]],[[x+1,y+1]]],
        region:{x1:x-1,y1:y-2,x2:x+3,y2:y+2}})
    }
  }

  // --- 2.7 点眼(破眼) ---
  for(var x=0;x<=12;x+=4){
    ALL.push({cat:'点眼',rating:840+x*4,desc:'黑先',time:22000,
      stones:[W(x,0),W(x+1,0),W(x+2,0),W(x+3,0),W(x,1),W(x+3,1),B(x+1,2),B(x+2,2),B(x,2),B(x+3,2),B(x+4,1),B(x+4,0)],
      seqs:[[[x+2,1]]],
      region:{x1:Math.max(0,x-1),y1:0,x2:Math.min(18,x+5),y2:3}})
  }

  // ========== 第3级: 中级 (900-1200) ==========
  // --- 3.1 角上死活 ---
  var cornerLifeBases = [
    // L形活棋
    {stones:[W(0,0),W(1,0),W(2,0),W(0,1),W(0,2),B(3,0),B(1,1),B(2,1),B(1,2),B(0,3)],
     seqs:[[[2,2],[1,2],[0,2]]]},
    // 直四
    {stones:[W(0,0),W(1,0),W(2,0),W(3,0),W(0,1),W(3,1),B(4,0),B(1,1),B(2,1),B(4,1),B(0,2),B(1,2),B(2,2),B(3,2)],
     seqs:[[[1,1]],[[2,1]]]},
    // 弯四
    {stones:[W(0,0),W(1,0),W(2,0),W(0,1),W(0,2),W(1,2),B(3,0),B(1,1),B(2,1),B(3,1),B(2,2),B(1,3),B(0,3)],
     seqs:[[[2,2],[1,1],[0,1]]]},
    // 板六
    {stones:[W(0,0),W(1,0),W(2,0),W(3,0),W(4,0),W(0,1),W(4,1),B(5,0),B(1,1),B(2,1),B(3,1),B(5,1),B(0,2),B(1,2),B(2,2),B(3,2),B(4,2)],
     seqs:[[[2,1]]]},
  ]
  for(var i=0;i<cornerLifeBases.length;i++){
    var vs=expand(cornerLifeBases[i],'死活',900+i*40,'黑先',35000,[[0,0]])
    ALL=ALL.concat(vs)
  }

  // --- 3.2 边上死活 ---
  var edgeLifeBases = [
    // 边上直三需要扩展
    {stones:[W(5,0),W(6,0),W(7,0),W(5,1),W(7,1),B(4,0),B(8,0),B(4,1),B(8,1),B(5,2),B(6,2),B(7,2)],
     seqs:[[[6,1]]]},
    // 边上弯三
    {stones:[W(5,0),W(6,0),W(5,1),W(6,1),W(7,0),B(4,0),B(8,0),B(4,1),B(7,1),B(5,2),B(6,2),B(7,2),B(8,1)],
     seqs:[[[6,1],[5,1],[7,1]]]},
  ]
  for(var i=0;i<edgeLifeBases.length;i++){
    var vs=expand(edgeLifeBases[i],'死活',960+i*30,'黑先',30000,[[0,0],[-3,0],[3,0]])
    ALL=ALL.concat(vs)
  }

  // --- 3.3 对杀(基本) ---
  for(var x=0;x<=10;x+=5){
    for(var y=0;y<=10;y+=5){
      if(x+4<=18&&y+4<=18){
        ALL.push({cat:'对杀',rating:1000+(x+y)%40,desc:'黑先',time:35000,
          stones:[B(x,y),B(x+1,y),B(x,y+1),W(x+2,y),W(x+2,y+1),W(x+3,y),B(x+1,y+2),B(x+2,y+2),W(x+3,y+1),W(x+4,y)],
          seqs:[[[x+1,y+1],[x+3,y+2],[x+2,y+1]]], // 紧气
          region:{x1:Math.max(0,x-1),y1:Math.max(0,y-1),x2:Math.min(18,x+5),y2:Math.min(18,y+3)}})
      }
    }
  }

  // --- 3.4 手筋:倒扑 ---
  var snapbackBases = [
    {stones:[W(1,0),W(2,0),W(0,1),W(3,1),B(3,0),B(1,1),B(2,1),B(0,2),B(1,2)],
     seqs:[[[0,0],[0,1],[1,0]]]},
    {stones:[W(0,0),W(1,0),W(0,1),B(2,0),B(1,1),B(0,2)],
     seqs:[[[2,1],[1,0],[0,0]]]},
  ]
  for(var i=0;i<snapbackBases.length;i++){
    var vs=expand(snapbackBases[i],'手筋',1050+i*30,'黑先',30000,[[0,0],[8,0],[0,8]])
    ALL=ALL.concat(vs)
  }

  // --- 3.5 大量中级吃子(3-5手) ---
  var midCaptures = [
    {stones:[W(3,3),W(4,3),B(2,3),B(5,3),B(3,2),B(4,2),B(3,4)],seqs:[[[4,4],[5,4],[5,3]]]},
    {stones:[W(3,3),W(3,4),B(2,3),B(2,4),B(3,2),B(4,3)],seqs:[[[3,5],[4,4],[4,5]]]},
    {stones:[W(5,5),W(6,5),W(5,6),B(4,5),B(7,5),B(5,4),B(6,4),B(6,6)],seqs:[[[5,7],[6,6],[7,6]]]},
  ]
  for(var i=0;i<midCaptures.length;i++){
    var vs=expand(midCaptures[i],'吃子',1080+i*20,'黑先',28000,[[0,0],[3,3],[6,0],[0,6]])
    ALL=ALL.concat(vs)
  }

  // ========== 第4级: 高级 (1200-1600) ==========
  // --- 4.1 复杂角上死活 ---
  var advCornerLife = [
    {stones:[W(0,0),W(1,0),W(2,0),W(3,0),W(0,1),W(0,2),W(1,2),
             B(4,0),B(1,1),B(2,1),B(3,1),B(4,1),B(2,2),B(1,3),B(0,3)],
     seqs:[[[3,2],[2,2],[0,1],[1,1],[0,2]]]},
    {stones:[W(0,0),W(1,0),W(2,0),W(3,0),W(4,0),W(0,1),W(0,2),W(1,2),
             B(5,0),B(1,1),B(2,1),B(3,1),B(4,1),B(5,1),B(2,2),B(1,3),B(0,3)],
     seqs:[[[4,2],[3,2],[2,2],[0,1],[0,2]]]},
    {stones:[W(0,0),W(1,0),W(2,0),W(0,1),W(2,1),W(0,2),W(1,2),W(2,2),
             B(3,0),B(3,1),B(3,2),B(2,3),B(1,3),B(0,3)],
     seqs:[[[1,1],[0,1],[2,1]]]},
  ]
  for(var i=0;i<advCornerLife.length;i++){
    var vs=expand(advCornerLife[i],'死活',1200+i*50,'黑先',40000,[[0,0]])
    ALL=ALL.concat(vs)
  }

  // --- 4.2 劫 ---
  var koBases = [
    {stones:[W(0,0),W(1,0),W(0,1),B(2,0),B(1,1),B(0,2),B(2,1)],
     seqs:[[[1,2],[0,1],[0,2]]]},
    {stones:[W(1,0),W(2,0),W(0,1),W(3,0),B(1,1),B(2,1),B(3,1),B(4,0)],
     seqs:[[[2,2],[1,2],[0,0]]]},
  ]
  for(var i=0;i<koBases.length;i++){
    var vs=expand(koBases[i],'劫',1300+i*40,'黑先',40000,[[0,0],[8,0],[0,8],[8,8]])
    ALL=ALL.concat(vs)
  }

  // --- 4.3 高级手筋 ---
  var tesujiBases = [
    // 双叫吃
    {stones:[W(3,3),W(4,3),W(3,4),B(2,3),B(5,3),B(3,2),B(4,2),B(4,4),B(3,5)],
     seqs:[[[4,5],[5,4],[2,4]]]},
    // 夹
    {stones:[W(3,3),W(4,4),B(2,3),B(3,2),B(5,4),B(4,5)],
     seqs:[[[3,4],[4,3],[5,3]]]},
    // 挖
    {stones:[W(3,3),W(4,3),W(5,3),B(3,2),B(4,2),B(5,2),B(6,3),B(5,4)],
     seqs:[[[4,4],[3,4],[3,3]]]},
  ]
  for(var i=0;i<tesujiBases.length;i++){
    var vs=expand(tesujiBases[i],'手筋',1350+i*40,'黑先',35000,[[0,0],[4,4],[0,6],[6,0]])
    ALL=ALL.concat(vs)
  }

  // --- 4.4 复杂对杀 ---
  var advSemeai = [
    {stones:[B(0,0),B(1,0),B(0,1),B(0,2),W(2,0),W(2,1),W(1,1),W(1,2),W(0,3),
             B(3,0),B(3,1),B(2,2),B(1,3)],
     seqs:[[[0,4],[2,3],[1,4]]]},
  ]
  for(var i=0;i<advSemeai.length;i++){
    var vs=expand(advSemeai[i],'对杀',1450+i*30,'黑先',45000,[[0,0],[8,0],[0,8]])
    ALL=ALL.concat(vs)
  }

  // ========== 第5级: 段位 (1600-2100) ==========
  // --- 5.1 复杂死活(长手数) ---
  var expertLife = [
    {stones:[W(0,0),W(1,0),W(2,0),W(3,0),W(4,0),W(0,1),W(4,1),W(0,2),W(1,2),W(3,2),W(4,2),
             B(5,0),B(5,1),B(5,2),B(4,3),B(3,3),B(2,3),B(1,3),B(0,3)],
     seqs:[[[2,1],[1,1],[2,2],[3,1],[3,2]]]},
    {stones:[W(0,0),W(1,0),W(2,0),W(3,0),W(0,1),W(3,1),W(0,2),W(0,3),W(1,3),
             B(4,0),B(4,1),B(1,1),B(2,1),B(3,2),B(2,3),B(1,4),B(0,4)],
     seqs:[[[1,2],[2,2],[3,3],[0,2],[0,3]]]},
  ]
  for(var i=0;i<expertLife.length;i++){
    var vs=expand(expertLife[i],'死活',1600+i*60,'黑先',50000,[[0,0]])
    ALL=ALL.concat(vs)
  }

  // --- 5.2 复杂劫 ---
  var expertKo = [
    {stones:[W(0,0),W(1,0),W(2,0),W(0,1),W(2,1),W(0,2),
             B(3,0),B(3,1),B(1,1),B(2,2),B(1,2),B(0,3)],
     seqs:[[[1,3],[0,2],[0,1],[1,1],[2,1]]]},
  ]
  for(var i=0;i<expertKo.length;i++){
    var vs=expand(expertKo[i],'劫',1700+i*50,'黑先',55000,[[0,0],[8,0]])
    ALL=ALL.concat(vs)
  }

  // ========== 大量生成：系统化网格位置变体 ==========
  // 用已有的基础题型在不同位置生成大量变体

  // 吃子变体：中腹各位置
  for(var cx=2;cx<=16;cx++){
    for(var cy=2;cy<=16;cy++){
      var r=((cx*7+cy*13)%5)
      if(r===0){
        ALL.push({cat:'吃子',rating:500+((cx+cy)*17)%200,desc:'黑先',time:15000,
          stones:[W(cx,cy),B(cx-1,cy),B(cx+1,cy),B(cx,cy-1)],seqs:[[[cx,cy+1]]],
          region:{x1:cx-2,y1:cy-2,x2:cx+2,y2:cy+2}})
      } else if(r===1){
        ALL.push({cat:'吃子',rating:520+((cx+cy)*17)%200,desc:'黑先',time:16000,
          stones:[W(cx,cy),W(cx+1,cy),B(cx-1,cy),B(cx+2,cy),B(cx,cy-1),B(cx+1,cy-1)],seqs:[[[cx,cy+1],[cx+1,cy+1],[cx+2,cy+1]]]  ,
          region:{x1:cx-2,y1:cy-2,x2:cx+3,y2:cy+2}})
      } else if(r===2){
        ALL.push({cat:'逃子',rating:550+((cx+cy)*13)%180,desc:'黑先',time:16000,
          stones:[B(cx,cy),W(cx-1,cy),W(cx,cy-1),W(cx+1,cy)],seqs:[[[cx,cy+1]]],
          region:{x1:cx-2,y1:cy-2,x2:cx+2,y2:cy+3}})
      } else if(r===3){
        ALL.push({cat:'连接',rating:600+((cx+cy)*11)%150,desc:'黑先',time:18000,
          stones:[B(cx,cy),B(cx+2,cy),W(cx+1,cy-1),W(cx+1,cy+1)],seqs:[[[cx+1,cy]]],
          region:{x1:cx-1,y1:cy-2,x2:cx+3,y2:cy+2}})
      } else {
        ALL.push({cat:'切断',rating:700+((cx+cy)*19)%200,desc:'黑先',time:20000,
          stones:[W(cx,cy),W(cx+1,cy),B(cx-1,cy),B(cx+2,cy),B(cx,cy+1),B(cx+1,cy-1)],seqs:[[[cx+1,cy+1]],[[cx,cy-1]]],
          region:{x1:cx-2,y1:cy-2,x2:cx+3,y2:cy+2}})
      }
    }
  }

  // 边上死活变体
  for(var x=1;x<=13;x++){
    for(var edge=0;edge<4;edge++){
      var rating=800+x*15+edge*10+(x*edge)%40
      if(edge===0){ // 上边
        ALL.push({cat:'死活',rating:rating,desc:'黑先',time:30000,
          stones:[W(x,0),W(x+1,0),W(x+2,0),W(x,1),W(x+2,1),
                  B(x-1,0),B(x+3,0),B(x-1,1),B(x+3,1),B(x,2),B(x+1,2),B(x+2,2)],
          seqs:[[[x+1,1]]],
          region:{x1:Math.max(0,x-2),y1:0,x2:Math.min(18,x+4),y2:3}})
      } else if(edge===1){ // 下边
        ALL.push({cat:'死活',rating:rating,desc:'黑先',time:30000,
          stones:[W(x,18),W(x+1,18),W(x+2,18),W(x,17),W(x+2,17),
                  B(x-1,18),B(x+3,18),B(x-1,17),B(x+3,17),B(x,16),B(x+1,16),B(x+2,16)],
          seqs:[[[x+1,17]]],
          region:{x1:Math.max(0,x-2),y1:15,x2:Math.min(18,x+4),y2:18}})
      } else if(edge===2){ // 左边
        ALL.push({cat:'死活',rating:rating,desc:'黑先',time:30000,
          stones:[W(0,x),W(0,x+1),W(0,x+2),W(1,x),W(1,x+2),
                  B(0,x-1),B(0,x+3),B(1,x-1),B(1,x+3),B(2,x),B(2,x+1),B(2,x+2)],
          seqs:[[[1,x+1]]],
          region:{x1:0,y1:Math.max(0,x-2),x2:3,y2:Math.min(18,x+4)}})
      } else { // 右边
        ALL.push({cat:'死活',rating:rating,desc:'黑先',time:30000,
          stones:[W(18,x),W(18,x+1),W(18,x+2),W(17,x),W(17,x+2),
                  B(18,x-1),B(18,x+3),B(17,x-1),B(17,x+3),B(16,x),B(16,x+1),B(16,x+2)],
          seqs:[[[17,x+1]]],
          region:{x1:15,y1:Math.max(0,x-2),x2:18,y2:Math.min(18,x+4)}})
      }
    }
  }

  // 征子变体（不同方向、不同起点）
  for(var sx=2;sx<=14;sx+=2){
    for(var sy=2;sy<=14;sy+=2){
      if((sx+sy)%4===0){
        ALL.push({cat:'征子',rating:700+(sx*3+sy*7)%200,desc:'黑先',time:25000,
          stones:[B(sx,sy),B(sx+1,sy+1),W(sx+1,sy)],
          seqs:[[[sx+1,sy-1],[sx+2,sy],[sx+2,sy-1],[sx+3,sy],[sx+3,sy-1]]],
          region:{x1:sx-1,y1:Math.max(0,sy-2),x2:Math.min(18,sx+5),y2:sy+2}})
      }
    }
  }

  // 做眼/点眼大量变体
  for(var x=0;x<=14;x+=2){
    for(var side=0;side<2;side++){
      var y=side===0?0:18
      var dy=side===0?1:-1
      ALL.push({cat:'做眼',rating:850+x*8,desc:'白先',time:28000,
        stones:[W(x,y),W(x+1,y),W(x+2,y),W(x+3,y),W(x,y+dy),W(x+3,y+dy),
                B(x+1,y+dy*2),B(x+2,y+dy*2),B(x,y+dy*2),B(x+3,y+dy*2),B(x+4,y),B(x+4,y+dy)],
        seqs:[[[x+1,y+dy]]],
        region:side===0?{x1:Math.max(0,x-1),y1:0,x2:Math.min(18,x+5),y2:3}:{x1:Math.max(0,x-1),y1:15,x2:Math.min(18,x+5),y2:18}})
      ALL.push({cat:'点眼',rating:880+x*8,desc:'黑先',time:28000,
        stones:[W(x,y),W(x+1,y),W(x+2,y),W(x+3,y),W(x,y+dy),W(x+3,y+dy),
                B(x+1,y+dy*2),B(x+2,y+dy*2),B(x,y+dy*2),B(x+3,y+dy*2),B(x+4,y),B(x+4,y+dy)],
        seqs:[[[x+2,y+dy]]],
        region:side===0?{x1:Math.max(0,x-1),y1:0,x2:Math.min(18,x+5),y2:3}:{x1:Math.max(0,x-1),y1:15,x2:Math.min(18,x+5),y2:18}})
    }
  }

  // 高级死活：角上各种形状
  var cornerShapes = [
    // 角上方四
    {s:[W(0,0),W(1,0),W(2,0),W(3,0),W(0,1),W(3,1)],
     b:[B(4,0),B(4,1),B(3,2),B(2,2),B(1,2),B(0,2),B(1,1),B(2,1)],
     ans:[[[2,1]]]},
    // 角上曲四
    {s:[W(0,0),W(1,0),W(2,0),W(0,1),W(0,2),W(1,2)],
     b:[B(3,0),B(3,1),B(2,1),B(2,2),B(1,3),B(0,3),B(1,1)],
     ans:[[[1,1]]]},
    // 刀把五
    {s:[W(0,0),W(1,0),W(2,0),W(3,0),W(4,0),W(0,1),W(4,1),W(0,2)],
     b:[B(5,0),B(5,1),B(4,2),B(3,2),B(2,2),B(1,2),B(0,3),B(1,1),B(2,1),B(3,1)],
     ans:[[[3,1]]]},
    // 梅花五
    {s:[W(0,0),W(1,0),W(2,0),W(0,1),W(2,1),W(0,2),W(1,2),W(2,2)],
     b:[B(3,0),B(3,1),B(3,2),B(2,3),B(1,3),B(0,3)],
     ans:[[[1,1]]]},
  ]
  for(var i=0;i<cornerShapes.length;i++){
    var allStones=cornerShapes[i].s.concat(cornerShapes[i].b)
    var prob={stones:allStones,seqs:cornerShapes[i].ans}
    var vs=expand(prob,'死活',1100+i*80,'黑先',40000,[[0,0]])
    ALL=ALL.concat(vs)
  }

  // 中腹手筋大量
  for(var cx=3;cx<=15;cx+=2){
    for(var cy=3;cy<=15;cy+=2){
      var h=((cx*11+cy*7)%8)
      if(h<2){
        // 双叫吃
        ALL.push({cat:'手筋',rating:1200+(cx+cy*3)%300,desc:'黑先',time:35000,
          stones:[W(cx,cy),W(cx+1,cy),B(cx-1,cy),B(cx+2,cy),B(cx,cy-1),B(cx+1,cy+1)],
          seqs:[[[cx+1,cy-1]]],
          region:{x1:cx-2,y1:cy-2,x2:cx+3,y2:cy+2}})
      } else if(h<4){
        // 挖
        ALL.push({cat:'手筋',rating:1250+(cx+cy*3)%280,desc:'黑先',time:35000,
          stones:[W(cx,cy),W(cx+1,cy),W(cx+2,cy),B(cx,cy-1),B(cx+1,cy-1),B(cx+2,cy-1),B(cx+3,cy)],
          seqs:[[[cx+1,cy+1],[cx,cy+1],[cx+2,cy+1]]],
          region:{x1:cx-1,y1:cy-2,x2:cx+4,y2:cy+2}})
      } else if(h<6){
        // 对杀(紧气)
        ALL.push({cat:'对杀',rating:1350+(cx+cy*5)%250,desc:'黑先',time:40000,
          stones:[B(cx,cy),B(cx+1,cy),W(cx+2,cy),W(cx+3,cy),B(cx,cy+1),W(cx+3,cy+1),B(cx+1,cy+2),B(cx+2,cy+2)],
          seqs:[[[cx+2,cy+1],[cx+1,cy+1],[cx+3,cy+2]]],
          region:{x1:cx-1,y1:cy-1,x2:cx+4,y2:cy+3}})
      } else {
        // 官子手筋
        ALL.push({cat:'官子',rating:1400+(cx+cy*3)%300,desc:'黑先',time:35000,
          stones:[W(cx,cy),W(cx+1,cy),W(cx,cy+1),B(cx-1,cy),B(cx-1,cy+1),B(cx,cy+2),B(cx+1,cy+1),B(cx+2,cy)],
          seqs:[[[cx+1,cy+2],[cx,cy+1],[cx+2,cy+1]]],
          region:{x1:cx-2,y1:cy-1,x2:cx+3,y2:cy+3}})
      }
    }
  }

  // 段位级复杂死活
  for(var i=0;i<4;i++){
    for(var j=0;j<4;j++){
      var ox=i*4,oy=j*4
      if(ox+5<=18&&oy+4<=18){
        ALL.push({cat:'死活',rating:1600+(i*17+j*23)%400,desc:'黑先',time:50000,
          stones:[W(ox,oy),W(ox+1,oy),W(ox+2,oy),W(ox+3,oy),W(ox+4,oy),
                  W(ox,oy+1),W(ox+4,oy+1),W(ox,oy+2),W(ox+1,oy+2),W(ox+3,oy+2),W(ox+4,oy+2),
                  B(ox+5,oy),B(ox+5,oy+1),B(ox+5,oy+2),B(ox+4,oy+3),B(ox+3,oy+3),
                  B(ox+2,oy+3),B(ox+1,oy+3),B(ox,oy+3),B(ox+2,oy+1)],
          seqs:[[[ox+3,oy+1],[ox+1,oy+1],[ox+2,oy+2]]],
          region:{x1:Math.max(0,ox-1),y1:Math.max(0,oy-1),x2:Math.min(18,ox+6),y2:Math.min(18,oy+4)}})
      }
    }
  }

  return ALL
}

// ===== 云函数入口 =====
exports.main = async function(event, context) {
  var action = event.action || 'seed'

  if (action === 'count') {
    var res = await db.collection('problems').count()
    return { total: res.total }
  }

  // 验证题目: { action: 'validate', batch: 0 } 检查, { action: 'validate', batch: 0, fix: true } 检查+删除
  if (action === 'validate') {
    return await validateBatch(event)
  }

  // 重新分级: { action: 'classify', batch: 0 }
  if (action === 'classify') {
    return await classifyBatch(event)
  }

  // 统计各级别分布: { action: 'stats' }
  if (action === 'stats') {
    var total = (await db.collection('problems').count()).total
    var tiers = {}
    var cats = {}
    var scanned = 0
    while (scanned < total) {
      var batch = await db.collection('problems').skip(scanned).limit(100).orderBy('problem_id','asc').get()
      if (batch.data.length === 0) break
      for (var i = 0; i < batch.data.length; i++) {
        var t = batch.data[i].level_tier || 'unclassified'
        var c = batch.data[i].category || 'unknown'
        tiers[t] = (tiers[t] || 0) + 1
        cats[c] = (cats[c] || 0) + 1
      }
      scanned += batch.data.length
    }
    return { total: total, by_tier: tiers, by_category: cats }
  }

  if (action === 'clear') {
    // 分批删除
    var total = (await db.collection('problems').count()).total
    var deleted = 0
    while (deleted < total) {
      var batch = await db.collection('problems').limit(100).get()
      if (batch.data.length === 0) break
      var tasks = batch.data.map(function(d) {
        return db.collection('problems').doc(d._id).remove()
      })
      await Promise.all(tasks)
      deleted += batch.data.length
    }
    return { deleted: deleted }
  }

  // seed: 生成并导入一批题目
  var batchNum = event.batch || 0
  var batchSize = 500
  var startId = batchNum * batchSize

  console.log('Generating all problems...')
  var all = generateAll()
  console.log('Total generated:', all.length)

  var endId = Math.min(startId + batchSize, all.length)
  if (startId >= all.length) {
    return { message: 'No more problems', total: all.length, batch: batchNum }
  }

  var batch = []
  for (var i = startId; i < endId; i++) {
    var p = all[i]
    var region = p.region || vr(p.stones, p.seqs)
    var tier = p.level_tier || getLevelTier(p.rating)
    var steps = p.steps || (p.seqs && p.seqs.length > 0 ? p.seqs[0].length : 0)
    var hint = p.hint || CAT_HINTS[p.cat] || p.cat
    batch.push({
      problem_id: i,
      category: p.cat,
      difficulty_rating: p.rating,
      board_size: 19,
      description: p.desc,
      expected_time_ms: p.time,
      initial_stones: p.stones,
      view_region: region,
      correct_sequences: p.seqs,
      level_tier: tier,
      steps: steps,
      has_variants: p.seqs ? p.seqs.length > 1 : false,
      hint: hint,
    })
  }

  // 分批插入(每次20条，云数据库限制)
  var inserted = 0
  for (var i = 0; i < batch.length; i += 20) {
    var chunk = batch.slice(i, i + 20)
    var tasks = chunk.map(function(p) {
      return db.collection('problems').add({ data: p })
    })
    await Promise.all(tasks)
    inserted += chunk.length
  }

  return {
    batch: batchNum,
    inserted: inserted,
    startId: startId,
    endId: endId - 1,
    totalGenerated: all.length,
    totalBatches: Math.ceil(all.length / batchSize),
  }
}

// ========== 围棋规则引擎（用于验证题目） ==========
function createBoard(size) {
  var b = []
  for (var i = 0; i < size; i++) { var r = []; for (var j = 0; j < size; j++) r.push(null); b.push(r) }
  return b
}
function getNeighbors(x, y, size) {
  var pts = []
  if (x > 0) pts.push([x-1, y]); if (x < size-1) pts.push([x+1, y])
  if (y > 0) pts.push([x, y-1]); if (y < size-1) pts.push([x, y+1])
  return pts
}
function getGroupAndLiberties(board, x, y, size) {
  var color = board[y][x]; if (!color) return { group: [], liberties: 0 }
  var visited = {}, group = [], libSet = {}, stack = [[x, y]]
  while (stack.length > 0) {
    var p = stack.pop(), k = p[0] + ',' + p[1]
    if (visited[k]) continue; visited[k] = true; group.push(p)
    var nb = getNeighbors(p[0], p[1], size)
    for (var i = 0; i < nb.length; i++) {
      var n = nb[i], nk = n[0] + ',' + n[1]
      if (board[n[1]][n[0]] === null) libSet[nk] = true
      else if (board[n[1]][n[0]] === color && !visited[nk]) stack.push(n)
    }
  }
  return { group: group, liberties: Object.keys(libSet).length }
}
function simulateMove(board, x, y, color, size) {
  if (x < 0 || x >= size || y < 0 || y >= size) return { valid: false, reason: 'oob' }
  if (board[y][x] !== null) return { valid: false, reason: 'occupied' }
  var nb = board.map(function(r) { return r.slice() })
  nb[y][x] = color
  var opp = color === 'black' ? 'white' : 'black'
  var captured = []
  var neighbors = getNeighbors(x, y, size)
  for (var i = 0; i < neighbors.length; i++) {
    var n = neighbors[i]
    if (nb[n[1]][n[0]] === opp) {
      var gl = getGroupAndLiberties(nb, n[0], n[1], size)
      if (gl.liberties === 0) {
        for (var g = 0; g < gl.group.length; g++) { nb[gl.group[g][1]][gl.group[g][0]] = null; captured.push(gl.group[g]) }
      }
    }
  }
  if (captured.length === 0) {
    var selfGL = getGroupAndLiberties(nb, x, y, size)
    if (selfGL.liberties === 0) return { valid: false, reason: 'suicide' }
  }
  return { valid: true, board: nb, captured: captured }
}

// ========== validate action: 检测并删除不合理的题目 ==========
// 调用: { action: 'validate', batch: 0 }  每批检查500题，返回问题列表
// 调用: { action: 'validate', batch: 0, fix: true }  检查+删除有问题的题
async function validateBatch(event) {
  var batchNum = event.batch || 0
  var batchSize = 100 // 每批100题，避免超时
  var doFix = event.fix === true
  var skip = batchNum * batchSize

  var total = (await db.collection('problems').count()).total
  if (skip >= total) return { done: true, total: total, batch: batchNum }

  var res = await db.collection('problems').skip(skip).limit(batchSize).orderBy('problem_id', 'asc').get()
  var problems = res.data

  var issues = []
  var deleteIds = []

  for (var i = 0; i < problems.length; i++) {
    var p = problems[i]
    var errs = []

    // === 基础字段检查 ===
    if (!p.initial_stones || !Array.isArray(p.initial_stones) || p.initial_stones.length === 0)
      errs.push('no_stones')

    if (!p.correct_sequences || !Array.isArray(p.correct_sequences) || p.correct_sequences.length === 0)
      errs.push('no_sequences')
    else {
      var allEmpty = true
      for (var s = 0; s < p.correct_sequences.length; s++)
        if (p.correct_sequences[s] && p.correct_sequences[s].length > 0) allEmpty = false
      if (allEmpty) errs.push('empty_sequences')
    }

    if (!p.description) errs.push('no_description')
    if (!p.difficulty_rating || p.difficulty_rating < 100 || p.difficulty_rating > 3000) errs.push('bad_rating')

    if (errs.length > 0) {
      issues.push({ id: p._id, pid: p.problem_id, cat: p.category, rating: p.difficulty_rating, errors: errs })
      if (doFix) deleteIds.push(p._id)
      continue
    }

    // === 棋盘合法性检查 ===
    var size = p.board_size || 19
    var board = createBoard(size)
    var stoneErr = false

    for (var j = 0; j < p.initial_stones.length; j++) {
      var st = p.initial_stones[j]
      if (!st || st.x === undefined || st.y === undefined || !st.color) { stoneErr = true; errs.push('bad_stone_data'); break }
      if (st.x < 0 || st.x >= size || st.y < 0 || st.y >= size) { stoneErr = true; errs.push('stone_oob:' + st.x + ',' + st.y); break }
      if (board[st.y][st.x] !== null) { stoneErr = true; errs.push('dup_stone:' + st.x + ',' + st.y); break }
      board[st.y][st.x] = st.color
    }

    if (stoneErr) {
      issues.push({ id: p._id, pid: p.problem_id, cat: p.category, rating: p.difficulty_rating, errors: errs })
      if (doFix) deleteIds.push(p._id)
      continue
    }

    // === 检查初始局面：有没有已经0气的棋子（不合法局面） ===
    var deadGroups = false
    var checked = {}
    for (var j = 0; j < p.initial_stones.length; j++) {
      var st = p.initial_stones[j]
      var key = st.x + ',' + st.y
      if (checked[key]) continue
      var gl = getGroupAndLiberties(board, st.x, st.y, size)
      for (var g = 0; g < gl.group.length; g++) checked[gl.group[g][0] + ',' + gl.group[g][1]] = true
      if (gl.liberties === 0) { deadGroups = true; errs.push('dead_group:' + st.color + '@' + st.x + ',' + st.y); break }
    }
    if (deadGroups) {
      issues.push({ id: p._id, pid: p.problem_id, cat: p.category, rating: p.difficulty_rating, errors: errs })
      if (doFix) deleteIds.push(p._id)
      continue
    }

    // === 模拟正确答案序列 ===
    var desc = p.description || '黑先'
    var firstColor = desc.indexOf('白先') !== -1 ? 'white' : 'black'
    var seqValid = false

    for (var s = 0; s < p.correct_sequences.length; s++) {
      var seq = p.correct_sequences[s]
      if (!seq || seq.length === 0) continue

      var simBoard = board.map(function(r) { return r.slice() })
      var color = firstColor
      var seqOk = true

      for (var m = 0; m < seq.length; m++) {
        var move = seq[m]
        if (!move || !Array.isArray(move) || move.length < 2) { seqOk = false; break }
        var result = simulateMove(simBoard, move[0], move[1], color, size)
        if (!result.valid) { seqOk = false; errs.push('invalid_move_' + (m+1) + ':' + move[0] + ',' + move[1] + '(' + result.reason + ')'); break }
        simBoard = result.board
        color = color === 'black' ? 'white' : 'black'
      }

      if (seqOk) { seqValid = true; break }
    }

    if (!seqValid) {
      if (errs.length === 0) errs.push('no_valid_sequence')
      issues.push({ id: p._id, pid: p.problem_id, cat: p.category, rating: p.difficulty_rating, errors: errs })
      if (doFix) deleteIds.push(p._id)
      continue
    }

    // === 检查第一手落在已有棋子上 ===
    var moveOnStone = false
    for (var s = 0; s < p.correct_sequences.length; s++) {
      var seq = p.correct_sequences[s]
      if (seq && seq.length > 0) {
        var fm = seq[0]
        if (board[fm[1]] && board[fm[1]][fm[0]] !== null) { moveOnStone = true; break }
      }
    }
    if (moveOnStone) {
      errs.push('first_move_on_stone')
      issues.push({ id: p._id, pid: p.problem_id, cat: p.category, rating: p.difficulty_rating, errors: errs })
      if (doFix) deleteIds.push(p._id)
    }
  }

  // 删除有问题的题
  var deleted = 0
  if (doFix && deleteIds.length > 0) {
    for (var i = 0; i < deleteIds.length; i += 20) {
      var chunk = deleteIds.slice(i, i + 20)
      var tasks = chunk.map(function(id) { return db.collection('problems').doc(id).remove() })
      await Promise.all(tasks)
      deleted += chunk.length
    }
  }

  return {
    batch: batchNum,
    checked: problems.length,
    issues_found: issues.length,
    deleted: deleted,
    total_in_db: total,
    next_batch: skip + batchSize < total ? batchNum + 1 : null,
    issues: issues,
  }
}

// ========== classify action: 给所有题目重新分级 ==========
// 调用: { action: 'classify', batch: 0 }
async function classifyBatch(event) {
  var batchNum = event.batch || 0
  var batchSize = 100
  var skip = batchNum * batchSize

  var total = (await db.collection('problems').count()).total
  if (skip >= total) return { done: true, total: total }

  var res = await db.collection('problems').skip(skip).limit(batchSize).orderBy('problem_id', 'asc').get()
  var problems = res.data
  var updated = 0

  for (var i = 0; i < problems.length; i++) {
    var p = problems[i]
    var rating = p.difficulty_rating || 1000
    var seqs = p.correct_sequences || []

    // 计算步数（取最长正确序列中的第一手方步数）
    var maxSteps = 0
    for (var s = 0; s < seqs.length; s++) {
      if (seqs[s] && seqs[s].length > maxSteps) maxSteps = seqs[s].length
    }
    // 玩家实际需要下的步数 = ceil(总步数/2)（因为交替下）
    var playerSteps = Math.ceil(maxSteps / 2)

    // 计算棋子数
    var stoneCount = (p.initial_stones || []).length

    // 判断是否有变化分支
    var hasVariants = seqs.length > 1

    // === 分级逻辑 ===
    var tier, newRating = rating
    if (rating < 800 && playerSteps <= 1 && stoneCount <= 8) {
      tier = 'beginner'
    } else if (rating < 800 && (playerSteps > 1 || stoneCount > 8)) {
      // rating 低但步数多/棋子多 → 提升到初级
      tier = 'elementary'
      newRating = Math.max(rating, 800)
    } else if (rating >= 800 && rating < 1200) {
      if (playerSteps <= 3) {
        tier = 'elementary'
      } else {
        // 步数多于3步 → 提升到中级
        tier = 'intermediate'
        newRating = Math.max(rating, 1200)
      }
    } else if (rating >= 1200 && rating < 1600) {
      tier = 'intermediate'
    } else {
      // 1600+
      if (playerSteps >= 3 && hasVariants) {
        tier = 'advanced'
      } else if (playerSteps >= 3) {
        tier = 'advanced'
      } else {
        // 高rating但步数少 → 降到中级
        tier = 'intermediate'
        newRating = Math.min(rating, 1599)
      }
    }

    // 根据类别生成hint
    var cat = p.category || ''
    var desc = p.description || '黑先'
    var hint = CAT_HINTS[cat] || cat
    if (desc.indexOf('白先') !== -1) {
      hint = hint.replace('黑','白').replace('白子','黑子')
    }

    // 估算时间
    var expectedTime = playerSteps <= 1 ? 10000 :
                       playerSteps <= 2 ? 18000 :
                       playerSteps <= 3 ? 25000 :
                       playerSteps <= 5 ? 35000 : 50000

    // 更新数据库
    await db.collection('problems').doc(p._id).update({
      data: {
        level_tier: tier,
        steps: maxSteps,
        has_variants: hasVariants,
        hint: hint,
        difficulty_rating: newRating,
        expected_time_ms: p.expected_time_ms || expectedTime,
      }
    })
    updated++
  }

  return {
    batch: batchNum,
    updated: updated,
    total_in_db: total,
    next_batch: skip + batchSize < total ? batchNum + 1 : null,
  }
}

'use strict';
window.WarData=(()=>{
  // The final five rows reproduce the supplied PDF. Earlier rows are prototype values.
  const rows=[
    ['lubu','呂布','群','高攻低穩',98,38,1000,78,30,'無雙亂舞',60,'rival',true],
    ['guanyu','關羽','蜀','攻守穩定',85,68,1100,60,82,'青龍偃月',40,'attack',true],
    ['zhangfei','張飛','蜀','重裝震懾',78,90,1250,38,88,'長坂怒吼',30,'defense',true],
    ['zhaoyun','趙雲','蜀','高速反擊',76,56,950,96,67,'七進七出',40,'stamina',true],
    ['zhugeliang','諸葛亮','蜀','逆境翻盤',40,38,800,55,45,'心之一方',100,'stamina',true],
    ['liubei','劉備','蜀','援軍回復',60,64,1100,57,70,'桃園結義',55,'attack',true],
    ['caocao','曹操','魏','資源封鎖',70,65,1050,65,68,'挾天子令諸侯',50,'defense',true],
    ['simayi','司馬懿','魏','蓄傷反擊',58,72,1100,48,78,'隱忍待機',35,'defense',true],
    ['zhouyu','周瑜','吳','區域灼燒',75,48,950,72,55,'赤壁連環火',45,'rival',true],
    ['diaochan','貂蟬','群','反轉干擾',55,40,850,88,48,'連環計',40,'defense',true],
    ['machao','馬超','蜀','高速突進',88,45,900,92,50,'西涼鐵騎',45,'attack',false],
    ['pangde','龐德','魏','絕境強攻',80,60,1000,55,75,'抬棺死戰',35,'defense',false],
    ['xiahou','夏侯惇','魏','硬撐坦克',75,78,1200,45,85,'拔矢啖睛',30,'rival',false],
    ['ganning','甘寧','吳','奇襲干擾',72,42,900,85,45,'百騎劫營',50,'stamina',false],
    ['sunce','孫策','吳','爆發擊退',90,55,1000,70,60,'霸王突擊',55,'rival',false]
  ];
  const signatureText={lubu:'連續三次追擊，各 0.8 倍傷害；結束後穩定度降低 5 秒。',guanyu:'蓄力 2 秒，造成 2 倍傷害並忽略 30% 防禦；受擊中斷。',zhangfei:'對手速度降低 60%，4 秒內禁止位移；可打斷馬超助跑。',zhaoyun:'閃避接下來三次攻擊，第三次後反擊；反擊可中斷蓄力。',zhugeliang:'消耗全部現有魔法，至少需要 30；10% 擊倒。每次進入落後狀態 +5%，最高 30%。',liubei:'召喚關羽、張飛各追擊一次，並回復自身 8% 最大生命。',caocao:'封鎖對手下一次出招，偷取最多 20 魔法。',simayi:'6 秒只承受傷害，結束後回敬實際承傷的 1.5 倍。',zhouyu:'在對手當前位置留下火區 10 秒，區內每秒持續受傷。',diaochan:'使對手反轉 5 秒；其造成的傷害有 25% 回到自己身上。',machao:'沿邊緣助跑 3 秒後衝撞，最高 2 倍傷害；受擊或震懾會中斷。',pangde:'8 秒攻擊 +50%，禁止防禦技；生命低於 30% 時免費，期間免疫擊退。',xiahou:'清除自身負面狀態，回復 5% 生命，5 秒攻擊 +40%。',ganning:'瞬移背後突襲並偷取最多 20 魔法；可拉出中心守勢並追加傷害。',sunce:'1.8 倍衝撞並大幅擊退；目標位於最外圈時可直接出界。'};
  const colors={lubu:'#e84372',guanyu:'#21ddd1',zhangfei:'#8678ff',zhaoyun:'#86dfff',zhugeliang:'#d8eaa8',liubei:'#69df9c',caocao:'#678dff',simayi:'#b581ff',zhouyu:'#ff6652',diaochan:'#f780d3',machao:'#55ddd7',pangde:'#aaa9ff',xiahou:'#ef8153',ganning:'#42cde1',sunce:'#ffb94b'};
  const characters=Object.fromEntries(rows.map(r=>[r[0],{id:r[0],name:r[1],faction:r[2],role:r[3],attack:r[4],defense:r[5],hp:r[6],mana:100,speed:r[7],stability:r[8],signature:r[9],cost:r[10],baseSkin:r[11],provisional:r[12],color:colors[r[0]],description:signatureText[r[0]]}]));
  const common={
    storm:{name:'螺旋風暴',cost:50,type:'攻擊',cooldown:12,text:'攻擊 +30%，持續 8 秒；結束後 3 秒攻擊降低 25%。'},
    rush:{name:'疾風衝撞',cost:20,type:'位移',cooldown:4,text:'朝對手衝刺，下一次命中為 1.5 倍傷害並擊退；未命中會失效。'},
    center:{name:'赤道中心',cost:30,type:'位移',cooldown:10,text:'進入第三層中心 5 秒，減傷 50%，但不能移動或主動碰撞。'},
    edge:{name:'邊緣滑行',cost:15,type:'位移',cooldown:8,text:'沿邊緣高速繞行 5 秒；速度 +55%，防禦降低 30%。'},
    wall:{name:'鐵壁旋轉',cost:25,type:'防禦',cooldown:8,text:'受到傷害降低 40%，持續 5 秒。'},
    reflect:{name:'反震',cost:35,type:'防禦',cooldown:9,text:'8 秒內下一次受擊，反彈該次實際傷害的 50%。'},
    wind:{name:'逆風擾流',cost:25,type:'干擾',cooldown:8,text:'使對手速度降低 30%，持續 6 秒。'},
    siphon:{name:'吸魔漩渦',cost:30,type:'干擾',cooldown:7,text:'偷取對手最多 15 魔法；魔法上限為 100。'}
  };
  const rivals=[{a:'machao',b:'caocao',bonus:'a',text:'潼關宿敵：馬超對曹操傷害 +5%。'},{a:'pangde',b:'guanyu',text:'龐德：「今日誓與關將軍一決高下！」'},{a:'sunce',b:'lubu',bonus:'both',text:'猛將爭鋒：雙方傷害 +5%。'},{a:'lubu',b:'zhangfei',bonus:'both',text:'虎牢再會：呂布與張飛傷害 +5%。'},{a:'zhouyu',b:'caocao',bonus:'a',text:'赤壁宿敵：周瑜對曹操傷害 +5%。'}];
  return {characters,common,rivals,source:'三國戰鬥陀螺 3D 遊戲設計文件.pdf（使用者提供，6 頁）',version:'半即時原型 0.3'};
})();

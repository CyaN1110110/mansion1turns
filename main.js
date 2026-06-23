const CLASSES=['약사','군인','요리사','청소부','기계공','사서','탐정','신부','도둑'];
const MAX_TURNS=5;
const LOOT_NORMAL=['무전기','약도','단검','클립'];
const ROOM_INTRO='낡은 철제 침대 하나, 벽에 박힌 녹슨 고리.\n희미한 전구가 깜빡인다.\n바닥에 말라붙은 핏자국이 보인다.';

let S={phase:'setup',cls:'',str:0,dex:0,int:0,turnsLeft:MAX_TURNS,lootIndex:0,cuffsBroken:false,hasWalkie:false,inventory:[], lastFailedAction: null, fear: false};

const logBox=document.getElementById('log-box');
const actArea=document.getElementById('action-area');
const turnsSpan=document.getElementById('turns-left');

function log(text,type='gm'){
  const d=document.createElement('div');
  d.className='log '+type;
  d.textContent=text;
  logBox.appendChild(d);
  logBox.scrollTop=logBox.scrollHeight;
}

function doCheck(name, stat, actionName) {
  // 재시도인지 확인
  if (S.lastFailedAction === actionName) {
    log(`재시도 성공! 이번에는 성공했습니다.`, 'dice');
    S.lastFailedAction = null;
    return [true, false];
  }
  
 const roll = Math.floor(Math.random() * 9) + 1;
  const success = roll <=stat;
  const best = roll === 1; 
  log('🎲'+name+' 판정  [1d10: '+roll+' / 기준: '+stat+']\n'); log(success?'✅ 성공' : '❌ 실패');
  
  // 실패했다면 기록
  if (!success) {
    S.lastFailedAction = actionName;
  } else {
    S.lastFailedAction = null;
  }
  
  return [success, best];
}

function d10(){return Math.floor(Math.random()*10)+1;}

function roll(stat,name){
  const r=d10();
  const ok=r<=stat;
  log('🎲 '+name+' 판정  [1d10: '+r+'  /  기준: '+stat+']\n→ '+(ok?'✅ 성공':'❌ 실패'),'dice');
  return ok;
}

function updateTurns(){turnsSpan.textContent=S.turnsLeft;}
function clearAct(){actArea.innerHTML='';}

function btn(label,onClick,disabled){
  const b=document.createElement('button');
  b.className='act-btn';
  b.textContent=label;
  if(disabled)b.disabled=true;
  b.addEventListener('click',onClick);
  actArea.appendChild(b);
  return b;
}

// -- SETUP --
function renderSetup(){
  clearAct();
  log('당신은 눈을 떴다.','gm');
  log(ROOM_INTRO,'gm');
  log('직업과 스탯을 입력하고 시작하세요.','system');

  const wrap=document.createElement('div');
  wrap.className='setup-block';

  const l1=document.createElement('label');l1.textContent='직업';
  const sel=document.createElement('select');
  CLASSES.forEach(c=>{const o=document.createElement('option');o.value=c;o.textContent=c;sel.appendChild(o);});

  const l2=document.createElement('label');l2.textContent='스탯 배분 (합계 15 이하)';
  const sNames=['힘','민첩','지능'];
  const sInputs={};
  sNames.forEach(s=>{
    const row=document.createElement('div');row.className='stat-row';
    const lb=document.createElement('label');lb.textContent=s;
    const ip=document.createElement('input');ip.type='number';ip.min=1;ip.max=13;ip.value=5;
    sInputs[s]=ip;
    row.appendChild(lb);row.appendChild(ip);wrap.appendChild(row);
  });
  const sumD=document.createElement('div');
  function refreshSum(){
    const t=sNames.reduce((a,s)=>a+(parseInt(sInputs[s].value)||0),0);
    sumD.textContent='합계: '+t+' / 16 이하';
    sumD.className=t<=15?'sum-ok':'sum-ng';
  }
  sNames.forEach(s=>sInputs[s].addEventListener('input',refreshSum));
  refreshSum();
  const startB=document.createElement('button');startB.id='start-btn';startB.textContent='▶ 시작';
  startB.addEventListener('click',()=>{
    const t=sNames.reduce((a,s)=>a+(parseInt(sInputs[s].value)||0),0);
    if(t>16){log('⚠ 스탯 합계가 16 이하여야 합니다.','system');return;}
    S.cls=sel.value;
    S.str=parseInt(sInputs['힘'].value);
    S.dex=parseInt(sInputs['민첩'].value);
    S.int=parseInt(sInputs['지능'].value);
    startGame();
  });
  [l1,sel,l2,sumD,startB].forEach(e=>wrap.appendChild(e));
  actArea.appendChild(wrap);
}

// -- START --
function startGame(){
  S.phase='play';
  clearAct();
  // 군인: 힘 버프 +1
  if(S.cls==='군인') S.str += 1;
  // 공포 상태이상: 지능 5 이상이면 민첩 -1
  if(S.int>=5){
    S.fear = true;
    log('⚠ 공포 상태이상: 지능이 높아 공포에 시달린다. (민첩 -1)','system');
  }
  // 수갑: 힘 5 이상이면 민첩 -1
  if(S.str>=5){
    S.cuffsBroken = false;
    log('⚠ 수갑 착용: 수갑이 채워져 있다. 움직이기가 불편하다.','system');
  }
  log('['+S.cls+'] 힘 '+S.str+' 민첩 '+S.dex+' 지능 '+S.int,'system');
  log('무엇을 할 것인가?','gm');
  renderActions();
}

// -- ACTIONS --
function renderActions(){
  clearAct();
  if(S.turnsLeft<=0){endGame();return;}
  if(!S.cuffsBroken&&S.str>=5)btn('🔗 수갑을 해제한다 (힘 판정)',actionCuffs);
  btn('🔍 방을 뒤진다 (민첩 판정)',actionSearch);
  btn('👁 주위를 살핀다 (지능 판정)',actionObserve);
  if(S.hasWalkie)btn('📻 채널을 설정한다',actionWalkie);
}

function spend(fn){
  fn();
  S.turnsLeft--;
  updateTurns();
  if(S.turnsLeft<=0)setTimeout(endGame,500);
  else setTimeout(renderActions,300);
}

// -- 수갑 해제 --
function actionCuffs(){
  log('수갑을 힘으로 끊으려 한다...','player');
  spend(()=>{
    const ok=doCheck('힘',S.str, '수갑부수기' );
    if(ok[0]){
      S.cuffsBroken=true;
      log('끊어냈다. 수갑이 바닥에 떨어진다. 손목에 붉은 자국이 남는다.','gm');
    }else{
      log('꿈쩍도 하지 않는다. 손목만 욱신거린다.','gm');
    }
    if (ok[1]){
      log('대성공! 힘이 늘었다');
      S.str+=1;
    }
  });
}

// -- 방 뒤지기 --
function actionSearch(){
  log('방 구석구석을 뒤진다...','player');
  spend(()=>{
// S.cuffsBroken이 false이면 민첩을 1 낮춰서 계산 (true이면 그대로 사용)
    const currentDex = S.fear? (S.cuffsBroken ? S.dex-1 : S.dex - 2):S.cuffsBroken ? S.dex : S.dex - 1 ;
    // 수정된 민첩 수치로 판정 진행
    const ok = doCheck('민첩',currentDex, '찾기')
    if(!ok[0]){log('먼지만 잔뜩 묻었다. 아무것도 찾지 못했다.','gm');return;}
    if(S.lootIndex>=LOOT_NORMAL.length){
      log('이미 뒤질 곳이 없다. 방은 텅 비어있다.','gm');return;
    }
    if (ok[1]){
      log('대성공! 민첩이 늘었다(민첩 +1)');
      S.dex+=1;
    }
    const item=LOOT_NORMAL[S.lootIndex];
    S.lootIndex++;
    S.inventory.push(item);
    if(item==='무전기')S.hasWalkie=true;
    log('찾았다 — ['+item+'] 을(를) 획득했다.','gm');
    log('소지품: '+S.inventory.join(', '),'system');
  });
  
}

// -- 주위 살피기 --
function actionObserve(){
  log('주위를 조용히 살핀다...','player');
  spend(()=>{
    const ok=doCheck('지능',S.int, '관찰');
    const clues=[
      '바닥의 핏자국은 오래됐다. 한 사람 분량이 아니다.',
      '침대 아래 먼지 속에 오래된 단추 하나가 보인다. 이 방에 누가 있었던 걸까.',
      '문 틈으로 희미하게 빛이 새어 들어온다. 복도에 인기척은 없다.',
      
    ];
    if(ok[0]){
      const c=clues[Math.floor(Math.random()*clues.length)];
        if (ok[1]){
      log('대성공! 지능이 늘었다');
      S.int+=1;
    }
      log(c,'gm');
    }else{
      log('특별한 것은 보이지 않는다. 어둡고 조용하다.','gm');
    }
  });
}

// -- 무전기 채널 --
function actionWalkie(){
  log('무전기 채널을 설정하려 한다.','player');
  log('GM을 호출하여 원하는 채널을 전달하세요.','system');
}

// -- 엔딩 --
function endGame(){
  clearAct();
  log('\n덜컥 — ','gm');
  setTimeout(()=>{
    log('문이 열린다.\n복도의 빛이 독방 안으로 쏟아진다.\n선택의 시간이 끝났다.','gm');
    log('[ 독방 탈출 — GM에게 현재 상태를 보고하세요 ]\n소지품: '+(S.inventory.length?S.inventory.join(', '):'없음')+'\n수갑: '+(S.cuffsBroken?'해제됨':'착용중'),'system');
    log('힘:'+ S.str+'\n 민첩: '+S.dex+ '\n 지능: '+S.int);
    const rb=document.createElement('button');
    rb.className='act-btn';
    rb.textContent='🔄 다시 시작';
    rb.addEventListener('click',()=>{
      S={phase:'setup',cls:'',str:0,dex:0,int:0,turnsLeft:MAX_TURNS,lootIndex:0,cuffsBroken:false,hasWalkie:false,inventory:[]};
      logBox.innerHTML='';
      turnsSpan.textContent=MAX_TURNS;
      renderSetup();
    });
    actArea.appendChild(rb);
  }, 2000);
}

renderSetup();
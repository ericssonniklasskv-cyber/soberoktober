(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.SoberOctoberCompetition=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const START='2026-10-05',END='2026-10-11';
  const START_INSTANT=Date.parse('2026-10-05T00:01:00+02:00'),END_INSTANT=Date.parse('2026-10-12T00:00:00+02:00');
  const isBingoDate=date=>date>=START&&date<=END;
  const active=(enabled,now=Date.now())=>Boolean(enabled)&&now>=START_INSTANT&&now<END_INSTANT;
  function mergeResults(results=[],bingo=null){
    if(!bingo?.enabled)return results;
    const points=new Map((bingo.daily_scores||[]).map(r=>[r.result_date,Number(r.points)||0]));
    return results.filter(r=>!isBingoDate(r.result_date)).concat((bingo.activity_dates||[]).map(date=>({result_date:date,points:points.get(date)||0,kind:'bingo',multiplier:null})));
  }
  const normalBonus=(claims=[],bingo)=>bingo?.enabled?claims.filter(c=>!isBingoDate(c.challenge_date)):claims;
  function report(bingo,start=START,end=END){
    if(!bingo?.enabled)return null;
    const cells=Object.entries(bingo.completed_cells||{}).filter(([,date])=>date>=start&&date<=end);
    const totals=new Map();
    for(const[index]of cells){const task=bingo.board?.[Number(index)];if(!task?.unit?.trim()||!Number.isFinite(Number(task.base_amount))||Number(task.base_amount)<=0)continue;const unit=task.unit.trim();const key=unit.toLocaleLowerCase('sv-SE');const item=totals.get(key)||{unit,amount:0};item.amount+=Number(task.base_amount);totals.set(key,item);}
    return{completedCells:cells.length,completedDays:(bingo.activity_dates||[]).filter(d=>d>=start&&d<=end).length,points:(bingo.daily_scores||[]).filter(r=>r.result_date>=start&&r.result_date<=end).reduce((n,r)=>n+Number(r.points),0),exerciseTotals:[...totals.values()].sort((a,b)=>a.unit.localeCompare(b.unit,'sv-SE'))};
  }
  return Object.freeze({START,END,START_INSTANT,END_INSTANT,isBingoDate,active,mergeResults,normalBonus,report});
});

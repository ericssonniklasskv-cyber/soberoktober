((root,factory)=>{const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.SoberVoteLogic=api;})(typeof globalThis==='object'?globalThis:this,()=>{
  const OPEN=Date.parse('2026-10-18T21:00:00+02:00'),END=Date.parse('2026-10-26T00:00:00+01:00');
  const dateLabel=date=>new Intl.DateTimeFormat('sv-SE',{weekday:'long',day:'numeric',month:'long',timeZone:'Europe/Stockholm'}).format(new Date(date+'T12:00:00Z'));
  function view(state){
    const now=Date.parse(state.now),days=state.days||[];
    return {phase:now<OPEN?'before':now>=END?'finished':'active',
      today:days.find(day=>day.date===state.today&&day.result),
      poll:days.find(day=>Date.parse(day.opens)<=now&&now<Date.parse(day.closes)&&!day.result),
      next:days.find(day=>Date.parse(day.opens)>now)};
  }
  const total=day=>day.options.reduce((sum,option)=>sum+Number(option.votes),0);
  const percentage=(votes,count)=>count?Math.round(100*votes/count):0;
  function timeLeft(now,closes){
    const remaining=Date.parse(closes)-Date.parse(now);
    if(remaining<=0)return 'Röstningen är stängd';
    if(remaining<60000)return 'Mindre än 1 min kvar';
    const minutes=Math.ceil(remaining/60000),hours=Math.floor(minutes/60),rest=minutes%60;
    return (hours?hours+' tim'+(rest?' '+rest+' min':''):rest+' min')+' kvar';
  }
  function race(day){
    const count=total(day),highest=Math.max(...day.options.map(option=>option.votes));
    const leaders=day.options.filter(option=>option.votes===highest);
    if(!count)return {title:'Här kan allt hända.',copy:'Första rösten väntar fortfarande på att bli lagd.'};
    if(leaders.length>1)return {title:'Jämnt skägg i toppen!',copy:leaders.length+' pass delar ledningen. Står det lika vid midnatt får lotten avgöra.'};
    return {title:leaders[0].id===day.own_vote?'Din favorit leder just nu!':leaders[0].title+' leder just nu.',copy:'Men det är inte avgjort än. Vi räknar rösterna vid midnatt.'};
  }
  function iconKind(title){
    const text=String(title||'').toLowerCase();
    if(/yoga|rörlig|stretch/.test(text))return 'mobility';
    if(/squat|armhäv|pull[ -]?ups?|kroppsvikt|styrk|plank|burpee/.test(text))return 'strength';
    if(/sim/.test(text))return 'swim';
    if(/cykel/.test(text))return 'bike';
    if(/racket|padel|tennis/.test(text))return 'racket';
    if(/löp|jogg|intervall/.test(text))return 'run';
    if(/promenad|steg|trapp/.test(text))return 'walk';
    return 'activity';
  }
  function mergeResults(results,state){
    if(!state)return results;
    const days=state.days||[],dates=new Set(days.map(day=>day.date));
    const completed=days.filter(day=>day.completion&&day.result).map(day=>{
      const winner=day.options.find(option=>option.id===day.result.option_id),stepped=day.completion.kind==='steps';
      return {result_date:day.date,kind:'vote',completion_kind:stepped?'steps':'workout',multiplier:null,points:Number(day.completion.points),title:stepped?'10 000 steg':winner.title,description:stepped?'10 000 steg istället för dagens framröstade pass.':winner.description};
    });
    return [...results.filter(result=>!dates.has(result.result_date)),...completed].sort((a,b)=>a.result_date.localeCompare(b.result_date));
  }
  const rouletteAvailable=(today,requested)=>today<'2026-10-19'||Boolean(requested&&/^2026-10-(1[2-8])$/.test(requested));
  return Object.freeze({rouletteAvailable,OPEN,END,dateLabel,view,total,percentage,timeLeft,race,iconKind,mergeResults});
});

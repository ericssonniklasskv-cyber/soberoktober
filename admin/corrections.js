(() => {
  const $ = id => document.getElementById(id);
  let client, snapshot=null, busy=false, generation=0, pending=null;
  const number=new Intl.NumberFormat('sv-SE');
  const today=window.SoberOctoberCalendar.stockholmDate;
  const fields=()=>[$('correction-user'),$('correction-date'),$('correction-level'),$('correction-parts'),$('correction-reason'),$('correction-load'),$('correction-save')];
  function setBusy(value){busy=value;fields().forEach(field=>field.disabled=value);$('correction-save').disabled=value||!snapshot;}
  function clear(){snapshot=null;$('correction-details').hidden=true;$('correction-history').replaceChildren();$('correction-save').disabled=true;}
  function resultText(result){return result?result.multiplier+'× · '+number.format(Number(result.points))+' poäng':'Ingen registrering';}
  function render(data){
    snapshot=data;
    $('correction-details').hidden=false;
    $('correction-current').textContent='Nuvarande: '+resultText(data.result);
    $('correction-challenge').textContent=data.challenge.title+(data.challenge.description?' · '+data.challenge.description:'')+(data.challenge.second_description?' / '+data.challenge.second_description:'');
    $('correction-warning').textContent=data.status==='eliminated'?'Deltagaren är utslagen. Rättningen återställer inte tävlingsstatusen.':'';
    $('correction-bonus').textContent='Separat dagsbonus: '+number.format(data.bonus_points)+' poäng (ändras inte här).';
    $('correction-level').value=String(data.result?.multiplier||1);
    const mode=data.challenge.completion_mode;
    $('correction-parts-field').hidden=mode!=='or';
    $('correction-parts').value=mode==='and'?'first,second':mode==='single'?'first':(data.result?.completed_parts||['first']).join(',');
    $('correction-reason').value='';
    $('correction-history').replaceChildren(...data.history.map(item=>{
      const li=document.createElement('li');
      const date=new Intl.DateTimeFormat('sv-SE',{dateStyle:'short',timeStyle:'short',timeZone:'Europe/Stockholm'}).format(new Date(item.created_at));
      li.textContent=date+' · '+(item.before_multiplier?item.before_multiplier+'×':'Saknades')+' → '+item.after_multiplier+'× · '+item.reason+' · '+item.admin_name;
      return li;
    }));
    $('correction-history-empty').hidden=data.history.length>0;
  }
  async function load(){
    if(busy||!client||!$('correction-user').value)return;
    const token=++generation;clear();setBusy(true);$('correction-status').textContent='Laddar resultat…';
    try{
      const {data,error}=await client.rpc('admin_daily_result',{p_user_id:$('correction-user').value,p_date:$('correction-date').value});
      if(error)throw error;
      if(token!==generation)return;
      render(data);$('correction-status').textContent='';
    }catch(error){if(token===generation)$('correction-status').textContent=error.message||'Resultatet kunde inte laddas.';}
    finally{if(token===generation)setBusy(false);}
  }
  function prepare(event){
    event.preventDefault();
    if(busy||!snapshot||!$('correction-form').reportValidity())return;
    pending={p_user_id:$('correction-user').value,p_date:$('correction-date').value,p_action:'save',
      p_payload:{multiplier:Number($('correction-level').value),completed_parts:$('correction-parts').value.split(','),
        reason:$('correction-reason').value.trim(),expected:snapshot.result}};
    $('correction-confirm-copy').textContent=snapshot.display_name+' · '+pending.p_date+': '+resultText(snapshot.result)+' → '+pending.p_payload.multiplier+'×. Anledning: '+pending.p_payload.reason;
    setBusy(true);$('correction-confirmation').showModal();$('correction-cancel').focus();
  }
  function cancel(){pending=null;$('correction-confirmation').close();setBusy(false);}
  async function save(){
    if(!pending)return;
    const payload=pending;pending=null;$('correction-confirm').disabled=true;
    $('correction-status').textContent='Sparar rättning…';
    try{
      const {data,error}=await client.rpc('admin_daily_result',payload);if(error)throw error;
      render(data);$('correction-status').textContent='Rättningen är sparad. Poäng och rapporter använder det uppdaterade resultatet.';
    }catch(error){$('correction-status').textContent=error.message||'Rättningen kunde inte sparas. Ladda om resultatet och försök igen.';clear();}
    finally{$('correction-confirm').disabled=false;$('correction-confirmation').close();setBusy(false);}
  }
  $('correction-form').addEventListener('submit',prepare);
  $('correction-load').addEventListener('click',load);
  ['correction-user','correction-date'].forEach(id=>$(id).addEventListener('change',()=>{clear();void load();}));
  $('correction-cancel').addEventListener('click',cancel);
  $('correction-confirmation').addEventListener('cancel',()=>{pending=null;setBusy(false);});
  $('correction-confirm').addEventListener('click',save);
  window.SoberOctoberAdminCorrections={
    mount(nextClient,participants){
      client=nextClient;
      const selected=$('correction-user').value;
      const options=participants.map(person=>{const option=document.createElement('option');option.value=person.participant_id;option.textContent=person.display_name;return option;});
      const placeholder=document.createElement('option');placeholder.value='';placeholder.textContent='Välj deltagare';
      $('correction-user').replaceChildren(placeholder,...options);
      if(participants.some(person=>person.participant_id===selected))$('correction-user').value=selected;
      const max=today()<'2026-10-31'?today():'2026-10-31';
      $('correction-date').max=max;
      if(!$('correction-date').value)$('correction-date').value=max<'2026-10-01'?'2026-10-01':max;
      setBusy(false);
    },
    reset(){generation++;client=null;pending=null;clear();$('correction-user').replaceChildren();$('correction-confirmation').close();setBusy(false);}
  };
})();

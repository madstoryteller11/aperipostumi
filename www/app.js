const BUILD_VERSION = '0.3.1-pages-beta.5';
const REMOVED_DECK_IDS = new Set(['carte_nostre']);

const APP = {
  storageKey: 'aperipostumi.library.v1',
  settingsKey: 'aperipostumi.settings.v1',
  feedbackKey: 'aperipostumi.feedback.v1',
  defaults: null,
  library: null,
  feedback: null,
  settings: {
    players: [],
    selectedDecks: ['aperitivo','confessioni','sfide','regole_assurde'],
    sips: 2
  },
  game: null,
  pendingFeedback: null,
  editorDeckId: null,
  installPrompt: null,
  installPlatform: null
};

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const clone = obj => JSON.parse(JSON.stringify(obj));
const uid = prefix => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2,7)}`;

async function init(){
  const response = await fetch(`data/decks.json?v=${BUILD_VERSION}`, {cache:'no-store'});
  APP.defaults = await response.json();
  APP.defaults.decks=APP.defaults.decks.filter(deck=>!REMOVED_DECK_IDS.has(deck.id));
  const savedLibrary=loadJSON(APP.storageKey);
  APP.library = savedLibrary || clone(APP.defaults);
  if(savedLibrary)migrateLibraryContent();
  APP.settings = {...APP.settings, ...(loadJSON(APP.settingsKey)||{})};
  const selectedDecks=APP.settings.selectedDecks.filter(id=>!REMOVED_DECK_IDS.has(id));
  if(selectedDecks.length!==APP.settings.selectedDecks.length){
    APP.settings.selectedDecks=selectedDecks;
    saveSettings();
  }
  APP.feedback = loadJSON(APP.feedbackKey) || {
    schemaVersion: 1,
    installId: uid('install'),
    entries: []
  };
  if(!APP.feedback.installId)APP.feedback.installId=uid('install');
  if(!Array.isArray(APP.feedback.entries))APP.feedback.entries=[];
  saveFeedback();
  APP.editorDeckId = APP.library.decks[0]?.id;
  bindEvents();
  renderSetup();
  renderEditor();
  renderFeedbackDashboard();
  registerServiceWorker();
}

function loadJSON(key){ try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } }
function saveLibrary(){ localStorage.setItem(APP.storageKey, JSON.stringify(APP.library)); }
function saveSettings(){ localStorage.setItem(APP.settingsKey, JSON.stringify(APP.settings)); }
function saveFeedback(){ localStorage.setItem(APP.feedbackKey, JSON.stringify(APP.feedback)); }
function toast(message){ const t=$('#toast'); t.textContent=message; t.classList.add('show'); clearTimeout(t._timer); t._timer=setTimeout(()=>t.classList.remove('show'),2200); }
function escapeHTML(s=''){ return s.replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
function shuffle(a){ for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];} return a; }
function deckById(id){ return APP.library.decks.find(d=>d.id===id); }

function migrateLibraryContent(){
  const patches={
    tutti_contro_tutti_040:{
      from:'Finale collettivo: tutti brindano. Chi dimentica lo slogan della partita beve {sips} sorso.',
      to:'Finale collettivo: tutti brindano e si urla VALERIOOOO.'
    },
    senza_filtro_023:{
      from:'Tutti indicano chi sarebbe più pericoloso dopo due complimenti e uno sguardo. Il prescelto assegna {sips} sorsi.',
      to:'Tutti indicano chi ci rimarrebbe più fregato dopo due complimenti e uno sguardo. Il prescelto assegna {sips} sorsi.'
    }
  };
  const deckCount=APP.library.decks.length;
  APP.library.decks=APP.library.decks.filter(deck=>!REMOVED_DECK_IDS.has(deck.id));
  let changed=APP.library.decks.length!==deckCount;
  (APP.library.decks||[]).forEach(deck=>{
    (deck.cards||[]).forEach(card=>{
      const patch=patches[card.id];
      if(patch && card.text===patch.from){
        card.text=patch.to;
        changed=true;
      }
    });
  });
  const contentPatchIds=new Set([
    'senza_filtro_004','senza_filtro_007','senza_filtro_009','senza_filtro_011',
    'senza_filtro_014','senza_filtro_016','senza_filtro_017','senza_filtro_019',
    'senza_filtro_027','senza_filtro_029','senza_filtro_030','senza_filtro_031',
    'senza_filtro_034','senza_filtro_036','senza_filtro_039','senza_filtro_040'
  ]);
  const defaultCards=new Map(
    (APP.defaults.decks||[]).flatMap(deck=>(deck.cards||[]).map(card=>[card.id,card]))
  );
  (APP.library.decks||[]).forEach(deck=>{
    (deck.cards||[]).forEach(card=>{
      const updated=defaultCards.get(card.id);
      if(contentPatchIds.has(card.id) && card.customizable!==true && updated && card.text!==updated.text){
        card.text=updated.text;
        changed=true;
      }
    });
  });
  if(APP.library.contentVersion!==APP.defaults.contentVersion){
    APP.library.contentVersion=APP.defaults.contentVersion;
    changed=true;
  }
  if(changed)saveLibrary();
}

function bindEvents(){
  $$('[data-nav]').forEach(b=>b.addEventListener('click',()=>navigate(b.dataset.nav)));
  $('#playerForm').addEventListener('submit',e=>{e.preventDefault();const input=$('#playerInput');const name=input.value.trim();if(!name)return;if(APP.settings.players.some(p=>p.toLowerCase()===name.toLowerCase()))return toast('Nome già presente');APP.settings.players.push(name);input.value='';saveSettings();renderSetup();});
  $('#toggleAllDecks').addEventListener('click',()=>{const ids=APP.library.decks.filter(d=>d.enabled!==false).map(d=>d.id);APP.settings.selectedDecks=APP.settings.selectedDecks.length===ids.length?[]:ids;saveSettings();renderDeckPicker();});
  $('#intensityOptions').addEventListener('change',e=>{if(e.target.name==='sips'){APP.settings.sips=Number(e.target.value);saveSettings();renderSetup();}});
  $('#startGame').addEventListener('click',startGame);
  $('#cancelHotDeck').addEventListener('click',()=>$('#hotDeckDialog').close());
  $('#confirmHotDeck').addEventListener('click',()=>{$('#hotDeckDialog').close();beginGame();});
  $('#quitGame').addEventListener('click',()=>{ if(confirm('Uscire dalla partita in corso?')){ APP.game=null; navigate('setup'); } });
  $('#finishGameBtn').addEventListener('click',showFinaleCard);
  $('#rulesBtn').addEventListener('click',showRules);
  $('#activeRulesStrip').addEventListener('click',showRules);
  $('#closeRules').addEventListener('click',()=>$('#rulesDialog').close());
  $('#feedbackCardBtn').addEventListener('click',openFeedbackScreen);
  $('#feedbackCancelBtn').addEventListener('click',cancelFeedback);
  $('#feedbackCancelBottom').addEventListener('click',cancelFeedback);
  $('#feedbackForm').addEventListener('submit',saveCardFeedback);
  $('#exportFeedbackJson').addEventListener('click',exportFeedbackJSON);
  $('#exportFeedbackCsv').addEventListener('click',exportFeedbackCSV);
  $('#importFeedbackInput').addEventListener('change',importFeedback);
  $('#clearFeedbackBtn').addEventListener('click',clearFeedback);
  $('#feedbackList').addEventListener('click',handleFeedbackListClick);
  $('#cardSearch').addEventListener('input',renderCardList);
  $('#addCardBtn').addEventListener('click',()=>openCardEditor());
  $('#resetDeckBtn').addEventListener('click',resetCurrentDeck);
  $('#newDeckBtn').addEventListener('click',()=>$('#deckDialog').showModal());
  $('#deckForm').addEventListener('submit',createDeck);
  $('#cardForm').addEventListener('submit',saveCardFromDialog);
  $('#exportBtn').addEventListener('click',exportBackup);
  $('#importInput').addEventListener('change',importBackup);
  $('#resetBtn').addEventListener('click',resetAll);
  $('#installBtn').addEventListener('click',installApp);
  $('#closeInstallDialog').addEventListener('click',()=>$('#installDialog').close());
  $('#closeInstallDialogBottom').addEventListener('click',()=>$('#installDialog').close());

  window.addEventListener('beforeinstallprompt',e=>{
    e.preventDefault();
    APP.installPrompt=e;
    updateInstallButton();
  });

  window.addEventListener('appinstalled',()=>{
    APP.installPrompt=null;
    updateInstallButton();
    toast('AperiPost(umi) installata');
  });

  updateInstallButton();
}

function navigate(name){
  $$('.screen').forEach(s=>s.classList.toggle('active',s.id===`screen-${name}`));
  $$('.nav-btn[data-nav]').forEach(b=>b.classList.toggle('active',b.dataset.nav===name));
  if(name==='editor')renderEditor();
  if(name==='backup')renderFeedbackDashboard();
  window.scrollTo({top:0,behavior:'smooth'});
}

function renderSetup(){
  $('#playerCount').textContent=APP.settings.players.length;
  $('#playerChips').innerHTML=APP.settings.players.map((p,i)=>`<span class="chip">${escapeHTML(p)}<button data-remove-player="${i}">×</button></span>`).join('');
  $$('[data-remove-player]').forEach(b=>b.onclick=()=>{APP.settings.players.splice(Number(b.dataset.removePlayer),1);saveSettings();renderSetup();});
  $$('input[name=sips]').forEach(r=>r.checked=Number(r.value)===Number(APP.settings.sips));
  renderDeckPicker();
}

function renderDeckPicker(){
  const el=$('#deckPicker');
  el.innerHTML=APP.library.decks.filter(d=>d.enabled!==false).map(d=>{
    const selected=APP.settings.selectedDecks.includes(d.id);
    const active=d.cards.filter(c=>c.enabled!==false).length;
    return `<article class="deck-option ${selected?'selected':''}" data-deck-pick="${d.id}" style="--deck:${d.color||'#ff8a3d'}"><span class="emoji">${escapeHTML(d.emoji||'🎲')}</span>${d.adultOnly?'<span class="adult-tag">18+</span>':''}<h3>${escapeHTML(d.name)}</h3><p>${escapeHTML(d.description||'')}</p><footer>${active} carte</footer></article>`;
  }).join('');
  $$('[data-deck-pick]').forEach(card=>card.onclick=()=>{const id=card.dataset.deckPick;const i=APP.settings.selectedDecks.indexOf(id);if(i>=0)APP.settings.selectedDecks.splice(i,1);else APP.settings.selectedDecks.push(id);saveSettings();renderDeckPicker();});
  const count=APP.library.decks.filter(d=>APP.settings.selectedDecks.includes(d.id)).reduce((n,d)=>n+d.cards.filter(c=>c.enabled!==false).length,0);
  $('#selectedSummary').textContent=`${count} carte selezionate`;
  const all=APP.library.decks.filter(d=>d.enabled!==false).length;
  $('#toggleAllDecks').textContent=APP.settings.selectedDecks.length===all?'Deseleziona tutti':'Seleziona tutti';
}


const SESSION_LENGTH = 50;

const FINALE_CARDS = [
  "Tutti in piedi: a turno dite una sola parola per descrivere la serata. Chi spezza il ritmo beve {sips} sorsi. Poi fate l'ultimo brindisi.",
  "Tutti alzate il bicchiere. Contate insieme da uno a dieci, ma ogni multiplo di tre va sostituito con «Postumi!». Chi sbaglia beve {sips} sorsi. Poi brindate.",
  "Ultima sfida: ognuno dedica un complimento alla persona alla propria destra. Chi si rifiuta beve {sips} sorsi. Alla fine, brindisi collettivo.",
  "Tutti scegliete una posa da foto ricordo al conto di tre. Chi arriva per ultimo beve {sips} sorsi. Restate in posa e fate l'ultimo brindisi.",
  "A turno nominate qualcosa che volete ricordare di questa serata. Chi ripete o si blocca beve {sips} sorsi. Poi tutti insieme: cin cin.",
  "Create insieme il brindisi ufficiale di AperiPost(umi): ognuno aggiunge una parola. Chi rompe la frase beve {sips} sorsi. Recitatelo e brindate.",
  "Tutti puntano il dito verso chi ha reso la serata più memorabile. Il più votato assegna {sips} sorsi, poi guida l'ultimo brindisi.",
  "Sfida finale: tutti devono dire «L'aperitivo passa, i postumi restano» nello stesso momento. Chi parte fuori tempo beve {sips} sorsi. Poi brindate."
];

function cardDifficulty(card){
  return Math.max(1,Math.min(3,Number(card?.intensity||1)));
}

function getSipCount(card){
  const level=Math.max(1,Math.min(3,Number(APP.settings.sips||2)));
  const difficulty=cardDifficulty(card);
  const matrix={
    1:{1:1,2:1,3:2},
    2:{1:1,2:2,3:3},
    3:{1:2,2:3,3:3}
  };
  return matrix[level][difficulty];
}

function isRuleCard(card){
  return card?.duration==='fino-a-revoca';
}

function alreadyHasAlternative(text=''){
  const normalized=text.toLowerCase();
  return [
    'oppure bevi',
    'oppure bevete',
    'in alternativa',
    'puoi passare bevendo',
    'se non vuoi',
    'rispondi oppure bevi',
    'risponde oppure beve',
    'può non rispondere bevendo'
  ].some(fragment=>normalized.includes(fragment));
}

function hasBuiltInDrinkConsequence(text=''){
  return /\b(bevi|beve|bevono|bevete|beviamo|bere|bevendo|bevuto|bevuta|bevuti|bevute|sorso|sorsi)\b/i.test(text);
}

function ensureCardSupply(minimum){
  if(!APP.game)return;
  while(APP.game.cards.length<minimum){
    const refill=shuffle(APP.game.sourcePool.map(c=>clone(c)));
    APP.game.cards.push(...refill);
  }
}

function startGame(){
  const players=APP.settings.players;
  if(players.length<2)return toast('Aggiungi almeno 2 giocatori');
  if(!APP.settings.selectedDecks.length)return toast('Seleziona almeno un mazzo');
  const hasAdult=APP.library.decks.some(d=>APP.settings.selectedDecks.includes(d.id)&&d.adultOnly);
  if(hasAdult)return $('#hotDeckDialog').showModal();
  beginGame();
}

function beginGame(){
  const players=APP.settings.players;
  const pool=[];
  APP.library.decks.filter(d=>APP.settings.selectedDecks.includes(d.id)).forEach(d=>d.cards.forEach(c=>{
    if(c.enabled!==false && Number(c.minPlayers||2)<=players.length){
      pool.push({...clone(c),_deck:{id:d.id,name:d.name,color:d.color,emoji:d.emoji}});
    }
  }));
  if(!pool.length)return toast('Nessuna carta compatibile');
  APP.game={
    sessionId:uid('session'),
    sourcePool:pool,
    cards:shuffle(pool.map(c=>clone(c))),
    index:0,
    activeRules:[],
    current:null,
    decisionShown:false,
    extended:false,
    showingFinale:false,
    actionLocked:false
  };
  ensureCardSupply(SESSION_LENGTH);
  navigate('game');
  showCurrentCard();
}

function createCardContext(card){
  const players=APP.settings.players;
  const p1=players[Math.floor(Math.random()*players.length)];
  const rest=players.filter(p=>p!==p1);
  const p2=rest[Math.floor(Math.random()*rest.length)]||p1;
  return {p1,p2,sips:getSipCount(card)};
}

function normalizeSipGrammar(text){
  return text
    .replace(/\b1\s+sorsi\b/gi,'1 sorso')
    .replace(/\b([2-9]|[1-9][0-9]+)\s+sorso\b/gi,'$1 sorsi');
}

function renderCardText(text,context){
  const rendered=text
    .replaceAll('{player1}',`<strong>${escapeHTML(context.p1)}</strong>`)
    .replaceAll('{player2}',`<strong>${escapeHTML(context.p2)}</strong>`)
    .replaceAll('{sips}',String(context.sips));
  return normalizeSipGrammar(rendered);
}

function plainTextFromHTML(html){
  const temp=document.createElement('div');
  temp.innerHTML=html;
  return temp.textContent||'';
}

function prepareCurrentCard(card){
  if(!card._context)card._context=createCardContext(card);
  let html=renderCardText(card.text,card._context);
  const needsAlternative=
    !isRuleCard(card) &&
    card.allowDrinkAlternative!==false &&
    !alreadyHasAlternative(card.text) &&
    !hasBuiltInDrinkConsequence(card.text);

  if(needsAlternative){
    const unit=card._context.sips===1?'sorso':'sorsi';
    html+=` <span class="card-alternative">Alternativa: ${card._context.sips} ${unit}</span>`;
  }
  card._renderedHTML=html;
  card._renderedPlain=plainTextFromHTML(html);
  return card;
}

function addActiveRule(card){
  if(!APP.game || APP.game.activeRules.some(rule=>rule.id===card.id))return;
  APP.game.activeRules.push({
    id:card.id,
    text:card._renderedPlain||plainTextFromHTML(card._renderedHTML||card.text),
    deck:card._deck
  });
  renderActiveRules();
  toast('Regola attivata');
}

function runGameAction(expectedCardId, action){
  if(!APP.game || APP.game.actionLocked)return;
  if(expectedCardId && APP.game.current?.id!==expectedCardId)return;

  APP.game.actionLocked=true;
  try{
    action();
  }finally{
    window.setTimeout(()=>{
      if(APP.game)APP.game.actionLocked=false;
    },180);
  }
}

function showCurrentCard(){
  if(!APP.game)return;

  if(APP.game.showingFinale)return;

  if(APP.game.index===SESSION_LENGTH && !APP.game.decisionShown && !APP.game.extended){
    showSessionDecision();
    return;
  }

  ensureCardSupply(APP.game.index+1);
  const card=prepareCurrentCard(APP.game.cards[APP.game.index]);
  APP.game.current=card;

  const displayed=APP.game.index+1;
  $('#progressText').textContent=APP.game.extended?`Carta ${displayed} · Extra`:`Carta ${displayed} di ${SESSION_LENGTH}`;
  $('#progressBar').style.width=`${Math.min(displayed,SESSION_LENGTH)/SESSION_LENGTH*100}%`;
  $('#gameCard').style.setProperty('--card-color',card._deck.color||'#ff8a3d');
  $('#gameDeckBadge').textContent=`${card._deck.emoji||''} ${card._deck.name}`;
  $('#gameCardText').innerHTML=card._renderedHTML;
  $('#fallbackText').classList.add('hidden');
  $('#sessionPrompt').classList.add('hidden');
  $('#feedbackCardBtn').classList.remove('hidden');
  $('#feedbackCardBtn').disabled=false;

  const rule=isRuleCard(card);
  const currentCardId=card.id;
  const doneButton=$('#doneAndNext');
  const skipButton=$('#drinkAndNext');

  // Rimuove sempre eventuali gestori della carta precedente.
  doneButton.onclick=null;
  skipButton.onclick=null;
  skipButton.classList.toggle('hidden',rule);

  if(rule){
    doneButton.textContent='Attiva regola · Prossima';
    doneButton.onclick=()=>runGameAction(
      currentCardId,
      ()=>activateCurrentRuleAndNext(currentCardId)
    );
  }else{
    doneButton.textContent='Fatto · Prossima';
    doneButton.onclick=()=>runGameAction(
      currentCardId,
      ()=>nextCard(currentCardId)
    );

    const unit=card._context.sips===1?'sorso':'sorsi';
    skipButton.textContent=`Salta · ${card._context.sips} ${unit}`;
    skipButton.onclick=()=>runGameAction(
      currentCardId,
      ()=>nextCard(currentCardId)
    );
  }

  renderActiveRules();
}

function activateCurrentRuleAndNext(expectedCardId){
  if(!APP.game || !APP.game.current)return;
  if(APP.game.current.id!==expectedCardId)return;
  if(!isRuleCard(APP.game.current))return;

  const acceptedRule=APP.game.current;
  addActiveRule(acceptedRule);
  APP.game.index++;
  showCurrentCard();
}

function nextCard(expectedCardId=null){
  if(!APP.game || APP.game.showingFinale)return;
  if(expectedCardId && APP.game.current?.id!==expectedCardId)return;

  APP.game.index++;
  showCurrentCard();
}

function showSessionDecision(){
  APP.game.decisionShown=true;
  APP.game.current=null;
  $('#progressText').textContent=`${SESSION_LENGTH} carte completate`;
  $('#progressBar').style.width='100%';
  $('#gameCard').style.setProperty('--card-color','#ffb23f');
  $('#gameDeckBadge').textContent='🏁 FINE DELLA PARTITA BASE';
  $('#gameCardText').innerHTML=`Avete completato ${SESSION_LENGTH} carte.<br><strong>Volete continuare o chiudere con l'ultimo brindisi?</strong>`;
  $('#fallbackText').classList.add('hidden');
  $('#sessionPrompt').classList.remove('hidden');
  $('#feedbackCardBtn').classList.add('hidden');
  const skipButton=$('#drinkAndNext');
  const doneButton=$('#doneAndNext');
  skipButton.onclick=null;
  doneButton.onclick=null;
  skipButton.classList.remove('hidden');
  skipButton.textContent='Continua a giocare';
  skipButton.onclick=()=>{
    APP.game.extended=true;
    $('#sessionPrompt').classList.add('hidden');
    showCurrentCard();
  };
  doneButton.textContent='Concludi partita';
  doneButton.onclick=showFinaleCard;
}

function showFinaleCard(){
  if(!APP.game)return;
  APP.game.showingFinale=true;
  const finale={
    intensity:2,
    text:FINALE_CARDS[Math.floor(Math.random()*FINALE_CARDS.length)],
    _deck:{name:'Ultimo brindisi',emoji:'🥂',color:'#ffb23f'}
  };
  finale._context=createCardContext(finale);
  finale._renderedHTML=renderCardText(finale.text,finale._context);

  $('#progressText').textContent='Sfida finale';
  $('#progressBar').style.width='100%';
  $('#gameCard').style.setProperty('--card-color',finale._deck.color);
  $('#gameDeckBadge').textContent='🥂 ULTIMO BRINDISI';
  $('#gameCardText').innerHTML=finale._renderedHTML;
  $('#fallbackText').classList.add('hidden');
  $('#sessionPrompt').classList.add('hidden');
  $('#feedbackCardBtn').classList.add('hidden');

  const skipButton=$('#drinkAndNext');
  const doneButton=$('#doneAndNext');
  skipButton.onclick=null;
  doneButton.onclick=null;
  skipButton.classList.remove('hidden');
  skipButton.textContent='Torna alla partita';
  skipButton.onclick=()=>{
    APP.game.showingFinale=false;
    showCurrentCard();
  };
  doneButton.textContent='Brindiamo e chiudi';
  doneButton.onclick=()=>{
    APP.game=null;
    navigate('setup');
    toast('Partita conclusa');
  };
}

function renderRulesCount(){
  const count=APP.game?.activeRules.length||0;
  $('#rulesCount').textContent=count;
  $('#activeRulesCount').textContent=count;
}

function renderActiveRules(){
  const rules=APP.game?.activeRules||[];
  renderRulesCount();
  const strip=$('#activeRulesStrip');
  const chips=$('#activeRuleChips');
  strip.classList.toggle('hidden',rules.length===0);
  chips.innerHTML=rules.map(rule=>`<span class="active-rule-chip" title="${escapeHTML(rule.text)}">${escapeHTML(rule.text)}</span>`).join('');
}

function showRules(){
  const list=$('#activeRulesList');
  const rules=APP.game?.activeRules||[];
  list.innerHTML=rules.length
    ?rules.map(r=>`<div class="active-rule locked-rule"><span>🔒</span><p>${escapeHTML(r.text)}</p></div>`).join('')
    :'<div class="empty">Nessuna regola attiva.</div>';
  if(!$('#rulesDialog').open)$('#rulesDialog').showModal();
}


function simpleHash(value=''){
  let hash=2166136261;
  for(let i=0;i<value.length;i++){
    hash^=value.charCodeAt(i);
    hash=Math.imul(hash,16777619);
  }
  return (hash>>>0).toString(16).padStart(8,'0');
}

function currentFeedbackCard(){
  if(!APP.game || !APP.game.current)return null;
  return APP.game.current;
}

function openFeedbackScreen(){
  const card=currentFeedbackCard();
  if(!card || APP.game?.showingFinale)return toast('Questa carta non può essere valutata');

  APP.pendingFeedback={
    cardId:card.id,
    sessionId:APP.game.sessionId,
    gameIndex:APP.game.index,
    openedAt:new Date().toISOString(),
    card:clone(card)
  };

  $('#feedbackOriginalDeck').textContent=`${card._deck?.emoji||''} ${card._deck?.name||card.deck||'Mazzo'}`;
  $('#feedbackOriginalText').innerHTML=card._renderedHTML||renderCardText(card.text,card._context||createCardContext(card));
  $('#feedbackCardId').textContent=card.id;
  $('#feedbackProposal').value=card.text||'';
  $('#feedbackFormError').textContent='';
  navigate('feedback');
  window.setTimeout(()=>$('#feedbackProposal').focus(),120);
}

function cancelFeedback(){
  APP.pendingFeedback=null;
  navigate(APP.game?'game':'setup');
}

function saveCardFeedback(e){
  e.preventDefault();
  const pending=APP.pendingFeedback;
  if(!pending || !APP.game || APP.game.current?.id!==pending.cardId){
    $('#feedbackFormError').textContent='La carta non è più disponibile. Torna alla partita.';
    return;
  }

  const proposal=($('#feedbackProposal').value||'').trim();
  const original=(pending.card.text||'').trim();

  if(!proposal){
    $('#feedbackFormError').textContent='Scrivi una proposta alternativa.';
    return;
  }
  if(proposal===original){
    $('#feedbackFormError').textContent='La proposta è identica alla carta originale: modifica almeno una parte.';
    return;
  }

  const card=pending.card;
  const entry={
    id:uid('feedback'),
    schemaVersion:1,
    installId:APP.feedback.installId,
    buildVersion:BUILD_VERSION,
    contentVersion:APP.defaults?.contentVersion||APP.defaults?.version||null,
    sessionId:pending.sessionId,
    createdAt:new Date().toISOString(),
    deckId:card._deck?.id||card.deck||null,
    deckName:card._deck?.name||card.deck||null,
    cardId:card.id,
    originalHash:simpleHash(original),
    originalText:original,
    renderedText:card._renderedPlain||plainTextFromHTML(card._renderedHTML||original),
    proposedText:proposal,
    cardMetadata:{
      minPlayers:Number(card.minPlayers||2),
      difficulty:Number(card.intensity||1),
      duration:card.duration||'immediata',
      adultOnly:Boolean(card.adultOnly),
      physicalContact:Boolean(card.physicalContact),
      tags:Array.isArray(card.tags)?card.tags:[]
    },
    status:'proposta'
  };

  APP.feedback.entries.push(entry);
  saveFeedback();
  renderFeedbackDashboard();

  const cardId=pending.cardId;
  APP.pendingFeedback=null;
  navigate('game');
  toast('Proposta salvata');
  nextCard(cardId);
}

function feedbackSummary(entries=APP.feedback.entries){
  const byDeck={};
  const byCard={};
  entries.forEach(entry=>{
    const deckKey=entry.deckId||'senza_mazzo';
    byDeck[deckKey]=(byDeck[deckKey]||0)+1;
    const cardKey=entry.cardId||'senza_id';
    byCard[cardKey]=(byCard[cardKey]||0)+1;
  });
  return {
    total:entries.length,
    uniqueCards:Object.keys(byCard).length,
    byDeck,
    byCard
  };
}

function renderFeedbackDashboard(){
  if(!APP.feedback)return;
  const entries=[...APP.feedback.entries].sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)));
  const summary=feedbackSummary(entries);

  $('#feedbackCount').textContent=summary.total;
  $('#feedbackCardCount').textContent=summary.uniqueCards;
  $('#feedbackInstallId').textContent=APP.feedback.installId;

  const list=$('#feedbackList');
  if(!entries.length){
    list.innerHTML='<div class="empty">Nessuna proposta raccolta su questo dispositivo.</div>';
    return;
  }

  list.innerHTML=entries.slice(0,100).map(entry=>{
    return `<article class="feedback-record">
      <div class="feedback-record-head">
        <div>
          <span class="feedback-deck">${escapeHTML(entry.deckName||entry.deckId||'Mazzo')}</span>
          <b>${escapeHTML(entry.cardId||'Carta')}</b>
        </div>
        <button class="icon-btn feedback-delete" data-delete-feedback="${escapeHTML(entry.id)}" title="Elimina proposta">×</button>
      </div>
      <p class="feedback-original-small">${escapeHTML(entry.originalText||'')}</p>
      <p class="feedback-arrow">→</p>
      <p class="feedback-proposal-small">${escapeHTML(entry.proposedText||'')}</p>
      <footer>
        <time>${escapeHTML(formatFeedbackDate(entry.createdAt))}</time>
      </footer>
    </article>`;
  }).join('');
}

function formatFeedbackDate(value){
  try{
    return new Intl.DateTimeFormat('it-IT',{
      day:'2-digit',month:'2-digit',year:'numeric',
      hour:'2-digit',minute:'2-digit'
    }).format(new Date(value));
  }catch{
    return value||'';
  }
}

function handleFeedbackListClick(e){
  const button=e.target.closest('[data-delete-feedback]');
  if(!button)return;
  const id=button.dataset.deleteFeedback;
  const entry=APP.feedback.entries.find(item=>item.id===id);
  if(!entry)return;
  if(!confirm(`Eliminare la proposta per ${entry.cardId}?`))return;
  APP.feedback.entries=APP.feedback.entries.filter(item=>item.id!==id);
  saveFeedback();
  renderFeedbackDashboard();
  toast('Proposta eliminata');
}

function safeFilenamePart(value='tester'){
  return value
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .replace(/[^a-z0-9_-]+/gi,'-')
    .replace(/^-+|-+$/g,'')
    .toLowerCase()||'tester';
}

function downloadFile(content,type,filename){
  const blob=new Blob([content],{type});
  const url=URL.createObjectURL(blob);
  const anchor=document.createElement('a');
  anchor.href=url;
  anchor.download=filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(()=>URL.revokeObjectURL(url),1000);
}

function feedbackExportPayload(){
  const entries=clone(APP.feedback.entries);
  return {
    app:'AperiPost(umi)',
    type:'aperipostumi-feedback',
    schemaVersion:1,
    buildVersion:BUILD_VERSION,
    exportedAt:new Date().toISOString(),
    installId:APP.feedback.installId,
    summary:feedbackSummary(entries),
    entries
  };
}

function exportFeedbackJSON(){
  if(!APP.feedback.entries.length)return toast('Nessun feedback da esportare');
  const payload=feedbackExportPayload();
  const installId=safeFilenamePart(APP.feedback.installId);
  const date=new Date().toISOString().slice(0,10);
  downloadFile(
    JSON.stringify(payload,null,2),
    'application/json',
    `aperipostumi-feedback-${installId}-${date}.json`
  );
  toast('Feedback JSON esportato');
}

function csvCell(value){
  const text=Array.isArray(value)?value.join(' | '):String(value??'');
  return `"${text.replaceAll('"','""')}"`;
}

function exportFeedbackCSV(){
  if(!APP.feedback.entries.length)return toast('Nessun feedback da esportare');
  const columns=[
    'id','createdAt','buildVersion','sessionId',
    'deckId','deckName','cardId','originalHash','originalText',
    'proposedText',
    'minPlayers','difficulty','duration','adultOnly','physicalContact','tags'
  ];
  const rows=[columns.map(csvCell).join(';')];

  APP.feedback.entries.forEach(entry=>{
    const meta=entry.cardMetadata||{};
    const row={
      ...entry,
      minPlayers:meta.minPlayers,
      difficulty:meta.difficulty,
      duration:meta.duration,
      adultOnly:meta.adultOnly,
      physicalContact:meta.physicalContact,
      tags:meta.tags
    };
    rows.push(columns.map(key=>csvCell(row[key])).join(';'));
  });

  const installId=safeFilenamePart(APP.feedback.installId);
  const date=new Date().toISOString().slice(0,10);
  downloadFile(
    '\ufeff'+rows.join('\r\n'),
    'text/csv;charset=utf-8',
    `aperipostumi-feedback-${installId}-${date}.csv`
  );
  toast('Feedback CSV esportato');
}

async function importFeedback(e){
  const files=[...(e.target.files||[])];
  if(!files.length)return;

  let imported=[];
  let rejected=0;

  for(const file of files){
    try{
      const data=JSON.parse(await file.text());
      const entries=Array.isArray(data)?data:data.entries;
      if(!Array.isArray(entries))throw new Error('Nessuna lista entries');
      imported.push(...entries.filter(item=>item && item.id && item.cardId && item.proposedText));
    }catch(error){
      rejected++;
      console.error('Feedback non importato:',file.name,error);
    }
  }

  const existing=new Map(APP.feedback.entries.map(entry=>[entry.id,entry]));
  imported.forEach(entry=>{
    if(!existing.has(entry.id))existing.set(entry.id,entry);
  });

  const before=APP.feedback.entries.length;
  APP.feedback.entries=[...existing.values()];
  const added=APP.feedback.entries.length-before;
  saveFeedback();
  renderFeedbackDashboard();
  e.target.value='';

  if(rejected){
    alert(`${added} proposte aggiunte. ${rejected} file non validi.`);
  }else{
    toast(`${added} proposte aggiunte`);
  }
}

function clearFeedback(){
  if(!APP.feedback.entries.length)return toast('Archivio già vuoto');
  if(!confirm(`Eliminare tutte le ${APP.feedback.entries.length} proposte locali? Esporta prima il JSON se vuoi conservarle.`))return;
  APP.feedback.entries=[];
  saveFeedback();
  renderFeedbackDashboard();
  toast('Archivio feedback svuotato');
}


function renderEditor(){
  if(!deckById(APP.editorDeckId))APP.editorDeckId=APP.library.decks[0]?.id;
  $('#editorDecks').innerHTML=APP.library.decks.map(d=>`<button class="editor-deck-btn ${d.id===APP.editorDeckId?'active':''}" data-editor-deck="${d.id}"><span>${d.emoji||'🎲'}</span><span>${escapeHTML(d.name)}</span><b>${d.cards.length}</b></button>`).join('');
  $$('[data-editor-deck]').forEach(b=>b.onclick=()=>{APP.editorDeckId=b.dataset.editorDeck;$('#cardSearch').value='';renderEditor();});
  const d=deckById(APP.editorDeckId);if(!d)return;
  $('#editorDeckTitle').textContent=`${d.emoji||'🎲'} ${d.name}`;
  $('#editorDeckMeta').textContent=`${d.cards.filter(c=>c.enabled!==false).length} attive su ${d.cards.length} carte`;
  renderCardList();
}

function renderCardList(){
  const d=deckById(APP.editorDeckId);if(!d)return;
  const q=$('#cardSearch').value.trim().toLowerCase();
  const cards=d.cards.filter(c=>!q||c.text.toLowerCase().includes(q)||(c.tags||[]).join(' ').toLowerCase().includes(q));
  $('#cardList').innerHTML=cards.length?cards.map(c=>`<div class="edit-card-row ${c.enabled===false?'disabled':''}"><button class="toggle ${c.enabled!==false?'on':''}" data-toggle-card="${c.id}" aria-label="Attiva o disattiva"><i></i></button><div><div class="edit-card-text">${escapeHTML(c.text)}</div><div class="edit-card-meta">min ${c.minPlayers||2} · difficoltà ${c.intensity||1} · ${(c.tags||[]).join(', ')}</div></div><div class="row-actions"><button data-edit-card="${c.id}">Modifica</button><button data-duplicate-card="${c.id}">Duplica</button><button data-delete-card="${c.id}">Elimina</button></div></div>`).join(''):'<div class="empty">Nessuna carta trovata.</div>';
  $$('[data-toggle-card]').forEach(b=>b.onclick=()=>{const c=d.cards.find(x=>x.id===b.dataset.toggleCard);c.enabled=c.enabled===false;saveLibrary();renderEditor();renderSetup();});
  $$('[data-edit-card]').forEach(b=>b.onclick=()=>openCardEditor(b.dataset.editCard));
  $$('[data-duplicate-card]').forEach(b=>b.onclick=()=>duplicateCard(b.dataset.duplicateCard));
  $$('[data-delete-card]').forEach(b=>b.onclick=()=>deleteCard(b.dataset.deleteCard));
}

function openCardEditor(id=null){
  const d=deckById(APP.editorDeckId);const c=id?d.cards.find(x=>x.id===id):null;
  $('#cardDialogTitle').textContent=c?'Modifica carta':'Nuova carta';
  $('#editCardId').value=c?.id||'';
  $('#editCardText').value=c?.text||'{player1}, ';
  $('#editMinPlayers').value=c?.minPlayers||2;
  $('#editIntensity').value=c?.intensity||1;
  $('#editDuration').value=c?.duration||'immediata';
  $('#editTags').value=(c?.tags||[]).join(', ');
  $('#editEnabled').checked=c?.enabled!==false;
  $('#editAdult').checked=!!c?.adultOnly;
  $('#editContact').checked=!!c?.physicalContact;
  $('#cardDialog').showModal();
}

function saveCardFromDialog(e){
  e.preventDefault();const d=deckById(APP.editorDeckId);const id=$('#editCardId').value;const old=d.cards.find(c=>c.id===id);
  const data={id:old?.id||uid(d.id),deck:d.id,text:$('#editCardText').value.trim(),minPlayers:Number($('#editMinPlayers').value)||2,intensity:Number($('#editIntensity').value)||1,tags:$('#editTags').value.split(',').map(x=>x.trim()).filter(Boolean),duration:$('#editDuration').value,adultOnly:$('#editAdult').checked,physicalContact:$('#editContact').checked,customizable:true,enabled:$('#editEnabled').checked,allowDrinkAlternative:true};
  if(!data.text)return toast('Inserisci il testo');
  if(old)Object.assign(old,data);else d.cards.push(data);
  saveLibrary();$('#cardDialog').close();renderEditor();renderSetup();toast('Carta salvata');
}
function duplicateCard(id){ const d=deckById(APP.editorDeckId);const c=d.cards.find(x=>x.id===id);const copy=clone(c);copy.id=uid(d.id);copy.text=`${copy.text} (copia)`;d.cards.push(copy);saveLibrary();renderEditor();renderSetup();toast('Carta duplicata'); }
function deleteCard(id){ const d=deckById(APP.editorDeckId);const c=d.cards.find(x=>x.id===id);if(!confirm(`Eliminare questa carta?\n\n${c.text}`))return;d.cards=d.cards.filter(x=>x.id!==id);saveLibrary();renderEditor();renderSetup(); }
function createDeck(e){e.preventDefault();const name=$('#newDeckName').value.trim();if(!name)return;const id=uid('mazzo');APP.library.decks.push({id,name,description:$('#newDeckDescription').value.trim(),emoji:$('#newDeckEmoji').value||'🎲',color:'#ff8a3d',adultOnly:$('#newDeckAdult').checked,enabled:true,version:'custom',cards:[]});APP.editorDeckId=id;saveLibrary();$('#deckDialog').close();e.target.reset();$('#newDeckEmoji').value='🎲';renderEditor();renderSetup();toast('Mazzo creato');}


function resetCurrentDeck(){
  const original=APP.defaults.decks.find(d=>d.id===APP.editorDeckId);
  const current=deckById(APP.editorDeckId);
  if(!original)return toast('Questo è un mazzo personalizzato');
  if(!confirm(`Ripristinare il mazzo “${current.name}”? Le modifiche a questo mazzo saranno eliminate.`))return;
  const index=APP.library.decks.findIndex(d=>d.id===APP.editorDeckId);
  APP.library.decks[index]=clone(original);
  saveLibrary();renderEditor();renderSetup();toast('Mazzo ripristinato');
}

function exportBackup(){
  const payload={
    app:'AperiPost(umi)',
    exportedAt:new Date().toISOString(),
    schemaVersion:2,
    library:APP.library,
    settings:APP.settings,
    feedback:APP.feedback
  };
  const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`aperipostumi-backup-${new Date().toISOString().slice(0,10)}.json`;a.click();URL.revokeObjectURL(a.href);toast('Backup esportato');
}
async function importBackup(e){
  const file=e.target.files[0];if(!file)return;try{const data=JSON.parse(await file.text());const lib=data.library||data;if(!Array.isArray(lib.decks))throw new Error('Formato non valido');if(!confirm(`Importare ${lib.decks.length} mazzi? I dati locali verranno sostituiti.`))return;APP.library=lib;APP.settings={...APP.settings,...(data.settings||{})};if(data.feedback&&Array.isArray(data.feedback.entries)){APP.feedback=data.feedback;saveFeedback();}saveLibrary();saveSettings();APP.editorDeckId=APP.library.decks[0]?.id;renderSetup();renderEditor();renderFeedbackDashboard();toast('Backup importato');}catch(err){alert(`Importazione non riuscita: ${err.message}`);}finally{e.target.value='';}
}
function resetAll(){if(!confirm('Ripristinare tutti i mazzi originali? Le modifiche manuali saranno eliminate.'))return;APP.library=clone(APP.defaults);saveLibrary();APP.editorDeckId=APP.library.decks[0]?.id;renderSetup();renderEditor();toast('Mazzi ripristinati');}
function isStandaloneMode(){
  return window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone===true;
}

function detectInstallPlatform(){
  const ua=navigator.userAgent||'';
  const isIOS=/iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform==='MacIntel' && navigator.maxTouchPoints>1);
  const isAndroid=/Android/i.test(ua);

  if(isIOS)return 'ios';
  if(isAndroid)return 'android';
  return 'desktop';
}

function updateInstallButton(){
  const button=$('#installBtn');
  if(!button)return;

  if(isStandaloneMode()){
    button.classList.add('hidden');
    return;
  }

  APP.installPlatform=detectInstallPlatform();
  button.classList.remove('hidden');
  button.textContent=APP.installPrompt?'Installa':'Come installare';
}

function renderInstallInstructions(){
  const platform=detectInstallPlatform();
  const title=$('#installDialogTitle');
  const lead=$('#installDialogLead');
  const steps=$('#installSteps');
  const note=$('#installStorageNote');

  if(platform==='ios'){
    title.textContent='Installa su iPhone o iPad';
    lead.textContent='Apri questa pagina in Safari e aggiungila alla schermata Home.';
    steps.innerHTML=`
      <li>Tocca il pulsante <strong>Condividi</strong> di Safari.</li>
      <li>Scorri e scegli <strong>Aggiungi alla schermata Home</strong>.</li>
      <li>Attiva <strong>Apri come app web</strong>.</li>
      <li>Tocca <strong>Aggiungi</strong>.</li>
    `;
  }else if(platform==='android'){
    title.textContent='Installa su Android';
    lead.textContent=APP.installPrompt
      ?'Il telefono può installare direttamente AperiPost(umi).'
      :'Usa il menu del browser per aggiungere l’app al telefono.';
    steps.innerHTML=APP.installPrompt
      ?'<li>Chiudi questa finestra e premi nuovamente <strong>Installa</strong>.</li>'
      :`
        <li>Apri il menu del browser.</li>
        <li>Scegli <strong>Installa app</strong> oppure <strong>Aggiungi a schermata Home</strong>.</li>
        <li>Conferma l’installazione.</li>
      `;
  }else{
    title.textContent='Installa come app';
    lead.textContent='I browser compatibili mostrano il comando di installazione nella barra degli indirizzi o nel menu.';
    steps.innerHTML=`
      <li>Apri il menu del browser.</li>
      <li>Cerca <strong>Installa AperiPost(umi)</strong> o <strong>Installa app</strong>.</li>
      <li>Conferma.</li>
    `;
  }

  note.textContent='Mazzi modificati e feedback restano sul dispositivo. Esporta un backup prima di cancellare l’app o i dati del browser.';
}

async function installApp(){
  if(isStandaloneMode()){
    toast('L’app risulta già installata');
    return;
  }

  if(APP.installPrompt){
    const prompt=APP.installPrompt;
    APP.installPrompt=null;
    prompt.prompt();
    await prompt.userChoice;
    updateInstallButton();
    return;
  }

  renderInstallInstructions();
  $('#installDialog').showModal();
}
async function registerServiceWorker(){
  if(!('serviceWorker' in navigator))return;
  try{
    const registration=await navigator.serviceWorker.register(
      `service-worker.js?v=${BUILD_VERSION}`,
      {updateViaCache:'none'}
    );
    await registration.update();
    if(registration.waiting){
      registration.waiting.postMessage({type:'SKIP_WAITING'});
    }
  }catch(error){
    console.error('Service worker:',error);
  }
}

init().catch(err=>{console.error(err);document.body.innerHTML=`<main><h1>Errore di avvio</h1><p>${escapeHTML(err.message)}</p></main>`;});

// ╔══════════════════════════════════════════════════════════════════╗
// ║  BLOOM — Period Tracker  ·  SCROLL-BUG ROOT CAUSE + FIX         ║
// ╠══════════════════════════════════════════════════════════════════╣
// ║                                                                  ║
// ║  ❌ BEFORE (broken)                                              ║
// ║  ─────────────────                                               ║
// ║  HomeScreen, LogScreen, etc. were defined INSIDE BloomApp().     ║
// ║  Every state change (clicking a chip → setLogState) caused       ║
// ║  BloomApp to re-render, creating NEW function references for      ║
// ║  every screen component. React saw a different component type    ║
// ║  at the same JSX position → full unmount + remount → scroll TOP. ║
// ║                                                                  ║
// ║  Conditional rendering also caused scroll resets:                ║
// ║    {screen === 'home' && <HomeScreen />}                         ║
// ║  Switching tabs always mounted fresh → scroll = 0.               ║
// ║                                                                  ║
// ║  ✅ AFTER (fixed) — 3 architectural changes                      ║
// ║  ──────────────────────────────────────────                      ║
// ║  1. All screen components defined at MODULE LEVEL (outside        ║
// ║     BloomApp). References are stable. React never remounts them. ║
// ║  2. All screens are ALWAYS in the DOM. Visibility is toggled     ║
// ║     via CSS display:'block'/'none' on each screen's scroll       ║
// ║     container. Scroll position is 100% preserved.                ║
// ║  3. Every <button> has type="button" — no implicit form submit.  ║
// ║                                                                  ║
// ╚══════════════════════════════════════════════════════════════════╝

import { useState, useEffect, useRef, memo } from "react";

// ─── THEMES ──────────────────────────────────────────────────────────────────
const THEMES = {
  rose: {
    name:"Rose Pink", primary:"#e8637a", soft:"#f9dde3", medium:"#f4a0b0",
    light:"#fff0f3", card:"#ffffff", bg:"#fdf5f7", text:"#3d1826",
    muted:"#9a6070", accent:"#c94060", lavender:"#f0e6ff", lavText:"#7030a0",
    lavBg:"#e8d8ff", grad1:"#e8637a", grad2:"#f4a0b0", gradOv:"#b06ad0",
    bar:"#e8637a", barPred:"#f4c0cc",
  },
  lavender: {
    name:"Lavender", primary:"#9060d0", soft:"#e8d8f8", medium:"#c098e8",
    light:"#f3ecff", card:"#ffffff", bg:"#f8f3ff", text:"#2a1050",
    muted:"#7850a8", accent:"#7030b0", lavender:"#fce8ff", lavText:"#8020b0",
    lavBg:"#f0d0ff", grad1:"#9060d0", grad2:"#c098e8", gradOv:"#d060a0",
    bar:"#9060d0", barPred:"#c8a0e8",
  },
  peach: {
    name:"Peach", primary:"#e07840", soft:"#ffe4cc", medium:"#f0a870",
    light:"#fff5ed", card:"#ffffff", bg:"#fdf8f4", text:"#3d1800",
    muted:"#9a6040", accent:"#c05020", lavender:"#fff0e0", lavText:"#a04820",
    lavBg:"#ffe0c0", grad1:"#e07840", grad2:"#f0a870", gradOv:"#d060a0",
    bar:"#e07840", barPred:"#f0c0a0",
  },
};

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const WEEKDAYS = ["Su","Mo","Tu","We","Th","Fr","Sa"];
const MOODS = [
  {id:"happy",emoji:"😊",label:"Happy"},{id:"calm",emoji:"😌",label:"Calm"},
  {id:"tired",emoji:"😴",label:"Tired"},{id:"sad",emoji:"😢",label:"Sad"},
  {id:"irritable",emoji:"😤",label:"Irritable"},{id:"anxious",emoji:"😰",label:"Anxious"},
  {id:"energized",emoji:"⚡",label:"Energized"},{id:"sensitive",emoji:"🥺",label:"Sensitive"},
];
const SYMPTOMS = [
  {id:"headache",label:"🤕 Headache"},{id:"acne",label:"💄 Acne"},
  {id:"bloating",label:"🎈 Bloating"},{id:"fatigue",label:"😴 Fatigue"},
  {id:"nausea",label:"🤢 Nausea"},{id:"backpain",label:"🪑 Back Pain"},
  {id:"tender",label:"💗 Tenderness"},{id:"cravings",label:"🍫 Cravings"},
  {id:"insomnia",label:"🌙 Insomnia"},{id:"dizzy",label:"💫 Dizziness"},
];
const FLOW_OPTS = [
  {id:"spotting",label:"· Spotting"},{id:"light",label:"💧 Light"},
  {id:"medium",label:"🩸 Medium"},{id:"heavy",label:"🌊 Heavy"},
];
const CRAMP_OPTS = [
  {id:"none",label:"✓ None"},{id:"mild",label:"😐 Mild"},
  {id:"medium",label:"😣 Medium"},{id:"severe",label:"😭 Severe"},
];
const ENERGY_LABELS = ["","😴 Exhausted","😔 Low","😊 OK","💪 Good","⚡ High!"];
const ENCOURAGEMENTS = [
  {t:"You're doing amazing. Your body is incredible and so are you!",i:"💖"},
  {t:"Every day you choose to care for yourself is a beautiful win.",i:"🌟"},
  {t:"Your feelings are completely valid. Be gentle with yourself today.",i:"🌸"},
  {t:"You are stronger, brighter, and more resilient than you know.",i:"✨"},
  {t:"Listen to your body — it's always sharing something important.",i:"🌺"},
  {t:"Rest is not laziness. Taking care of yourself is the most important work.",i:"🌙"},
  {t:"You deserve warmth, comfort, and all the kindness in the world.",i:"💛"},
  {t:"Small acts of self-care add up. You're doing beautifully.",i:"🫶"},
];
const INSIGHTS = {
  menstrual:["Your body is working hard — rest when you can 💕","Iron-rich foods like spinach & lentils help restore energy","Gentle movement like light yoga can ease cramp discomfort","Stay warm and hydrated — your body will thank you 🌸"],
  follicular:["Your energy is rising! Great time for new beginnings 🌱","You may feel more social and creative this week — lean in!","Great phase for planning, learning, and trying new things","Your skin may be glowing right now — you're in your element ✨"],
  ovulation:["You're likely feeling your most confident right now 💫","Your energy and mood often peak during ovulation","This is often when people feel their most radiant","Some light spotting during ovulation is completely normal 💜"],
  luteal:["Fatigue and mood shifts are completely normal now 🌙","Cravings for sweets are common — enjoy a treat guilt-free 🍫","Magnesium (dark chocolate, nuts!) can ease PMS symptoms","Be extra gentle with yourself — your period is on its way 🌸"],
  unknown:["Start tracking to unlock personalized cycle insights 💜","Every body is different — your cycle is beautifully unique","Tracking helps you understand and celebrate your body","Log your first period today to begin your journey! 🌸"],
};
const CARE_CONTENT = {
  yoga:{
    title:"🧘‍♀️ Gentle Yoga & Stretches",
    footer:"Always be gentle — never push through pain 💜",
    items:[
      {label:"🌙 Child's Pose",desc:"Kneel and sit back on heels, arms stretched forward. Hold 1–3 min. Gently releases lower back and hip tension.",bg:"#fff0f5"},
      {label:"🌿 Supine Twist",desc:"Lie on back, bring knee to chest, guide across body. Releases lower back and hips. Switch sides slowly.",bg:"#f3ecff"},
      {label:"💫 Cat-Cow Stretch",desc:"On all fours, alternate arching up (cat) and sagging down (cow). 5–10 rounds with deep breathing.",bg:"#eaf5ea"},
      {label:"🦋 Butterfly Pose",desc:"Sit with soles of feet together, knees falling outward. Gently lean forward. Wonderful for hip tension.",bg:"#fff5ed"},
    ],
  },
  heat:{
    title:"🔥 Heat Therapy",
    footer:"Heat is one of the most effective natural cramp remedies 🌸",
    items:[
      {label:"🌡️ Heating Pad",desc:"Apply to lower abdomen for 15–20 min. Warmth relaxes uterine muscles and increases blood flow.",bg:"#fff5ed"},
      {label:"🛁 Warm Bath",desc:"Warm bath with epsom salts relaxes your whole body. Add lavender oil for extra calm. Soak 15–20 min.",bg:"#fff0f5"},
      {label:"☕ Warm Drinks",desc:"Chamomile, ginger or peppermint tea soothe from inside. Anti-inflammatory and wonderfully calming.",bg:"#f3ecff"},
      {label:"⚠️ Safety Note",desc:"Use a cloth barrier — never apply heat directly to skin. Limit to 20 min. See a doctor if pain is severe.",bg:"#f8f8f8"},
    ],
  },
  food:{
    title:"🥗 Nourishing Foods",
    footer:"Nourishing your body is an act of love for yourself 💛",
    items:[
      {label:"🌿 Iron-Rich Foods",desc:"Spinach, lentils, tofu, red meat, pumpkin seeds, dark chocolate. Fights period fatigue.",bg:"#eaf5ea"},
      {label:"🫐 Anti-Inflammatory",desc:"Berries, fatty fish, walnuts, olive oil, turmeric. Reduces inflammation and eases cramp pain.",bg:"#fff0f5"},
      {label:"🍌 Magnesium Sources",desc:"Bananas, avocados, dark leafy greens, nuts, dark chocolate. Reduces PMS symptoms.",bg:"#f3ecff"},
      {label:"🚫 Limit These",desc:"Excess caffeine, salty foods (worsen bloating), processed sugar (amplifies mood swings).",bg:"#fff5ed"},
    ],
  },
  relax:{
    title:"🎵 Relaxation Ideas",
    footer:"You deserve to rest and enjoy gentle pleasures today 🌸",
    items:[
      {label:"🎵 Calming Music",desc:"Lo-fi, ambient, or classical music lowers stress hormones. Create a cozy comfort playlist!",bg:"#f3ecff"},
      {label:"📚 Light Reading",desc:"Getting lost in a good book is a wonderful distraction from discomfort.",bg:"#fff0f5"},
      {label:"🌬️ Box Breathing",desc:"Inhale 4, hold 4, exhale 4, hold 4. Repeat 5×. Calms the nervous system and reduces pain.",bg:"#eaf5ea"},
      {label:"🎨 Creative Time",desc:"Drawing, journaling, crafting — doing something you love shifts focus to joy.",bg:"#fff5ed"},
    ],
  },
};

// ─── UTILITIES ────────────────────────────────────────────────────────────────
const ds = d => {
  const y=d.getFullYear(), m=String(d.getMonth()+1).padStart(2,'0'), dy=String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${dy}`;
};
const pd  = s => new Date(s + 'T00:00:00');
const dayDiff  = (a, b) => Math.round((b - a) / 86400000);
const todayDate = () => { const d = new Date(); d.setHours(0,0,0,0); return d; };
const fmtDate   = d => d.toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'});

// ─── CYCLE LOGIC ──────────────────────────────────────────────────────────────
const avgCycleLen = c => {
  if (c.length < 2) return 28;
  const l = [];
  for (let i=1;i<c.length;i++) { const d=dayDiff(pd(c[i-1].startDate),pd(c[i].startDate)); if(d>=15&&d<=45) l.push(d); }
  return l.length ? Math.round(l.reduce((a,b)=>a+b,0)/l.length) : 28;
};
const avgPeriodLen = c => {
  const f = c.filter(x=>x.endDate); if (!f.length) return 5;
  const l = f.map(x=>{ const d=dayDiff(pd(x.startDate),pd(x.endDate))+1; return (d>0&&d<=14)?d:5; });
  return Math.round(l.reduce((a,b)=>a+b,0)/l.length);
};
const getPeriodDays = c => {
  const s = new Set();
  c.forEach(x=>{ const st=pd(x.startDate), en=x.endDate?pd(x.endDate):pd(x.startDate); for(let d=new Date(st);d<=en;d.setDate(d.getDate()+1)) s.add(ds(new Date(d))); });
  return s;
};
const getNextPeriod = c => {
  if (!c.length) return null;
  const d = new Date(pd(c[c.length-1].startDate)); d.setDate(d.getDate()+avgCycleLen(c)); return d;
};
const getPredictedDays = c => {
  const np = getNextPeriod(c); if (!np) return new Set();
  const s = new Set();
  for (let i=0;i<avgPeriodLen(c);i++) { const d=new Date(np); d.setDate(d.getDate()+i); s.add(ds(d)); }
  return s;
};
const getOvWindow = c => {
  const np = getNextPeriod(c); if (!np) return null;
  const pk = new Date(np); pk.setDate(pk.getDate()-14);
  return { start: new Date(pk.getTime()-172800000), peak: pk, end: new Date(pk.getTime()+172800000) };
};
const getCycleDay   = c => { if (!c.length) return null; const d=dayDiff(pd(c[c.length-1].startDate),todayDate())+1; return d<1?null:d; };
const getCyclePhase = c => {
  const cd=getCycleDay(c); if (!cd) return {name:'Not Tracking',icon:'🌸',key:'unknown'};
  const ap=avgPeriodLen(c);
  if (cd<=ap)  return {name:'Menstrual Phase', icon:'🩸', key:'menstrual'};
  if (cd<=13)  return {name:'Follicular Phase',icon:'🌱', key:'follicular'};
  if (cd<=16)  return {name:'Ovulation Phase', icon:'✨', key:'ovulation'};
  return {name:'Luteal Phase', icon:'🌙', key:'luteal'};
};
const defaultData = () => ({
  cycles:[], syms:{}, journal:{},
  cfg:{ pin:null, theme:'rose', name:'', showOvulation:true,
        reminders:{hydration:false,periodAlert:true,logReminder:true} },
});

// ─────────────────────────────────────────────────────────────────────────────
//  SHARED PRIMITIVES  (module-level — stable references across re-renders)
// ─────────────────────────────────────────────────────────────────────────────

// ✅ FIX: type="button" on every interactive element prevents any
//    accidental form-submit behavior that could reload the page.

function Chip({ label, on, onClick, T }) {
  return (
    <button type="button" onClick={onClick} style={{
      padding:'7px 14px', borderRadius:20,
      border:`1.5px solid ${on?T.primary:T.soft}`,
      background:on?T.primary:'transparent', color:on?'white':T.muted,
      fontSize:12, fontWeight:700, cursor:'pointer',
      fontFamily:"'Nunito',sans-serif", transition:'all .18s',
    }}>
      {label}
    </button>
  );
}

function Toggle({ on, onClick, T }) {
  return (
    <button type="button" onClick={onClick} style={{
      width:44, height:25, borderRadius:13, border:'none',
      background:on?T.primary:T.soft, position:'relative',
      cursor:'pointer', transition:'all .25s', flexShrink:0,
    }}>
      <div style={{
        position:'absolute', top:3, left:on?22:3,
        width:19, height:19, borderRadius:'50%', background:'white',
        transition:'left .25s', boxShadow:'0 1px 4px rgba(0,0,0,0.18)',
      }} />
    </button>
  );
}

function Card({ children, T, style={} }) {
  return (
    <div style={{
      background:T.card, borderRadius:20, padding:'16px 18px',
      boxShadow:`0 2px 16px ${T.soft}`, margin:'0 16px 12px', ...style,
    }}>
      {children}
    </div>
  );
}

function SectionLabel({ children, T }) {
  return (
    <div style={{
      fontSize:10, fontWeight:800, letterSpacing:'1.5px',
      textTransform:'uppercase', color:T.muted, margin:'18px 22px 10px',
    }}>
      {children}
    </div>
  );
}

function PriBtn({ children, onClick, T, style={} }) {
  return (
    <button type="button" onClick={onClick} style={{
      background:`linear-gradient(135deg,${T.grad1},${T.grad2})`,
      border:'none', borderRadius:16, padding:'13px',
      color:'white', fontSize:14, fontWeight:800, cursor:'pointer',
      fontFamily:"'Nunito',sans-serif", width:'100%',
      boxShadow:`0 4px 18px ${T.medium}88`, transition:'all .2s', ...style,
    }}>
      {children}
    </button>
  );
}

function OutBtn({ children, onClick, T, style={} }) {
  return (
    <button type="button" onClick={onClick} style={{
      background:'transparent', border:`1.5px solid ${T.primary}`,
      borderRadius:14, padding:'9px 16px',
      color:T.primary, fontSize:13, fontWeight:700,
      cursor:'pointer', fontFamily:"'Nunito',sans-serif",
      transition:'all .2s', ...style,
    }}>
      {children}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  MODALS  (module-level)
// ─────────────────────────────────────────────────────────────────────────────

function Backdrop({ children, onClose, T }) {
  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position:'fixed', inset:0, background:'rgba(60,20,45,.38)', zIndex:200,
               display:'flex', alignItems:'flex-end', justifyContent:'center' }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ background:T.card, borderRadius:'28px 28px 0 0',
                 padding:'22px 22px 42px', width:'100%', maxWidth:430,
                 maxHeight:'82vh', overflowY:'auto' }}
      >
        <div style={{ width:38, height:4, background:T.soft, borderRadius:2, margin:'0 auto 18px' }} />
        {children}
      </div>
    </div>
  );
}

function LogPeriodModal({ T, onSave, onClose }) {
  const [st, setSt] = useState(ds(todayDate()));
  const [en, setEn] = useState('');
  const [fl, setFl] = useState('medium');
  return (
    <Backdrop T={T} onClose={onClose}>
      <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:22, fontWeight:600, color:T.text, marginBottom:16 }}>
        🩸 Log Period
      </div>
      <div style={{ display:'flex', gap:10, marginBottom:14 }}>
        {[['START DATE', st, setSt], ['END DATE', en, setEn]].map(([lbl, val, fn], i) => (
          <div key={i} style={{ flex:1 }}>
            <div style={{ fontSize:10, fontWeight:700, letterSpacing:'.5px', color:T.muted, marginBottom:5 }}>{lbl}</div>
            <input
              type="date" value={val} onChange={e => fn(e.target.value)}
              style={{ width:'100%', border:`1.5px solid ${T.soft}`, borderRadius:11,
                       padding:'8px 10px', fontSize:13, fontFamily:"'Nunito',sans-serif",
                       color:T.text, background:T.bg, outline:'none' }}
            />
          </div>
        ))}
      </div>
      <div style={{ fontSize:12, fontWeight:700, color:T.text, marginBottom:8 }}>Flow Intensity</div>
      <div style={{ display:'flex', flexWrap:'wrap', gap:7, marginBottom:18 }}>
        {FLOW_OPTS.map(f => <Chip key={f.id} T={T} label={f.label} on={fl===f.id} onClick={() => setFl(f.id)} />)}
      </div>
      <PriBtn T={T} onClick={() => onSave(st, en, fl)}>Save Period 🌸</PriBtn>
    </Backdrop>
  );
}

function PinModal({ T, data, upd, onClose, showToast }) {
  const [step,  setStep]   = useState(data.cfg.pin ? 0 : 1);
  const [p1,    setP1]     = useState('');
  const [p2,    setP2]     = useState('');
  const [pinErr,setPinErr] = useState('');

  const PinPad = ({ val, setVal, title, onFull }) => (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:16 }}>
      <div style={{ fontSize:14, fontWeight:700, color:T.muted, textAlign:'center' }}>{title}</div>
      <div style={{ display:'flex', gap:14 }}>
        {[0,1,2,3].map(i => (
          <div key={i} style={{
            width:14, height:14, borderRadius:'50%',
            border:`2px solid ${T.medium}`,
            background: i < val.length ? T.primary : 'transparent',
            transition:'all .2s',
          }} />
        ))}
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8, width:220 }}>
        {['1','2','3','4','5','6','7','8','9','⌫','0',''].map((k, i) => (
          <button type="button" key={i}
            onClick={() => {
              if (k === '⌫') { setVal(v => v.slice(0,-1)); setPinErr(''); return; }
              if (!k || val.length >= 4) return;
              const nv = val + k; setVal(nv);
              if (nv.length === 4) setTimeout(() => onFull(nv), 180);
            }}
            style={{
              height:52, borderRadius:14, border:`1px solid ${T.soft}`,
              background:T.card, fontSize: k==='⌫' ? 14 : 18, fontWeight:700,
              fontFamily:"'Nunito',sans-serif", color:T.text, cursor:'pointer',
              visibility: k === '' ? 'hidden' : 'visible',
            }}
          >{k}</button>
        ))}
      </div>
      {pinErr && <div style={{ color:'#d04060', fontSize:12, fontWeight:700 }}>{pinErr}</div>}
    </div>
  );

  if (step === 0) return (
    <Backdrop T={T} onClose={onClose}>
      <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:22, fontWeight:600, color:T.text, marginBottom:16 }}>🔐 App Lock</div>
      <div style={{ display:'flex', flexDirection:'column', gap:9 }}>
        <PriBtn T={T} onClick={() => { setP1(''); setStep(1); }}>Change PIN</PriBtn>
        <button type="button" onClick={() => { upd(d => { d.cfg.pin = null; }); showToast('PIN removed'); onClose(); }}
          style={{ background:'transparent', border:'1.5px solid #d05070', borderRadius:14, padding:'10px',
                   color:'#d05070', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:"'Nunito',sans-serif", width:'100%' }}>
          Remove PIN
        </button>
        <OutBtn T={T} onClick={onClose}>Cancel</OutBtn>
      </div>
    </Backdrop>
  );
  if (step === 1) return (
    <Backdrop T={T} onClose={onClose}>
      <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:22, fontWeight:600, color:T.text, marginBottom:20 }}>Set New PIN</div>
      <PinPad val={p1} setVal={setP1} title="Enter a 4-digit PIN" onFull={() => setStep(2)} />
    </Backdrop>
  );
  return (
    <Backdrop T={T} onClose={onClose}>
      <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:22, fontWeight:600, color:T.text, marginBottom:20 }}>Confirm PIN</div>
      <PinPad val={p2} setVal={setP2} title="Re-enter your PIN to confirm"
        onFull={nv => {
          if (nv === p1) { upd(d => { d.cfg.pin = nv; }); showToast('PIN set! 🔐'); onClose(); }
          else { setPinErr("PINs don't match — try again"); setP2(''); setP1(''); setStep(1); }
        }}
      />
    </Backdrop>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  SCREEN COMPONENTS  (module-level — THIS IS THE CORE FIX)
//
//  ❌ BEFORE:  function BloomApp() {
//                const HomeScreen = () => { ... }   ← new reference every render
//                return <HomeScreen />               ← React remounts → scroll top
//              }
//
//  ✅ AFTER:   const HomeScreen = memo(function HomeScreen(props) { ... })
//              function BloomApp() {
//                return <HomeScreen {...props} />    ← stable ref → no remount
//              }
// ─────────────────────────────────────────────────────────────────────────────

const HomeScreen = memo(function HomeScreen({ T, data, cycles, cPhase, acl, apl, pDays, np, cDay, setScreen, setModal }) {
  const hr   = new Date().getHours();
  const greet = hr < 12 ? 'Good morning' : hr < 17 ? 'Good afternoon' : 'Good evening';
  const td   = todayDate();
  const onPeriod = pDays.has(ds(td));

  let cLabel = 'Track now', cTxt = 'Start tracking your cycle';
  if (np) {
    const dti = dayDiff(td, np);
    if (onPeriod)  { cLabel = 'Currently';       cTxt = 'On your period 🩸'; }
    else if (dti<0){ cLabel = 'Possibly late by'; cTxt = Math.abs(dti)+' day'+(Math.abs(dti)>1?'s':''); }
    else if (dti===0){ cLabel = 'Period expected'; cTxt = 'Today! 🔔'; }
    else           { cLabel = 'Next period in';   cTxt = dti+' day'+(dti>1?'s':''); }
  }
  const ins  = INSIGHTS[cPhase.key] || INSIGHTS.unknown;
  const enc  = ENCOURAGEMENTS[td.getDate() % ENCOURAGEMENTS.length];
  const showAlert = np && data.cfg?.reminders?.periodAlert && dayDiff(td, np) >= 0 && dayDiff(td, np) <= 3;

  return (
    <div>
      {/* Header */}
      <div style={{ padding:'48px 22px 14px' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div>
            <div style={{ fontSize:28, fontFamily:"'Cormorant Garamond',serif", fontWeight:600, color:T.text, letterSpacing:'-0.5px' }}>
              {greet}{data.cfg?.name ? `, ${data.cfg.name}` : ''} ✨
            </div>
            <div style={{ fontSize:13, color:T.muted, marginTop:2 }}>How are you feeling today?</div>
          </div>
          <button type="button" onClick={() => setScreen('settings')} style={{ background:'none', border:'none', fontSize:22, cursor:'pointer', padding:4 }}>⚙️</button>
        </div>
      </div>

      {/* Alert banner */}
      {showAlert && (
        <div style={{ margin:'0 16px 12px', background:'linear-gradient(135deg,#fff3e0,#ffe0b2)', borderRadius:16, padding:'13px 16px', display:'flex', gap:12, alignItems:'center', border:'1px solid rgba(255,160,60,.25)' }}>
          <span style={{ fontSize:22 }}>⚠️</span>
          <div style={{ fontSize:13, color:'#7a4800', fontWeight:600, lineHeight:1.5 }}>
            {dayDiff(td, np) === 0 ? 'Your period is expected today! Be prepared 💕' : `Your period is expected in ${dayDiff(td, np)} day${dayDiff(td, np) > 1 ? 's' : ''} — be prepared! 💕`}
          </div>
        </div>
      )}

      {/* Hero card */}
      <div style={{ margin:'0 16px 14px', background:`linear-gradient(135deg,${T.grad1},${T.grad2} 60%,${T.medium} 100%)`, borderRadius:28, padding:'24px 22px', position:'relative', overflow:'hidden', color:'white' }}>
        <div style={{ position:'absolute', top:-30, right:-30, width:150, height:150, borderRadius:'50%', background:'rgba(255,255,255,0.08)' }} />
        <div style={{ fontSize:12, fontWeight:700, opacity:.85, marginBottom:4 }}>{cPhase.name}</div>
        <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:54, fontWeight:600, lineHeight:1, letterSpacing:'-2px' }}>
          {cDay || '—'}<span style={{ fontSize:16, fontWeight:400, letterSpacing:0, opacity:.8 }}>{cDay ? ` / ${acl} days` : ''}</span>
        </div>
        <div style={{ fontSize:14, fontWeight:500, opacity:.88, marginTop:4 }}>
          {cDay ? `Day ${cDay} of your cycle 🌸` : 'Log your first period to start tracking'}
        </div>
        <div style={{ marginTop:18, background:'rgba(255,255,255,.18)', borderRadius:16, padding:'12px 16px', display:'flex', alignItems:'center', justifyContent:'space-between', backdropFilter:'blur(10px)' }}>
          <div><div style={{ fontSize:11, opacity:.8 }}>{cLabel}</div><div style={{ fontSize:15, fontWeight:800 }}>{cTxt}</div></div>
          <div style={{ fontSize:28 }}>{cPhase.icon}</div>
        </div>
        <button type="button" onClick={() => setModal({ type:'logPeriod' })} style={{ position:'absolute', top:20, right:20, background:'rgba(255,255,255,.22)', border:'none', borderRadius:'50%', width:42, height:42, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', fontSize:19, backdropFilter:'blur(10px)', zIndex:1 }}>➕</button>
      </div>

      {/* Stats */}
      <div style={{ display:'flex', gap:10, padding:'0 16px', marginBottom:14 }}>
        {[{icon:'🔄',val:acl,lbl:'Avg Cycle',s:'calendar'},{icon:'🌊',val:apl,lbl:'Avg Period',s:'log'},{icon:'📊',val:cycles.length,lbl:'Cycles Logged',s:'calendar'}].map((it, i) => (
          <div key={i} onClick={() => setScreen(it.s)} style={{ flex:1, background:T.card, borderRadius:18, padding:'14px 10px', boxShadow:`0 2px 14px ${T.soft}`, textAlign:'center', cursor:'pointer' }}>
            <div style={{ fontSize:20, marginBottom:5 }}>{it.icon}</div>
            <div style={{ fontSize:22, fontWeight:800, color:T.primary, fontFamily:"'Cormorant Garamond',serif" }}>{it.val}</div>
            <div style={{ fontSize:9, color:T.muted, fontWeight:700, letterSpacing:'.3px', marginTop:1 }}>{it.lbl}</div>
          </div>
        ))}
      </div>

      {/* Insight */}
      <div style={{ margin:'0 16px 12px', background:`linear-gradient(135deg,${T.lavender},${T.lavBg})`, borderRadius:20, padding:18, border:`1px solid ${T.lavText}22` }}>
        <div style={{ fontSize:10, fontWeight:700, letterSpacing:'1.5px', textTransform:'uppercase', color:T.lavText, marginBottom:6 }}>✨ Today's Insight</div>
        <div style={{ fontSize:14, color:T.lavText, lineHeight:1.65, fontWeight:500 }}>{ins[new Date().getDay() % ins.length]}</div>
      </div>

      {/* Quick actions */}
      <SectionLabel T={T}>Quick Actions</SectionLabel>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:9, padding:'0 16px', marginBottom:14 }}>
        {[
          {icon:'🩸',label:'Log Period',   bg:`linear-gradient(135deg,${T.grad1},${T.accent})`, color:'white',    fn:()=>setModal({type:'logPeriod'})},
          {icon:'😊',label:'Log Mood',     bg:T.card, color:T.text, border:`1.5px solid ${T.soft}`,              fn:()=>setScreen('log')},
          {icon:'🌸',label:'Self-Care',    bg:`linear-gradient(135deg,${T.lavender},${T.lavBg})`,color:T.lavText, fn:()=>setScreen('care')},
          {icon:'📓',label:'Journal',      bg:T.card, color:T.text, border:`1.5px solid ${T.soft}`,              fn:()=>setScreen('journal')},
        ].map((b, i) => (
          <button type="button" key={i} onClick={b.fn} style={{ background:b.bg, border:b.border||'none', borderRadius:18, padding:'16px 14px', display:'flex', alignItems:'center', gap:9, cursor:'pointer', fontFamily:"'Nunito',sans-serif", boxShadow:b.border?`0 2px 14px ${T.soft}`:'none' }}>
            <span style={{ fontSize:20 }}>{b.icon}</span>
            <span style={{ fontSize:13, fontWeight:700, color:b.color }}>{b.label}</span>
          </button>
        ))}
      </div>

      {/* Encouragement */}
      <div style={{ margin:'0 16px 18px', background:T.card, borderRadius:20, padding:18, boxShadow:`0 2px 14px ${T.soft}`, display:'flex', gap:14, alignItems:'center' }}>
        <div style={{ fontSize:36, animation:'float 3s ease-in-out infinite' }}>{enc.i}</div>
        <div style={{ fontSize:13, color:T.muted, lineHeight:1.65, fontWeight:500 }}>{enc.t}</div>
      </div>
      <div style={{ height:12 }} />
    </div>
  );
});

// ─── CALENDAR SCREEN ──────────────────────────────────────────────────────────
const CalendarScreen = memo(function CalendarScreen({ T, data, cycles, pDays, predDays, ovDays, ovWin, calDate, setCalDate, setLogDate, setScreen, setModal }) {
  const [selD, setSelD] = useState(null);
  const y = calDate.getFullYear(), m = calDate.getMonth();
  const firstDay = new Date(y,m,1).getDay(), dim = new Date(y,m+1,0).getDate(), dipm = new Date(y,m,0).getDate();
  const today2 = ds(todayDate());

  const cells = [];
  for (let i=0;i<42;i++) {
    let dn, dstr, isOm = false;
    if      (i < firstDay)            { dn=dipm-firstDay+i+1; dstr=ds(new Date(y,m-1,dn)); isOm=true; }
    else if (i-firstDay < dim)        { dn=i-firstDay+1;      dstr=ds(new Date(y,m,dn)); }
    else                              { dn=i-firstDay-dim+1;  dstr=ds(new Date(y,m+1,dn)); isOm=true; }
    cells.push({dn,dstr,isOm});
  }

  const dStyle = (dstr, isOm) => {
    const b = { aspectRatio:'1', display:'flex', alignItems:'center', justifyContent:'center', borderRadius:'50%', fontSize:13, fontWeight:500, cursor:'pointer', position:'relative', transition:'all .18s' };
    if (isOm)                               return {...b, color:T.muted, opacity:.3};
    if (pDays.has(dstr))                    return {...b, background:T.primary, color:'white', fontWeight:700};
    if (ovDays.has(dstr)&&!predDays.has(dstr)) return {...b, background:T.lavBg, color:T.lavText};
    if (predDays.has(dstr))                 return {...b, background:T.soft, color:T.accent};
    if (dstr===today2)                      return {...b, background:T.card, border:`2px solid ${T.primary}`, fontWeight:700, color:T.text};
    if (selD===dstr)                        return {...b, background:T.soft, fontWeight:700, color:T.accent};
    return {...b, color:T.text};
  };

  const detPanel = () => {
    if (!selD) return <div style={{ fontSize:13, color:T.muted, textAlign:'center', padding:'10px 0' }}>Tap any date to see details</div>;
    const d = pd(selD), sy = data.syms[selD]||{};
    const isPrd=pDays.has(selD), isPrd2=predDays.has(selD), isOv=ovDays.has(selD);
    const hasSy=Object.keys(sy).length>0, hasJr=!!data.journal[selD];
    const tag = (txt,bg,col) => <span key={txt} style={{ padding:'4px 11px', borderRadius:20, background:bg, color:col, fontSize:11, fontWeight:700 }}>{txt}</span>;
    return (
      <div>
        <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:18, fontWeight:600, color:T.text, marginBottom:10 }}>{fmtDate(d)}</div>
        <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
          {isPrd  && tag('🩸 Period Day', T.primary,'white')}
          {isPrd2&&!isPrd && tag('🔮 Predicted', T.soft, T.accent)}
          {isOv   && tag(ovWin&&ds(ovWin.peak)===selD?'✨ Ovulation':'🌸 Fertile Window', T.lavBg, T.lavText)}
          {sy.mood && tag(`${MOODS.find(x=>x.id===sy.mood)?.emoji} ${sy.mood}`, '#eaf5ea','#1a7040')}
          {sy.cramps&&sy.cramps!=='none' && tag(`😣 ${sy.cramps} cramps`, T.soft, T.accent)}
          {sy.energy && tag(`⚡ Energy ${sy.energy}/5`, '#fff5ed','#8a5000')}
          {(sy.syms||[]).map(x => tag(x, T.soft, T.muted))}
          {hasJr && tag('📓 Journal entry', T.lavBg, T.lavText)}
          {!isPrd&&!isPrd2&&!isOv&&!hasSy&&!hasJr && (
            <button type="button" onClick={()=>{setLogDate(pd(selD));setScreen('log');}} style={{ background:'transparent', border:`1.5px solid ${T.primary}`, borderRadius:14, padding:'6px 14px', fontSize:12, fontWeight:700, color:T.primary, cursor:'pointer', fontFamily:"'Nunito',sans-serif" }}>+ Log this day</button>
          )}
        </div>
      </div>
    );
  };

  const histBars = () => {
    if (cycles.length < 2) return <div style={{ fontSize:12, color:T.muted, textAlign:'center', padding:'8px 0' }}>Log 2+ cycles to see history</div>;
    const r = cycles.slice(-7), lens = [];
    for (let i=1;i<r.length;i++) lens.push(dayDiff(pd(r[i-1].startDate),pd(r[i].startDate)));
    const mx = Math.max(...lens);
    return (
      <div style={{ display:'flex', gap:8, alignItems:'flex-end', height:72 }}>
        {lens.map((l,i) => (
          <div key={i} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:3 }}>
            <div style={{ width:'100%', borderRadius:'4px 4px 0 0', background:i===lens.length-1?T.bar:T.barPred, height:Math.max(16,Math.round((l/mx)*68)), transition:'height .5s' }} />
            <div style={{ fontSize:9, color:T.muted, fontWeight:700 }}>{l}d</div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div>
      <div style={{ padding:'48px 22px 14px' }}>
        <div style={{ fontSize:28, fontFamily:"'Cormorant Garamond',serif", fontWeight:600, color:T.text, letterSpacing:'-0.5px' }}>Calendar 🗓️</div>
        <div style={{ fontSize:13, color:T.muted, marginTop:2 }}>Your cycle at a glance</div>
      </div>

      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'6px 22px 0' }}>
        <button type="button" onClick={()=>{const d=new Date(calDate);d.setMonth(d.getMonth()-1);setCalDate(new Date(d));}} style={{ width:40,height:40,borderRadius:'50%',border:`1px solid ${T.soft}`,background:T.card,fontSize:18,cursor:'pointer',color:T.primary,display:'flex',alignItems:'center',justifyContent:'center' }}>‹</button>
        <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:24, fontWeight:600, color:T.text }}>{MONTHS[m]} {y}</div>
        <button type="button" onClick={()=>{const d=new Date(calDate);d.setMonth(d.getMonth()+1);setCalDate(new Date(d));}} style={{ width:40,height:40,borderRadius:'50%',border:`1px solid ${T.soft}`,background:T.card,fontSize:18,cursor:'pointer',color:T.primary,display:'flex',alignItems:'center',justifyContent:'center' }}>›</button>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', padding:'14px 14px 6px', gap:2 }}>
        {WEEKDAYS.map(d => <div key={d} style={{ textAlign:'center', fontSize:10, fontWeight:700, color:T.muted }}>{d}</div>)}
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', padding:'0 14px 10px', gap:2 }}>
        {cells.map(({dn,dstr,isOm},i) => (
          <div key={i} onClick={()=>!isOm&&setSelD(s=>s===dstr?null:dstr)} style={dStyle(dstr,isOm)}>
            {dn}
            {!isOm&&(data.syms[dstr]||data.journal[dstr])&&<div style={{ position:'absolute',bottom:2,width:4,height:4,borderRadius:'50%',background:pDays.has(dstr)?'rgba(255,255,255,.8)':T.medium }} />}
          </div>
        ))}
      </div>

      <div style={{ display:'flex', gap:14, padding:'8px 16px 14px', flexWrap:'wrap' }}>
        {[{bg:T.primary,label:'Period'},{bg:T.soft,label:'Predicted'},{bg:T.lavBg,label:'Ovulation'},{bg:T.soft,label:'Logged'}].map((l,i) => (
          <div key={i} style={{ display:'flex', alignItems:'center', gap:6, fontSize:11, color:T.muted, fontWeight:600 }}>
            <div style={{ width:11,height:11,borderRadius:'50%',background:l.bg,border:i>0?`1px solid ${T.muted}40`:'' }} />{l.label}
          </div>
        ))}
      </div>

      <Card T={T} style={{ minHeight:76 }}>{detPanel()}</Card>
      <Card T={T}><div style={{ fontSize:14, fontWeight:700, color:T.text, marginBottom:14 }}>📊 Cycle History</div>{histBars()}</Card>
      <div style={{ padding:'4px 16px 0' }}><PriBtn T={T} onClick={()=>setModal({type:'logPeriod'})}>🩸 Log New Period</PriBtn></div>
      <div style={{ height:12 }} />
    </div>
  );
});

// ─── LOG SCREEN ───────────────────────────────────────────────────────────────
const LogScreen = memo(function LogScreen({ T, data, logDate, setLogDate, logState, setLogState, onSaveLog, onSavePeriod, onDeletePeriod }) {
  const td2 = todayDate(), diff2 = dayDiff(logDate, td2);
  const dateLbl = diff2===0?'Today':diff2===1?'Yesterday':diff2===-1?'Tomorrow':logDate.toLocaleDateString('en-US',{weekday:'long',month:'short',day:'numeric'});
  const dstr = ds(logDate);
  const [pStart, setPStart] = useState(dstr);
  const [pEnd,   setPEnd]   = useState('');

  useEffect(() => {
    const c = data.cycles.find(x => x.startDate === dstr);
    setPStart(c?.startDate || dstr); setPEnd(c?.endDate || '');
  }, [dstr, data.cycles.length]);

  const navDay = dir => { const d=new Date(logDate); d.setDate(d.getDate()+dir); setLogDate(new Date(d)); };

  const ss = (() => {
    const keys = Object.keys(data.syms); if (!keys.length) return null;
    const last30 = keys.filter(k=>{ const d=dayDiff(pd(k),todayDate()); return d>=0&&d<=30; });
    const mc={},sc2={}; let te=0,ec=0;
    last30.forEach(k=>{ const sy=data.syms[k]; if(sy.mood)mc[sy.mood]=(mc[sy.mood]||0)+1; (sy.syms||[]).forEach(x=>sc2[x]=(sc2[x]||0)+1); if(sy.energy){te+=sy.energy;ec++;} });
    return { tm:Object.entries(mc).sort((a,b)=>b[1]-a[1])[0], ts:Object.entries(sc2).sort((a,b)=>b[1]-a[1])[0], ae:ec?+(te/ec).toFixed(1):null, days:last30.length };
  })();

  return (
    <div>
      <div style={{ padding:'48px 22px 14px' }}>
        <div style={{ fontSize:28, fontFamily:"'Cormorant Garamond',serif", fontWeight:600, color:T.text, letterSpacing:'-0.5px' }}>Daily Log 📝</div>
        <div style={{ fontSize:13, color:T.muted, marginTop:2 }}>How are you feeling?</div>
      </div>

      <div style={{ display:'flex', alignItems:'center', gap:10, padding:'0 22px 16px' }}>
        <button type="button" onClick={()=>navDay(-1)} style={{ background:T.card,border:`1px solid ${T.soft}`,borderRadius:10,padding:'7px 12px',fontSize:12,fontWeight:700,color:T.primary,cursor:'pointer' }}>‹</button>
        <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:20, fontWeight:600, color:T.text, flex:1 }}>{dateLbl}</div>
        <button type="button" onClick={()=>navDay(1)} style={{ background:T.card,border:`1px solid ${T.soft}`,borderRadius:10,padding:'7px 12px',fontSize:12,fontWeight:700,color:T.primary,cursor:'pointer' }}>›</button>
      </div>

      {/* Period log */}
      <Card T={T} style={{ borderLeft:`4px solid ${T.primary}` }}>
        <div style={{ fontSize:14, fontWeight:700, color:T.text, marginBottom:14 }}>🩸 Period Log</div>
        <div style={{ display:'flex', gap:10, marginBottom:14 }}>
          {[['START DATE',pStart,setPStart],['END DATE',pEnd,setPEnd]].map(([lbl,val,fn],i) => (
            <div key={i} style={{ flex:1 }}>
              <div style={{ fontSize:10, fontWeight:700, letterSpacing:'.5px', color:T.muted, marginBottom:5 }}>{lbl}</div>
              <input type="date" value={val} onChange={e=>fn(e.target.value)} style={{ width:'100%',border:`1.5px solid ${T.soft}`,borderRadius:11,padding:'8px 10px',fontSize:13,fontFamily:"'Nunito',sans-serif",color:T.text,background:T.bg,outline:'none' }} />
            </div>
          ))}
        </div>
        <div style={{ fontSize:12, fontWeight:700, color:T.text, marginBottom:8 }}>Flow Intensity</div>
        <div style={{ display:'flex', flexWrap:'wrap', gap:7, marginBottom:14 }}>
          {FLOW_OPTS.map(f=><Chip key={f.id} T={T} label={f.label} on={logState.flow===f.id} onClick={()=>setLogState(l=>({...l,flow:f.id}))} />)}
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <PriBtn T={T} onClick={()=>onSavePeriod(pStart,pEnd,logState.flow)} style={{ flex:1,padding:'11px',fontSize:13 }}>Save Period</PriBtn>
          <OutBtn T={T} onClick={()=>{if(pStart)onDeletePeriod(pStart);}}>Clear</OutBtn>
        </div>
      </Card>

      {/* Symptoms */}
      <Card T={T} style={{ borderLeft:`4px solid ${T.lavText}` }}>
        <div style={{ fontSize:14, fontWeight:700, color:T.text, marginBottom:14 }}>🌡️ Symptoms</div>
        <div style={{ fontSize:12, fontWeight:700, color:T.text, marginBottom:8 }}>Cramps</div>
        <div style={{ display:'flex', flexWrap:'wrap', gap:7, marginBottom:14 }}>
          {CRAMP_OPTS.map(c=><Chip key={c.id} T={T} label={c.label} on={logState.cramps===c.id} onClick={()=>setLogState(l=>({...l,cramps:c.id}))} />)}
        </div>
        <div style={{ fontSize:12, fontWeight:700, color:T.text, marginBottom:8 }}>Other Symptoms</div>
        <div style={{ display:'flex', flexWrap:'wrap', gap:7 }}>
          {SYMPTOMS.map(s=><Chip key={s.id} T={T} label={s.label} on={logState.syms.includes(s.id)} onClick={()=>setLogState(l=>({...l,syms:l.syms.includes(s.id)?l.syms.filter(x=>x!==s.id):[...l.syms,s.id]}))} />)}
        </div>
      </Card>

      {/* Mood */}
      <Card T={T} style={{ borderLeft:'4px solid #4caf50' }}>
        <div style={{ fontSize:14, fontWeight:700, color:T.text, marginBottom:14 }}>😊 Mood</div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:7 }}>
          {MOODS.map(m => (
            <button type="button" key={m.id} onClick={()=>setLogState(l=>({...l,mood:m.id}))} style={{ display:'flex',flexDirection:'column',alignItems:'center',gap:3,padding:'10px 4px',borderRadius:14,border:`1.5px solid ${logState.mood===m.id?T.primary:T.soft}`,background:logState.mood===m.id?T.soft:'transparent',cursor:'pointer',fontFamily:"'Nunito',sans-serif" }}>
              <span style={{ fontSize:22 }}>{m.emoji}</span>
              <span style={{ fontSize:10, fontWeight:700, color:logState.mood===m.id?T.accent:T.muted }}>{m.label}</span>
            </button>
          ))}
        </div>
      </Card>

      {/* Energy */}
      <Card T={T}>
        <div style={{ fontSize:14, fontWeight:700, color:T.text, marginBottom:14 }}>⚡ Energy Level</div>
        <input type="range" min={1} max={5} value={logState.energy} step={1}
          onChange={e=>setLogState(l=>({...l,energy:+e.target.value}))}
          style={{ width:'100%',WebkitAppearance:'none',height:6,borderRadius:3,background:`linear-gradient(to right,${T.primary} 0%,${T.primary} ${(logState.energy-1)*25}%,${T.soft} ${(logState.energy-1)*25}%,${T.soft} 100%)`,outline:'none',cursor:'pointer' }} />
        <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, color:T.muted, fontWeight:700, marginTop:5 }}>
          {['Exhausted','Low','OK','Good','High'].map(l=><span key={l}>{l}</span>)}
        </div>
        <div style={{ textAlign:'center', marginTop:8, fontSize:13, fontWeight:700, color:T.primary }}>{ENERGY_LABELS[logState.energy]}</div>
      </Card>

      <div style={{ padding:'0 16px 18px' }}><PriBtn T={T} onClick={onSaveLog}>💾 Save Today's Log</PriBtn></div>

      {ss && (
        <>
          <SectionLabel T={T}>Last 30 Days · Patterns</SectionLabel>
          <Card T={T} style={{ marginBottom:20 }}>
            {[ss.tm&&{l:'Most common mood',v:`${MOODS.find(x=>x.id===ss.tm[0])?.emoji} ${ss.tm[0]} (${ss.tm[1]}×)`},ss.ts&&{l:'Top symptom',v:`${ss.ts[0]} (${ss.ts[1]} days)`},ss.ae&&{l:'Average energy',v:`⚡ ${ss.ae}/5`},{l:'Days logged',v:`${ss.days} days`}].filter(Boolean).map((r,i,a) => (
              <div key={i} style={{ display:'flex',alignItems:'center',justifyContent:'space-between',padding:'9px 0',borderBottom:i<a.length-1?`1px solid ${T.soft}`:'none' }}>
                <span style={{ fontSize:12,color:T.muted,fontWeight:600 }}>{r.l}</span>
                <span style={{ fontSize:12,fontWeight:800,color:T.primary }}>{r.v}</span>
              </div>
            ))}
          </Card>
        </>
      )}
      <div style={{ height:12 }} />
    </div>
  );
});

// ─── CARE SCREEN ──────────────────────────────────────────────────────────────
const CareScreen = memo(function CareScreen({ T, data, upd, showToast, setModal }) {
  const rem = data.cfg?.reminders || {};
  const togR = key => { upd(d => { d.cfg.reminders[key] = !d.cfg.reminders[key]; }); showToast(!rem[key]?'Reminder on! 🔔':'Reminder off'); };
  const REMS = [{key:'hydration',icon:'💧',t:'Hydration',s:'Drink 8 glasses today'},{key:'periodAlert',icon:'🔔',t:'Period Alert',s:'3 days before expected'},{key:'logReminder',icon:'📝',t:'Daily Log',s:'Reminder to log symptoms'}];

  return (
    <div>
      <div style={{ padding:'48px 22px 14px' }}>
        <div style={{ fontSize:28, fontFamily:"'Cormorant Garamond',serif", fontWeight:600, color:T.text, letterSpacing:'-0.5px' }}>Self-Care 🌸</div>
        <div style={{ fontSize:13, color:T.muted, marginTop:2 }}>Your wellness sanctuary</div>
      </div>

      <div style={{ margin:'0 16px 16px', background:`linear-gradient(135deg,${T.lavender},${T.lavBg})`, borderRadius:24, padding:20, border:`1px solid ${T.lavText}20` }}>
        <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:22, fontWeight:600, color:T.lavText, marginBottom:6 }}>You deserve care 💜</div>
        <div style={{ fontSize:13, color:T.lavText+'cc', lineHeight:1.65 }}>Your body works hard for you. These gentle tips can help you feel more comfortable and supported throughout your cycle.</div>
      </div>

      <SectionLabel T={T}>Reminders</SectionLabel>
      <div style={{ display:'flex', flexDirection:'column', gap:9, padding:'0 16px', marginBottom:4 }}>
        {REMS.map(r => (
          <div key={r.key} style={{ background:T.card,borderRadius:16,padding:'14px 18px',display:'flex',alignItems:'center',justifyContent:'space-between',boxShadow:`0 2px 12px ${T.soft}` }}>
            <div style={{ display:'flex', alignItems:'center', gap:11 }}>
              <span style={{ fontSize:20 }}>{r.icon}</span>
              <div><div style={{ fontSize:13,fontWeight:700,color:T.text }}>{r.t}</div><div style={{ fontSize:11,color:T.muted }}>{r.s}</div></div>
            </div>
            <Toggle T={T} on={!!rem[r.key]} onClick={()=>togR(r.key)} />
          </div>
        ))}
      </div>

      <SectionLabel T={T}>Comfort Tips</SectionLabel>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, padding:'0 16px', marginBottom:14 }}>
        {Object.entries(CARE_CONTENT).map(([key,val]) => (
          <div key={key} onClick={()=>setModal({type:'care',key})} style={{ background:T.card,borderRadius:20,padding:'18px 14px',boxShadow:`0 2px 14px ${T.soft}`,cursor:'pointer' }}>
            <div style={{ fontSize:28, marginBottom:9 }}>{val.title.split(' ')[0]}</div>
            <div style={{ fontSize:13, fontWeight:700, color:T.text, marginBottom:3 }}>{val.title.slice(val.title.indexOf(' ')+1)}</div>
            <div style={{ fontSize:11, color:T.muted, lineHeight:1.5 }}>Tap to explore tips</div>
          </div>
        ))}
      </div>

      <SectionLabel T={T}>Daily Wellness</SectionLabel>
      <Card T={T}>
        {[
          {icon:'💧',bg:T.soft,       t:'Stay Hydrated',   d:'Warm water, chamomile or ginger tea reduce bloating and cramps. Aim for 8 glasses daily.'},
          {icon:'🥬',bg:'#eaf5ea',    t:'Iron-Rich Foods',  d:'Spinach, lentils, dark chocolate and legumes help replace iron and fight fatigue.'},
          {icon:'🌙',bg:T.lavender,   t:'Rest & Sleep',     d:'Your body needs extra rest. Prioritize 7–9 hours and be genuinely gentle with yourself.'},
          {icon:'🚶‍♀️',bg:'#fff5ed', t:'Light Movement',   d:'A short walk or gentle stretching boosts mood and reduces discomfort naturally.'},
          {icon:'🌬️',bg:T.soft,      t:'Deep Breathing',   d:'Box breathing: inhale 4, hold 4, exhale 4, hold 4. Repeat 5 times for calm.'},
          {icon:'🎨',bg:T.lavender,   t:'Creative Time',    d:'Drawing, music, journaling — doing something you love shifts focus to joy.'},
        ].map((tip,i,arr) => (
          <div key={i} style={{ display:'flex',alignItems:'flex-start',gap:11,padding:'11px 0',borderBottom:i<arr.length-1?`1px solid ${T.soft}`:'none' }}>
            <div style={{ width:34,height:34,borderRadius:10,background:tip.bg,display:'flex',alignItems:'center',justifyContent:'center',fontSize:17,flexShrink:0 }}>{tip.icon}</div>
            <div><div style={{ fontSize:13,fontWeight:700,color:T.text,marginBottom:1 }}>{tip.t}</div><div style={{ fontSize:11,color:T.muted,lineHeight:1.5 }}>{tip.d}</div></div>
          </div>
        ))}
      </Card>

      <div style={{ margin:'0 16px 18px',background:T.card,borderRadius:20,padding:18,boxShadow:`0 2px 14px ${T.soft}`,display:'flex',gap:14,alignItems:'center' }}>
        <div style={{ fontSize:34,animation:'float 3s ease-in-out infinite' }}>🌸</div>
        <div style={{ fontSize:13,color:T.muted,lineHeight:1.65,fontWeight:500 }}>Every cycle is different, and every feeling you have is valid. Be patient and kind to yourself today.</div>
      </div>
      <div style={{ height:12 }} />
    </div>
  );
});

// ─── JOURNAL SCREEN ───────────────────────────────────────────────────────────
const JournalScreen = memo(function JournalScreen({ T, data, jDate, setJDate, journalText, setJournalText, onSave, onDelete }) {
  const td2 = todayDate(), diff2 = dayDiff(jDate, td2);
  const dateLbl = diff2===0?'Today':diff2===1?'Yesterday':diff2===-1?'Tomorrow':jDate.toLocaleDateString('en-US',{weekday:'long',month:'short',day:'numeric'});
  const dstr = ds(jDate);
  const moodDisp = data.syms[dstr]?.mood ? MOODS.find(m=>m.id===data.syms[dstr].mood) : null;
  const entries = Object.values(data.journal).sort((a,b)=>b.ts-a.ts);
  const navDay = dir => { const d=new Date(jDate); d.setDate(d.getDate()+dir); setJDate(new Date(d)); };

  return (
    <div>
      <div style={{ padding:'48px 22px 14px' }}>
        <div style={{ fontSize:28, fontFamily:"'Cormorant Garamond',serif", fontWeight:600, color:T.text, letterSpacing:'-0.5px' }}>Journal 📓</div>
        <div style={{ fontSize:13, color:T.muted, marginTop:2 }}>Your private safe space</div>
      </div>

      <div style={{ display:'flex', alignItems:'center', gap:10, padding:'0 22px 14px' }}>
        <button type="button" onClick={()=>navDay(-1)} style={{ background:T.card,border:`1px solid ${T.soft}`,borderRadius:10,padding:'7px 12px',fontSize:12,fontWeight:700,color:T.primary,cursor:'pointer' }}>‹</button>
        <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:20, fontWeight:600, color:T.text, flex:1 }}>{dateLbl}</div>
        <button type="button" onClick={()=>navDay(1)} style={{ background:T.card,border:`1px solid ${T.soft}`,borderRadius:10,padding:'7px 12px',fontSize:12,fontWeight:700,color:T.primary,cursor:'pointer' }}>›</button>
      </div>

      <div style={{ margin:'0 16px 12px',background:T.card,borderRadius:16,padding:'12px 16px',display:'flex',alignItems:'center',justifyContent:'space-between',boxShadow:`0 2px 12px ${T.soft}` }}>
        <div style={{ fontSize:13,fontWeight:700,color:T.muted }}>Today's mood</div>
        <div style={{ fontSize:13,color:moodDisp?T.primary:T.muted,fontWeight:moodDisp?700:400 }}>{moodDisp?`${moodDisp.emoji} ${moodDisp.label}`:'— not logged yet'}</div>
      </div>

      <div style={{ padding:'0 16px 4px' }}>
        <textarea value={journalText} onChange={e=>setJournalText(e.target.value)}
          placeholder={"Write how you're feeling today... 💭\n\nThis is your private space. No judgment, just you."}
          style={{ width:'100%',minHeight:190,border:`1.5px solid ${T.soft}`,borderRadius:20,padding:18,fontSize:14,fontFamily:"'Nunito',sans-serif",color:T.text,background:T.card,outline:'none',resize:'none',lineHeight:1.7,boxShadow:`0 2px 14px ${T.soft}` }} />
      </div>
      <div style={{ padding:'10px 16px 18px',display:'flex',gap:9 }}>
        <PriBtn T={T} onClick={onSave} style={{ flex:3 }}>💾 Save Entry</PriBtn>
        {data.journal[dstr] && <OutBtn T={T} onClick={()=>onDelete(dstr)}>Delete</OutBtn>}
      </div>

      <SectionLabel T={T}>Past Entries</SectionLabel>
      <div style={{ padding:'0 16px' }}>
        {entries.length===0 ? (
          <div style={{ textAlign:'center',padding:'36px 22px',color:T.muted }}>
            <div style={{ fontSize:44,marginBottom:14 }}>📓</div>
            <div style={{ fontSize:14,fontWeight:500,lineHeight:1.6 }}>Start writing to build your journal</div>
          </div>
        ) : entries.map(e => (
          <div key={e.date} onClick={()=>{setJDate(pd(e.date));setJournalText(e.text);}}
            style={{ background:T.card,borderRadius:16,padding:'14px 16px',marginBottom:10,boxShadow:`0 2px 12px ${T.soft}`,cursor:'pointer',borderLeft:`3px solid ${T.primary}` }}>
            <div style={{ fontSize:10,fontWeight:800,color:T.muted,marginBottom:5,letterSpacing:'.5px' }}>{new Date(e.date+'T00:00:00').toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'})}</div>
            <div style={{ fontSize:13,color:T.muted,lineHeight:1.5,display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical',overflow:'hidden' }}>{e.text}</div>
          </div>
        ))}
      </div>
      <div style={{ height:12 }} />
    </div>
  );
});

// ─── SETTINGS SCREEN ──────────────────────────────────────────────────────────
const SettingsScreen = memo(function SettingsScreen({ T, data, upd, acl, apl, setScreen, setModal, showToast }) {
  return (
    <div>
      <div style={{ padding:'48px 22px 14px' }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <button type="button" onClick={()=>setScreen('home')} style={{ background:'none',border:'none',fontSize:21,cursor:'pointer',color:T.primary,fontFamily:"'Nunito',sans-serif",fontWeight:700 }}>‹</button>
          <div style={{ fontSize:28,fontFamily:"'Cormorant Garamond',serif",fontWeight:600,color:T.text,letterSpacing:'-0.5px' }}>Settings ⚙️</div>
        </div>
      </div>

      <div style={{ display:'flex',flexDirection:'column',alignItems:'center',padding:'0 22px 22px',gap:10 }}>
        <div style={{ width:80,height:80,borderRadius:'50%',background:`linear-gradient(135deg,${T.grad1},${T.gradOv})`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:36 }}>🌸</div>
        <input value={data.cfg?.name||''} onChange={e=>upd(d=>{d.cfg.name=e.target.value;})} placeholder="Your name"
          style={{ border:`1.5px solid ${T.soft}`,borderRadius:12,padding:'8px 16px',fontSize:16,fontFamily:"'Cormorant Garamond',serif",color:T.text,background:T.bg,outline:'none',textAlign:'center',width:200 }} />
      </div>

      <SectionLabel T={T}>Appearance</SectionLabel>
      <div style={{ margin:'0 16px 16px',background:T.card,borderRadius:20,overflow:'hidden',boxShadow:`0 2px 14px ${T.soft}`,padding:'14px 18px' }}>
        <div style={{ fontSize:10,fontWeight:800,letterSpacing:'.8px',color:T.muted,marginBottom:11 }}>THEME COLOR</div>
        <div style={{ display:'flex', gap:14 }}>
          {Object.entries(THEMES).map(([key,th]) => (
            <button type="button" key={key} onClick={()=>upd(d=>{d.cfg.theme=key;})} title={th.name}
              style={{ width:42,height:42,borderRadius:'50%',background:`linear-gradient(135deg,${th.grad1},${th.grad2})`,cursor:'pointer',border:`3px solid ${data.cfg?.theme===key?T.text:'transparent'}`,transform:data.cfg?.theme===key?'scale(1.1)':'scale(1)',transition:'all .2s' }} />
          ))}
        </div>
      </div>

      <SectionLabel T={T}>Privacy</SectionLabel>
      <div style={{ margin:'0 16px 16px',background:T.card,borderRadius:20,overflow:'hidden',boxShadow:`0 2px 14px ${T.soft}` }}>
        <div onClick={()=>setModal({type:'pin'})} style={{ display:'flex',alignItems:'center',justifyContent:'space-between',padding:'15px 18px',cursor:'pointer' }}>
          <div style={{ display:'flex',alignItems:'center',gap:11 }}>
            <span style={{ fontSize:18 }}>🔐</span>
            <div><div style={{ fontSize:14,fontWeight:700,color:T.text }}>App Lock</div><div style={{ fontSize:12,color:T.muted }}>{data.cfg?.pin?'PIN is set':'Not set'}</div></div>
          </div>
          <span style={{ color:T.muted,fontSize:14 }}>›</span>
        </div>
      </div>

      <SectionLabel T={T}>Cycle Settings</SectionLabel>
      <div style={{ margin:'0 16px 16px',background:T.card,borderRadius:20,overflow:'hidden',boxShadow:`0 2px 14px ${T.soft}` }}>
        {[{icon:'🔄',label:'Average Cycle Length',val:`${acl} days`},{icon:'📅',label:'Average Period Duration',val:`${apl} days`}].map((r,i) => (
          <div key={i} style={{ display:'flex',alignItems:'center',justifyContent:'space-between',padding:'15px 18px',borderBottom:`1px solid ${T.soft}` }}>
            <div style={{ display:'flex',alignItems:'center',gap:11 }}><span style={{ fontSize:18 }}>{r.icon}</span><div style={{ fontSize:14,fontWeight:700,color:T.text }}>{r.label}</div></div>
            <span style={{ fontSize:12,color:T.muted,fontWeight:600 }}>{r.val}</span>
          </div>
        ))}
        <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',padding:'15px 18px' }}>
          <div style={{ display:'flex',alignItems:'center',gap:11 }}>
            <span style={{ fontSize:18 }}>🔮</span>
            <div style={{ fontSize:14,fontWeight:700,color:T.text }}>Show Ovulation Window</div>
          </div>
          <Toggle T={T} on={!!data.cfg?.showOvulation} onClick={()=>upd(d=>{d.cfg.showOvulation=!d.cfg.showOvulation;})} />
        </div>
      </div>

      <SectionLabel T={T}>About</SectionLabel>
      <div style={{ margin:'0 16px 16px',background:T.card,borderRadius:20,overflow:'hidden',boxShadow:`0 2px 14px ${T.soft}` }}>
        {[{icon:'🌸',label:'Bloom',val:'v2.0 · Your cycle companion'},{icon:'🔒',label:'Privacy First',val:'All data stays on your device only'}].map((r,i) => (
          <div key={i} style={{ display:'flex',alignItems:'center',justifyContent:'space-between',padding:'15px 18px',borderBottom:i===0?`1px solid ${T.soft}`:'none' }}>
            <div style={{ display:'flex',alignItems:'center',gap:11 }}><span style={{ fontSize:18 }}>{r.icon}</span><div><div style={{ fontSize:14,fontWeight:700,color:T.text }}>{r.label}</div><div style={{ fontSize:12,color:T.muted }}>{r.val}</div></div></div>
          </div>
        ))}
      </div>

      <div style={{ padding:'0 16px 22px' }}>
        <button type="button"
          onClick={()=>{ if(window.confirm('Clear all data? This cannot be undone.')) { upd(d=>{ Object.assign(d,defaultData()); }); showToast('All data cleared'); }}}
          style={{ background:'transparent',border:'1.5px solid #d05070',borderRadius:14,padding:'10px',color:'#d05070',fontSize:13,fontWeight:700,cursor:'pointer',fontFamily:"'Nunito',sans-serif",width:'100%' }}>
          🗑️ Clear All Data
        </button>
      </div>
      <div style={{ height:12 }} />
    </div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
//  MAIN APP SHELL  — state only, no screen logic defined here
// ─────────────────────────────────────────────────────────────────────────────
export default function BloomApp() {
  const [data,      setData]      = useState(() => { try { const s=localStorage.getItem('bloom3'); return s?JSON.parse(s):defaultData(); } catch { return defaultData(); } });
  const [screen,    setScreen]    = useState('home');
  const [locked,    setLocked]    = useState(false);
  const [lockPin,   setLockPin]   = useState('');
  const [lockErr,   setLockErr]   = useState('');
  const [toast,     setToast]     = useState({msg:'',show:false});
  const [calDate,   setCalDate]   = useState(() => new Date());
  const [logDate,   setLogDate]   = useState(() => todayDate());
  const [jDate,     setJDate]     = useState(() => todayDate());
  const [modal,     setModal]     = useState(null);
  const [logState,  setLogState]  = useState({flow:null,cramps:null,syms:[],mood:null,energy:3});
  const [journalText,setJournalText] = useState('');
  const toastRef = useRef(null);

  const T = THEMES[data.cfg?.theme] || THEMES.rose;

  // Persist data
  useEffect(() => { try { localStorage.setItem('bloom3', JSON.stringify(data)); } catch {} }, [data]);

  // Init lock
  useEffect(() => { if (data.cfg?.pin) setLocked(true); }, []);

  // Sync log state when date changes
  useEffect(() => {
    const dstr = ds(logDate), sy = data.syms[dstr] || {};
    setLogState({ flow:sy.flow||null, cramps:sy.cramps||null, syms:sy.syms?[...sy.syms]:[], mood:sy.mood||null, energy:sy.energy||3 });
  }, [logDate]);

  // Sync journal when date changes
  useEffect(() => { setJournalText(data.journal[ds(jDate)]?.text || ''); }, [jDate]);

  const showToast = msg => {
    setToast({msg,show:true});
    clearTimeout(toastRef.current);
    toastRef.current = setTimeout(() => setToast(t=>({...t,show:false})), 2800);
  };

  // Deep-clone update — ensures React always sees new object references
  const upd = fn => setData(d => { const n = JSON.parse(JSON.stringify(d)); fn(n); return n; });

  // ── Action handlers
  const saveLog = () => {
    upd(d => { d.syms[ds(logDate)] = {...logState, date:ds(logDate)}; });
    showToast('Daily log saved! 💖');
  };
  const savePeriod = (startDate, endDate, flow) => {
    if (!startDate) { showToast('Please set a start date'); return; }
    upd(d => {
      const idx = d.cycles.findIndex(c => c.startDate === startDate);
      const nc = {id:Date.now()+'', startDate, endDate:endDate||null, flow:flow||'medium'};
      if (idx >= 0) d.cycles[idx] = {...d.cycles[idx], ...nc};
      else { d.cycles.push(nc); d.cycles.sort((a,b)=>a.startDate.localeCompare(b.startDate)); }
    });
    showToast('Period logged! 🌸');
    setModal(null);
  };
  const deletePeriod = startDate => { upd(d => { d.cycles = d.cycles.filter(c=>c.startDate!==startDate); }); showToast('Period removed'); setModal(null); };
  const saveJournal = () => {
    if (!journalText.trim()) return;
    const dstr = ds(jDate);
    upd(d => { d.journal[dstr] = {date:dstr, text:journalText, ts:Date.now()}; });
    showToast('Journal saved! 📓');
  };
  const deleteJournal = dstr => { upd(d => { delete d.journal[dstr]; }); if (ds(jDate)===dstr) setJournalText(''); showToast('Entry deleted'); };

  // ── Derived values
  const cycles   = data.cycles;
  const pDays    = getPeriodDays(cycles);
  const predDays = getPredictedDays(cycles);
  const ovWin    = data.cfg?.showOvulation ? getOvWindow(cycles) : null;
  const ovDays   = (() => { const s=new Set(); if(ovWin){for(let d=new Date(ovWin.start);d<=ovWin.end;d.setDate(d.getDate()+1))s.add(ds(new Date(d)));} return s; })();
  const np       = getNextPeriod(cycles);
  const cDay     = getCycleDay(cycles);
  const cPhase   = getCyclePhase(cycles);
  const acl      = avgCycleLen(cycles);
  const apl      = avgPeriodLen(cycles);

  // ── Lock screen
  const handleLockKey = k => {
    if (k==='⌫') { setLockPin(p=>p.slice(0,-1)); return; }
    if (lockPin.length >= 4) return;
    const np2 = lockPin + k; setLockPin(np2);
    if (np2.length === 4) setTimeout(() => {
      if (np2 === data.cfg.pin) { setLocked(false); setLockPin(''); setLockErr(''); }
      else { setLockErr('Incorrect PIN. Try again.'); setLockPin(''); }
    }, 180);
  };

  if (locked) return (
    <>
      <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600&family=Nunito:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />
      <style>{`*{box-sizing:border-box;margin:0;padding:0;}html,body{height:100%;}`}</style>
      <div style={{ position:'fixed',inset:0,background:`linear-gradient(160deg,${T.light} 0%,${T.lavender} 100%)`,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:24,padding:'40px 32px',fontFamily:"'Nunito',sans-serif" }}>
        <div style={{ textAlign:'center' }}>
          <div style={{ fontSize:52,fontFamily:"'Cormorant Garamond',serif",fontWeight:600,color:T.primary }}>🌸 Bloom</div>
          <div style={{ fontSize:13,color:T.muted,marginTop:-4 }}>Enter your PIN to continue</div>
        </div>
        <div style={{ display:'flex', gap:16 }}>
          {[0,1,2,3].map(i=><div key={i} style={{ width:16,height:16,borderRadius:'50%',border:`2px solid ${T.medium}`,background:i<lockPin.length?T.primary:'transparent',transition:'all .2s' }} />)}
        </div>
        <div style={{ color:'#c04060',fontSize:13,fontWeight:700,height:18 }}>{lockErr}</div>
        <div style={{ display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10,width:270 }}>
          {['1','2','3','4','5','6','7','8','9','⌫','0',''].map((k,i)=>(
            <button type="button" key={i} onClick={()=>k&&handleLockKey(k)} style={{ height:62,borderRadius:'50%',border:'none',background:'white',fontSize:k==='⌫'?14:22,fontWeight:700,fontFamily:"'Nunito',sans-serif",color:T.text,cursor:'pointer',boxShadow:`0 2px 12px ${T.soft}`,visibility:k===''?'hidden':'visible' }}>{k}</button>
          ))}
        </div>
      </div>
    </>
  );

  // ── Modal renderer
  const renderModal = () => {
    if (!modal) return null;
    const close = () => setModal(null);
    if (modal.type === 'care') {
      const cd = CARE_CONTENT[modal.key];
      return (
        <Backdrop T={T} onClose={close}>
          <div style={{ fontFamily:"'Cormorant Garamond',serif",fontSize:22,fontWeight:600,color:T.text,marginBottom:16 }}>{cd.title}</div>
          <div style={{ display:'flex',flexDirection:'column',gap:11 }}>
            {cd.items.map((it,i)=><div key={i} style={{ padding:14,background:it.bg,borderRadius:16 }}><div style={{ fontWeight:800,color:T.text,marginBottom:5,fontSize:13 }}>{it.label}</div><div style={{ fontSize:12,color:T.muted,lineHeight:1.65 }}>{it.desc}</div></div>)}
          </div>
          <div style={{ marginTop:12,fontSize:11,color:T.muted,textAlign:'center',fontStyle:'italic',marginBottom:14 }}>{cd.footer}</div>
          <OutBtn T={T} onClick={close}>Close</OutBtn>
        </Backdrop>
      );
    }
    if (modal.type === 'logPeriod') return <LogPeriodModal T={T} onSave={savePeriod} onClose={close} />;
    if (modal.type === 'pin')       return <PinModal T={T} data={data} upd={upd} onClose={close} showToast={showToast} />;
    return null;
  };

  // ── Shared props passed to all screens
  const sp = { T, data, cycles, pDays, predDays, ovDays, ovWin, np, cDay, cPhase, acl, apl, setScreen, setModal, showToast, upd };

  return (
    <>
      <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600&family=Nunito:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />
      <style>{`
        * { box-sizing:border-box; margin:0; padding:0; }
        html, body { height:100%; background:${T.bg}; }
        ::-webkit-scrollbar { display:none; }
        * { scrollbar-width:none; }
        input[type=range]::-webkit-slider-thumb { -webkit-appearance:none; width:22px; height:22px; border-radius:50%; background:${T.primary}; cursor:pointer; box-shadow:0 2px 8px ${T.medium}88; }
        input[type=range] { -webkit-appearance:none; cursor:pointer; }
        @keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-5px)} }
        button { -webkit-tap-highlight-color:transparent; outline:none; }
      `}</style>

      <div style={{ maxWidth:430, height:'100vh', margin:'0 auto', display:'flex', flexDirection:'column', fontFamily:"'Nunito',sans-serif", background:T.bg, position:'relative', overflow:'hidden' }}>

        {/*
          ✅ SCROLL FIX — CSS display toggle pattern
          ─────────────────────────────────────────
          Every screen sits in its own absolutely-positioned scroll container.
          We show/hide via display:'block'/'none'. The container is NEVER
          unmounted, so its scroll position is always preserved.

          ❌ OLD PATTERN (causes scroll reset):
              {screen==='home' && <HomeScreen />}
              — React unmounts HomeScreen when you leave, remounts when you return → scroll=0

          ✅ NEW PATTERN (preserves scroll):
              <div style={{display: screen==='home' ? 'block' : 'none'}}>
                <HomeScreen />
              </div>
              — HomeScreen stays mounted, only CSS visibility changes → scroll preserved
        */}
        <div style={{ flex:1, position:'relative', overflow:'hidden' }}>

          <div style={{ position:'absolute',inset:0,overflowY:'auto',display:screen==='home'    ?'block':'none',paddingBottom:84 }}>
            <HomeScreen     {...sp} />
          </div>

          <div style={{ position:'absolute',inset:0,overflowY:'auto',display:screen==='calendar'?'block':'none',paddingBottom:84 }}>
            <CalendarScreen {...sp} calDate={calDate} setCalDate={setCalDate} setLogDate={setLogDate} />
          </div>

          <div style={{ position:'absolute',inset:0,overflowY:'auto',display:screen==='log'     ?'block':'none',paddingBottom:84 }}>
            <LogScreen      {...sp} logDate={logDate} setLogDate={setLogDate} logState={logState} setLogState={setLogState} onSaveLog={saveLog} onSavePeriod={savePeriod} onDeletePeriod={deletePeriod} />
          </div>

          <div style={{ position:'absolute',inset:0,overflowY:'auto',display:screen==='care'    ?'block':'none',paddingBottom:84 }}>
            <CareScreen     {...sp} />
          </div>

          <div style={{ position:'absolute',inset:0,overflowY:'auto',display:screen==='journal' ?'block':'none',paddingBottom:84 }}>
            <JournalScreen  {...sp} jDate={jDate} setJDate={setJDate} journalText={journalText} setJournalText={setJournalText} onSave={saveJournal} onDelete={deleteJournal} />
          </div>

          <div style={{ position:'absolute',inset:0,overflowY:'auto',display:screen==='settings'?'block':'none',paddingBottom:84 }}>
            <SettingsScreen {...sp} />
          </div>

        </div>

        {/* Bottom Nav */}
        {screen !== 'settings' && (
          <nav style={{ position:'fixed',bottom:0,left:'50%',transform:'translateX(-50%)',width:'100%',maxWidth:430,background:`${T.bg}ee`,backdropFilter:'blur(20px)',WebkitBackdropFilter:'blur(20px)',borderTop:`1px solid ${T.soft}`,display:'flex',padding:'7px 0 18px',zIndex:100 }}>
            {[{id:'home',icon:'🏠',label:'Home'},{id:'calendar',icon:'📅',label:'Calendar'},{id:'log',icon:'📝',label:'Log'},{id:'care',icon:'🌸',label:'Self-Care'},{id:'journal',icon:'📓',label:'Journal'}].map(tab => {
              const act = screen === tab.id;
              return (
                <button type="button" key={tab.id} onClick={() => setScreen(tab.id)} style={{ flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:3,background:'none',border:'none',cursor:'pointer',padding:'7px 4px',fontFamily:"'Nunito',sans-serif" }}>
                  <span style={{ fontSize:21,filter:act?'none':'grayscale(.6) opacity(.45)',transition:'all .2s',position:'relative' }}>
                    {act && <span style={{ position:'absolute',inset:-5,background:T.soft,borderRadius:'50%',zIndex:-1 }} />}
                    {tab.icon}
                  </span>
                  <span style={{ fontSize:9,fontWeight:800,color:act?T.primary:T.muted,letterSpacing:'.3px' }}>{tab.label}</span>
                </button>
              );
            })}
          </nav>
        )}

        {/* Modals */}
        {renderModal()}

        {/* Toast */}
        <div style={{ position:'fixed',top:50,left:'50%',transform:`translateX(-50%) translateY(${toast.show?0:-14}px)`,background:T.text,color:'white',padding:'11px 22px',borderRadius:16,fontSize:13,fontWeight:700,zIndex:400,opacity:toast.show?1:0,transition:'all .28s ease',whiteSpace:'nowrap',fontFamily:"'Nunito',sans-serif",pointerEvents:'none' }}>
          {toast.msg}
        </div>
      </div>
    </>
  );
}

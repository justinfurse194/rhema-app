import React, { useState, useEffect, useRef } from "react";
import { db, auth } from "./firebase";
import { collection, doc, setDoc, deleteDoc, onSnapshot, query, orderBy, updateDoc } from "firebase/firestore";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "firebase/auth";

const ADMIN_EMAIL = "justin@vcachurch.ca";
const ACCENT = "#1348A0", ACCENT2 = "#1D6FD8", GOLD = "#C9A84C";
const BG = "#F4F7FB", CARD = "#FFFFFF", TEXT = "#1A2535", MUTED = "#6B7A8D";
const SPOKE_BG = "#EBF2FC", SPOKE_BORDER = "#90BAE8";

const fmt = d => { if (!d) return ""; const [y,m,day] = d.split("-"); return new Date(+y,+m-1,+day).toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"}); };
const fmtT = s => `${Math.floor(s/60).toString().padStart(2,"0")}:${(s%60).toString().padStart(2,"0")}`;
const hasContent = p => !!(p && (p.godSpoke || p.audioDataUrl || p.summary || (p.annotations && Object.keys(p.annotations).length > 0)));

const Logo = ({size=48}) => (
  <svg height={size} viewBox="0 0 620 90" xmlns="http://www.w3.org/2000/svg" style={{overflow:"visible"}}>
    <text x="0" y="52" fontFamily="Georgia,serif" fontSize="52" fontWeight="bold" fill="white" opacity="0.95">Valley</text>
    <rect x="178" y="4" width="20" height="60" rx="4" fill="#4a9eff" opacity="0.85"/>
    <rect x="188" y="4" width="20" height="60" rx="4" fill="white" opacity="0.65"/>
    <line x1="195" y1="4" x2="184" y2="64" stroke="rgba(19,72,160,0.5)" strokeWidth="2.5"/>
    <text x="220" y="52" fontFamily="Georgia,serif" fontSize="52" fontWeight="bold" fill="white" opacity="0.95">Christian</text>
    <text x="188" y="96" fontFamily="Georgia,serif" fontSize="28" fill="white" opacity="0.6" letterSpacing="4" textAnchor="middle">ASSEMBLY</text>
  </svg>
);

const S = {
  app: {fontFamily:"Georgia,serif", background:BG, minHeight:"100vh", color:TEXT},
  hdr: {background:`linear-gradient(135deg,${ACCENT},${ACCENT2})`, color:"#fff", padding:"12px 16px", display:"flex", alignItems:"center", justifyContent:"space-between", boxShadow:"0 2px 12px rgba(19,72,160,0.3)"},
  body: {maxWidth:680, margin:"0 auto", padding:"16px 12px 120px"},
  btn: (bg,col="#fff",pad="10px 20px") => ({background:bg, color:col, border:"none", borderRadius:8, padding:pad, fontFamily:"Georgia,serif", fontSize:14, cursor:"pointer", fontWeight:"bold"}),
  oBtn: (col=ACCENT) => ({background:"transparent", color:col, border:`1.5px solid ${col}`, borderRadius:8, padding:"8px 16px", fontFamily:"Georgia,serif", fontSize:13, cursor:"pointer", fontWeight:"bold"}),
  card: (left=ACCENT) => ({background:CARD, borderRadius:12, padding:18, marginBottom:14, boxShadow:"0 2px 8px rgba(0,0,0,0.07)", borderLeft:`4px solid ${left}`}),
  lbl: {fontSize:12, fontWeight:"bold", color:ACCENT, textTransform:"uppercase", letterSpacing:.8, marginBottom:6, display:"block"},
  inp: {width:"100%", padding:"10px 12px", borderRadius:8, border:"1px solid #D0DAE8", fontFamily:"Georgia,serif", fontSize:14, boxSizing:"border-box", background:"#FAFCFF"},
  ta: (r=4) => ({width:"100%", padding:"10px 12px", borderRadius:8, border:"1px solid #D0DAE8", fontFamily:"Georgia,serif", fontSize:14, resize:"vertical", boxSizing:"border-box", background:"#FAFCFF", minHeight:r*28}),
  sec: {fontSize:12, fontWeight:"bold", color:MUTED, textTransform:"uppercase", letterSpacing:1, marginBottom:10, borderBottom:"1px solid #DDE4EE", paddingBottom:6},
  tag: (bg="#E0ECFA",col=ACCENT) => ({display:"inline-block", background:bg, color:col, borderRadius:20, padding:"2px 10px", fontSize:12, marginRight:6, marginBottom:4}),
  empty: {textAlign:"center", padding:"60px 20px", color:MUTED},
};

const Hdr = ({user, isAdmin, setMode, right}) => (
  <div style={S.hdr}>
    <div style={{flex:1, minWidth:0}}>
      <div style={{cursor:"pointer", display:"inline-block"}} onClick={() => setMode(isAdmin?"admin":"congregation")}>
        <div style={{fontSize:17, fontWeight:"bold", letterSpacing:1}}>Rhema</div>
        <div style={{fontSize:10, opacity:.75}}>God's word for you</div>
      </div>
    </div>
    <div style={{flex:"0 0 auto", padding:"0 10px"}}><Logo size={26}/></div>
    <div style={{flex:1, display:"flex", justifyContent:"flex-end", alignItems:"center", gap:6, minWidth:0}}>
      {right}
      {user && <button onClick={() => { signOut(auth); setMode("splash"); }} style={{background:"rgba(255,255,255,0.15)", border:"1px solid rgba(255,255,255,0.3)", color:"#fff", borderRadius:6, padding:"5px 8px", fontFamily:"Georgia,serif", fontSize:11, cursor:"pointer"}}>Sign Out</button>}
    </div>
  </div>
);

const Modal = ({onClose, title, children}) => (
  <div style={{position:"fixed", inset:0, background:"rgba(0,0,0,0.55)", zIndex:300, display:"flex", alignItems:"flex-end", justifyContent:"center"}} onClick={e => e.target===e.currentTarget && onClose()}>
    <div style={{background:CARD, borderRadius:"18px 18px 0 0", padding:24, width:"100%", maxWidth:680, boxShadow:"0 -4px 24px rgba(0,0,0,0.2)", maxHeight:"85vh", overflowY:"auto"}}>
      <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16}}>
        <div style={{fontWeight:"bold", color:ACCENT, fontSize:16}}>{title}</div>
        <button onClick={onClose} style={{background:"none", border:"none", fontSize:22, cursor:"pointer", color:MUTED, padding:4}}>✕</button>
      </div>
      {children}
    </div>
  </div>
);

export default function App() {
  const [mode, setMode] = useState("splash");
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [sermons, setSermons] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, u => {
      setUser(u);
      const admin = u?.email === ADMIN_EMAIL;
      setIsAdmin(admin);
      setLoading(false);
      if (u && admin) setMode("admin");
      else if (u) setMode("congregation");
      else setMode("splash");
    });
  }, []);

  useEffect(() => {
    return onSnapshot(query(collection(db,"sermons"), orderBy("date","desc")), snap => {
      setSermons(snap.docs.map(d => ({id:d.id, ...d.data()})));
    });
  }, []);

  if (loading) return <div style={{...S.app, display:"flex", alignItems:"center", justifyContent:"center"}}><div style={{textAlign:"center", color:MUTED}}><Logo size={60}/><br/><br/>Loading...</div></div>;

  const hdrProps = {user, isAdmin, setMode};

  if (mode==="splash") return <Splash {...hdrProps} setMode={setMode}/>;
  if (mode==="login") return <Auth mode="login" {...hdrProps} setMode={setMode}/>;
  if (mode==="register") return <Auth mode="register" {...hdrProps} setMode={setMode}/>;
  if (mode==="admin" && isAdmin) return <Admin {...hdrProps} sermons={sermons} setMode={setMode}/>;
  if (mode==="congregation" && user) return <Cong {...hdrProps} sermons={sermons} selected={selected} setSelected={setSelected} setMode={setMode}/>;
  return <Splash {...hdrProps} setMode={setMode}/>;
}

function Splash({user, isAdmin, setMode}) {
  return (
    <div style={S.app}>
      <Hdr user={user} isAdmin={isAdmin} setMode={setMode} right={null}/>
      <div style={S.body}>
        <div style={{textAlign:"center", padding:"32px 0"}}>
          <h1 style={{margin:"0 0 4px", fontSize:32, color:ACCENT, letterSpacing:1}}>Rhema</h1>
          <p style={{color:MUTED, fontSize:15, margin:"0 0 28px"}}>God's word for you</p>
          <button style={{...S.btn(`linear-gradient(135deg,${ACCENT},${ACCENT2})`), display:"block", width:"100%", maxWidth:300, margin:"0 auto 12px", padding:"14px", fontSize:16, borderRadius:10}}
            onClick={() => setMode(user?(isAdmin?"admin":"congregation"):"login")}>
            {user ? "Continue" : "Sign In"}
          </button>
          {!user && <button style={{...S.btn("transparent",ACCENT,"12px"), display:"block", width:"100%", maxWidth:300, margin:"0 auto", border:`1.5px solid ${ACCENT}`, borderRadius:10, fontSize:15}} onClick={() => setMode("register")}>Create Account</button>}
        </div>
      </div>
    </div>
  );
}

function Auth({mode, user, isAdmin, setMode}) {
  const [email,setEmail]=useState(""); const [pass,setPass]=useState(""); const [err,setErr]=useState(""); const [busy,setBusy]=useState(false);
  const isLogin = mode==="login";
  const handle = async () => {
    setErr(""); setBusy(true);
    try { if (isLogin) await signInWithEmailAndPassword(auth,email,pass); else await createUserWithEmailAndPassword(auth,email,pass); }
    catch(e) { setErr(e.message.replace("Firebase: ","").replace(/\(auth.*\)/,"")); }
    setBusy(false);
  };
  return (
    <div style={S.app}>
      <Hdr user={user} isAdmin={isAdmin} setMode={setMode} right={<button style={{...S.btn("transparent"),"color":"rgba(255,255,255,0.7)", padding:"5px 0"}} onClick={() => setMode("splash")}>Back</button>}/>
      <div style={{...S.body, maxWidth:400}}>
        <div style={{textAlign:"center", padding:"28px 0 20px"}}><Logo size={52}/><h2 style={{margin:"10px 0 4px", color:ACCENT}}>{isLogin?"Welcome Back":"Create Account"}</h2><p style={{color:MUTED, fontSize:14}}>{isLogin?"Sign in to see your sermon notes":"Join Rhema to save your sermon notes"}</p></div>
        {err && <div style={{background:"#FEE2E2", color:"#B91C1C", padding:"10px 14px", borderRadius:8, marginBottom:14, fontSize:13}}>{err}</div>}
        <div style={{marginBottom:12}}><label style={S.lbl}>Email</label><input style={S.inp} type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="your@email.com"/></div>
        <div style={{marginBottom:20}}><label style={S.lbl}>Password</label><input style={S.inp} type="password" value={pass} onChange={e=>setPass(e.target.value)} placeholder="Password" onKeyDown={e=>e.key==="Enter"&&handle()}/></div>
        <button style={{...S.btn(`linear-gradient(135deg,${ACCENT},${ACCENT2})`), width:"100%", padding:"12px"}} onClick={handle} disabled={busy}>{busy?"Please wait...":isLogin?"Sign In":"Create Account"}</button>
        <p style={{textAlign:"center", color:MUTED, fontSize:13, marginTop:16}}>{isLogin?"Don't have an account? ":"Already have an account? "}<span style={{color:ACCENT, cursor:"pointer", fontWeight:"bold"}} onClick={()=>setMode(isLogin?"register":"login")}>{isLogin?"Create one":"Sign In"}</span></p>
      </div>
    </div>
  );
}

function Admin({user, isAdmin, setMode, sermons}) {
  const [view,setView]=useState("list"); const [cur,setCur]=useState(null);
  const hc=(f,v)=>setCur(p=>({...p,[f]:v}));
  const empty=()=>({date:new Date().toISOString().split("T")[0],title:"",speaker:"",scriptures:"",notes:"",published:false});
  const save=async()=>{ if(!cur.title.trim()) return alert("Please enter a title."); if(cur.id) await updateDoc(doc(db,"sermons",cur.id),cur); else { const r=doc(collection(db,"sermons")); await setDoc(r,{...cur,id:r.id}); } setView("list"); };
  const del=async id=>{ if(!window.confirm("Delete?")) return; await deleteDoc(doc(db,"sermons",id)); setView("list"); };
  if (view==="list") return (
    <div style={S.app}>
      <Hdr user={user} isAdmin={isAdmin} setMode={setMode} right={<button style={S.btn(GOLD)} onClick={()=>{setCur(empty());setView("edit");}}>+ New</button>}/>
      <div style={S.body}>
        {sermons.length===0 ? <div style={S.empty}><div style={{fontSize:40,marginBottom:12}}>📋</div><p>No sermons yet.</p><button style={S.btn(ACCENT)} onClick={()=>{setCur(empty());setView("edit");}}>Create Sermon</button></div>
        : sermons.map(s=>(
          <div key={s.id} style={S.card(s.published?"#22C55E":"#AAA")}>
            <div style={{display:"flex", justifyContent:"space-between", alignItems:"flex-start"}}>
              <div style={{flex:1}}><div style={{fontWeight:"bold", fontSize:15, marginBottom:3}}>{s.title}</div><div style={{color:MUTED, fontSize:12, marginBottom:8}}>{s.speaker&&s.speaker+" · "}{fmt(s.date)}</div><span style={S.tag(s.published?"#DCFCE7":"#F3F4F6",s.published?"#166534":"#6B7280")}>{s.published?"✅ Published":"⏸ Draft"}</span></div>
              <div style={{display:"flex", gap:6, marginLeft:10}}><button style={S.oBtn(ACCENT)} onClick={()=>{setCur({...s});setView("edit");}}>Edit</button><button style={S.oBtn(s.published?"#888":"#22C55E")} onClick={async()=>await updateDoc(doc(db,"sermons",s.id),{published:!s.published})}>{s.published?"Unpublish":"Publish"}</button></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
  return (
    <div style={S.app}>
      <Hdr user={user} isAdmin={isAdmin} setMode={setMode} right={<button style={S.btn(GOLD)} onClick={save}>Save</button>}/>
      <div style={S.body}>
        <div style={{...S.card(), marginBottom:20}}>
          <div style={S.sec}>Sermon Details</div>
          <div style={{marginBottom:12}}><label style={S.lbl}>Sermon Title *</label><input style={S.inp} value={cur.title} onChange={e=>hc("title",e.target.value)} placeholder="e.g. Walking in Faith"/></div>
          <div style={{display:"flex", gap:12, marginBottom:12}}>
            <div style={{flex:1}}><label style={S.lbl}>Speaker</label><input style={S.inp} value={cur.speaker} onChange={e=>hc("speaker",e.target.value)} placeholder="Speaker name"/></div>
            <div style={{flex:1}}><label style={S.lbl}>Date</label><input style={S.inp} type="date" value={cur.date} onChange={e=>hc("date",e.target.value)}/></div>
          </div>
          <div style={{marginBottom:12}}><label style={S.lbl}>Scripture References</label><input style={S.inp} value={cur.scriptures} onChange={e=>hc("scriptures",e.target.value)} placeholder="e.g. John 3:16"/></div>
          <div><label style={S.lbl}>Sermon Notes</label><textarea style={S.ta(10)} value={cur.notes} onChange={e=>hc("notes",e.target.value)} placeholder="Full sermon notes..."/></div>
        </div>
        <div style={{display:"flex", gap:10, paddingBottom:40}}>
          <button style={{...S.btn(ACCENT), flex:1}} onClick={save}>Save</button>
          {cur.id && <button style={{...S.btn("#FEE2E2"), color:"#B91C1C"}} onClick={()=>del(cur.id)}>Delete</button>}
        </div>
      </div>
    </div>
  );
}

function Cong({user, isAdmin, setMode, sermons, selected, setSelected}) {
  const pub = sermons.filter(s=>s.published);
  const [pMap,setPMap] = useState({});
  useEffect(()=>{ if(!user) return; return onSnapshot(collection(db,"users",user.uid,"entries"),snap=>{ const m={}; snap.docs.forEach(d=>{m[d.id]=d.data();}); setPMap(m); }); },[user]);
  if (!selected) return (
    <div style={S.app}>
      <Hdr user={user} isAdmin={isAdmin} setMode={setMode} right={null}/>
      <div style={S.body}>
        {pub.length===0 ? <div style={S.empty}><div style={{fontSize:44,marginBottom:12}}>🕊️</div><p>No sermons available yet.</p></div>
        : pub.map(s=>{ const p=pMap[s.id]; return (
          <div key={s.id} style={{...S.card(), cursor:"pointer"}} onClick={()=>setSelected(s.id)}>
            <div style={{display:"flex", justifyContent:"space-between", alignItems:"flex-start"}}>
              <div style={{flex:1}}>
                <div style={{fontWeight:"bold", fontSize:16, marginBottom:3}}>{s.title}</div>
                <div style={{color:MUTED, fontSize:13, marginBottom:8}}>{s.speaker&&s.speaker+" · "}{fmt(s.date)}</div>
                {s.scriptures && <span style={S.tag()}>📖 {s.scriptures.split(",")[0].trim()}</span>}
                {p?.audioDataUrl && <span style={S.tag("#E0F0FF","#1565A8")}>🎙️ Audio</span>}
                {p?.summary && <span style={S.tag("#FFFBEF","#8A6E2F")}>⭐ Summary</span>}
                {p?.godSpoke && <span style={S.tag(SPOKE_BG,"#1A4A80")}>📖 My Word</span>}
                {hasContent(p) && <span style={S.tag("#F0FDF4","#166534")}>✓ Saved</span>}
              </div>
              <div style={{color:"#CCC", fontSize:20}}>›</div>
            </div>
          </div>
        );})}
      </div>
    </div>
  );
  const sermon = sermons.find(s=>s.id===selected);
  if (!sermon) { setSelected(null); return null; }
  return <Detail sermon={sermon} user={user} p0={pMap[sermon.id]||{godSpoke:"",audioDataUrl:null,summary:"",shared:false,annotations:{}}} back={()=>setSelected(null)}/>;
}

function Detail({sermon, user, p0, back}) {
  const pid = sermon.id;
  const [p,setP] = useState(p0);
  const [audio,setAudio] = useState(p0.audioDataUrl||null);
  const [rec,setRec] = useState(false);
  const [rt,setRt] = useState(0);
  const [gl,setGl] = useState(false);
  const [shared,setShared] = useState([]);
  const [anno,setAnno] = useState(p0.annotations||{});
  const [noteMod,setNoteMod] = useState(null);
  const [noteText,setNoteText] = useState("");
  const [gsMod,setGsMod] = useState(false);
  const [sumMod,setSumMod] = useState(false);
  const [godSpoke,setGodSpoke] = useState(p0.godSpoke||"");
  const [summary,setSummary] = useState(p0.summary||"");
  const mrRef=useRef(null); const streamRef=useRef(null); const chunks=useRef([]); const timerRef=useRef(null);

  useEffect(()=>{ return onSnapshot(collection(db,"shared",pid,"entries"),snap=>setShared(snap.docs.map(d=>d.data()))); },[pid]);

  const save = async upd => {
    const e={...p,...upd,audioDataUrl:audio,annotations:anno};
    setP(e);
    if(hasContent(e)) await setDoc(doc(db,"users",user.uid,"entries",pid),e);
  };

  const saveAnno = async na => {
    setAnno(na);
    const e={...p,audioDataUrl:audio,annotations:na};
    if(hasContent(e)) await setDoc(doc(db,"users",user.uid,"entries",pid),e);
  };

  const startRec = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({audio:true});
      streamRef.current = stream; chunks.current = [];
      const opts = MediaRecorder.isTypeSupported("audio/mp4")?{mimeType:"audio/mp4"}:MediaRecorder.isTypeSupported("audio/webm")?{mimeType:"audio/webm"}:{};
      const mr = new MediaRecorder(stream, opts);
      mrRef.current = mr;
      mr.ondataavailable = e => { if(e.data&&e.data.size>0) chunks.current.push(e.data); };
      mr.onstop = async () => {
        setRec(false); clearInterval(timerRef.current);
        if(!chunks.current.length) return;
        const blob = new Blob(chunks.current,{type:mr.mimeType||"audio/webm"});
        const reader = new FileReader();
        reader.onload = async () => {
          const b64 = reader.result; setAudio(b64);
          const e={...p,audioDataUrl:b64,annotations:anno}; setP(e);
          await setDoc(doc(db,"users",user.uid,"entries",pid),e);
        };
        reader.readAsDataURL(blob);
        stream.getTracks().forEach(t=>t.stop()); streamRef.current=null;
      };
      mr.start(500); setRec(true); setRt(0);
      timerRef.current = setInterval(()=>setRt(t=>t+1),1000);
    } catch { alert("Microphone access denied. Please allow microphone access in your browser settings."); }
  };

  const stopRec = () => {
    clearInterval(timerRef.current);
    try { if(mrRef.current?.state==="recording") mrRef.current.stop(); } catch {}
    if(streamRef.current) { streamRef.current.getTracks().forEach(t=>t.stop()); streamRef.current=null; }
    setRec(false);
  };

  const delAudio = async () => {
    if(!window.confirm("Delete recording?")) return;
    setAudio(null);
    const e={...p,audioDataUrl:null,annotations:anno}; setP(e);
    await setDoc(doc(db,"users",user.uid,"entries",pid),e);
  };

  const genSummary = async () => {
  setGl(true);
  try {
    const res = await fetch("/api/summary",{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:1000,messages:[{role:"user",content:`Write a warm 3-4 sentence summary in second person to help this person remember and apply the message.\n\nSermon: ${sermon.title}\nSpeaker: ${sermon.speaker}\nScriptures: ${sermon.scriptures}\nNotes: ${sermon.notes}\nHow God Spoke: ${godSpoke}`}]})
    });
    const data = await res.json();
    const text = data.content?data.content.map(b=>b.text||"").join(""):"Could not generate summary.";
    setSummary(text); await save({summary:text,godSpoke});
  } catch { setSummary("Error generating summary."); }
  setGl(false);
};

  const saveGs = async () => { await save({godSpoke,summary}); setGsMod(false); };

  const toggleShare = async () => {
    const next=!p.shared; await save({shared:next,godSpoke,summary});
    const ref=doc(db,"shared",pid,"entries",user.uid);
    if(next&&godSpoke) await setDoc(ref,{email:user.email,text:godSpoke}); else await deleteDoc(ref);
  };

  const saveNote = async () => {
    if(!noteText.trim()){setNoteMod(null);return;}
    const na={...anno,[noteMod.i]:noteText.trim()};
    await saveAnno(na); setNoteMod(null); setNoteText("");
  };

  const delNote = async i => { const na={...anno}; delete na[i]; await saveAnno(na); };

  const paras = sermon.notes?sermon.notes.split("\n").filter(l=>l.trim()):[];

  return (
    <div style={{...S.app, paddingBottom:0}}>
      {/* Action bar — replaces header */}
      <div style={{background:`linear-gradient(135deg,${ACCENT},${ACCENT2})`, display:"flex", boxShadow:"0 2px 12px rgba(19,72,160,0.3)", position:"sticky", top:0, zIndex:100}}>
        {[
          {icon:"📖", label:"God Spoke", onClick:()=>setGsMod(true), bg: godSpoke?"rgba(255,255,255,0.2)":"transparent"},
          {icon:"⭐", label:"Summary", onClick:()=>setSumMod(true), bg: summary?"rgba(255,255,255,0.2)":"transparent"},
          {icon:rec?"⏹":"⏺", label:rec?`Stop ${fmtT(rt)}`:"Record", onClick:rec?stopRec:startRec, bg:rec?"rgba(239,68,68,0.8)":"transparent"},
        ].map(b=>(
          <button key={b.label} onClick={b.onClick} style={{flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:3, padding:"10px 4px", background:b.bg, border:"none", cursor:"pointer", borderRight:"1px solid rgba(255,255,255,0.1)", animation:rec&&b.label.startsWith("Stop")?"pulse 1s infinite":"none"}}>
            <span style={{fontSize:20}}>{b.icon}</span>
            <span style={{fontSize:9, color:"#fff", fontFamily:"Georgia,serif", fontWeight:"bold", letterSpacing:.3, whiteSpace:"nowrap"}}>{b.label}</span>
          </button>
        ))}
      </div>

      <div style={S.body}>
        {/* Sermon title */}
        <h2 style={{margin:"0 0 3px", fontSize:20}}>{sermon.title}</h2>
        <div style={{color:MUTED, fontSize:13, marginBottom:8}}>{sermon.speaker&&sermon.speaker+" · "}{fmt(sermon.date)}</div>
        {sermon.scriptures&&sermon.scriptures.split(",").map((sc,i)=><span key={i} style={S.tag()}>📖 {sc.trim()}</span>)}

        {/* Saved content */}
        {audio && (
          <div style={{background:"#F0F6FF", border:"1.5px solid #90BAE8", borderRadius:12, padding:14, marginTop:14, marginBottom:12}}>
            <div style={S.sec}>🎙️ Your Recording</div>
            <audio controls src={audio} style={{width:"100%", marginBottom:8}} preload="auto"/>
            <button style={{...S.btn("#FEE2E2","#B91C1C","6px 12px"), fontSize:12}} onClick={delAudio}>Delete</button>
          </div>
        )}

        {rec && (
          <div style={{background:"#FEF2F2", border:"1.5px solid #FCA5A5", borderRadius:12, padding:12, marginTop:14, marginBottom:12, display:"flex", alignItems:"center", gap:10}}>
            <div style={{width:10,height:10,borderRadius:"50%",background:"#EF4444",animation:"pulse 1s infinite",flexShrink:0}}/>
            <span style={{color:"#EF4444", fontWeight:"bold"}}>Recording {fmtT(rt)}</span>
            <button style={{...S.btn("#EF4444","#fff","6px 14px"), marginLeft:"auto"}} onClick={stopRec}>⏹ Stop</button>
          </div>
        )}

        {godSpoke && (
          <div style={{background:SPOKE_BG, border:`2px solid ${SPOKE_BORDER}`, borderRadius:12, padding:14, marginTop:audio||rec?0:14, marginBottom:12, cursor:"pointer"}} onClick={()=>setGsMod(true)}>
            <div style={S.sec}>📖 How God Spoke to Me <span style={{color:ACCENT, fontSize:10, fontStyle:"italic", textTransform:"none"}}>tap to edit</span></div>
            <div style={{fontSize:14, color:"#1A3A60", fontStyle:"italic", lineHeight:1.7}}>"{godSpoke}"</div>
          </div>
        )}

        {summary && (
          <div style={{background:"#FFFBEF", border:`1.5px solid ${GOLD}`, borderRadius:12, padding:14, marginBottom:12, cursor:"pointer"}} onClick={()=>setSumMod(true)}>
            <div style={S.sec}>⭐ AI Summary <span style={{color:GOLD, fontSize:10, fontStyle:"italic", textTransform:"none"}}>tap to regenerate</span></div>
            <div style={{fontSize:14, color:"#5A4A20", lineHeight:1.7}}>{summary}</div>
          </div>
        )}

        {/* Pastor's notes */}
        <div style={{...S.card("#22C55E"), marginTop: godSpoke||summary||audio||rec ? 0 : 14}}>
          <div style={S.sec}>📋 Pastor's Notes</div>
          {paras.length===0 ? <div style={{color:MUTED, fontStyle:"italic"}}>No notes provided yet.</div>
          : paras.map((para,i)=>(
            <div key={i} style={{marginBottom:14}}>
              <div style={{display:"flex", alignItems:"flex-start", gap:8}}>
                <div style={{fontSize:15, lineHeight:1.8, flex:1}}>{para}</div>
                <button onClick={()=>{setNoteMod({i,existing:anno[i]||""});setNoteText(anno[i]||"");}} style={{background:anno[i]?"#DBEAFE":"#F1F5F9", border:"none", borderRadius:6, width:30, height:30, cursor:"pointer", fontSize:15, flexShrink:0, marginTop:4, display:"flex", alignItems:"center", justifyContent:"center", boxShadow:"0 1px 3px rgba(0,0,0,0.1)"}}>
                  {anno[i]?"✏️":"+"}
                </button>
              </div>
              {anno[i] && (
                <div style={{marginTop:6, padding:"8px 12px", background:"#EFF6FF", borderRadius:8, borderLeft:"3px solid #3B82F6", display:"flex", alignItems:"flex-start", gap:8}}>
                  <span style={{color:"#1D4ED8", fontStyle:"italic", fontSize:14, flex:1}}>[ {anno[i]} ]</span>
                  <button onClick={()=>delNote(i)} style={{background:"none", border:"none", color:"#93C5FD", cursor:"pointer", fontSize:14, padding:0}}>✕</button>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Congregation shares */}
        {shared.length>0 && (
          <div style={{marginTop:14}}>
            <div style={S.sec}>🙌 From the Congregation</div>
            {shared.map((e,i)=>(
              <div key={i} style={{...S.card(SPOKE_BORDER), padding:"12px 16px"}}>
                <div style={{fontSize:11, color:MUTED, marginBottom:4}}>{e.email}</div>
                <div style={{fontSize:14, color:"#1A3A60", fontStyle:"italic", lineHeight:1.7}}>"{e.text}"</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* God Spoke Modal */}
      {gsMod && (
        <Modal onClose={()=>setGsMod(false)} title="📖 How God Spoke to Me">
          <p style={{color:MUTED, fontSize:13, fontStyle:"italic", marginBottom:12}}>What did the Holy Spirit highlight for you in today's message?</p>
          <textarea style={S.ta(5)} value={godSpoke} onChange={e=>setGodSpoke(e.target.value)} placeholder="Lord, through today's message you showed me..." autoFocus/>
          <button style={{...S.btn(ACCENT), width:"100%", padding:"12px", marginTop:12}} onClick={saveGs}>Save</button>
          <div style={{display:"flex", alignItems:"center", gap:10, marginTop:14, padding:"12px 14px", background:SPOKE_BG, borderRadius:10}}>
            <div style={{flex:1}}><div style={{fontWeight:"bold", fontSize:13, color:"#1A4A80"}}>Share with congregation</div><div style={{fontSize:11, color:MUTED}}>Let others see what God spoke to you</div></div>
            <div onClick={toggleShare} style={{width:44,height:24,borderRadius:12,background:p.shared?ACCENT:"#CBD5E1",cursor:"pointer",position:"relative",transition:"background .2s"}}>
              <div style={{position:"absolute",top:3,left:p.shared?22:3,width:18,height:18,borderRadius:9,background:"#fff",transition:"left .2s",boxShadow:"0 1px 3px rgba(0,0,0,.2)"}}/>
            </div>
          </div>
        </Modal>
      )}

      {/* Summary Modal */}
      {sumMod && (
        <Modal onClose={()=>setSumMod(false)} title="⭐ AI Summary">
          {gl && <div style={{color:MUTED, fontStyle:"italic", textAlign:"center", padding:"20px 0"}}>Reflecting on the message... ⭐</div>}
          {summary&&!gl && <div style={{fontSize:15, lineHeight:1.8, color:"#5A4A20", marginBottom:16}}>{summary}</div>}
          {!summary&&!gl && <div style={{color:MUTED, fontSize:14, fontStyle:"italic", textAlign:"center", padding:"10px 0 16px"}}>Tap below to generate your personal AI recap.</div>}
          <button style={{...S.btn(gl?"#CCC":GOLD), width:"100%", padding:"12px"}} onClick={genSummary} disabled={gl}>
            {gl?"Generating...":summary?"Regenerate Summary":"Generate Summary"}
          </button>
        </Modal>
      )}

      {/* Note Modal */}
      {noteMod && (
        <Modal onClose={()=>setNoteMod(null)} title="📝 Personal Note">
          <textarea style={S.ta(4)} value={noteText} onChange={e=>setNoteText(e.target.value)} placeholder="Write your personal note or reflection..." autoFocus/>
          <div style={{display:"flex", gap:10, marginTop:12}}>
            <button style={{...S.btn(ACCENT), flex:1}} onClick={saveNote}>Save Note</button>
            {noteMod.existing && <button style={{...S.btn("#FEE2E2","#B91C1C")}} onClick={()=>{delNote(noteMod.i);setNoteMod(null);}}>Delete</button>}
            <button style={S.btn("#F1F5F9","#6B7A8D")} onClick={()=>setNoteMod(null)}>Cancel</button>
          </div>
        </Modal>
      )}

      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}} *{-webkit-tap-highlight-color:transparent;} audio{border-radius:8px;}`}</style>
    </div>
  );
}

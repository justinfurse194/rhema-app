import React, { useState, useEffect, useRef } from "react";
import { db, auth } from "./firebase";
import {
  collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, onSnapshot, query, orderBy
} from "firebase/firestore";
import {
  createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged
} from "firebase/auth";

// ─── Constants ────────────────────────────────────────────────
const ADMIN_EMAIL = "justin@vcachurch.ca";
const ANTHROPIC_KEY = process.env.REACT_APP_ANTHROPIC_KEY;

const ACCENT  = "#1348A0";
const ACCENT2 = "#1D6FD8";
const GOLD    = "#C9A84C";
const BG      = "#F4F7FB";
const CARD    = "#FFFFFF";
const TEXT    = "#1A2535";
const MUTED   = "#6B7A8D";
const SPOKE_BG     = "#EBF2FC";
const SPOKE_BORDER = "#90BAE8";

const fmt = (d) => {
  if (!d) return "";
  const [y,m,day] = d.split("-");
  return new Date(+y,+m-1,+day).toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"});
};
const fmtTime = s => `${Math.floor(s/60).toString().padStart(2,"0")}:${(s%60).toString().padStart(2,"0")}`;
const hasContent = (p) => !!(p && (p.godSpoke || p.keyQuotes || p.actionPoints || p.audioDataUrl || p.summary));

const VCALogo = ({ size = 48 }) => (
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
  app:  { fontFamily:"Georgia,serif", background:BG, minHeight:"100vh", color:TEXT },
  hdr:  { background:`linear-gradient(135deg, ${ACCENT} 0%, ${ACCENT2} 100%)`, color:"#fff", padding:"14px 20px", display:"flex", alignItems:"center", justifyContent:"space-between", boxShadow:"0 2px 12px rgba(19,72,160,0.3)" },
  body: { maxWidth:680, margin:"0 auto", padding:"20px 16px" },
  btn:  (bg, col="#fff", pad="10px 20px") => ({ background:bg, color:col, border:"none", borderRadius:8, padding:pad, fontFamily:"Georgia,serif", fontSize:14, cursor:"pointer", fontWeight:"bold" }),
  oBtn: (col=ACCENT) => ({ background:"transparent", color:col, border:`1.5px solid ${col}`, borderRadius:8, padding:"8px 16px", fontFamily:"Georgia,serif", fontSize:13, cursor:"pointer", fontWeight:"bold" }),
  card: (left=ACCENT) => ({ background:CARD, borderRadius:12, padding:18, marginBottom:14, boxShadow:"0 2px 8px rgba(0,0,0,0.07)", borderLeft:`4px solid ${left}` }),
  lbl:  { fontSize:12, fontWeight:"bold", color:ACCENT, textTransform:"uppercase", letterSpacing:.8, marginBottom:6, display:"block" },
  inp:  { width:"100%", padding:"10px 12px", borderRadius:8, border:"1px solid #D0DAE8", fontFamily:"Georgia,serif", fontSize:14, boxSizing:"border-box", background:"#FAFCFF" },
  ta:   (rows=4) => ({ width:"100%", padding:"10px 12px", borderRadius:8, border:"1px solid #D0DAE8", fontFamily:"Georgia,serif", fontSize:14, resize:"vertical", boxSizing:"border-box", background:"#FAFCFF", minHeight:rows*28 }),
  sec:  { fontSize:12, fontWeight:"bold", color:MUTED, textTransform:"uppercase", letterSpacing:1, marginBottom:10, borderBottom:"1px solid #DDE4EE", paddingBottom:6 },
  tag:  (bg="#E0ECFA", col=ACCENT) => ({ display:"inline-block", background:bg, color:col, borderRadius:20, padding:"2px 10px", fontSize:12, marginRight:6, marginBottom:4 }),
  spoke:{ background:SPOKE_BG, border:`2px solid ${SPOKE_BORDER}`, borderRadius:12, padding:18, marginBottom:20 },
  sum:  { background:"#FFFBEF", border:`1.5px solid ${GOLD}`, borderRadius:12, padding:18, marginTop:16 },
  rec:  { background:"#F0F6FF", border:"1.5px solid #90BAE8", borderRadius:12, padding:16, marginBottom:20 },
  empty:{ textAlign:"center", padding:"60px 20px", color:MUTED },
};

export default function App() {
  const [mode, setMode]         = useState("splash");
  const [user, setUser]         = useState(null);
  const [isAdmin, setIsAdmin]   = useState(false);
  const [sermons, setSermons]   = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      setIsAdmin(u?.email === ADMIN_EMAIL);
      setLoading(false);
      if (u) setMode("congregation");
    });
    return unsub;
  }, []);

  useEffect(() => {
    const q = query(collection(db, "sermons"), orderBy("date", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      setSermons(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, []);

  const Header = ({ left, right }) => (
    <div style={S.hdr}>
      <div style={{flex:1, display:"flex", alignItems:"center"}}>
        <div>
          <div style={{fontSize:20, fontWeight:"bold", letterSpacing:1}}>Rhema</div>
          <div style={{fontSize:10, opacity:.75, letterSpacing:.5}}>God's word for you</div>
        </div>
      </div>
      <div style={{flex:1, display:"flex", justifyContent:"center", alignItems:"center"}}>
        <VCALogo size={32} />
      </div>
      <div style={{flex:1, display:"flex", justifyContent:"flex-end", alignItems:"center", gap:10}}>
        {right}
      </div>
    </div>
  );

  if (loading) return (
    <div style={{...S.app, display:"flex", alignItems:"center", justifyContent:"center", minHeight:"100vh"}}>
      <div style={{textAlign:"center", color:MUTED}}><VCALogo size={60} /><br/><br/>Loading...</div>
    </div>
  );

  if (mode === "splash") return <Splash setMode={setMode} user={user} isAdmin={isAdmin} Header={Header} />;
  if (mode === "login") return <AuthForm mode="login" setMode={setMode} Header={Header} />;
  if (mode === "register") return <AuthForm mode="register" setMode={setMode} Header={Header} />;
  if (mode === "admin" && isAdmin) return <AdminArea setMode={setMode} sermons={sermons} Header={Header} />;
  if (mode === "congregation" && user) return (
    <CongArea setMode={setMode} sermons={sermons} user={user} selected={selected} setSelected={setSelected} Header={Header} />
  );
  return <Splash setMode={setMode} user={user} isAdmin={isAdmin} Header={Header} />;
}

function Splash({ setMode, user, isAdmin, Header }) {
  const published = 0;
  return (
    <div style={S.app}>
      <Header left={null} right={
        <button onClick={() => setMode(isAdmin ? "admin" : "login")}
          style={{background:"transparent", border:"none", color:"rgba(255,255,255,0.3)", fontSize:11, cursor:"pointer", fontFamily:"Georgia,serif"}}>
          Admin
        </button>
      } />
      <div style={S.body}>
        <div style={{textAlign:"center", padding:"28px 0 28px"}}>
          <h1 style={{margin:"0 0 2px", fontSize:32, color:ACCENT, letterSpacing:1}}>Rhema</h1>
          <p style={{color:MUTED, fontSize:15, margin:"0 0 24px"}}>God's word for you</p>
          <button style={{...S.btn(`linear-gradient(135deg,${ACCENT},${ACCENT2})`), width:"100%", maxWidth:300, padding:"14px 20px", fontSize:16, marginBottom:12, borderRadius:10}}
            onClick={() => setMode(user ? "congregation" : "login")}>
            {user ? "Continue" : "Sign In"}
          </button>
          {!user && (
            <button style={{...S.btn("transparent", ACCENT, "12px 20px"), width:"100%", maxWidth:300, border:`1.5px solid ${ACCENT}`, borderRadius:10, fontSize:15}}
              onClick={() => setMode("register")}>
              Create Account
            </button>
          )}
          {user && (
            <button style={{...S.btn("transparent", MUTED, "8px 20px"), fontSize:13}} onClick={() => signOut(auth)}>
              Sign out
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function AuthForm({ mode, setMode, Header }) {
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr]           = useState("");
  const [loading, setLoading]   = useState(false);
  const isLogin = mode === "login";

  const handle = async () => {
    setErr(""); setLoading(true);
    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
      }
    } catch (e) {
      setErr(e.message.replace("Firebase: ", "").replace(/\(auth.*\)/, ""));
    }
    setLoading(false);
  };

  return (
    <div style={S.app}>
      <Header left={<button style={{...S.btn("transparent"), color:"#fff", padding:"6px 0"}} onClick={() => setMode("splash")}>Back</button>} right={null} />
      <div style={{...S.body, maxWidth:400}}>
        <div style={{textAlign:"center", padding:"32px 0 24px"}}>
          <VCALogo size={56} />
          <h2 style={{margin:"12px 0 4px", color:ACCENT}}>{isLogin ? "Welcome Back" : "Create Account"}</h2>
          <p style={{color:MUTED, fontSize:14}}>{isLogin ? "Sign in to see your sermon notes" : "Join Rhema to save your sermon notes"}</p>
        </div>
        {err && <div style={{background:"#FEE2E2", color:"#B91C1C", padding:"10px 14px", borderRadius:8, marginBottom:14, fontSize:13}}>{err}</div>}
        <div style={{marginBottom:12}}>
          <label style={S.lbl}>Email</label>
          <input style={S.inp} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="your@email.com" />
        </div>
        <div style={{marginBottom:20}}>
          <label style={S.lbl}>Password</label>
          <input style={S.inp} type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" onKeyDown={e => e.key === "Enter" && handle()} />
        </div>
        <button style={{...S.btn(`linear-gradient(135deg,${ACCENT},${ACCENT2})`), width:"100%", padding:"12px"}} onClick={handle} disabled={loading}>
          {loading ? "Please wait..." : isLogin ? "Sign In" : "Create Account"}
        </button>
        <p style={{textAlign:"center", color:MUTED, fontSize:13, marginTop:16}}>
          {isLogin ? "Don't have an account? " : "Already have an account? "}
          <span style={{color:ACCENT, cursor:"pointer", fontWeight:"bold"}} onClick={() => setMode(isLogin ? "register" : "login")}>
            {isLogin ? "Create one" : "Sign In"}
          </span>
        </p>
      </div>
    </div>
  );
}
function AdminArea({ setMode, sermons, Header }) {
  const [view, setView]       = useState("list");
  const [current, setCurrent] = useState(null);
  const hc = (f, v) => setCurrent(p => ({...p, [f]:v}));

  const emptyS = () => ({ date:new Date().toISOString().split("T")[0], title:"", speaker:"", scriptures:"", notes:"", published:false });

  const handleSave = async () => {
    if (!current.title.trim()) return alert("Please enter a sermon title.");
    if (current.id) {
      await updateDoc(doc(db, "sermons", current.id), current);
    } else {
      await setDoc(doc(collection(db, "sermons")), current);
    }
    setView("list");
  };

  const togglePublish = async (s) => {
    await updateDoc(doc(db, "sermons", s.id), { published: !s.published });
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this sermon?")) return;
    await deleteDoc(doc(db, "sermons", id));
    setView("list");
  };

  if (view === "list") return (
    <div style={S.app}>
      <Header
        left={<button style={{...S.btn("transparent"), color:"#fff", padding:"6px 0"}} onClick={() => setMode("splash")}>Home</button>}
        right={<button style={S.btn(GOLD)} onClick={() => { setCurrent(emptyS()); setView("edit"); }}>+ New</button>}
      />
      <div style={S.body}>
        {sermons.length === 0
          ? <div style={S.empty}><div style={{fontSize:40,marginBottom:12}}>📋</div><p>No sermons yet.</p><button style={S.btn(ACCENT)} onClick={() => { setCurrent(emptyS()); setView("edit"); }}>Create Sermon</button></div>
          : sermons.map(s => (
            <div key={s.id} style={{...S.card(s.published ? "#22C55E" : "#AAA")}}>
              <div style={{display:"flex", justifyContent:"space-between", alignItems:"flex-start"}}>
                <div style={{flex:1}}>
                  <div style={{fontWeight:"bold", fontSize:15, marginBottom:3}}>{s.title}</div>
                  <div style={{color:MUTED, fontSize:12, marginBottom:8}}>{s.speaker && s.speaker + " · "}{fmt(s.date)}</div>
                  <span style={S.tag(s.published ? "#DCFCE7":"#F3F4F6", s.published ? "#166534":"#6B7280")}>{s.published ? "✅ Published" : "⏸ Draft"}</span>
                </div>
                <div style={{display:"flex", gap:6, marginLeft:10}}>
                  <button style={S.oBtn(ACCENT)} onClick={() => { setCurrent({...s}); setView("edit"); }}>Edit</button>
                  <button style={S.oBtn(s.published ? "#888" : "#22C55E")} onClick={() => togglePublish(s)}>{s.published ? "Unpublish" : "Publish"}</button>
                </div>
              </div>
            </div>
          ))}
      </div>
    </div>
  );

  return (
    <div style={S.app}>
      <Header
        left={<button style={{...S.btn("transparent"), color:"#fff", padding:"6px 0"}} onClick={() => setView("list")}>Back</button>}
        right={<button style={S.btn(GOLD)} onClick={handleSave}>Save</button>}
      />
      <div style={S.body}>
        <div style={{...S.card(), marginBottom:20}}>
          <div style={S.sec}>Sermon Details</div>
          <div style={{marginBottom:12}}>
            <label style={S.lbl}>Sermon Title *</label>
            <input style={S.inp} value={current.title} onChange={e => hc("title", e.target.value)} placeholder="e.g. Walking in Faith" />
          </div>
          <div style={{display:"flex", gap:12, marginBottom:12}}>
            <div style={{flex:1}}>
              <label style={S.lbl}>Speaker</label>
              <input style={S.inp} value={current.speaker} onChange={e => hc("speaker", e.target.value)} placeholder="Speaker name" />
            </div>
            <div style={{flex:1}}>
              <label style={S.lbl}>Date</label>
              <input style={S.inp} type="date" value={current.date} onChange={e => hc("date", e.target.value)} />
            </div>
          </div>
          <div style={{marginBottom:12}}>
            <label style={S.lbl}>Scripture References</label>
            <input style={S.inp} value={current.scriptures} onChange={e => hc("scriptures", e.target.value)} placeholder="e.g. John 3:16, Romans 8:28" />
          </div>
          <div>
            <label style={S.lbl}>Sermon Notes</label>
            <textarea style={S.ta(8)} value={current.notes} onChange={e => hc("notes", e.target.value)} placeholder="Full sermon notes for the congregation..." />
          </div>
        </div>
        <div style={{display:"flex", gap:10, paddingBottom:40}}>
          <button style={{...S.btn(ACCENT), flex:1}} onClick={handleSave}>Save</button>
          {current.id && <button style={{...S.btn("#FEE2E2"), color:"#B91C1C"}} onClick={() => handleDelete(current.id)}>Delete</button>}
        </div>
      </div>
    </div>
  );
}

function CongArea({ setMode, sermons, user, selected, setSelected, Header }) {
  const published = sermons.filter(s => s.published);
  const [personalMap, setPersonalMap] = useState({});

  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(collection(db, "users", user.uid, "entries"), (snap) => {
      const map = {};
      snap.docs.forEach(d => { map[d.id] = d.data(); });
      setPersonalMap(map);
    });
    return unsub;
  }, [user]);

  if (!selected) return (
    <div style={S.app}>
      <Header
        left={<button style={{...S.btn("transparent"), color:"#fff", padding:"6px 0"}} onClick={() => setMode("splash")}>Home</button>}
        right={<div style={{fontSize:12, color:"rgba(255,255,255,0.7)", maxWidth:100, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>{user.email}</div>}
      />
      <div style={S.body}>
        {published.length === 0
          ? <div style={S.empty}><div style={{fontSize:44,marginBottom:12}}>🕊️</div><p style={{fontSize:15}}>No sermons available yet.</p></div>
          : published.map(s => {
            const p = personalMap[s.id];
            return (
              <div key={s.id} style={{...S.card(), cursor:"pointer"}} onClick={() => setSelected(s.id)}>
                <div style={{display:"flex", justifyContent:"space-between", alignItems:"flex-start"}}>
                  <div style={{flex:1}}>
                    <div style={{fontWeight:"bold", fontSize:16, marginBottom:3}}>{s.title}</div>
                    <div style={{color:MUTED, fontSize:13, marginBottom:8}}>{s.speaker && s.speaker + " · "}{fmt(s.date)}</div>
                    {s.scriptures && <span style={S.tag()}>📖 {s.scriptures.split(",")[0].trim()}</span>}
                    {p && p.audioDataUrl && <span style={S.tag("#E0F0FF","#1565A8")}>🎙️ Audio</span>}
                    {p && p.summary && <span style={S.tag("#FFFBEF","#8A6E2F")}>✨ Summary</span>}
                    {p && p.godSpoke && <span style={S.tag(SPOKE_BG,"#1A4A80")}>🙏 My Word</span>}
                    {hasContent(p) && <span style={S.tag("#F0FDF4","#166534")}>✓ Saved</span>}
                  </div>
                  <div style={{color:"#CCC", fontSize:20}}>›</div>
                </div>
              </div>
            );
          })}
      </div>
    </div>
  );

  const sermon = sermons.find(s => s.id === selected);
  if (!sermon) { setSelected(null); return null; }
  return (
    <SermonDetail
      sermon={sermon}
      user={user}
      personal={personalMap[sermon.id] || { godSpoke:"", keyQuotes:"", actionPoints:"", audioDataUrl:null, summary:"", shared:false }}
      back={() => setSelected(null)}
      Header={Header}
    />
  );
}

function SermonDetail({ sermon, user, personal: p0, back, Header }) {
  const pid = sermon.id;
  const [p, setP]         = useState(p0);
  const [audio, setAudio] = useState(p0.audioDataUrl || null);
  const [rec, setRec]     = useState(false);
  const [rt, setRt]       = useState(0);
  const [gl, setGl]       = useState(false);
  const [open, setOpen]   = useState(true);
  const [shared, setShared] = useState([]);
  const mrRef  = useRef(null);
  const chunks = useRef([]);
  const timer  = useRef(null);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "shared", pid, "entries"), (snap) => {
      setShared(snap.docs.map(d => d.data()));
    });
    return unsub;
  }, [pid]);

  const persist = async (updated, url) => {
    const entry = {...updated, audioDataUrl: url !== undefined ? url : audio};
    setP(entry);
    if (hasContent(entry)) {
      await setDoc(doc(db, "users", user.uid, "entries", pid), entry);
    }
  };

  const startRec = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({audio:true});
      chunks.current = [];
      const mr = new MediaRecorder(stream);
      mrRef.current = mr;
      mr.ondataavailable = e => { if(e.data.size>0) chunks.current.push(e.data); };
      mr.onstop = () => {
        const blob = new Blob(chunks.current, {type:"audio/webm"});
        const reader = new FileReader();
        reader.onload = async () => { setAudio(reader.result); await persist(p, reader.result); };
        reader.readAsDataURL(blob);
        stream.getTracks().forEach(t => t.stop());
      };
      mr.start(); setRec(true); setRt(0);
      timer.current = setInterval(() => setRt(t => t+1), 1000);
    } catch { alert("Microphone access denied."); }
  };

  const stopRec = () => { mrRef.current && mrRef.current.stop(); setRec(false); clearInterval(timer.current); };

  const delAudio = async () => {
    if(!window.confirm("Delete recording?")) return;
    setAudio(null);
    await persist(p, null);
  };

  const genSummary = async () => {
    setGl(true);
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method:"POST",
        headers:{"Content-Type":"application/json", "x-api-key": ANTHROPIC_KEY, "anthropic-version":"2023-06-01"},
        body: JSON.stringify({ model:"claude-sonnet-4-20250514", max_tokens:1000, messages:[{ role:"user", content:`You are a helpful church assistant. Write a warm 3-4 sentence summary in second person to help this person remember and apply the message.\n\nSermon: ${sermon.title}\nSpeaker: ${sermon.speaker}\nScriptures: ${sermon.scriptures}\nNotes: ${sermon.notes}\nKey Quotes: ${p.keyQuotes}\nAction Points: ${p.actionPoints}\nHow God Spoke: ${p.godSpoke}` }] })
      });
      const data = await res.json();
      const text = data.content ? data.content.map(b => b.text||"").join("") : "Could not generate summary.";
      await persist({...p, summary:text}, audio);
    } catch { await persist({...p, summary:"Error generating summary."}, audio); }
    setGl(false);
  };

  const hc = async (f, v) => { const next={...p,[f]:v}; setP(next); await persist(next, audio); };

  const toggleShare = async () => {
    const next = {...p, shared:!p.shared};
    setP(next);
    await persist(next, audio);
    const sharedRef = doc(db, "shared", pid, "entries", user.uid);
    if (next.shared && next.godSpoke) {
      await setDoc(sharedRef, { email: user.email, text: next.godSpoke });
    } else {
      await deleteDoc(sharedRef);
    }
  };

  return (
    <div style={S.app}>
      <Header
        left={<button style={{...S.btn("transparent"), color:"#fff", padding:"6px 0"}} onClick={back}>Back</button>}
        right={<div style={{fontSize:12, color:"rgba(255,255,255,0.7)", maxWidth:100, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>{user.email}</div>}
      />
      <div style={S.body}>
        <h2 style={{margin:"0 0 4px", fontSize:22}}>{sermon.title}</h2>
        <div style={{color:MUTED, fontSize:14, marginBottom:10}}>{sermon.speaker && sermon.speaker + " · "}{fmt(sermon.date)}</div>
        {sermon.scriptures && sermon.scriptures.split(",").map((sc,i) => <span key={i} style={S.tag()}>📖 {sc.trim()}</span>)}

        <div style={{...S.card("#22C55E"), cursor:"default", marginBottom:20, marginTop:16}}>
          <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:open?12:0}}>
            <div style={S.sec}>📋 Pastor's Notes</div>
            <button style={{...S.btn("transparent","#22C55E","4px 8px"), fontSize:12, border:"1px solid #22C55E", borderRadius:6}} onClick={() => setOpen(o=>!o)}>
              {open ? "Collapse ▲" : "Expand ▼"}
            </button>
          </div>
          {open && <div style={{fontSize:15, lineHeight:1.8, whiteSpace:"pre-wrap"}}>{sermon.notes || <span style={{color:MUTED, fontStyle:"italic"}}>No notes provided.</span>}</div>}
        </div>

        <div style={S.rec}>
          <div style={S.sec}>🎙️ Message Recording</div>
          {!audio && !rec && <button style={{...S.btn(ACCENT), width:"100%"}} onClick={startRec}>🎙️ Start Recording</button>}
          {rec && (
            <div style={{display:"flex", alignItems:"center", gap:12}}>
              <div style={{width:12,height:12,borderRadius:"50%",background:"#EF4444",animation:"pulse 1s infinite"}} />
              <span style={{color:"#EF4444", fontWeight:"bold"}}>{fmtTime(rt)}</span>
              <button style={{...S.btn("#EF4444"), marginLeft:"auto"}} onClick={stopRec}>Stop</button>
            </div>
          )}
          {audio && !rec && (
            <div>
              <audio controls src={audio} style={{width:"100%", marginBottom:10}} />
              <div style={{display:"flex", gap:8}}>
                <button style={{...S.btn(ACCENT,"#fff","8px 14px"), fontSize:12}} onClick={startRec}>Re-record</button>
                <button style={{...S.btn("#FEE2E2","#B91C1C","8px 14px"), fontSize:12}} onClick={delAudio}>Delete</button>
              </div>
            </div>
          )}
          <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}`}</style>
        </div>

        <div style={S.spoke}>
          <div style={{fontWeight:"bold", color:"#1A4A80", fontSize:14, marginBottom:4}}>🕊️ How God Spoke to Me</div>
          <div style={{fontSize:12, color:"#3A6A9A", marginBottom:10, fontStyle:"italic"}}>What did the Holy Spirit highlight for you in today's message?</div>
          <textarea style={S.ta(5)} value={p.godSpoke} onChange={e => hc("godSpoke", e.target.value)} placeholder="Lord, through today's message you showed me..." />
          <div style={{display:"flex", alignItems:"center", gap:10, marginTop:12}}>
            <div style={{flex:1}}>
              <div style={{fontWeight:"bold", fontSize:13, color:"#1A4A80"}}>Share with congregation</div>
              <div style={{fontSize:11, color:MUTED}}>Let others see what God spoke to you</div>
            </div>
            <div onClick={toggleShare} style={{width:44,height:24,borderRadius:12,background:p.shared?ACCENT:"#CBD5E1",cursor:"pointer",position:"relative",transition:"background .2s"}}>
              <div style={{position:"absolute",top:3,left:p.shared?22:3,width:18,height:18,borderRadius:9,background:"#fff",transition:"left .2s",boxShadow:"0 1px 3px rgba(0,0,0,.2)"}} />
            </div>
          </div>
        </div>

        <div style={{marginBottom:20}}>
          <div style={S.sec}>My Notes</div>
          <div style={{marginBottom:12}}>
            <label style={S.lbl}>Key Quotes</label>
            <textarea style={S.ta(3)} value={p.keyQuotes} onChange={e => hc("keyQuotes", e.target.value)} placeholder="What lines hit deep for you?" />
          </div>
          <div>
            <label style={S.lbl}>Action Points / Next Steps</label>
            <textarea style={S.ta(3)} value={p.actionPoints} onChange={e => hc("actionPoints", e.target.value)} placeholder="What will you do differently this week?" />
          </div>
        </div>

        <div style={S.sum}>
          <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10}}>
            <div style={{fontSize:13, fontWeight:"bold", color:"#8A6E2F", textTransform:"uppercase", letterSpacing:.8}}>✨ AI Summary</div>
            <button style={{...S.btn(GOLD), padding:"6px 14px", fontSize:12}} onClick={genSummary}>
              {gl ? "Generating..." : p.summary ? "Regenerate" : "Generate"}
            </button>
          </div>
          {gl && <div style={{color:MUTED, fontStyle:"italic", fontSize:14}}>Reflecting on the message... ✨</div>}
          {p.summary && !gl && <div style={{fontSize:15, lineHeight:1.8, color:"#5A4A20"}}>{p.summary}</div>}
          {!p.summary && !gl && <div style={{color:MUTED, fontSize:13, fontStyle:"italic"}}>Tap "Generate" for a personal AI recap.</div>}
        </div>

        {shared.length > 0 && (
          <div style={{marginTop:24}}>
            <div style={S.sec}>🙌 From the Congregation</div>
            {shared.map((e,i) => (
              <div key={i} style={{...S.card(SPOKE_BORDER), padding:"14px 18px"}}>
                <div style={{fontSize:11, color:MUTED, marginBottom:4}}>{e.email}</div>
                <div style={{fontSize:15, lineHeight:1.8, color:"#1A3A60", fontStyle:"italic"}}>"{e.text}"</div>
              </div>
            ))}
          </div>
        )}
        <div style={{height:40}} />
      </div>
    </div>
  );
}

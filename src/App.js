import React, { useState, useEffect, useRef } from "react";
import { db, auth } from "./firebase";
import {
  collection, doc, setDoc, deleteDoc, onSnapshot, query, orderBy, updateDoc
} from "firebase/firestore";
import {
  createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged
} from "firebase/auth";

const ADMIN_EMAIL = "justin@vcachurch.ca";

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
const hasContent = (p) => !!(p && (p.godSpoke || p.keyQuotes || p.actionPoints || p.audioDataUrl || p.summary || (p.annotations && Object.keys(p.annotations).length > 0)));

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
  hdr:  { background:`linear-gradient(135deg, ${ACCENT} 0%, ${ACCENT2} 100%)`, color:"#fff", padding:"12px 16px", display:"flex", alignItems:"center", justifyContent:"space-between", boxShadow:"0 2px 12px rgba(19,72,160,0.3)" },
  body: { maxWidth:680, margin:"0 auto", padding:"16px 12px", paddingBottom:120 },
  btn:  (bg, col="#fff", pad="10px 20px") => ({ background:bg, color:col, border:"none", borderRadius:8, padding:pad, fontFamily:"Georgia,serif", fontSize:14, cursor:"pointer", fontWeight:"bold" }),
  oBtn: (col=ACCENT) => ({ background:"transparent", color:col, border:`1.5px solid ${col}`, borderRadius:8, padding:"8px 16px", fontFamily:"Georgia,serif", fontSize:13, cursor:"pointer", fontWeight:"bold" }),
  card: (left=ACCENT) => ({ background:CARD, borderRadius:12, padding:18, marginBottom:14, boxShadow:"0 2px 8px rgba(0,0,0,0.07)", borderLeft:`4px solid ${left}` }),
  lbl:  { fontSize:12, fontWeight:"bold", color:ACCENT, textTransform:"uppercase", letterSpacing:.8, marginBottom:6, display:"block" },
  inp:  { width:"100%", padding:"10px 12px", borderRadius:8, border:"1px solid #D0DAE8", fontFamily:"Georgia,serif", fontSize:14, boxSizing:"border-box", background:"#FAFCFF" },
  ta:   (rows=4) => ({ width:"100%", padding:"10px 12px", borderRadius:8, border:"1px solid #D0DAE8", fontFamily:"Georgia,serif", fontSize:14, resize:"vertical", boxSizing:"border-box", background:"#FAFCFF", minHeight:rows*28 }),
  sec:  { fontSize:12, fontWeight:"bold", color:MUTED, textTransform:"uppercase", letterSpacing:1, marginBottom:10, borderBottom:"1px solid #DDE4EE", paddingBottom:6 },
  tag:  (bg="#E0ECFA", col=ACCENT) => ({ display:"inline-block", background:bg, color:col, borderRadius:20, padding:"2px 10px", fontSize:12, marginRight:6, marginBottom:4 }),
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
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      const admin = u?.email === ADMIN_EMAIL;
      setIsAdmin(admin);
      setLoading(false);
      if (u && admin) setMode("admin");
      else if (u) setMode("congregation");
      else setMode("splash");
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

  const Header = ({ right }) => (
    <div style={S.hdr}>
      <div style={{flex:1, display:"flex", alignItems:"center", minWidth:0}}>
        <div style={{cursor:"pointer"}} onClick={() => setMode(isAdmin ? "admin" : "congregation")}>
          <div style={{fontSize:18, fontWeight:"bold", letterSpacing:1, whiteSpace:"nowrap"}}>Rhema</div>
          <div style={{fontSize:10, opacity:.75, letterSpacing:.5, whiteSpace:"nowrap"}}>God's word for you</div>
        </div>
      </div>
      <div style={{flex:"0 0 auto", display:"flex", justifyContent:"center", alignItems:"center", padding:"0 8px"}}>
        <VCALogo size={28} />
      </div>
      <div style={{flex:1, display:"flex", justifyContent:"flex-end", alignItems:"center", gap:6, minWidth:0}}>
        {right}
        {user && (
          <button onClick={() => { signOut(auth); setMode("splash"); }}
            style={{background:"rgba(255,255,255,0.15)", border:"1px solid rgba(255,255,255,0.3)", color:"#fff", borderRadius:6, padding:"5px 8px", fontFamily:"Georgia,serif", fontSize:11, cursor:"pointer", whiteSpace:"nowrap"}}>
            Sign Out
          </button>
        )}
      </div>
    </div>
  );

  if (loading) return (
    <div style={{...S.app, display:"flex", alignItems:"center", justifyContent:"center", minHeight:"100vh"}}>
      <div style={{textAlign:"center", color:MUTED}}><VCALogo size={60}/><br/><br/>Loading...</div>
    </div>
  );

  if (mode === "splash")       return <Splash setMode={setMode} user={user} isAdmin={isAdmin} Header={Header} />;
  if (mode === "login")        return <AuthForm mode="login" setMode={setMode} Header={Header} />;
  if (mode === "register")     return <AuthForm mode="register" setMode={setMode} Header={Header} />;
  if (mode === "admin" && isAdmin) return <AdminArea setMode={setMode} sermons={sermons} Header={Header} />;
  if (mode === "congregation" && user) return (
    <CongArea setMode={setMode} sermons={sermons} user={user} selected={selected} setSelected={setSelected} Header={Header} />
  );
  return <Splash setMode={setMode} user={user} isAdmin={isAdmin} Header={Header} />;
}

function Splash({ setMode, user, isAdmin, Header }) {
  return (
    <div style={S.app}>
      <Header right={null} />
      <div style={S.body}>
        <div style={{textAlign:"center", padding:"28px 0 28px"}}>
          <h1 style={{margin:"0 0 2px", fontSize:32, color:ACCENT, letterSpacing:1}}>Rhema</h1>
          <p style={{color:MUTED, fontSize:15, margin:"0 0 24px"}}>God's word for you</p>
          <button style={{...S.btn(`linear-gradient(135deg,${ACCENT},${ACCENT2})`), width:"100%", maxWidth:300, padding:"14px 20px", fontSize:16, marginBottom:12, borderRadius:10, display:"block", margin:"0 auto 12px"}}
            onClick={() => setMode(user ? (isAdmin ? "admin" : "congregation") : "login")}>
            {user ? "Continue" : "Sign In"}
          </button>
          {!user && (
            <button style={{...S.btn("transparent", ACCENT, "12px 20px"), width:"100%", maxWidth:300, border:`1.5px solid ${ACCENT}`, borderRadius:10, fontSize:15, display:"block", margin:"0 auto"}}
              onClick={() => setMode("register")}>
              Create Account
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
      if (isLogin) await signInWithEmailAndPassword(auth, email, password);
      else await createUserWithEmailAndPassword(auth, email, password);
    } catch (e) {
      setErr(e.message.replace("Firebase: ","").replace(/\(auth.*\)/,""));
    }
    setLoading(false);
  };

  return (
    <div style={S.app}>
      <Header right={null} />
      <div style={{...S.body, maxWidth:400}}>
        <div style={{textAlign:"center", padding:"32px 0 24px"}}>
          <VCALogo size={56}/>
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
          <input style={S.inp} type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" onKeyDown={e => e.key==="Enter" && handle()} />
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
  const hc = (f,v) => setCurrent(p => ({...p,[f]:v}));
  const emptyS = () => ({ date:new Date().toISOString().split("T")[0], title:"", speaker:"", scriptures:"", notes:"", published:false });

  const handleSave = async () => {
    if (!current.title.trim()) return alert("Please enter a sermon title.");
    if (current.id) {
      await updateDoc(doc(db,"sermons",current.id), current);
    } else {
      const ref = doc(collection(db,"sermons"));
      await setDoc(ref, {...current, id: ref.id});
    }
    setView("list");
  };

  const togglePublish = async (s) => {
    await updateDoc(doc(db,"sermons",s.id), { published: !s.published });
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this sermon?")) return;
    await deleteDoc(doc(db,"sermons",id));
    setView("list");
  };

  if (view === "list") return (
    <div style={S.app}>
      <Header right={<button style={S.btn(GOLD)} onClick={() => { setCurrent(emptyS()); setView("edit"); }}>+ New</button>} />
      <div style={S.body}>
        {sermons.length === 0
          ? <div style={S.empty}><div style={{fontSize:40,marginBottom:12}}>📋</div><p>No sermons yet.</p><button style={S.btn(ACCENT)} onClick={() => { setCurrent(emptyS()); setView("edit"); }}>Create Sermon</button></div>
          : sermons.map(s => (
            <div key={s.id} style={{...S.card(s.published?"#22C55E":"#AAA")}}>
              <div style={{display:"flex", justifyContent:"space-between", alignItems:"flex-start"}}>
                <div style={{flex:1}}>
                  <div style={{fontWeight:"bold", fontSize:15, marginBottom:3}}>{s.title}</div>
                  <div style={{color:MUTED, fontSize:12, marginBottom:8}}>{s.speaker && s.speaker+" · "}{fmt(s.date)}</div>
                  <span style={S.tag(s.published?"#DCFCE7":"#F3F4F6", s.published?"#166534":"#6B7280")}>{s.published?"✅ Published":"⏸ Draft"}</span>
                </div>
                <div style={{display:"flex", gap:6, marginLeft:10}}>
                  <button style={S.oBtn(ACCENT)} onClick={() => { setCurrent({...s}); setView("edit"); }}>Edit</button>
                  <button style={S.oBtn(s.published?"#888":"#22C55E")} onClick={() => togglePublish(s)}>{s.published?"Unpublish":"Publish"}</button>
                </div>
              </div>
            </div>
          ))}
      </div>
    </div>
  );

  return (
    <div style={S.app}>
      <Header right={<button style={S.btn(GOLD)} onClick={handleSave}>Save</button>} />
      <div style={S.body}>
        <div style={{...S.card(), marginBottom:20}}>
          <div style={S.sec}>Sermon Details</div>
          <div style={{marginBottom:12}}>
            <label style={S.lbl}>Sermon Title *</label>
            <input style={S.inp} value={current.title} onChange={e => hc("title",e.target.value)} placeholder="e.g. Walking in Faith" />
          </div>
          <div style={{display:"flex", gap:12, marginBottom:12}}>
            <div style={{flex:1}}>
              <label style={S.lbl}>Speaker</label>
              <input style={S.inp} value={current.speaker} onChange={e => hc("speaker",e.target.value)} placeholder="Speaker name" />
            </div>
            <div style={{flex:1}}>
              <label style={S.lbl}>Date</label>
              <input style={S.inp} type="date" value={current.date} onChange={e => hc("date",e.target.value)} />
            </div>
          </div>
          <div style={{marginBottom:12}}>
            <label style={S.lbl}>Scripture References</label>
            <input style={S.inp} value={current.scriptures} onChange={e => hc("scriptures",e.target.value)} placeholder="e.g. John 3:16, Romans 8:28" />
          </div>
          <div>
            <label style={S.lbl}>Sermon Notes</label>
            <textarea style={S.ta(10)} value={current.notes} onChange={e => hc("notes",e.target.value)} placeholder="Full sermon notes for the congregation..." />
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
    const unsub = onSnapshot(collection(db,"users",user.uid,"entries"), (snap) => {
      const map = {};
      snap.docs.forEach(d => { map[d.id] = d.data(); });
      setPersonalMap(map);
    });
    return unsub;
  }, [user]);

  if (!selected) return (
    <div style={S.app}>
      <Header right={null} />
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
                    <div style={{color:MUTED, fontSize:13, marginBottom:8}}>{s.speaker && s.speaker+" · "}{fmt(s.date)}</div>
                    {s.scriptures && <span style={S.tag()}>📖 {s.scriptures.split(",")[0].trim()}</span>}
                    {p?.audioDataUrl && <span style={S.tag("#E0F0FF","#1565A8")}>🎙️ Audio</span>}
                    {p?.summary && <span style={S.tag("#FFFBEF","#8A6E2F")}>✨ Summary</span>}
                    {p?.godSpoke && <span style={S.tag(SPOKE_BG,"#1A4A80")}>🙏 My Word</span>}
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
      personal={personalMap[sermon.id] || { godSpoke:"", audioDataUrl:null, summary:"", shared:false, annotations:{} }}
      back={() => setSelected(null)}
      Header={Header}
    />
  );
}
function SermonDetail({ sermon, user, personal: p0, back, Header }) {
  const pid = sermon.id;
  const [p, setP]             = useState(p0);
  const [audio, setAudio]     = useState(p0.audioDataUrl || null);
  const [audioBlob, setAudioBlob] = useState(null);
  const [rec, setRec]         = useState(false);
  const [rt, setRt]           = useState(0);
  const [gl, setGl]           = useState(false);
  const [shared, setShared]   = useState([]);
  const [annotations, setAnnotations] = useState(p0.annotations || {});
  const [noteModal, setNoteModal]     = useState(null);
  const [noteText, setNoteText]       = useState("");
  const [activePanel, setActivePanel] = useState(null);
  const [godSpoke, setGodSpoke]       = useState(p0.godSpoke || "");
  const mrRef  = useRef(null);
  const chunks = useRef([]);
  const timer  = useRef(null);

  useEffect(() => {
    const unsub = onSnapshot(collection(db,"shared",pid,"entries"), (snap) => {
      setShared(snap.docs.map(d => d.data()));
    });
    return unsub;
  }, [pid]);

  const persist = async (updates) => {
    const entry = { ...p, ...updates, annotations };
    if (audio) entry.audioDataUrl = audio;
    setP(entry);
    if (hasContent(entry)) {
      await setDoc(doc(db,"users",user.uid,"entries",pid), entry);
    }
  };

  const persistAnnotations = async (newAnno) => {
    setAnnotations(newAnno);
    const entry = { ...p, audioDataUrl: audio, annotations: newAnno };
    if (hasContent(entry)) {
      await setDoc(doc(db,"users",user.uid,"entries",pid), entry);
    }
  };

  const saveNote = async () => {
    if (!noteText.trim()) { setNoteModal(null); return; }
    const newAnno = { ...annotations, [noteModal.paraIndex]: noteText.trim() };
    await persistAnnotations(newAnno);
    setNoteModal(null);
    setNoteText("");
  };

  const deleteNote = async (idx) => {
    const newAnno = { ...annotations };
    delete newAnno[idx];
    await persistAnnotations(newAnno);
  };

  const startRec = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      chunks.current = [];
      const options = MediaRecorder.isTypeSupported("audio/webm") ? { mimeType:"audio/webm" } : {};
      const mr = new MediaRecorder(stream, options);
      mrRef.current = mr;
      mr.ondataavailable = e => { if (e.data.size > 0) chunks.current.push(e.data); };
      mr.onstop = async () => {
        const mimeType = mr.mimeType || "audio/webm";
        const blob = new Blob(chunks.current, { type: mimeType });
        setAudioBlob(blob);
        const url = URL.createObjectURL(blob);
        setAudio(url);
        // Save as base64
        const reader = new FileReader();
        reader.onload = async () => {
          const base64 = reader.result;
          setAudio(base64);
          const entry = { ...p, audioDataUrl: base64, annotations };
          await setDoc(doc(db,"users",user.uid,"entries",pid), entry);
        };
        reader.readAsDataURL(blob);
        stream.getTracks().forEach(t => t.stop());
      };
      mr.start(1000);
      setRec(true); setRt(0);
      timer.current = setInterval(() => setRt(t => t + 1), 1000);
    } catch(e) {
      alert("Microphone access denied. Please allow microphone access in your browser settings.");
    }
  };

  const stopRec = () => {
    if (mrRef.current && mrRef.current.state === "recording") mrRef.current.stop();
    setRec(false);
    clearInterval(timer.current);
  };

  const delAudio = async () => {
    if (!window.confirm("Delete recording?")) return;
    setAudio(null);
    setAudioBlob(null);
    const entry = { ...p, audioDataUrl: null, annotations };
    setP(entry);
    await setDoc(doc(db,"users",user.uid,"entries",pid), entry);
  };

  const genSummary = async () => {
    setGl(true);
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": process.env.REACT_APP_ANTHROPIC_KEY,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-allow-browser": "true"
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          messages: [{
            role: "user",
            content: `You are a helpful church assistant. Write a warm 3-4 sentence summary in second person to help this person remember and apply the message.\n\nSermon: ${sermon.title}\nSpeaker: ${sermon.speaker}\nScriptures: ${sermon.scriptures}\nNotes: ${sermon.notes}\nHow God Spoke: ${godSpoke}\nMy Annotations: ${JSON.stringify(annotations)}`
          }]
        })
      });
      const data = await res.json();
      const text = data.content ? data.content.map(b => b.text||"").join("") : "Could not generate summary.";
      await persist({ summary: text });
      setActivePanel("summary");
    } catch(e) {
      await persist({ summary: "Error generating summary. Please try again." });
    }
    setGl(false);
  };

  const saveGodSpoke = async () => {
    await persist({ godSpoke });
  };

  const toggleShare = async () => {
    const next = !p.shared;
    await persist({ shared: next, godSpoke });
    const sharedRef = doc(db,"shared",pid,"entries",user.uid);
    if (next && godSpoke) {
      await setDoc(sharedRef, { email: user.email, text: godSpoke });
    } else {
      await deleteDoc(sharedRef);
    }
  };

  const paragraphs = sermon.notes ? sermon.notes.split("\n").filter(l => l.trim()) : [];

  const FabBtn = ({ onClick, color, label, icon, size=48 }) => (
    <div style={{display:"flex", flexDirection:"column", alignItems:"center", gap:3}}>
      <button onClick={onClick}
        style={{ width:size, height:size, borderRadius:size/2, background:color, border:"none", fontSize:size*0.38, cursor:"pointer", boxShadow:"0 3px 10px rgba(0,0,0,0.25)", display:"flex", alignItems:"center", justifyContent:"center" }}>
        {icon}
      </button>
      <span style={{fontSize:9, color:"#555", fontFamily:"Georgia,serif", fontWeight:"bold", letterSpacing:.3}}>{label}</span>
    </div>
  );

  return (
    <div style={S.app}>
      <Header right={null} />
      <div style={S.body}>

        {/* Sermon Header */}
        <div style={{marginBottom:16}}>
          <h2 style={{margin:"0 0 4px", fontSize:20}}>{sermon.title}</h2>
          <div style={{color:MUTED, fontSize:13, marginBottom:8}}>{sermon.speaker && sermon.speaker+" · "}{fmt(sermon.date)}</div>
          {sermon.scriptures && sermon.scriptures.split(",").map((sc,i) => (
            <span key={i} style={S.tag()}>📖 {sc.trim()}</span>
          ))}
        </div>

        {/* Audio Player */}
        {audio && !rec && (
          <div style={{background:"#F0F6FF", border:"1.5px solid #90BAE8", borderRadius:12, padding:14, marginBottom:16}}>
            <div style={{fontSize:12, fontWeight:"bold", color:MUTED, textTransform:"uppercase", letterSpacing:1, marginBottom:8}}>🎙️ Your Recording</div>
            <audio controls src={audio} style={{width:"100%", marginBottom:8}} preload="auto" />
            <button style={{...S.btn("#FEE2E2","#B91C1C","6px 12px"), fontSize:12}} onClick={delAudio}>Delete Recording</button>
          </div>
        )}

        {/* Recording indicator */}
        {rec && (
          <div style={{background:"#FEF2F2", border:"1.5px solid #FCA5A5", borderRadius:12, padding:14, marginBottom:16, display:"flex", alignItems:"center", gap:12}}>
            <div style={{width:12, height:12, borderRadius:"50%", background:"#EF4444", animation:"pulse 1s infinite"}} />
            <span style={{color:"#EF4444", fontWeight:"bold", fontSize:15}}>Recording {fmtTime(rt)}</span>
            <button style={{...S.btn("#EF4444","#fff","8px 16px"), marginLeft:"auto"}} onClick={stopRec}>⏹ Stop</button>
          </div>
        )}

        {/* Pastor's Notes */}
        <div style={{...S.card("#22C55E"), marginBottom:16}}>
          <div style={S.sec}>📋 Pastor's Notes</div>
          {paragraphs.length === 0
            ? <div style={{color:MUTED, fontStyle:"italic"}}>No notes provided yet.</div>
            : paragraphs.map((para, i) => (
              <div key={i} style={{marginBottom:14}}>
                <div style={{display:"flex", alignItems:"flex-start", gap:8}}>
                  <div style={{fontSize:15, lineHeight:1.8, flex:1}}>{para}</div>
                  <button
                    onClick={() => { setNoteModal({ paraIndex:i, existing:annotations[i]||"" }); setNoteText(annotations[i]||""); }}
                    style={{ background:annotations[i]?"#DBEAFE":"#F1F5F9", border:"none", borderRadius:6, width:30, height:30, cursor:"pointer", fontSize:16, flexShrink:0, marginTop:4, display:"flex", alignItems:"center", justifyContent:"center", boxShadow:"0 1px 3px rgba(0,0,0,0.1)" }}
                    title="Add personal note"
                  >
                    {annotations[i] ? "✏️" : "+"}
                  </button>
                </div>
                {annotations[i] && (
                  <div style={{marginTop:6, padding:"8px 12px", background:"#EFF6FF", borderRadius:8, borderLeft:"3px solid #3B82F6", display:"flex", alignItems:"flex-start", gap:8}}>
                    <span style={{color:"#1D4ED8", fontStyle:"italic", fontSize:14, flex:1}}>[ {annotations[i]} ]</span>
                    <button onClick={() => deleteNote(i)} style={{background:"none", border:"none", color:"#93C5FD", cursor:"pointer", fontSize:14, padding:0}}>✕</button>
                  </div>
                )}
              </div>
            ))}
        </div>

        {/* God Spoke Panel */}
        {activePanel === "godSpoke" && (
          <div style={{background:SPOKE_BG, border:`2px solid ${SPOKE_BORDER}`, borderRadius:12, padding:18, marginBottom:16}}>
            <div style={{fontWeight:"bold", color:"#1A4A80", fontSize:14, marginBottom:4}}>📖 How God Spoke to Me</div>
            <div style={{fontSize:12, color:"#3A6A9A", marginBottom:10, fontStyle:"italic"}}>What did the Holy Spirit highlight for you in today's message?</div>
            <textarea style={S.ta(5)} value={godSpoke} onChange={e => setGodSpoke(e.target.value)} placeholder="Lord, through today's message you showed me..." />
            <div style={{display:"flex", gap:8, marginTop:10}}>
              <button style={{...S.btn(ACCENT), flex:1}} onClick={() => { saveGodSpoke(); setActivePanel(null); }}>Save</button>
              <button style={S.btn("#F1F5F9","#6B7A8D")} onClick={() => setActivePanel(null)}>Close</button>
            </div>
            <div style={{display:"flex", alignItems:"center", gap:10, marginTop:12, padding:"10px 14px", background:"rgba(255,255,255,0.6)", borderRadius:8}}>
              <div style={{flex:1}}>
                <div style={{fontWeight:"bold", fontSize:13, color:"#1A4A80"}}>Share with congregation</div>
                <div style={{fontSize:11, color:MUTED}}>Let others see what God spoke to you</div>
              </div>
              <div onClick={toggleShare} style={{width:44, height:24, borderRadius:12, background:p.shared?ACCENT:"#CBD5E1", cursor:"pointer", position:"relative", transition:"background .2s"}}>
                <div style={{position:"absolute", top:3, left:p.shared?22:3, width:18, height:18, borderRadius:9, background:"#fff", transition:"left .2s", boxShadow:"0 1px 3px rgba(0,0,0,.2)"}} />
              </div>
            </div>
            {godSpoke && (
              <div style={{marginTop:10, padding:"10px 14px", background:"rgba(255,255,255,0.6)", borderRadius:8}}>
                <div style={{fontSize:14, color:"#1A3A60", fontStyle:"italic"}}>"{godSpoke}"</div>
              </div>
            )}
          </div>
        )}

        {/* Summary Panel */}
        {activePanel === "summary" && (
          <div style={{background:"#FFFBEF", border:`1.5px solid ${GOLD}`, borderRadius:12, padding:18, marginBottom:16}}>
            <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10}}>
              <div style={{fontSize:13, fontWeight:"bold", color:"#8A6E2F", textTransform:"uppercase", letterSpacing:.8}}>⭐ AI Summary</div>
              <div style={{display:"flex", gap:8}}>
                <button style={{...S.btn(GOLD,"#fff","6px 12px"), fontSize:12}} onClick={genSummary}>{gl?"...":"Regenerate"}</button>
                <button style={S.btn("#F1F5F9","#6B7A8D","6px 12px")} onClick={() => setActivePanel(null)}>Close</button>
              </div>
            </div>
            {gl && <div style={{color:MUTED, fontStyle:"italic", fontSize:14}}>Reflecting on the message... ⭐</div>}
            {p.summary && !gl && <div style={{fontSize:15, lineHeight:1.8, color:"#5A4A20"}}>{p.summary}</div>}
            {!p.summary && !gl && (
              <div style={{textAlign:"center", padding:"10px 0"}}>
                <div style={{color:MUTED, fontSize:13, fontStyle:"italic", marginBottom:10}}>Tap below to get your personal AI recap.</div>
                <button style={{...S.btn(GOLD), padding:"10px 24px"}} onClick={genSummary}>Generate Summary</button>
              </div>
            )}
          </div>
        )}

        {/* Congregation Shares */}
        {shared.length > 0 && (
          <div style={{marginTop:8}}>
            <div style={S.sec}>🙌 From the Congregation</div>
            {shared.map((e,i) => (
              <div key={i} style={{...S.card(SPOKE_BORDER), padding:"14px 18px"}}>
                <div style={{fontSize:11, color:MUTED, marginBottom:4}}>{e.email}</div>
                <div style={{fontSize:15, lineHeight:1.8, color:"#1A3A60", fontStyle:"italic"}}>"{e.text}"</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Floating Action Buttons */}
      <div style={{position:"fixed", bottom:20, right:16, display:"flex", flexDirection:"column", alignItems:"center", gap:10, zIndex:100}}>
        <FabBtn
          onClick={() => setActivePanel(p => p==="godSpoke" ? null : "godSpoke")}
          color={activePanel==="godSpoke" ? "#1A4A80" : SPOKE_BORDER}
          icon="📖"
          label="God Spoke"
          size={46}
        />
        <FabBtn
          onClick={() => { setActivePanel(p => { const next = p==="summary" ? null : "summary"; if (next==="summary" && !p.summary) genSummary(); return next; }); }}
          color={activePanel==="summary" ? "#8A6E2F" : GOLD}
          icon="⭐"
          label="Summary"
          size={46}
        />
        <FabBtn
          onClick={rec ? stopRec : startRec}
          color={rec ? "#EF4444" : "#CC0000"}
          icon={rec ? "⏹" : "⏺"}
          label={rec ? `Stop ${fmtTime(rt)}` : "Record"}
          size={52}
        />
      </div>

      {/* Note Modal */}
      {noteModal !== null && (
        <div style={{position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", zIndex:200, display:"flex", alignItems:"flex-end", justifyContent:"center"}} onClick={e => { if(e.target===e.currentTarget) setNoteModal(null); }}>
          <div style={{background:CARD, borderRadius:"16px 16px 0 0", padding:24, width:"100%", maxWidth:680, boxShadow:"0 -4px 24px rgba(0,0,0,0.15)"}}>
            <div style={{fontWeight:"bold", color:ACCENT, fontSize:15, marginBottom:12}}>📝 Personal Note</div>
            <textarea
              style={S.ta(4)}
              value={noteText}
              onChange={e => setNoteText(e.target.value)}
              placeholder="Write your personal note or reflection on this point..."
              autoFocus
            />
            <div style={{display:"flex", gap:10, marginTop:12}}>
              <button style={{...S.btn(ACCENT), flex:1}} onClick={saveNote}>Save Note</button>
              {noteModal.existing && (
                <button style={{...S.btn("#FEE2E2","#B91C1C")}} onClick={() => { deleteNote(noteModal.paraIndex); setNoteModal(null); }}>Delete</button>
              )}
              <button style={S.btn("#F1F5F9","#6B7A8D")} onClick={() => setNoteModal(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}} * { -webkit-tap-highlight-color: transparent; } audio { border-radius: 8px; }`}</style>
    </div>
  );
}

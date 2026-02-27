// src/components/ChatScreen.jsx
/* eslint-disable react-hooks/exhaustive-deps */
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useApp } from '../contexts/AppContext';
import { UI_TEXT, LANG_NAMES, VOICE_LANGS } from '../data/translations';
import { callGeminiAPI, getTypingSuggestions } from '../services/geminiApi';

const NAV_H = 68;
const INPUT_H = 66;

export default function ChatScreen() {
  const { lang, setLang, navigate, showToast, chatMessages, setChatMessages, sessionId } = useApp();
  const T = UI_TEXT[lang] || UI_TEXT.en;

  const [input, setInput]                   = useState('');
  const [isSending, setIsSending]           = useState(false);
  const [isRecording, setIsRecording]       = useState(false);
  const [typingSugs, setTypingSugs]         = useState([]);
  const [showLangPicker, setShowLangPicker] = useState(false);

  const chatBodyRef    = useRef(null);
  const recognitionRef = useRef(null);
  const textareaRef    = useRef(null);
  const messagesRef    = useRef(chatMessages);

  useEffect(() => { messagesRef.current = chatMessages; }, [chatMessages]);
  useEffect(() => {
    if (chatBodyRef.current)
      chatBodyRef.current.scrollTop = chatBodyRef.current.scrollHeight;
  }, [chatMessages]);
  useEffect(() => { setTypingSugs([]); setInput(''); }, [lang]);
  useEffect(() => {
    window.__nyayaSendQ = (q) => { setInput(q); setTimeout(() => handleSend(q), 100); };
    return () => { delete window.__nyayaSendQ; };
  }, [lang]);

  const handleSend = useCallback(async (textArg) => {
    const msg = (textArg !== undefined ? textArg : input).trim();
    if (!msg || isSending) return;

    setInput('');
    setTypingSugs([]);
    if (textareaRef.current) textareaRef.current.style.height = '44px';
    setIsSending(true);

    const typingId = 'typing_' + Date.now();
    const userMsg  = { role: 'user', content: msg, id: Date.now() };
    setChatMessages(prev => [...prev, userMsg, { role: 'typing', content: '', id: typingId }]);

    try {
      const history = messagesRef.current.filter(m => m.role !== 'typing').slice(-6);
      const reply = await callGeminiAPI(msg, history, lang, LANG_NAMES[lang] || 'English');
      setChatMessages(prev => [
        ...prev.filter(m => m.id !== typingId),
        { role: 'ai', content: reply, id: Date.now() }
      ]);
    } catch (err) {
      // Server always responds — this only hits if server.js is not running
      const isNetwork = (err?.message || '').includes('fetch') || (err?.message || '').includes('Failed');
      setChatMessages(prev => [
        ...prev.filter(m => m.id !== typingId),
        {
          role: 'ai',
          content: isNetwork
            ? `⚠️ **Server not running.**\n\nPlease make sure you ran:\n\`node server.js\`\n\n📞 Free Legal Aid: **15100** (available 24/7)`
            : `⚠️ **Connection error.**\n\n📞 Free Legal Aid: **15100** (available 24/7)`,
          id: Date.now(), isOffline: true
        }
      ]);
    }

    setIsSending(false);
    try {
      const { saveChatMessage } = await import('../firebase');
      await saveChatMessage(sessionId, 'user', msg, lang);
    } catch { /* optional */ }
  }, [input, isSending, lang, sessionId, setChatMessages]);

  const handleInputChange = (e) => {
    setInput(e.target.value);
    setTypingSugs(e.target.value.length >= 2
      ? getTypingSuggestions(e.target.value, lang, T.suggestions || []) : []);
    e.target.style.height = '44px';
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
  };

  const toggleVoice = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { showToast('Voice requires Chrome browser'); return; }
    if (isRecording && recognitionRef.current) { recognitionRef.current.stop(); return; }
    const r = new SR();
    r.lang = VOICE_LANGS[lang] || 'en-IN';
    r.interimResults = true; r.continuous = false;
    recognitionRef.current = r;
    r.onstart  = () => setIsRecording(true);
    r.onresult = (e) => {
      const t = Array.from(e.results).map(r => r[0].transcript).join('');
      setInput(t);
      if (textareaRef.current) {
        textareaRef.current.style.height = '44px';
        textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px';
      }
    };
    r.onerror = () => { setIsRecording(false); showToast('Voice failed. Try again.'); };
    r.onend   = () => { setIsRecording(false); const v = textareaRef.current?.value?.trim(); if (v) handleSend(v); };
    r.start();
    showToast(`Listening in ${LANG_NAMES[lang]}...`);
  };

  const handleLangChange = (code) => {
    setLang(code); setShowLangPicker(false);
    const T2 = UI_TEXT[code] || UI_TEXT.en;
    showToast(T2.langChanged ? T2.langChanged(code) : `Language: ${LANG_NAMES[code]}`);
  };

  const fmt = (text) =>
    (text || '').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br/>');

  return (
    <div style={S.container}>
      <style>{`
        @keyframes dotBounce{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-6px)}}
        @keyframes micPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.1)}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
        .msg-in{animation:fadeUp 0.25s ease}
        .chip:hover{background:#FF6B00!important;color:white!important;border-color:#FF6B00!important}
        .langopt:hover{background:#FFF0E6!important;color:#FF6B00!important}
        .suggbtn:hover{background:#FF6B00!important;color:white!important}
        .sendbtn:hover:not(:disabled){transform:scale(1.08)}
        textarea:focus{border-color:#FF6B00!important;outline:none}
      `}</style>

      {/* TOP BAR */}
      <div style={S.topbar}>
        <button style={S.backBtn} onClick={() => navigate('home')}>‹</button>
        <div style={S.topAvatar}>⚖️</div>
        <div style={S.topInfo}>
          <div style={S.topName}>{T.chatTitle || 'NYAYA Legal AI'}</div>
          <div style={S.topStatus}>
            <span style={{...S.statusDot, background: isSending ? '#F59E0B' : '#059669'}}/>
            {isSending ? '⚡ Responding...' : (T.chatStatus || '● Online — Gemini AI · 24/7 Free')}
          </div>
        </div>
        <div style={{position:'relative'}}>
          <button style={S.langBtn} onClick={() => setShowLangPicker(v => !v)}>
            🌐 {LANG_NAMES[lang]}
          </button>
          {showLangPicker && (
            <div style={S.langDrop}>
              {Object.entries(LANG_NAMES).map(([code, name]) => (
                <button key={code} className="langopt"
                  style={{...S.langOpt,...(code===lang?S.langOptActive:{})}}
                  onClick={() => handleLangChange(code)}>
                  {code===lang?'✓ ':''}{name}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* CHAT BODY */}
      <div ref={chatBodyRef}
           style={{...S.chatBody, paddingBottom: NAV_H + INPUT_H + 16}}
           onClick={() => setShowLangPicker(false)}>

        {chatMessages.length === 0 && (
          <div style={S.welcomeWrap}>
            <div style={S.welcomeCard}>
              <div style={S.wIcon}>⚖️</div>
              <div style={S.wTitle}>NYAYA Legal AI</div>
              <div style={S.wSub}>Powered by Gemini AI · Free · 24/7</div>
              <div style={S.wLangRow}>
                <span style={S.wLangLabel}>{T.splashLangLabel||'Language'}:</span>
                <select style={S.wLangSel} value={lang} onChange={e=>handleLangChange(e.target.value)}>
                  {Object.entries(LANG_NAMES).map(([code,name])=>(
                    <option key={code} value={code}>{name}</option>
                  ))}
                </select>
              </div>
              <div style={S.wVoiceHint}>🎙️ Tap mic to speak in your language</div>
              <div style={S.wSuggGrid}>
                {(T.suggestions||[]).slice(0,4).map((s,i)=>(
                  <button key={i} className="suggbtn" style={S.wSuggBtn} onClick={()=>handleSend(s.q)}>
                    {s.text}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {chatMessages.map(msg => {
          if (msg.role === 'typing') return (
            <div key={msg.id} style={S.msgRow}>
              <div style={S.aiAva}>⚖️</div>
              <div style={S.typingBubble}>
                <div style={S.typingInner}>
                  <span style={S.tDot}/>
                  <span style={{...S.tDot,animationDelay:'0.2s'}}/>
                  <span style={{...S.tDot,animationDelay:'0.4s'}}/>
                </div>
                <span style={S.typingLabel}>NYAYA AI is thinking...</span>
              </div>
            </div>
          );
          const isUser = msg.role === 'user';
          return (
            <div key={msg.id} className="msg-in" style={{...S.msgRow,...(isUser?S.msgRowUser:{})}}>
              {!isUser && <div style={S.aiAva}>⚖️</div>}
              <div style={{...S.bubble,...(isUser?S.bubbleUser:S.bubbleAI)}}>
                {!isUser && (
                  <div style={S.msgTag}>⚖️ NYAYA AI · {LANG_NAMES[lang]}</div>
                )}
                <div style={{fontSize:13,lineHeight:1.85}}
                     dangerouslySetInnerHTML={{__html:fmt(msg.content)}}/>
                {!isUser && (
                  <div style={S.chipRow}>
                    <button className="chip" style={S.chip} onClick={()=>navigate('finder')}>🗺️ Find Office</button>
                    <button className="chip" style={S.chip} onClick={()=>navigate('docs')}>📄 Get Letter</button>
                    <button className="chip" style={S.chip} onClick={()=>navigate('lawyer')}>🤝 Free Lawyer</button>
                  </div>
                )}
              </div>
              {isUser && <div style={S.userAva}>🙂</div>}
            </div>
          );
        })}
      </div>

      {typingSugs.length > 0 && (
        <div style={{...S.suggsDrop, bottom: NAV_H + INPUT_H}}>
          <div style={S.suggsHead}>{T.typeToSearch||'Suggestions'}</div>
          {typingSugs.map((s,i)=>(
            <button key={i} style={S.suggsItem}
              onClick={()=>{setInput(s.q);setTypingSugs([]);textareaRef.current?.focus();}}>
              <span style={{fontSize:16}}>{s.text.split(' ')[0]}</span>
              <span style={{fontWeight:800,flex:1}}>{s.text.replace(/^\S+\s*/,'')}</span>
            </button>
          ))}
        </div>
      )}

      {isRecording && (
        <div style={{...S.recBar, bottom: NAV_H + INPUT_H}}>
          🔴 Listening in {LANG_NAMES[lang]}... speak now
        </div>
      )}

      <div style={{...S.inputBar, bottom: NAV_H}}>
        <button style={{...S.micBtn,...(isRecording?S.micBtnRec:{})}}
                onClick={toggleVoice}>🎙️</button>
        <textarea ref={textareaRef} style={S.textarea} value={input}
          onChange={handleInputChange}
          onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();handleSend();}}}
          placeholder={T.chatPlaceholder||'Type your legal problem here...'}
          rows={1} disabled={isSending}/>
        <button className="sendbtn"
          style={{...S.sendBtn,...(!input.trim()||isSending?S.sendBtnOff:{})}}
          onClick={()=>handleSend()} disabled={!input.trim()||isSending}>
          {isSending
            ? <span style={{animation:'spin 1s linear infinite',display:'inline-block'}}>⏳</span>
            : '➤'}
        </button>
      </div>
    </div>
  );
}

const S = {
  container:{display:'flex',flexDirection:'column',minHeight:'100vh',background:'#F8F5F0',fontFamily:"'Nunito',sans-serif"},
  topbar:{position:'sticky',top:0,zIndex:50,background:'white',padding:'12px 16px',display:'flex',alignItems:'center',gap:10,borderBottom:'1px solid #E5E7EB',boxShadow:'0 2px 16px rgba(0,0,0,0.08)'},
  backBtn:{width:36,height:36,borderRadius:'50%',background:'#F8F5F0',border:'none',cursor:'pointer',fontSize:22,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0},
  topAvatar:{width:40,height:40,borderRadius:'50%',flexShrink:0,background:'linear-gradient(135deg,#FF6B00,#F59E0B)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:20},
  topInfo:{flex:1},
  topName:{fontSize:15,fontWeight:800,color:'#1A1A2E'},
  topStatus:{fontSize:11,color:'#059669',fontWeight:700,display:'flex',alignItems:'center',gap:5},
  statusDot:{width:7,height:7,borderRadius:'50%',display:'inline-block',transition:'background 0.3s'},
  langBtn:{background:'#FFF0E6',border:'1.5px solid #FFD4B3',borderRadius:8,padding:'6px 10px',fontSize:12,fontWeight:700,cursor:'pointer',color:'#FF6B00',whiteSpace:'nowrap',fontFamily:"'Nunito',sans-serif"},
  langDrop:{position:'absolute',right:0,top:'calc(100% + 6px)',background:'white',border:'1.5px solid #E5E7EB',borderRadius:12,boxShadow:'0 8px 30px rgba(0,0,0,0.15)',overflow:'hidden',zIndex:200,minWidth:148},
  langOpt:{width:'100%',padding:'10px 14px',border:'none',background:'transparent',borderBottom:'1px solid #F3F4F6',fontSize:13,fontWeight:600,cursor:'pointer',textAlign:'left',color:'#2D2D2D',fontFamily:"'Nunito',sans-serif"},
  langOptActive:{background:'#FFF0E6',color:'#FF6B00'},
  chatBody:{flex:1,overflowY:'auto',padding:'16px 16px 0',display:'flex',flexDirection:'column',gap:14},
  welcomeWrap:{display:'flex',justifyContent:'center',padding:'8px 0'},
  welcomeCard:{background:'white',borderRadius:20,padding:24,textAlign:'center',boxShadow:'0 8px 40px rgba(0,0,0,0.12)',maxWidth:340,width:'100%'},
  wIcon:{fontSize:44,marginBottom:8},
  wTitle:{fontSize:20,fontWeight:900,color:'#1A1A2E',marginBottom:4,fontFamily:"'Playfair Display',serif"},
  wSub:{fontSize:12,color:'#6B7280',marginBottom:14},
  wLangRow:{display:'flex',alignItems:'center',justifyContent:'center',gap:8,marginBottom:12},
  wLangLabel:{fontSize:12,color:'#6B7280',fontWeight:700},
  wLangSel:{background:'#FFF0E6',border:'1.5px solid #FFD4B3',borderRadius:8,padding:'5px 8px',fontSize:13,fontWeight:700,cursor:'pointer',color:'#FF6B00',fontFamily:"'Nunito',sans-serif",outline:'none'},
  wVoiceHint:{fontSize:11,color:'#FF6B00',fontWeight:700,background:'#FFF0E6',borderRadius:8,padding:'6px 10px',marginBottom:14},
  wSuggGrid:{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8},
  wSuggBtn:{background:'#F8F5F0',border:'1.5px solid #E5E7EB',borderRadius:10,padding:'10px 8px',fontSize:12,fontWeight:700,cursor:'pointer',color:'#2D2D2D',textAlign:'left',transition:'all 0.2s',fontFamily:"'Nunito',sans-serif"},
  msgRow:{display:'flex',gap:8,alignItems:'flex-end'},
  msgRowUser:{flexDirection:'row-reverse'},
  aiAva:{width:34,height:34,borderRadius:'50%',flexShrink:0,background:'linear-gradient(135deg,#FF6B00,#F59E0B)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:17},
  userAva:{width:34,height:34,borderRadius:'50%',flexShrink:0,background:'linear-gradient(135deg,#6366F1,#8B5CF6)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:17},
  bubble:{maxWidth:'80%',padding:'12px 15px',borderRadius:18,boxShadow:'0 2px 12px rgba(0,0,0,0.08)'},
  bubbleAI:{background:'white',borderRadius:'4px 18px 18px 18px',color:'#1A1A2E'},
  bubbleUser:{background:'linear-gradient(135deg,#FF6B00,#FF8C42)',borderRadius:'18px 4px 18px 18px',color:'white'},
  msgTag:{fontSize:10,fontWeight:800,color:'#FF6B00',marginBottom:7,textTransform:'uppercase',letterSpacing:0.6},
  chipRow:{display:'flex',flexWrap:'wrap',gap:6,marginTop:10},
  chip:{background:'#F8F5F0',border:'1.5px solid #E5E7EB',borderRadius:20,padding:'5px 10px',fontSize:11,fontWeight:700,cursor:'pointer',color:'#2D2D2D',transition:'all 0.18s',fontFamily:"'Nunito',sans-serif"},
  typingBubble:{background:'white',borderRadius:'4px 18px 18px 18px',padding:'12px 16px',display:'flex',flexDirection:'column',gap:4,boxShadow:'0 2px 12px rgba(0,0,0,0.08)'},
  typingInner:{display:'flex',gap:5,alignItems:'center'},
  tDot:{width:8,height:8,borderRadius:'50%',background:'#FF6B00',display:'inline-block',animation:'dotBounce 1.2s infinite'},
  typingLabel:{fontSize:10,color:'#9CA3AF',fontWeight:700},
  suggsDrop:{position:'fixed',left:'50%',transform:'translateX(-50%)',width:'100%',maxWidth:480,background:'white',borderTop:'1.5px solid #FFD4B3',boxShadow:'0 -4px 20px rgba(0,0,0,0.10)',zIndex:98,boxSizing:'border-box'},
  suggsHead:{padding:'6px 16px',fontSize:10,fontWeight:800,color:'#FF6B00',textTransform:'uppercase',letterSpacing:0.5,background:'#FFF9F5'},
  suggsItem:{width:'100%',padding:'10px 16px',background:'transparent',border:'none',borderBottom:'1px solid #FFF0E6',fontSize:13,cursor:'pointer',textAlign:'left',color:'#2D2D2D',fontWeight:600,display:'flex',alignItems:'center',gap:8,fontFamily:"'Nunito',sans-serif"},
  recBar:{position:'fixed',left:'50%',transform:'translateX(-50%)',width:'100%',maxWidth:480,background:'#FEF2F2',borderTop:'1px solid #FECACA',padding:'8px 16px',fontSize:12,color:'#DC2626',fontWeight:700,textAlign:'center',zIndex:97,animation:'micPulse 1s infinite',boxSizing:'border-box'},
  inputBar:{position:'fixed',left:'50%',transform:'translateX(-50%)',width:'100%',maxWidth:480,background:'white',borderTop:'2px solid #FFD4B3',padding:'10px 12px',display:'flex',gap:8,alignItems:'flex-end',zIndex:99,boxSizing:'border-box',boxShadow:'0 -4px 20px rgba(0,0,0,0.08)'},
  micBtn:{width:44,height:44,borderRadius:'50%',background:'#F8F5F0',border:'2px solid #E5E7EB',cursor:'pointer',fontSize:20,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,transition:'all 0.2s'},
  micBtnRec:{background:'#FEF2F2',borderColor:'#FECACA',animation:'micPulse 1s infinite'},
  textarea:{flex:1,border:'2px solid #E5E7EB',borderRadius:14,padding:'10px 14px',fontSize:14,fontFamily:"'Nunito',sans-serif",color:'#1A1A2E',outline:'none',resize:'none',minHeight:44,maxHeight:120,lineHeight:1.5,background:'#F8F5F0',transition:'border-color 0.2s',boxSizing:'border-box'},
  sendBtn:{width:44,height:44,borderRadius:'50%',background:'linear-gradient(135deg,#FF6B00,#F59E0B)',border:'none',cursor:'pointer',fontSize:18,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,color:'white',boxShadow:'0 4px 16px rgba(255,107,0,0.4)',transition:'all 0.2s'},
  sendBtnOff:{opacity:0.4,cursor:'not-allowed',boxShadow:'none'}
};

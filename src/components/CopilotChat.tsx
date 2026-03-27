import { useState, useEffect, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Send, Loader2, Navigation, Mic, MicOff, MessageSquare, Volume2, Globe, ChevronRight, ArrowRight } from 'lucide-react';
import { useSaarthiPulse } from '@/hooks/useSaarthiPulse';
import type { Location } from '@/types';

// ── Markdown ──────────────────────────────────────────────────────────────────
const renderMarkdown = (text: string): React.ReactNode[] => {
  const lines = text.split('\n');
  const nodes: React.ReactNode[] = [];
  const inline = (line: string, key: string | number): React.ReactNode => {
    const parts = line.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/);
    return <span key={key}>{parts.map((p, i) => {
      if (p.startsWith('**') && p.endsWith('**')) return <strong key={i} className="font-semibold">{p.slice(2,-2)}</strong>;
      if (p.startsWith('*') && p.endsWith('*')) return <em key={i}>{p.slice(1,-1)}</em>;
      return p;
    })}</span>;
  };
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { nodes.push(<div key={i} className="h-1.5" />); i++; continue; }
    if (line.match(/^[•\-*] /) || line.match(/^\d+[.)]/)) {
      const items: React.ReactNode[] = [];
      while (i < lines.length && (lines[i].match(/^[•\-*] /) || lines[i].match(/^\d+[.)]/) || lines[i].trim() === '')) {
        if (lines[i].trim()) items.push(<li key={i} className="ml-3 mb-1 text-sm leading-relaxed">{inline(lines[i].replace(/^[•\-*] |^\d+[.)] /, ''), i)}</li>);
        i++;
      }
      nodes.push(<ul key={`ul-${i}`} className="list-disc list-outside space-y-0.5 my-1.5 pl-2">{items}</ul>);
      continue;
    }
    nodes.push(<p key={i} className="text-sm leading-relaxed mb-1.5">{inline(line, i)}</p>);
    i++;
  }
  return nodes;
};

// ── Nature SVG Element ─────────────────────────────────────────────────────────
// A beautiful animated Earth globe with aurora and nature rings
const NatureElement = ({ state }: { state: 'idle' | 'listening' | 'speaking' | 'thinking' }) => {
  const colors = {
    idle:      { orb: ['#86efac','#34d399','#059669','#065f46'], glow: 'rgba(52,211,153,0.25)', ring: '#34d399' },
    listening: { orb: ['#7dd3fc','#38bdf8','#0ea5e9','#0369a1'], glow: 'rgba(56,189,248,0.35)', ring: '#38bdf8' },
    speaking:  { orb: ['#c4b5fd','#a78bfa','#7c3aed','#4c1d95'], glow: 'rgba(167,139,250,0.35)', ring: '#a78bfa' },
    thinking:  { orb: ['#fde68a','#fbbf24','#d97706','#92400e'], glow: 'rgba(251,191,36,0.25)', ring: '#fbbf24' },
  };
  const c = colors[state];
  const isActive = state === 'listening' || state === 'speaking';

  return (
    <div className="relative flex items-center justify-center" style={{ width: 220, height: 220 }}>
      {/* Glow bloom */}
      <div className="absolute inset-0 rounded-full transition-all duration-1000"
        style={{ background: `radial-gradient(circle, ${c.glow} 0%, transparent 70%)`, transform: isActive ? 'scale(1.3)' : 'scale(1)' }} />

      {/* Outer aurora ring */}
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 220 220">
        <defs>
          <linearGradient id="auroraGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={c.ring} stopOpacity="0.8" />
            <stop offset="50%" stopColor={c.ring} stopOpacity="0.2" />
            <stop offset="100%" stopColor={c.ring} stopOpacity="0.8" />
          </linearGradient>
          {/* Leaf / organic petal shape */}
          <clipPath id="globeClip">
            <circle cx="110" cy="110" r="68" />
          </clipPath>
        </defs>

        {/* Rotating outer decorative petals (like a flower/earth) */}
        {[0,45,90,135,180,225,270,315].map((deg, idx) => (
          <ellipse key={idx}
            cx="110" cy="110"
            rx="8" ry="28"
            fill={c.ring}
            fillOpacity={0.15 + (idx % 3) * 0.05}
            transform={`rotate(${deg} 110 110) translate(0 -80)`}
          />
        ))}

        {/* Middle ring */}
        <circle cx="110" cy="110" r="90" fill="none" stroke={c.ring} strokeWidth="1" strokeOpacity="0.3"
          strokeDasharray={isActive ? "8 4" : "4 8"} >
          <animateTransform attributeName="transform" type="rotate" from="0 110 110" to="360 110 110"
            dur={isActive ? "6s" : "12s"} repeatCount="indefinite" />
        </circle>

        {/* Inner botanical ring */}
        <circle cx="110" cy="110" r="76" fill="none" stroke={c.ring} strokeWidth="0.5" strokeOpacity="0.5">
          <animateTransform attributeName="transform" type="rotate" from="360 110 110" to="0 110 110"
            dur="8s" repeatCount="indefinite" />
        </circle>

        {/* Earth globe */}
        <circle cx="110" cy="110" r="68" fill="url(#globeFill)" />
        <defs>
          <radialGradient id="globeFill" cx="38%" cy="35%" r="65%">
            <stop offset="0%" stopColor={c.orb[0]} />
            <stop offset="35%" stopColor={c.orb[1]} />
            <stop offset="70%" stopColor={c.orb[2]} />
            <stop offset="100%" stopColor={c.orb[3]} />
          </radialGradient>
        </defs>

        {/* Continent-like organic shapes */}
        <g clipPath="url(#globeClip)" opacity="0.25">
          {/* Large landmass */}
          <ellipse cx="95" cy="90" rx="30" ry="18" fill="white" transform="rotate(-20 95 90)" />
          <ellipse cx="125" cy="115" rx="20" ry="12" fill="white" transform="rotate(15 125 115)" />
          <ellipse cx="85" cy="130" rx="15" ry="8" fill="white" transform="rotate(5 85 130)" />
          <ellipse cx="130" cy="85" rx="10" ry="6" fill="white" transform="rotate(-10 130 85)" />
        </g>

        {/* Specular highlight */}
        <ellipse cx="88" cy="86" rx="22" ry="14" fill="white" fillOpacity="0.18" transform="rotate(-30 88 86)" />
        <ellipse cx="84" cy="83" rx="8" ry="5" fill="white" fillOpacity="0.25" transform="rotate(-30 84 83)" />

        {/* Orbit dots */}
        {isActive && [0,120,240].map((offset, idx) => (
          <circle key={idx} cx="110" cy="32" r="3" fill={c.ring} fillOpacity="0.8">
            <animateTransform attributeName="transform" type="rotate"
              from={`${offset} 110 110`} to={`${offset + 360} 110 110`}
              dur={`${2 + idx * 0.5}s`} repeatCount="indefinite" />
          </circle>
        ))}
      </svg>
    </div>
  );
};

interface Message { role: 'user' | 'assistant'; content: string; }
interface CopilotChatProps { userLocation: Location | null; facilities?: any[]; }

const LANGUAGES = [
  { code: 'en', label: 'English', voice: 'en-IN' },
  { code: 'hi', label: 'हिन्दी', voice: 'hi-IN' },
  { code: 'ta', label: 'தமிழ்', voice: 'ta-IN' },
  { code: 'te', label: 'తెలుగు', voice: 'te-IN' },
  { code: 'mr', label: 'मराठी', voice: 'mr-IN' },
  { code: 'bn', label: 'বাংলা', voice: 'bn-IN' },
];

const CopilotChat = ({ userLocation, facilities = [] }: CopilotChatProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [locationName, setLocationName] = useState('');
  const [mode, setMode] = useState<'text' | 'voice'>('text');
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const isListeningRef = useRef(false);
  const [language, setLanguage] = useState('en');
  const [showLangPicker, setShowLangPicker] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const { toast } = useToast();
  const { pulse, clearInterjection } = useSaarthiPulse(userLocation);

  const voiceState = loading ? 'thinking' : isListening ? 'listening' : isSpeaking ? 'speaking' : 'idle';

  useEffect(() => {
    if (pulse.isInterjectionNeeded && pulse.message) {
      setMessages(prev => [...prev, { role: 'assistant', content: pulse.message }]);
      clearInterjection();
    }
  }, [pulse.isInterjectionNeeded, pulse.message, clearInterjection]);

  useEffect(() => {
    if (userLocation) {
      fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${userLocation.lat}&longitude=${userLocation.lng}&localityLanguage=en`)
        .then(r => r.json()).then(d => setLocationName(d.city || d.locality || '')).catch(() => {});
    }
  }, [userLocation]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const [interimText, setInterimText] = useState('');
  const transcriptRef = useRef('');
  const accumulatedRef = useRef('');
  const interimRef = useRef('');
  const silenceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const stopAndSend = () => {
    if (!isListeningRef.current) return;
    try { recognitionRef.current?.stop(); } catch(e) {}
    if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current);
    
    setIsListening(false);
    isListeningRef.current = false;
    const fullText = (transcriptRef.current + ' ' + interimRef.current).trim();
    
    setInterimText('');
    interimRef.current = '';
    transcriptRef.current = '';
    accumulatedRef.current = '';
    
    if (fullText) {
      handleSend(fullText);
    }
  };

  const initRecognition = () => {
    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) return null;
    const rec = new SpeechRec();
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    rec.lang = LANGUAGES.find(l => l.code === language)?.voice || 'en-IN';

    rec.onresult = (e: any) => {
      if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current);

      let sessionFinal = '';
      let interim = '';
      for (let i = 0; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) {
          sessionFinal += t + ' ';
        } else {
          interim += t;
        }
      }
      
      // Full transcript = accumulated from previous restarts + current session finals
      transcriptRef.current = (accumulatedRef.current + ' ' + sessionFinal).trim();
      interimRef.current = interim;
      setInterimText(interim);

      // Auto-send after 1.5 seconds of silence
      const currentFullText = (transcriptRef.current + ' ' + interim).trim();
      if (currentFullText.length > 0) {
        silenceTimeoutRef.current = setTimeout(() => {
          stopAndSend();
        }, 1500);
      }
    };

    rec.onerror = (e: any) => {
      if (e.error === 'no-speech' || e.error === 'aborted') {
        console.log(`🎙 Speech ended: ${e.error}`);
        return;
      }
      
      const currentFullText = (transcriptRef.current + ' ' + interimRef.current).trim();
      if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current);
      
      setIsListening(false);
      isListeningRef.current = false;
      setInterimText('');
      interimRef.current = '';

      if (e.error === 'not-allowed' || e.error === 'permission-denied') {
        if (currentFullText.length > 0) {
          // If we already heard something but the browser blocked the auto-restart due to missing user gesture,
          // just gracefully send what we have instead of showing an error.
          handleSend(currentFullText);
          transcriptRef.current = '';
          accumulatedRef.current = '';
        } else {
          toast({ title: "Microphone blocked", description: "Please allow mic access. (Note: in-app browsers like Instagram/Discord often block microphones).", variant: "destructive" });
        }
      } else if (e.error === 'network') {
        toast({ title: "Network error", description: "Speech recognition requires an internet connection.", variant: "destructive" });
      } else {
        toast({ title: "Voice stopped", description: "The browser stopped listening. Tap the mic to try again.", variant: "default" });
      }
    };

    rec.onend = () => {
      if (isListeningRef.current) {
        accumulatedRef.current = transcriptRef.current;
        try { 
          rec.start(); 
        } catch (err) {
          setIsListening(false);
          isListeningRef.current = false;
          // If browser completely denies the restart synchronously
          if (transcriptRef.current.trim()) {
            handleSend(transcriptRef.current.trim());
            transcriptRef.current = '';
            accumulatedRef.current = '';
          }
        }
      }
    };

    return rec;
  };

  const toggleListening = () => {
    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) {
      toast({ title: "Voice unavailable", description: "Your browser doesn't support web speech recognition. Try Chrome or Edge.", variant: "destructive" });
      return;
    }

    // INTERRUPT: If AI is actively speaking, tapping the mic shuts it up immediately
    if (isSpeaking) {
      if (window.speechSynthesis) window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }

    if (isListening) {
      // STOP listening manually
      stopAndSend();
    } else {
      // START listening
      transcriptRef.current = '';
      accumulatedRef.current = '';
      interimRef.current = '';
      setInterimText('');
      if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current);
      
      const rec = initRecognition();
      if (!rec) return;
      recognitionRef.current = rec;
      try { 
        rec.start(); 
        setIsListening(true);
        isListeningRef.current = true; 
      } catch (err: any) {
        console.error("Failed to start speech recognition:", err);
        toast({ title: "Error starting mic", description: err.message || "Failed to start listening.", variant: "destructive" });
        setIsListening(false);
        isListeningRef.current = false;
      }
    }
  };

  const speakText = (text: string) => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const clean = text.replace(/\[ACTION:[^\]]+\]/g, '').replace(/\*\*/g, '').replace(/\*/g, '').replace(/#+\s/g, '').trim();
    if (!clean) return;

    // Split into sentences to avoid Chrome's ~15s TTS cutoff bug
    const sentences = clean.match(/[^.!?\n]+[.!?]?/g) || [clean];
    const chunks = sentences.reduce<string[]>((acc, s) => {
      const trimmed = s.trim();
      if (!trimmed) return acc;
      const last = acc[acc.length - 1];
      // Merge short sentences into ~120 char chunks
      if (last && last.length + trimmed.length < 120) {
        acc[acc.length - 1] = last + ' ' + trimmed;
      } else {
        acc.push(trimmed);
      }
      return acc;
    }, []);

    const voiceLang = LANGUAGES.find(l => l.code === language)?.voice || 'en-IN';
    setIsSpeaking(true);

    // Chrome resume() keepalive — prevents speech from pausing silently
    const keepAlive = setInterval(() => {
      if (window.speechSynthesis.speaking) {
        window.speechSynthesis.resume();
      }
    }, 5000);

    chunks.forEach((chunk, i) => {
      const utt = new SpeechSynthesisUtterance(chunk);
      utt.lang = voiceLang;
      utt.rate = 0.95;
      if (i === chunks.length - 1) {
        utt.onend = () => {
          clearInterval(keepAlive);
          setIsSpeaking(false);
          // Auto-listen again in voice mode for natural conversation
          if (mode === 'voice') {
            setTimeout(() => toggleListening(), 500);
          }
        };
      }
      window.speechSynthesis.speak(utt);
    });
  };

  const handleSend = async (overrideInput?: string) => {
    const activeInput = overrideInput || input;
    if (!activeInput.trim() || loading) return;
    const userMsg: Message = { role: 'user', content: activeInput };
    setMessages(prev => [...prev, userMsg]);
    if (!overrideInput) setInput('');
    setLoading(true);

    const langLabel = LANGUAGES.find(l => l.code === language)?.label || 'English';
    const systemPrompt = `You are Saarthi, a highly intelligent disaster management AI for India.
Rules:
- Respond ONLY in ${langLabel}.
- Be helpful and extremely detailed when providing safety guidelines or disaster protocols.
- For emergency steps, use bullet points for clarity.
- No greetings, no filler. Only facts and actionable advice.
- ONLY include the token [ACTION:SHOW_FACILITIES:hospital] if the user explicitly asks for:
  a) medical help, an ambulance, a doctor, or an injury.
  b) the nearest hospital or clinic.
- DO NOT include hospital tokens for general safety questions like "what to do in an earthquake" unless they mention being hurt.
- User location: ${locationName || 'India'}.`;
    try {
      const groqMessages = [
        { role: 'system', content: systemPrompt },
        ...[...messages, userMsg].slice(-10).map(m => ({ role: m.role, content: m.content })),
      ];
      let aiText = '';
      try {
        const { data, error } = await supabase.functions.invoke('v1-copilot-chat', { body: { messages: groqMessages } });
        if (error) throw error;
        aiText = data.message;
      } catch {
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: 'llama-3.3-70b-versatile', messages: groqMessages }),
        });
        aiText = (await response.json()).choices[0].message.content;
      }
      setMessages(prev => [...prev, { role: 'assistant', content: aiText }]);
      if (mode === 'voice') speakText(aiText);
    } catch {
      toast({ title: 'Connection error', description: 'Could not reach Saarthi.', variant: 'destructive' });
    } finally { setLoading(false); }
  };

  const handleActionClick = (token: string) => {
    const action = token.replace('[ACTION:', '').replace(']', '');
    const parts = action.split(':');
    const cmd = parts[0];
    const value = parts[1];

    console.log(`📡 Saarthi UI Action triggered: ${cmd} (${value})`);

    if (cmd === 'SHOW_FACILITIES') {
      // Handled by inline facility cards mostly, but for buttons:
      window.dispatchEvent(new CustomEvent('changeTab', { detail: 'emergency-services' }));
    } else if (cmd === 'SHOW_CONTACTS' || cmd === 'EMERGENCY_CONTACTS') {
      window.dispatchEvent(new CustomEvent('changeTab', { detail: 'guidelines' }));
      toast({ title: "Emergency Contacts", description: "Switching to safety guidelines & numbers." });
    } else if (cmd === 'SHOW_HEATMAP' || cmd === 'SHOW_MAP') {
      window.dispatchEvent(new CustomEvent('changeTab', { detail: 'overview' }));
      toast({ title: "Monitoring Map", description: "Switching to live disaster heatmap." });
    } else if (cmd === 'SHOW_ALERTS') {
      window.dispatchEvent(new CustomEvent('changeTab', { detail: 'early-alerts' }));
    } else if (cmd === 'SHOW_WEATHER') {
      window.dispatchEvent(new CustomEvent('changeTab', { detail: 'weather' }));
    }
  };

  const currentLang = LANGUAGES.find(l => l.code === language) || LANGUAGES[0];
  const quickPrompts = [
    'Nearest hospital',
    'Flood safety steps',
    'Emergency contacts',
    'Earthquake protocol',
    'Cyclone warning signs',
    'Evacuation routes',
    'First aid tips',
    'Fire emergency steps',
  ];

  const bgStyle = { background: 'linear-gradient(160deg, #dff0fb 0%, #e8f4fd 50%, #f0f8ff 100%)' };

  // ── Shared Header ─────────────────────────────────────────────────────────────
  const Header = () => (
    <div className="flex items-center justify-between px-4 pt-4 pb-3 flex-shrink-0">
      {/* Mode toggle pill */}
      <div className="flex items-center bg-white/50 backdrop-blur-sm border border-white/80 rounded-full p-1 gap-1">
        <button
          onClick={() => { setMode('text'); setIsListening(false); recognitionRef.current?.stop(); window.speechSynthesis?.cancel(); setIsSpeaking(false); }}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${mode === 'text' ? 'bg-white text-slate-700 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
        >
          <MessageSquare className="w-3.5 h-3.5" />
          Text
        </button>
        <button
          onClick={() => setMode('voice')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${mode === 'voice' ? 'bg-white text-slate-700 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
        >
          <Mic className="w-3.5 h-3.5" />
          Voice
        </button>
      </div>

      {/* Language picker */}
      <div className="relative">
        <button
          onClick={() => setShowLangPicker(v => !v)}
          className="flex items-center gap-1.5 bg-white/60 backdrop-blur-sm border border-white/80 rounded-full px-3 py-1.5 text-xs font-semibold text-slate-500 hover:text-slate-700 transition-colors"
        >
          <Globe className="w-3.5 h-3.5" />
          {currentLang.label}
        </button>
        {showLangPicker && (
          <div className="absolute top-9 right-0 bg-white/95 backdrop-blur-xl border border-slate-100 rounded-2xl shadow-2xl py-2 z-50 min-w-[130px]">
            {LANGUAGES.map(l => (
              <button key={l.code} onClick={() => { setLanguage(l.code); setShowLangPicker(false); }}
                className={`w-full text-left px-4 py-2.5 text-sm font-medium transition-colors ${language === l.code ? 'text-sky-500 bg-sky-50' : 'text-slate-600 hover:bg-slate-50'}`}>
                {l.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  // ── Voice Mode ────────────────────────────────────────────────────────────────
  if (mode === 'voice') {
    return (
      <div className="h-full flex flex-col" style={bgStyle}>
        <Header />

        {/* Nature visual + status */}
        <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6">
          <NatureElement state={voiceState} />
          <div className="text-center space-y-1 mt-2">
            <p className="text-base font-semibold text-slate-600">
              {isListening ? '🎙 Listening...' : isSpeaking ? '🔊 Speaking...' : loading ? '💭 Thinking...' : 'Tap mic to speak'}
            </p>
            {isListening && (
              <p className="text-[10px] text-slate-400 mt-0.5 uppercase tracking-wider">
                Speak now • Auto-sends when you pause
              </p>
            )}
            {isListening && (transcriptRef.current || interimText) && (
              <p className="text-sm text-slate-500 max-w-[280px] text-center leading-relaxed px-2">
                {transcriptRef.current}{interimText && <span className="text-slate-400 italic">{' '}{interimText}</span>}
              </p>
            )}
            {!isListening && messages.length > 0 && !isSpeaking && (
              <p className="text-xs text-slate-400 max-w-[240px] text-center leading-relaxed line-clamp-2">
                {messages[messages.length - 1].content.replace(/\[ACTION:[^\]]+\]/g, '').slice(0, 90)}...
              </p>
            )}
          </div>
        </div>

        {/* Controls */}
        <div className="pb-8 px-6">
          <div className="flex items-center justify-center gap-8">
            {/* Stop speaking */}
            <button
              onClick={() => { window.speechSynthesis?.cancel(); setIsSpeaking(false); }}
              className="w-12 h-12 rounded-full bg-white/60 backdrop-blur-sm border border-white/80 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors shadow-sm"
            >
              <Volume2 className="w-5 h-5" />
            </button>

            {/* Mic button */}
            <button
              onClick={toggleListening}
              disabled={loading}
              className={`w-18 h-18 w-[72px] h-[72px] rounded-full flex items-center justify-center transition-all duration-300 shadow-lg active:scale-95 ${
                isListening ? 'bg-red-400 text-white scale-110 shadow-red-200' : 'bg-white text-sky-500 hover:scale-105 hover:shadow-xl'
              }`}
            >
              {loading ? <Loader2 className="w-7 h-7 animate-spin text-amber-400" />
                : isListening ? <MicOff className="w-7 h-7" /> : <Mic className="w-7 h-7" />}
            </button>

            {/* Language */}
            <button onClick={() => setShowLangPicker(v => !v)}
              className="w-12 h-12 rounded-full bg-white/60 backdrop-blur-sm border border-white/80 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors shadow-sm">
              <Globe className="w-5 h-5" />
            </button>
          </div>
          <p className="text-center text-[10px] text-slate-400/60 mt-5 font-medium">Saarthi AI · Predict Aid</p>
        </div>
      </div>
    );
  }

  // ── Text Chat Mode ────────────────────────────────────────────────────────────
  return (
    <div className="h-full flex flex-col" style={bgStyle}>
      <Header />

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-2 space-y-4">
        {messages.length === 0 ? (
          <div className="pt-2 space-y-5">
            <div className="flex flex-col items-center py-6">
              <NatureElement state="idle" />
              <h2 className="text-lg font-bold text-slate-700 -mt-2">Ask Saarthi</h2>
              <p className="text-sm text-slate-400 mt-1">
                {locationName ? `Serving ${locationName}` : 'Your disaster management AI'}
              </p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {quickPrompts.map((q, i) => (
                <button key={i} onClick={() => handleSend(q)}
                  className="w-full flex items-center justify-between bg-white/40 backdrop-blur-xl border border-white/50 shadow-sm rounded-2xl px-4 py-3 text-xs lg:text-sm font-medium text-slate-700 hover:bg-white/60 hover:border-white/70 transition-all duration-300 active:scale-[0.98] text-left">
                  <span className="leading-snug truncate pr-1">{q}</span>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg, i) => (
            <div key={i} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
              {msg.role === 'user' ? (
                <div className="max-w-[80%] bg-white/80 backdrop-blur-sm border border-white/90 rounded-2xl rounded-tr-sm px-4 py-3 shadow-sm">
                  <p className="text-sm text-slate-700 font-medium">{msg.content}</p>
                </div>
              ) : (
                <div className="max-w-[90%] space-y-2">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-5 h-5 rounded-full flex-shrink-0" style={{ background: 'radial-gradient(circle at 35% 35%, #86efac, #34d399 50%, #059669)' }} />
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Saarthi</span>
                  </div>
                  <div className="text-slate-600 leading-relaxed">
                    {renderMarkdown(msg.content.replace(/\[ACTION:[^\]]+\]/g, ''))}
                  </div>
                  <div className="flex items-center gap-3">
                    <button onClick={() => speakText(msg.content)}
                      className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-400 hover:text-sky-500 transition-colors">
                      <Volume2 className="w-3 h-3" /> Listen
                    </button>
                  </div>

                  {/* Facility cards */}
                  {msg.content.includes('SHOW_FACILITIES') && facilities.length > 0 && (
                    <div className="mt-2 space-y-2">
                      {facilities.slice(0, 3).map((f, j) => (
                        <div key={j} className="flex items-center justify-between bg-white/60 backdrop-blur-sm border border-white/80 rounded-xl px-3 py-2.5">
                          <div>
                            <p className="text-xs font-semibold text-slate-700 truncate max-w-[160px]">{f.name}</p>
                            <p className="text-[10px] text-slate-400 font-medium">{f.distance?.toFixed(1)} km</p>
                          </div>
                          <button onClick={() => {
                            window.dispatchEvent(new CustomEvent('changeTab', { detail: 'emergency-services' }));
                            setTimeout(() => window.dispatchEvent(new CustomEvent('routeToFacility', { detail: f })), 300);
                          }} className="flex items-center gap-1 bg-sky-50 hover:bg-sky-500 text-sky-500 hover:text-white text-[10px] font-bold px-3 py-1.5 rounded-lg transition-all flex-shrink-0 ml-2">
                            <Navigation className="w-3 h-3" /> Directions
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Action pills */}
                  {((msg.content.match(/\[ACTION:[^\]]+\]/g) as string[]) || []).filter(t => !t.includes('SHOW_FACILITIES')).map((token, j) => (
                    <button 
                      key={j}
                      onClick={() => handleActionClick(token)}
                      className="inline-flex items-center gap-1.5 bg-white/60 backdrop-blur-sm border border-sky-100 text-sky-500 text-[11px] font-semibold px-3 py-1.5 rounded-full mt-1 mr-1 hover:bg-sky-500 hover:text-white transition-all active:scale-95 shadow-sm"
                    >
                      {token.split(':')[1].replace(/_/g, ' ').replace(']', '')} <ArrowRight className="w-3 h-3" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))
        )}

        {loading && (
          <div className="flex items-start gap-2">
            <div className="w-5 h-5 rounded-full flex-shrink-0" style={{ background: 'radial-gradient(circle at 35% 35%, #86efac, #34d399 50%, #059669)' }} />
            <div className="bg-white/60 backdrop-blur-sm border border-white/80 rounded-2xl rounded-tl-sm px-4 py-3">
              <div className="flex gap-1.5 items-center h-4">
                {[0,150,300].map(d => <div key={d} className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce" style={{ animationDelay: `${d}ms` }} />)}
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} className="h-2" />
      </div>

      {/* Input */}
      <div className="px-4 pb-5 pt-3 flex-shrink-0">
        <div className="flex items-center gap-2 bg-white/60 backdrop-blur-md border border-white/90 rounded-2xl px-4 py-3 shadow-sm">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
            placeholder={`Ask Saarthi${locationName ? ` about ${locationName}` : ''}...`}
            className="flex-1 bg-transparent text-sm text-slate-600 placeholder:text-slate-400 focus:outline-none font-medium"
            disabled={loading}
          />
          <button onClick={toggleListening}
            className={`p-1.5 rounded-lg transition-colors ${isListening ? 'text-red-400' : 'text-slate-300 hover:text-sky-400'}`}>
            {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>
          <button onClick={() => handleSend()} disabled={loading || !input.trim()}
            className="w-8 h-8 flex-shrink-0 flex items-center justify-center rounded-xl bg-sky-400 hover:bg-sky-500 active:scale-95 text-white transition-all disabled:opacity-30 shadow-md shadow-sky-100">
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
          </button>
        </div>
        <p className="text-center text-[10px] text-slate-400/60 mt-2 font-medium">Saarthi AI · Predict Aid</p>
      </div>
    </div>
  );
};

export default CopilotChat;

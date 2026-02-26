import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Send, MapPin, Loader2, Bot, Navigation, Languages, WifiOff, Download } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { offlineTranslator, translateSystemMessage } from '@/utils/offlineTranslation';
import { searchOfflineKnowledge } from '@/utils/offlineKnowledge';
import type { Location } from '@/types';

// ── Markdown renderer ─────────────────────────────────────────────────────────
// Converts LLM markdown (bold, italic, headings, lists) to styled JSX
const renderMarkdown = (text: string): React.ReactNode[] => {
  const lines = text.split('\n');
  const nodes: React.ReactNode[] = [];

  const inlineFormat = (line: string, key: string | number): React.ReactNode => {
    // Process **bold**, *italic*, `code` inline
    const parts = line.split(/(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/);
    return (
      <span key={key}>
        {parts.map((part, i) => {
          if (part.startsWith('**') && part.endsWith('**'))
            return <strong key={i} className="font-semibold text-foreground">{part.slice(2, -2)}</strong>;
          if (part.startsWith('*') && part.endsWith('*'))
            return <em key={i} className="italic">{part.slice(1, -1)}</em>;
          if (part.startsWith('`') && part.endsWith('`'))
            return <code key={i} className="px-1 py-0.5 bg-muted rounded text-xs font-mono">{part.slice(1, -1)}</code>;
          return part;
        })}
      </span>
    );
  };

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { nodes.push(<div key={i} className="h-1" />); i++; continue; }
    // Headings
    if (line.startsWith('### ')) { nodes.push(<h4 key={i} className="font-bold text-sm mt-3 mb-1 text-foreground">{inlineFormat(line.slice(4), 'h')}</h4>); i++; continue; }
    if (line.startsWith('## ')) { nodes.push(<h3 key={i} className="font-bold text-base mt-3 mb-1 text-foreground">{inlineFormat(line.slice(3), 'h')}</h3>); i++; continue; }
    if (line.startsWith('# ')) { nodes.push(<h2 key={i} className="font-bold text-lg mt-3 mb-1 text-foreground">{inlineFormat(line.slice(2), 'h')}</h2>); i++; continue; }
    // Bullet lists
    if (line.match(/^[•\-*] /) || line.match(/^\d+[.)]/)) {
      const listItems: React.ReactNode[] = [];
      while (i < lines.length && (lines[i].match(/^[•\-*] /) || lines[i].match(/^\d+[.)]/) || lines[i].trim() === '')) {
        if (lines[i].trim() !== '') {
          const content = lines[i].replace(/^[•\-*] |^\d+[.)] /, '');
          listItems.push(<li key={i} className="ml-3 text-sm leading-relaxed">{inlineFormat(content, i)}</li>);
        }
        i++;
      }
      nodes.push(<ul key={`ul-${i}`} className="list-disc list-inside space-y-0.5 my-1">{listItems}</ul>);
      continue;
    }
    // Horizontal rule
    if (line.match(/^-{3,}$/) || line.match(/^_{3,}$/)) { nodes.push(<hr key={i} className="border-border/30 my-2" />); i++; continue; }
    // Regular paragraph
    nodes.push(<p key={i} className="text-sm leading-relaxed">{inlineFormat(line, i)}</p>);
    i++;
  }
  return nodes;
};

interface Message {
  role: 'user' | 'assistant';
  content: string;
  facilities?: Array<{
    name: string;
    type: string;
    lat: number;
    lng: number;
    distance: number;
    contact?: string;
  }>;
  userLocation?: Location;
}

interface CopilotChatProps {
  userLocation: Location | null;
}

const CopilotChat = ({ userLocation }: CopilotChatProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [locationName, setLocationName] = useState<string>('');
  const [language, setLanguage] = useState('en');
  const [online, setOnline] = useState(true);
  const [modelLoading, setModelLoading] = useState(false);
  const [modelProgress, setModelProgress] = useState(0);
  const [modelReady, setModelReady] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    // Fetch location name when location changes
    if (userLocation) {
      fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${userLocation.lat}&longitude=${userLocation.lng}&localityLanguage=en`)
        .then(res => res.json())
        .then(data => {
          const name = data.city || data.locality || data.principalSubdivision || 'Unknown location';
          setLocationName(name);
        })
        .catch(err => console.error('Error fetching location name:', err));
    }
  }, [userLocation]);

  useEffect(() => {
    // Probe actual connectivity — navigator.onLine is unreliable in dev/VPN environments
    const probeConnectivity = async () => {
      try {
        await fetch(
          'https://api.open-meteo.com/v1/forecast?latitude=20&longitude=78&current=temperature_2m',
          { method: 'HEAD', signal: AbortSignal.timeout(4000) }
        );
        setOnline(true);
      } catch {
        setOnline(false);
      }
    };

    probeConnectivity();
    const handleOnline = () => setOnline(true);
    const handleOffline = () => probeConnectivity();
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const initializeOfflineModel = async () => {
    if (modelReady || modelLoading) return;

    setModelLoading(true);
    setModelProgress(0);

    try {
      await offlineTranslator.initialize((progress) => {
        setModelProgress(progress);
      });
      setModelReady(true);
      toast({
        title: "Offline Mode Ready",
        description: "Translation model downloaded. You can now use Saarthi offline.",
      });
    } catch (error) {
      console.error('Failed to initialize offline model:', error);
      toast({
        title: "Download Failed",
        description: "Could not download offline translation model. Please try again.",
        variant: "destructive",
      });
    } finally {
      setModelLoading(false);
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMessage: Message = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY as string;
      if (!GROQ_API_KEY) throw new Error('GROQ_API_KEY not configured');

      const allMessages = [...messages, userMessage];

      // Build an enriched system prompt with real context
      const now = new Date();
      const dateStr = now.toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
      const timeStr = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
      const langNames: Record<string, string> = {
        en: 'English', hi: 'Hindi', ta: 'Tamil', bn: 'Bengali', te: 'Telugu',
        mr: 'Marathi', gu: 'Gujarati', kn: 'Kannada', ml: 'Malayalam', pa: 'Punjabi',
      };

      const systemPrompt = `You are Saarthi, an expert AI disaster-response and medical assistant for India, built by Team Syntax.
Current date/time in India: ${dateStr}, ${timeStr} IST.
${userLocation ? `User is located at: ${locationName || `${userLocation.lat.toFixed(4)}°N, ${userLocation.lng.toFixed(4)}°E`}` : 'User location: not yet provided.'}
Respond ONLY in ${langNames[language] || 'English'}.

You specialize in:
- Disaster preparedness & response (flood, earthquake, cyclone, fire, landslide, heatwave, cold wave, AQI)
- NDMA safety protocols and Indian government emergency procedures
- First aid & medical emergency guidance
- Locating nearby hospitals, police, shelters, fire stations
- India emergency numbers: 112 (National), 100 (Police), 101 (Fire), 102 (Ambulance), 108 (NDRF), 1099 (Coast Guard)

Formatting rules:
- Use **bold** for key terms and emergency numbers
- Use bullet lists (- item) for steps or lists
- Use ## for section headings when needed
- Keep responses concise but actionable — no unnecessary filler
- Always end with the most relevant emergency number if the situation is critical

If asked something completely unrelated to disasters/health/emergencies, politely say you specialize in disaster response and redirect.`;

      // Trim history to last 16 messages to avoid token limit issues
      const trimmedMessages = allMessages.slice(-16);

      const groqMessages = [
        { role: 'system', content: systemPrompt },
        ...trimmedMessages.map(m => ({ role: m.role, content: m.content })),
      ];

      const groqResponse = await fetch(
        'https://api.groq.com/openai/v1/chat/completions',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${GROQ_API_KEY}`,
          },
          body: JSON.stringify({
            model: 'llama-3.3-70b-versatile',
            messages: groqMessages,
            max_tokens: 1024,
          }),
        }
      );

      if (!groqResponse.ok) {
        const errData = await groqResponse.json().catch(() => ({}));
        throw new Error(errData.error?.message || `Groq API error: ${groqResponse.status}`);
      }

      const groqData = await groqResponse.json();

      if (!groqData.choices || groqData.choices.length === 0) {
        throw new Error(groqData.error?.message || 'No response from Groq');
      }

      const aiText = groqData.choices[0].message.content;


      // Parse the response to extract facility data if present
      let facilities;
      let parsedUserLocation;

      // Try to extract JSON data from the response
      try {
        const jsonMatch = aiText.match(/\{[\s\S]*"facilities"[\s\S]*\}/);
        if (jsonMatch) {
          const extracted = JSON.parse(jsonMatch[0]);
          facilities = extracted.facilities;
          parsedUserLocation = extracted.userLocation;
        }
      } catch (e) {
        // If parsing fails, it's just regular text
      }

      const assistantMessage: Message = {
        role: 'assistant',
        content: aiText,
        facilities,
        userLocation: parsedUserLocation,
      };
      setMessages(prev => [...prev, assistantMessage]);

    } catch (error) {
      console.error('Error:', error);

      // If offline or network error, use offline knowledge base
      // Fall back to offline knowledge if: no internet, fetch failed, or GROQ_API_KEY not set in Supabase
      const isNetworkError = error instanceof Error && (
        error.message === 'OFFLINE' ||
        error.message.includes('Failed to fetch') ||
        error.message.includes('NetworkError') ||
        error.message.includes('Load failed') ||
        error.message.includes('Network request failed')
      );
      if (isNetworkError) {
        try {
          // Try to find answer in offline knowledge base
          const offlineAnswer = searchOfflineKnowledge(input);

          if (offlineAnswer) {
            let response = `🔵 **Offline Knowledge Base**\n\n${offlineAnswer.answer}`;

            // Add related topics
            if (offlineAnswer.relatedTopics && offlineAnswer.relatedTopics.length > 0) {
              response += `\n\n📚 **Related topics:** ${offlineAnswer.relatedTopics.join(', ')}`;
            }

            // Translate if needed
            if (language !== 'en') {
              if (!offlineTranslator.isReady()) {
                await offlineTranslator.initialize((progress) => {
                  setModelProgress(progress);
                });
              }
              response = await translateSystemMessage(response, language);
            }

            const assistantMessage: Message = {
              role: 'assistant',
              content: response,
            };
            setMessages(prev => [...prev, assistantMessage]);

            toast({
              title: "Offline Mode",
              description: "Answer from offline knowledge base.",
              variant: "default",
            });
          } else {
            // No offline answer available
            let offlineResponse = "⚠️ I'm currently in offline mode and don't have specific information about that query in my offline database.\n\nI can help with:\n• Medical emergencies (CPR, bleeding, burns, etc.)\n• Disaster safety (earthquake, flood, fire, etc.)\n• Emergency numbers and procedures\n\nPlease connect to internet for detailed, location-specific assistance or ask about one of the topics above.";

            if (language !== 'en') {
              if (!offlineTranslator.isReady()) {
                await offlineTranslator.initialize((progress) => {
                  setModelProgress(progress);
                });
              }
              offlineResponse = await translateSystemMessage(offlineResponse, language);
            }

            const assistantMessage: Message = {
              role: 'assistant',
              content: offlineResponse,
            };
            setMessages(prev => [...prev, assistantMessage]);

            toast({
              title: "Offline Mode",
              description: "Limited information available offline.",
              variant: "default",
            });
          }
        } catch (offlineError) {
          console.error('Offline knowledge error:', offlineError);
          setMessages(prev => prev.slice(0, -1));
          toast({
            title: "Error",
            description: "Cannot process request offline. Please connect to internet.",
            variant: "destructive",
          });
        }
      } else {
        // Remove the user message on error
        setMessages(prev => prev.slice(0, -1));

        toast({
          title: "Error",
          description: error instanceof Error ? error.message : "Failed to get response. Please try again.",
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleGetDirections = (facility: any, userLoc: Location) => {
    // Navigate to emergency page with route info
    navigate('/emergency', {
      state: {
        destination: {
          lat: facility.lat,
          lng: facility.lng,
          name: facility.name
        },
        origin: userLoc
      }
    });
  };

  const quickTopics = [
    { label: '🚨 Emergency Numbers', query: 'What are the emergency helpline numbers in India?' },
    { label: '❤️ CPR Guide', query: 'How do I perform CPR on an adult?' },
    { label: '🌊 Flood Safety', query: 'What should I do during a flood?' },
    { label: '⚡ Earthquake Safety', query: 'What to do during an earthquake?' },
    { label: '🌀 Cyclone Safety', query: 'How do I stay safe during a cyclone?' },
    { label: '🎒 Emergency Kit', query: 'What should be in a 72-hour emergency survival kit?' },
    { label: '🔥 Fire Escape', query: 'What to do if there is a fire at home?' },
    { label: '🏥 First Aid', query: 'Basic first aid for bleeding wounds?' },
  ];

  // Auto-send on quick topic click
  const handleQuickTopic = useCallback((query: string) => {
    setInput(query);
    // Small delay so the input is set before handleSend reads it
    setTimeout(() => {
      const sendBtn = document.getElementById('copilot-send-btn');
      sendBtn?.click();
    }, 50);
  }, []);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 md:p-6 border-b border-border/40 bg-card/50 backdrop-blur">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Bot className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg md:text-xl font-bold text-foreground">Saarthi</h2>
              <p className="text-xs md:text-sm text-muted-foreground hidden sm:block">Disaster & Medical Response Assistant</p>
            </div>
          </div>
          <div className="flex items-center gap-2 md:gap-3 flex-wrap">
            {!online && (
              <div className="flex items-center gap-1.5 md:gap-2 text-xs md:text-sm text-muted-foreground bg-muted/30 px-2 md:px-3 py-1.5 md:py-2 rounded-lg">
                <WifiOff className="w-3 h-3 md:w-4 md:h-4 text-yellow-500" />
                <span className="font-medium">Limited connectivity — offline knowledge active</span>
              </div>
            )}
            {!modelReady && !modelLoading && language !== 'en' && (
              <Button
                variant="outline"
                size="sm"
                onClick={initializeOfflineModel}
                className="gap-1.5 text-xs md:text-sm h-8 md:h-9"
              >
                <Download className="w-3 h-3 md:w-4 md:h-4" />
                <span className="hidden sm:inline">Enable Offline Mode</span>
                <span className="sm:hidden">Offline</span>
              </Button>
            )}
            <Select value={language} onValueChange={setLanguage}>
              <SelectTrigger className="w-[120px] md:w-[160px] bg-background border-border/40 h-8 md:h-9 text-xs md:text-sm">
                <Languages className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2 text-primary" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="hi">हिन्दी</SelectItem>
                <SelectItem value="ta">தமிழ்</SelectItem>
                <SelectItem value="bn">বাংলা</SelectItem>
                <SelectItem value="te">తెలుగు</SelectItem>
                <SelectItem value="mr">मराठी</SelectItem>
                <SelectItem value="gu">ગુજરાતી</SelectItem>
                <SelectItem value="kn">ಕನ್ನಡ</SelectItem>
                <SelectItem value="ml">മലയാളം</SelectItem>
                <SelectItem value="pa">ਪੰਜਾਬੀ</SelectItem>
              </SelectContent>
            </Select>
            {userLocation && (
              <div className="hidden lg:flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 px-3 py-2 rounded-lg">
                <MapPin className="w-4 h-4 text-primary" />
                <span className="font-medium truncate max-w-[150px]">
                  {locationName || `${userLocation.lat.toFixed(2)}, ${userLocation.lng.toFixed(2)}`}
                </span>
              </div>
            )}
          </div>
        </div>
        {modelLoading && (
          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Downloading offline translation model...</span>
              <span className="text-primary font-medium">{modelProgress}%</span>
            </div>
            <Progress value={modelProgress} className="h-2" />
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 md:p-6 space-y-3 md:space-y-4">
        {messages.length === 0 && (
          <Card className="p-4 md:p-8 text-center bg-card/50 backdrop-blur border-border/40">
            <div className="w-12 h-12 md:w-16 md:h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3 md:mb-4">
              <Bot className="w-6 h-6 md:w-8 md:h-8 text-primary" />
            </div>
            <h3 className="text-base md:text-lg font-semibold mb-2 text-foreground">Welcome to Saarthi</h3>
            <p className="text-xs md:text-sm text-muted-foreground mb-4">
              Your disaster and medical response assistant. Get help with emergencies, health, weather, and safety.
              {userLocation && locationName && (
                <span className="block mt-2 text-primary font-medium">
                  📍 {locationName}
                </span>
              )}
            </p>

            {/* Quick Topic Buttons */}
            <div className="mb-4">
              <p className="text-xs md:text-sm font-medium text-muted-foreground mb-2">Quick Topics:</p>
              <div className="flex flex-wrap gap-2 justify-center">
                {quickTopics.map((topic, idx) => (
                  <Button
                    key={idx}
                    variant="outline"
                    size="sm"
                    onClick={() => handleQuickTopic(topic.query)}
                    className="text-xs h-7 md:h-8 px-2 md:px-3 hover:bg-primary/10 hover:border-primary/40 transition-colors"
                  >
                    {topic.label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs md:text-sm max-w-md mx-auto">
              <div className="p-2 md:p-3 bg-muted/50 rounded-lg text-left">
                <p className="font-medium text-foreground">Try asking:</p>
                <p className="text-muted-foreground">"What's the weather here?"</p>
              </div>
              <div className="p-2 md:p-3 bg-muted/50 rounded-lg text-left">
                <p className="font-medium text-foreground">Or:</p>
                <p className="text-muted-foreground">"Find nearby hospitals"</p>
              </div>
            </div>

            {!online && (
              <div className="mt-4 p-3 bg-warning/10 border border-warning/30 rounded-lg">
                <p className="text-xs md:text-sm text-warning font-medium">
                  📵 Offline Mode Active
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Basic medical and disaster information available
                </p>
              </div>
            )}
          </Card>
        )}

        {messages.map((message, index) => (
          <div
            key={index}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[95%] sm:max-w-[85%] md:max-w-[80%] ${message.role === 'user'
                ? 'ml-auto'
                : ''
                }`}
            >
              <div
                className={`p-3 md:p-4 rounded-2xl ${message.role === 'user'
                  ? 'bg-primary text-primary-foreground text-sm md:text-base'
                  : 'bg-card border border-border/40 text-card-foreground'
                  }`}
              >
                {message.role === 'user' ? (
                  <p className="whitespace-pre-wrap text-sm">{message.content}</p>
                ) : (
                  <div className="space-y-1 text-sm leading-relaxed">
                    {renderMarkdown(message.content)}
                  </div>
                )}
              </div>

              {/* Show facility action buttons for hospitals */}
              {message.role === 'assistant' && message.facilities && message.userLocation && (
                <div className="mt-3 space-y-2">
                  {message.facilities
                    .filter(f => f.type === 'hospital')
                    .slice(0, 5)
                    .map((facility, idx) => (
                      <Card key={idx} className="p-3 bg-card/50 border-border/40">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm text-foreground truncate">
                              {facility.name}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {(facility.distance / 1000).toFixed(1)} km away
                            </p>
                            {facility.contact && (
                              <p className="text-xs text-muted-foreground mt-1">
                                📞 {facility.contact}
                              </p>
                            )}
                          </div>
                          <Button
                            size="sm"
                            onClick={() => handleGetDirections(facility, message.userLocation!)}
                            className="shrink-0"
                          >
                            <Navigation className="w-3 h-3 mr-1" />
                            Directions
                          </Button>
                        </div>
                      </Card>
                    ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-card border border-border/40 p-4 rounded-2xl">
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                <span className="text-muted-foreground">Thinking...</span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-3 md:p-6 border-t border-border/40 bg-card/50 backdrop-blur">
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={online ? "Ask about disasters, first aid, emergency numbers..." : "Offline: ask about first aid, emergencies..."}
            className="flex-1 bg-background border-border/40 text-sm md:text-base h-9 md:h-10"
            disabled={loading}
          />
          <Button
            id="copilot-send-btn"
            onClick={handleSend}
            disabled={loading || !input.trim()}
            size="icon"
            className="shrink-0 h-9 w-9 md:h-10 md:w-10"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default CopilotChat;

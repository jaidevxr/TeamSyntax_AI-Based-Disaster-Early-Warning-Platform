import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Send, MapPin, Loader2, Bot, Navigation, Languages, WifiOff, Download } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { offlineTranslator, isOnline, translateSystemMessage, getEmergencyPhrase } from '@/utils/offlineTranslation';
import { searchOfflineKnowledge, getOfflineTopics, canAnswerOffline } from '@/utils/offlineKnowledge';
import type { Location } from '@/types';

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
      fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${userLocation.lat}&lon=${userLocation.lng}`)
        .then(res => res.json())
        .then(data => {
          const address = data.address;
          const name = address.city || address.town || address.village || address.state || 'Unknown location';
          setLocationName(name);
        })
        .catch(err => console.error('Error fetching location name:', err));
    }
  }, [userLocation]);

  useEffect(() => {
    // Monitor online/offline status
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);

    setOnline(isOnline());
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
      // Check if online and if we need offline fallback
      if (!online) {
        throw new Error('OFFLINE');
      }

      // Call Groq via Supabase Edge Function — API key is server-side only, never in client code
      const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
      const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

      const allMessages = [...messages, userMessage];

      const edgeResponse = await fetch(
        `${SUPABASE_URL}/functions/v1/copilot-chat`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            'apikey': SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({
            messages: allMessages,
            location: userLocation,
            language,
          }),
        }
      );

      if (!edgeResponse.ok) {
        const errData = await edgeResponse.json().catch(() => ({}));
        throw new Error(errData.error || `Edge function error: ${edgeResponse.status}`);
      }

      const data = await edgeResponse.json();


      // Parse the response to extract facility data if present
      let facilities;
      let parsedUserLocation;

      // Try to extract JSON data from the response
      try {
        const jsonMatch = data.message.match(/\{[\s\S]*"facilities"[\s\S]*\}/);
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
        content: data.message,
        facilities,
        userLocation: parsedUserLocation,
      };
      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Error:', error);

      // If offline or network error, use offline knowledge base
      if (error instanceof Error && (error.message === 'OFFLINE' || error.message.includes('Failed to fetch'))) {
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
    { label: 'Emergency Numbers', query: 'emergency numbers' },
    { label: 'CPR', query: 'how to do CPR' },
    { label: 'Earthquake Safety', query: 'earthquake safety' },
    { label: 'First Aid Kit', query: 'first aid kit essentials' },
    { label: 'Flood Safety', query: 'flood safety guidelines' },
    { label: 'Fire Emergency', query: 'what to do in fire emergency' },
  ];

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
              <div className="flex items-center gap-1.5 md:gap-2 text-xs md:text-sm text-warning bg-warning/10 px-2 md:px-3 py-1.5 md:py-2 rounded-lg">
                <WifiOff className="w-3 h-3 md:w-4 md:h-4" />
                <span className="font-medium">Offline</span>
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
                    onClick={() => setInput(topic.query)}
                    className="text-xs h-7 md:h-8 px-2 md:px-3"
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
                className={`p-3 md:p-4 rounded-2xl text-sm md:text-base ${message.role === 'user'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-card border border-border/40 text-card-foreground'
                  }`}
              >
                <p className="whitespace-pre-wrap">{message.content}</p>
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
            placeholder={online ? "Ask about weather, risks, facilities..." : "Ask about emergencies, first aid..."}
            className="flex-1 bg-background border-border/40 text-sm md:text-base h-9 md:h-10"
            disabled={loading}
          />
          <Button
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

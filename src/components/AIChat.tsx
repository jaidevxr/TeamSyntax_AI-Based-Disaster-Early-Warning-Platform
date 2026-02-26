import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Phone, AlertTriangle, MapPin, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ChatMessage, Location, EmergencyFacility } from '@/types';

interface AIChatProps {
  userLocation: Location | null;
  nearestFacilities: EmergencyFacility[];
}

const AIChat: React.FC<AIChatProps> = ({ userLocation, nearestFacilities }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      content: `🌱 Hello! I'm your AI Disaster Response Assistant for India. I can help you with:

• Real-time disaster information and safety guidelines
• Emergency contact numbers and nearest facilities  
• NDMA safety protocols for floods, earthquakes, cyclones
• Location-based weather alerts and advisories

How can I assist you today?`,
      sender: 'bot',
      timestamp: new Date().toISOString(),
    }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const emergencyNumbers = [
    { name: 'National Emergency', number: '112' },
    { name: 'Police', number: '100' },
    { name: 'Fire Brigade', number: '101' },
    { name: 'Ambulance', number: '102' },
    { name: 'Disaster Management', number: '108' },
    { name: 'Women Helpline', number: '1091' },
  ];

  const ndmaGuidelines = {
    earthquake: `🏗️ **Earthquake Safety Guidelines (NDMA):**

**During Earthquake:**
• Drop, Cover, and Hold On
• Stay away from windows, mirrors, heavy objects
• If outdoors, move away from buildings, trees, power lines
• If in vehicle, stop and stay inside

**After Earthquake:**
• Check for injuries, provide first aid
• Inspect your home for damage
• Be prepared for aftershocks
• Listen to official emergency broadcasts`,

    flood: `🌊 **Flood Safety Guidelines (NDMA):**

**Before/During Flood:**
• Move to higher ground immediately
• Avoid walking/driving through flood water
• Stay away from electrical lines and equipment
• Listen to weather warnings and evacuation orders

**After Flood:**
• Avoid flood waters - may be contaminated
• Check for structural damage before entering buildings
• Boil water before drinking
• Document damage with photos for insurance`,

    cyclone: `🌀 **Cyclone Safety Guidelines (NDMA):**

**Before Cyclone:**
• Secure loose objects, board up windows  
• Stock emergency supplies (water, food, medicines)
• Charge electronic devices, keep battery radio
• Know your evacuation route

**During Cyclone:**
• Stay indoors, away from windows
• Listen to official weather updates
• Do not go outside during the eye of the storm
• Be prepared for power outages`,

    fire: `🔥 **Fire Safety Guidelines (NDMA):**

**Prevention:**
• Install smoke detectors, check batteries
• Keep fire extinguisher accessible
• Plan and practice escape routes
• Maintain electrical systems properly

**During Fire:**
• Call fire department immediately (101)
• Get low and crawl under smoke
• Feel doors before opening (heat check)
• Once out, stay out - never re-enter`,
  };

  const getAIResponse = (message: string): string => {
    const msg = message.toLowerCase();

    // Emergency numbers
    if (msg.includes('emergency') || msg.includes('helpline') || msg.includes('contact') || msg.includes('number')) {
      return `🚨 **Emergency Contact Numbers for India:**

${emergencyNumbers.map(contact => `• **${contact.name}:** ${contact.number}`).join('\n')}

**State Emergency Numbers:**
• Delhi: 1077
• Mumbai: 1916  
• Kolkata: 1070
• Chennai: 1913

⚠️ **For immediate life-threatening emergencies, always call 112 (National Emergency Number)**`;
    }

    // Disaster-specific guidelines
    if (msg.includes('earthquake') || msg.includes('भूकंप')) {
      return ndmaGuidelines.earthquake;
    }
    if (msg.includes('flood') || msg.includes('बाढ़')) {
      return ndmaGuidelines.flood;
    }
    if (msg.includes('cyclone') || msg.includes('तूफान') || msg.includes('hurricane')) {
      return ndmaGuidelines.cyclone;
    }
    if (msg.includes('fire') || msg.includes('आग')) {
      return ndmaGuidelines.fire;
    }

    // Location-based help
    if (msg.includes('shelter') || msg.includes('hospital') || msg.includes('nearest')) {
      if (nearestFacilities.length > 0) {
        const shelters = nearestFacilities.filter(f => f.type === 'shelter').slice(0, 3);
        const hospitals = nearestFacilities.filter(f => f.type === 'hospital').slice(0, 3);
        
        return `📍 **Nearest Emergency Facilities:**

${hospitals.length > 0 ? `**Hospitals:**\n${hospitals.map(h => `• ${h.name} (${h.distance}km)`).join('\n')}\n` : ''}

${shelters.length > 0 ? `**Emergency Shelters:**\n${shelters.map(s => `• ${s.name} (${s.distance}km)`).join('\n')}\n` : ''}

💡 Click on any facility in the sidebar to view it on the map!`;
      } else {
        return `📍 I'm still loading nearby emergency facilities. Please enable location access and wait a moment for the data to load.

In the meantime, you can call **112** for immediate emergency assistance.`;
      }
    }

    // Weather-related
    if (msg.includes('weather') || msg.includes('rain') || msg.includes('temperature')) {
      return `🌤️ **Weather Safety Tips:**

• **Heavy Rain/Monsoon:** Avoid low-lying areas, watch for flash floods
• **Extreme Heat:** Stay hydrated, avoid outdoor activities during peak hours (11 AM - 4 PM)
• **Strong Winds:** Secure loose objects, avoid standing under trees
• **Lightning:** Stay indoors, avoid metal objects and water

Check the Weather tab in this dashboard for current conditions and alerts!`;
    }

    // General safety
    if (msg.includes('safety') || msg.includes('preparation') || msg.includes('kit')) {
      return `🎒 **Emergency Preparedness Kit (NDMA Recommended):**

**Basic Supplies (72-hour kit):**
• Water: 4 liters per person per day
• Non-perishable food items
• First aid kit and medicines
• Flashlight and extra batteries
• Battery-powered or hand crank radio
• Cash in small bills
• Important documents (waterproof container)
• Whistle for signaling help
• Local maps and emergency contact list

**Additional Items:**
• Warm clothing and blankets
• Personal hygiene items
• Phone chargers (power bank)
• Multi-purpose tools`;
    }

    // Default response
    return `🤖 I'm here to help with disaster preparedness and emergency information for India. I can assist with:

• **Emergency contacts and helpline numbers**
• **NDMA safety guidelines** for earthquakes, floods, cyclones, fires
• **Nearest emergency facilities** (hospitals, shelters, police stations)  
• **Weather safety tips** and preparedness advice
• **Emergency kit recommendations**

Ask me about specific disasters, safety procedures, or emergency contacts. For immediate life-threatening emergencies, please call **112**.`;
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim()) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      content: inputMessage,
      sender: 'user',
      timestamp: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsTyping(true);

    // Simulate AI processing time
    setTimeout(() => {
      const botResponse: ChatMessage = {
        id: (Date.now() + 1).toString(),
        content: getAIResponse(inputMessage),
        sender: 'bot',
        timestamp: new Date().toISOString(),
      };

      setMessages(prev => [...prev, botResponse]);
      setIsTyping(false);
    }, 1000 + Math.random() * 1500);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="flex flex-col h-full max-h-[600px]">
      {/* Header */}
      <div className="glass-strong p-4 border-b border-border/20 rounded-t-2xl">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Bot className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-lg">AI Disaster Assistant</h3>
            <p className="text-sm text-muted-foreground">NDMA Guidelines • Emergency Help</p>
          </div>
          <Badge variant="outline" className="ml-auto text-success">Online</Badge>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-background/50">
        {messages.map((message) => (
          <div 
            key={message.id}
            className={`flex gap-3 ${message.sender === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
          >
            <div className={`p-2 rounded-lg ${
              message.sender === 'user' 
                ? 'bg-primary/10' 
                : 'bg-muted/50'
            }`}>
              {message.sender === 'user' ? (
                <User className="h-4 w-4" />
              ) : (
                <Bot className="h-4 w-4" />
              )}
            </div>
            
            <Card className={`max-w-[80%] glass p-3 ${
              message.sender === 'user'
                ? 'bg-primary text-primary-foreground'
                : 'bg-card'
            }`}>
              <div className="space-y-2">
                <div className="text-sm whitespace-pre-wrap">{message.content}</div>
                <div className={`text-xs ${
                  message.sender === 'user' 
                    ? 'text-primary-foreground/70' 
                    : 'text-muted-foreground'
                }`}>
                  {new Date(message.timestamp).toLocaleTimeString('en-IN')}
                </div>
              </div>
            </Card>
          </div>
        ))}

        {isTyping && (
          <div className="flex gap-3">
            <div className="p-2 rounded-lg bg-muted/50">
              <Bot className="h-4 w-4" />
            </div>
            <Card className="glass p-3">
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 bg-primary rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
              </div>
            </Card>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="glass-strong p-4 border-t border-border/20 rounded-b-2xl">
        <div className="flex items-center gap-2">
          <Input
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ask about emergency procedures, safety guidelines, or nearest facilities..."
            className="flex-1 glass border-border/30 focus:border-primary/50"
          />
          <Button 
            onClick={handleSendMessage}
            disabled={!inputMessage.trim() || isTyping}
            className="bg-primary hover:bg-primary-glow"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
        
        <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
          <Shield className="h-3 w-3" />
          <span>Powered by NDMA guidelines • For emergencies call 112</span>
        </div>
      </div>
    </div>
  );
};

export default AIChat;
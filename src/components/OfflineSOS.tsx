import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import QRCode from 'react-qr-code';
import { WifiOff, HeartPulse, User, Phone, MapPin, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

const translations = {
  en: {
    title: "Offline SOS QR",
    desc: "Generate a scannable emergency profile. Works without internet.",
    name: "Full Name",
    blood: "Blood Type",
    medical: "Medical Conditions / Allergies",
    contact: "Emergency Contact Route",
    generate: "Generate Emergency QR",
    success: "Profile Saved Offline. QR Ready.",
    location: "Fetching High-Accuracy GPS...",
    locationDone: "GPS Coordinates Locked",
    scanDesc: "Show this to rescue workers. They can scan it without internet to get your medical profile and exact coordinates."
  },
  hi: {
    title: "ऑफ़लाइन SOS QR",
    desc: "स्कैन करने योग्य आपातकालीन प्रोफ़ाइल जनरेट करें। इंटरनेट के बिना काम करता है।",
    name: "पूरा नाम",
    blood: "रक्त समूह",
    medical: "चिकित्सा स्थिति / एलर्जी",
    contact: "आपातकालीन संपर्क",
    generate: "आपातकालीन QR जनरेट करें",
    success: "प्रोफ़ाइल ऑफ़लाइन सहेजी गई। QR तैयार।",
    location: "उच्च-सटीकता GPS प्राप्त किया जा रहा है...",
    locationDone: "GPS निर्देशांक लॉक किए गए",
    scanDesc: "इसे बचाव कर्मियों को दिखाएं। वे आपके मेडिकल प्रोफ़ाइल और सटीक निर्देशांक प्राप्त करने के लिए इसे इंटरनेट के बिना स्कैन कर सकते हैं।"
  }
};

interface OfflineSOSProps {
  language?: 'en' | 'hi';
  isCollapsed?: boolean;
}

const OfflineSOS: React.FC<OfflineSOSProps> = ({ language = 'en', isCollapsed = false }) => {
  const t = translations[language];
  const [isOpen, setIsOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    bloodType: '',
    medicalInfo: '',
    emergencyContact: '',
  });
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [qrData, setQrData] = useState<string | null>(null);

  // Load saved data when modal opens
  useEffect(() => {
    if (isOpen) {
      const saved = localStorage.getItem('offlineSOS_profile');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          setFormData({
            name: parsed.n || '',
            bloodType: parsed.b || '',
            medicalInfo: parsed.m || '',
            emergencyContact: parsed.c || ''
          });
          if (parsed.n) {
            setQrData(saved);
          }
        } catch (e) {}
      }

      // Grab fresh highly accurate GPS
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
          () => {},
          { enableHighAccuracy: true, maximumAge: 0 }
        );
      }
    }
  }, [isOpen]);

  const handleGenerate = () => {
    // Compress data to keep QR code density manageable
    const payload = {
      n: formData.name,
      b: formData.bloodType,
      m: formData.medicalInfo,
      c: formData.emergencyContact,
      l: location ? `${location.lat.toFixed(5)},${location.lng.toFixed(5)}` : null,
      t: Date.now()
    };
    
    const jsonStr = JSON.stringify(payload);
    localStorage.setItem('offlineSOS_profile', jsonStr);
    setQrData(jsonStr);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>
            <DialogTrigger asChild>
              <button className={`flex items-center w-full rounded-xl bg-red-50 hover:bg-red-100/80 dark:bg-red-500/10 dark:hover:bg-red-500/20 text-red-600 dark:text-red-400 font-semibold transition-all border border-red-100 dark:border-red-500/20 shadow-sm active:scale-95 group ${isCollapsed ? 'p-2 justify-center h-10' : 'p-3 gap-3'}`}>
                <div className="h-6 w-6 rounded-lg bg-transparent flex items-center justify-center group-hover:scale-105 transition-transform">
                  <WifiOff className="h-4 w-4" />
                </div>
                {!isCollapsed && (
                  <div className="text-left flex-1">
                    <p className="text-sm">{t.title}</p>
                  </div>
                )}
              </button>
            </DialogTrigger>
          </TooltipTrigger>
          {isCollapsed && (
            <TooltipContent side="right" align="center" sideOffset={14} className="bg-red-50 dark:bg-red-950/90 border border-red-200 dark:border-red-900">
              <p className="font-bold text-sm text-red-600 dark:text-red-400">{t.title}</p>
              <p className="text-xs text-red-500/80">Offline Emergency QR</p>
            </TooltipContent>
          )}
        </Tooltip>
      </TooltipProvider>

      <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl text-red-600">
            <WifiOff className="h-5 w-5" /> {t.title}
          </DialogTitle>
          <p className="text-sm text-muted-foreground">{t.desc}</p>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {!qrData ? (
            <div className="space-y-4 animate-in fade-in zoom-in duration-300">
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5 text-xs text-slate-500"><User className="w-3.5 h-3.5"/> {t.name}</Label>
                <Input value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} placeholder="John Doe" />
              </div>
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5 text-xs text-slate-500"><HeartPulse className="w-3.5 h-3.5"/> {t.blood}</Label>
                <Input value={formData.bloodType} onChange={(e) => setFormData({...formData, bloodType: e.target.value})} placeholder="O+ / AB-" />
              </div>
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5 text-xs text-slate-500"><Phone className="w-3.5 h-3.5"/> {t.contact}</Label>
                <Input value={formData.emergencyContact} onChange={(e) => setFormData({...formData, emergencyContact: e.target.value})} placeholder="+91 9876543210" />
              </div>
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5 text-xs text-slate-500">⚕️ {t.medical}</Label>
                <Textarea value={formData.medicalInfo} onChange={(e) => setFormData({...formData, medicalInfo: e.target.value})} placeholder="Diabetic, allergic to penicillin..." className="h-20" />
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-lg border flex items-center gap-3">
                <MapPin className={`w-5 h-5 ${location ? 'text-green-500' : 'text-amber-500 animate-pulse'}`} />
                <span className="text-xs font-medium">{location ? t.locationDone : t.location}</span>
                {location && <CheckCircle2 className="w-4 h-4 text-green-500 ml-auto" />}
              </div>

              <Button onClick={handleGenerate} disabled={!formData.name} className="w-full bg-red-600 hover:bg-red-700 h-12 text-md font-bold text-white shadow-lg shadow-red-500/30">
                {t.generate}
              </Button>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center space-y-6 animate-in slide-in-from-bottom-4 duration-500 py-6">
              <div className="p-4 bg-white rounded-2xl shadow-xl border-4 border-red-100 dark:border-red-900/50">
                <QRCode value={qrData} size={220} level="M" />
              </div>
              
              <div className="text-center space-y-2 px-4">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400 rounded-full text-xs font-bold mb-2">
                  <CheckCircle2 className="w-3.5 h-3.5" /> {t.success}
                </div>
                <h3 className="text-xl font-black text-foreground">{formData.name}</h3>
                <p className="text-sm font-semibold text-red-600 dark:text-red-400">🩸 {formData.bloodType || 'Unknown Blood Type'}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium max-w-[260px] mx-auto leading-relaxed">{t.scanDesc}</p>
              </div>

              <Button variant="outline" onClick={() => setQrData(null)} className="mt-4 text-xs font-bold w-full rounded-xl">
                Edit Information
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default OfflineSOS;

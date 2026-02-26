import { pipeline } from '@huggingface/transformers';

// Language code mappings for translation models
const LANGUAGE_CODES: { [key: string]: string } = {
  'en': 'eng_Latn',
  'hi': 'hin_Deva',
  'ta': 'tam_Taml',
  'bn': 'ben_Beng',
  'te': 'tel_Telu',
  'mr': 'mar_Deva',
  'gu': 'guj_Gujr',
  'kn': 'kan_Knda',
  'ml': 'mal_Mlym',
  'pa': 'pan_Guru'
};

const LANGUAGE_NAMES: { [key: string]: string } = {
  'en': 'English',
  'hi': 'Hindi',
  'ta': 'Tamil',
  'bn': 'Bengali',
  'te': 'Telugu',
  'mr': 'Marathi',
  'gu': 'Gujarati',
  'kn': 'Kannada',
  'ml': 'Malayalam',
  'pa': 'Punjabi'
};

class OfflineTranslator {
  private translator: any = null;
  private isInitializing = false;
  private initializationPromise: Promise<void> | null = null;

  async initialize(onProgress?: (progress: number) => void): Promise<void> {
    if (this.translator) return;
    if (this.isInitializing && this.initializationPromise) {
      return this.initializationPromise;
    }

    this.isInitializing = true;
    this.initializationPromise = (async () => {
      try {
        
        // Use a multilingual model that supports Indian languages
        // This model is lightweight and works well in browsers
        this.translator = await pipeline(
          'translation',
          'Xenova/nllb-200-distilled-600M',
          {
            progress_callback: (progress: any) => {
              if (onProgress && progress.progress !== undefined) {
                onProgress(Math.round(progress.progress));
              }
            }
          }
        );
      } catch (error) {
        console.error('Error initializing translation model:', error);
        throw error;
      } finally {
        this.isInitializing = false;
      }
    })();

    return this.initializationPromise;
  }

  async translate(text: string, targetLanguage: string): Promise<string> {
    if (!this.translator) {
      throw new Error('Translator not initialized. Call initialize() first.');
    }

    try {
      const srcLang = LANGUAGE_CODES['en']; // Always translate from English
      const tgtLang = LANGUAGE_CODES[targetLanguage];

      if (!tgtLang) {
        throw new Error(`Unsupported target language: ${targetLanguage}`);
      }

      const result = await this.translator(text, {
        src_lang: srcLang,
        tgt_lang: tgtLang,
      });

      return result[0].translation_text;
    } catch (error) {
      console.error('Translation error:', error);
      throw error;
    }
  }

  isReady(): boolean {
    return this.translator !== null;
  }
}

// Singleton instance
export const offlineTranslator = new OfflineTranslator();

// Utility function to check if we're online
export const isOnline = (): boolean => {
  return navigator.onLine;
};

// Utility to translate system messages offline
export const translateSystemMessage = async (
  message: string,
  targetLanguage: string,
  onProgress?: (progress: number) => void
): Promise<string> => {
  if (targetLanguage === 'en') return message;

  try {
    if (!offlineTranslator.isReady()) {
      await offlineTranslator.initialize(onProgress);
    }
    return await offlineTranslator.translate(message, targetLanguage);
  } catch (error) {
    console.error('Failed to translate offline:', error);
    return message; // Fallback to original message
  }
};

// Predefined translations for common emergency phrases
export const EMERGENCY_PHRASES: { [key: string]: { [lang: string]: string } } = {
  'I need help': {
    'hi': 'मुझे मदद चाहिए',
    'ta': 'எனக்கு உதவி தேவை',
    'bn': 'আমার সাহায্য দরকার',
    'te': 'నాకు సహాయం కావాలి',
    'mr': 'मला मदत हवी आहे',
    'gu': 'મને મદદ જોઈએ છે',
    'kn': 'ನನಗೆ ಸಹಾಯ ಬೇಕು',
    'ml': 'എനിക്ക് സഹായം വേണം',
    'pa': 'ਮੈਨੂੰ ਮਦਦ ਚਾਹੀਦੀ ਹੈ'
  },
  'Call ambulance': {
    'hi': 'एम्बुलेंस बुलाओ',
    'ta': 'ஆம்புலன்ஸை அழைக்கவும்',
    'bn': 'অ্যাম্বুলেন্স কল করুন',
    'te': 'అంబులెన్స్‌ని పిలవండి',
    'mr': 'रुग्णवाहिका बोलवा',
    'gu': 'એમ્બ્યુલન્સ બોલાવો',
    'kn': 'ಆಂಬ್ಯುಲೆನ್ಸ್ ಕರೆ ಮಾಡಿ',
    'ml': 'ആംബുലൻസ് വിളിക്കുക',
    'pa': 'ਐਂਬੂਲੈਂਸ ਬੁਲਾਓ'
  },
  'Find nearest hospital': {
    'hi': 'निकटतम अस्पताल खोजें',
    'ta': 'அருகிலுள்ள மருத்துவமனையைக் கண்டறியவும்',
    'bn': 'নিকটতম হাসপাতাল খুঁজুন',
    'te': 'సమీప ఆసుపత్రిని కనుగొనండి',
    'mr': 'जवळचे रुग्णालय शोधा',
    'gu': 'નજીકની હોસ્પિટલ શોધો',
    'kn': 'ಹತ್ತಿರದ ಆಸ್ಪತ್ರೆಯನ್ನು ಹುಡುಕಿ',
    'ml': 'അടുത്തുള്ള ആശുപത്രി കണ്ടെത്തുക',
    'pa': 'ਨੇੜੇ ਦਾ ਹਸਪਤਾਲ ਲੱਭੋ'
  },
  'Emergency': {
    'hi': 'आपातकाल',
    'ta': 'அவசரநிலை',
    'bn': 'জরুরী',
    'te': 'అత్యవసరం',
    'mr': 'आणीबाणी',
    'gu': 'કટોકટી',
    'kn': 'ತುರ್ತು',
    'ml': 'അടിയന്തിരം',
    'pa': 'ਐਮਰਜੈਂਸੀ'
  }
};

export const getEmergencyPhrase = (phrase: string, language: string): string => {
  if (language === 'en') return phrase;
  return EMERGENCY_PHRASES[phrase]?.[language] || phrase;
};

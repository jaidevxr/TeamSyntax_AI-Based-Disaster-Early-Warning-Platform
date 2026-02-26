// Offline knowledge base for medical and disaster management support
// This provides essential information when internet is unavailable

export interface OfflineResponse {
  category: 'medical' | 'disaster' | 'general';
  answer: string;
  relatedTopics?: string[];
}

// Medical emergency knowledge base
const MEDICAL_KNOWLEDGE: { [key: string]: OfflineResponse } = {
  'heart attack': {
    category: 'medical',
    answer: '🚨 HEART ATTACK - Immediate Actions:\n\n1. Call emergency services (102/108) immediately\n2. Have the person sit down and rest\n3. If they have aspirin and are not allergic, give 1 tablet\n4. Loosen tight clothing\n5. Stay calm and monitor breathing\n\nSymptoms: Chest pain, shortness of breath, nausea, cold sweat.\n\n⚠️ If person becomes unconscious, start CPR if trained.',
    relatedTopics: ['CPR', 'chest pain', 'emergency numbers']
  },
  'cpr': {
    category: 'medical',
    answer: '🫀 CPR (Cardiopulmonary Resuscitation):\n\n1. Check if person is responsive\n2. Call 102/108 for ambulance\n3. Place person on firm, flat surface\n4. Hand position: Center of chest, between nipples\n5. Push hard and fast: 100-120 compressions/minute\n6. Push down at least 2 inches\n7. Allow full chest recoil between compressions\n8. Continue until help arrives\n\nFor trained individuals: 30 compressions, 2 rescue breaths.',
    relatedTopics: ['heart attack', 'unconscious', 'emergency']
  },
  'bleeding': {
    category: 'medical',
    answer: '🩹 SEVERE BLEEDING - First Aid:\n\n1. Call 102/108 if bleeding is severe\n2. Wash your hands if possible\n3. Apply direct pressure with clean cloth\n4. Keep pressure continuous for 5-10 minutes\n5. If cloth soaks through, add more on top\n6. Elevate injured area above heart if possible\n7. Apply pressure to pressure points if needed\n8. Do NOT remove cloth once bleeding stops\n\n⚠️ For deep wounds or arterial bleeding (spurting blood), seek immediate medical help.',
    relatedTopics: ['wounds', 'pressure points', 'bandaging']
  },
  'fracture': {
    category: 'medical',
    answer: '🦴 FRACTURE (Broken Bone) - First Aid:\n\n1. Do NOT move the person unless necessary\n2. Immobilize the injured area\n3. Apply ice packs (wrapped in cloth) to reduce swelling\n4. For open fractures, cover wound with sterile bandage\n5. Do NOT try to realign the bone\n6. Keep person warm and calm\n7. Call ambulance for serious fractures\n\nSigns: Severe pain, swelling, deformity, inability to move limb.',
    relatedTopics: ['sprains', 'immobilization', 'pain management']
  },
  'burn': {
    category: 'medical',
    answer: '🔥 BURN Treatment:\n\n**Minor Burns:**\n1. Cool the burn with running cool water for 10-20 minutes\n2. Remove jewelry/tight items before swelling\n3. Apply aloe vera or burn cream\n4. Cover with sterile, non-stick bandage\n5. Take pain reliever if needed\n\n**Severe Burns (call 102/108):**\n- Burns larger than 3 inches\n- Burns on face, hands, feet, genitals, joints\n- Third-degree burns (white or charred skin)\n- Chemical or electrical burns\n\n⚠️ Do NOT use ice, butter, or oil on burns!',
    relatedTopics: ['fire safety', 'wound care', 'pain management']
  },
  'choking': {
    category: 'medical',
    answer: '🫁 CHOKING - Heimlich Maneuver:\n\n**If person can cough/speak:**\n- Encourage them to keep coughing\n\n**If person cannot breathe:**\n1. Stand behind person\n2. Make a fist, place thumb side against stomach (above navel, below ribs)\n3. Grasp fist with other hand\n4. Give quick, upward thrusts\n5. Repeat until object is expelled\n6. Call 102/108 if unsuccessful\n\n**For infants:** 5 back blows, then 5 chest thrusts\n\n⚠️ If person becomes unconscious, start CPR.',
    relatedTopics: ['CPR', 'breathing problems', 'infants']
  },
  'stroke': {
    category: 'medical',
    answer: '🧠 STROKE - FAST Recognition:\n\n**F - Face:** Ask to smile, check for drooping\n**A - Arms:** Ask to raise both arms, check for weakness\n**S - Speech:** Ask to repeat simple phrase, check for slurred speech\n**T - Time:** Call 102/108 IMMEDIATELY if any signs present\n\n**What to do:**\n1. Note time symptoms started\n2. Keep person comfortable\n3. Do NOT give food, water, or medication\n4. Monitor breathing and consciousness\n\n⚠️ Every minute counts in stroke treatment!',
    relatedTopics: ['emergency numbers', 'brain injury', 'paralysis']
  },
  'seizure': {
    category: 'medical',
    answer: '⚡ SEIZURE - First Aid:\n\n**During seizure:**\n1. Stay calm and time the seizure\n2. Protect head - place something soft underneath\n3. Turn person on their side\n4. Remove nearby objects that could cause injury\n5. Loosen tight clothing around neck\n6. Do NOT restrain or put anything in mouth\n7. Do NOT give water or food\n\n**Call 102/108 if:**\n- Seizure lasts more than 5 minutes\n- Multiple seizures\n- Person is injured, pregnant, or has diabetes\n- First-time seizure\n- Difficulty breathing after seizure',
    relatedTopics: ['unconscious', 'head injury', 'emergency']
  },
  'poisoning': {
    category: 'medical',
    answer: '☠️ POISONING - Immediate Actions:\n\n1. Call poison control (India: 1800-11-6666) or 102/108\n2. Identify the poison if possible\n3. Check breathing and consciousness\n4. Do NOT induce vomiting unless instructed\n5. If poison on skin: Remove clothing, rinse with water for 15-20 minutes\n6. If in eyes: Rinse with water for 15-20 minutes\n7. If inhaled: Move to fresh air immediately\n\n**Save the container or note:**\n- What was ingested\n- How much\n- When it happened\n\n⚠️ Time is critical in poisoning cases!',
    relatedTopics: ['chemical exposure', 'food poisoning', 'emergency']
  },
  'heatstroke': {
    category: 'medical',
    answer: '🌡️ HEATSTROKE - Emergency Treatment:\n\n**Symptoms:** High body temperature (>104°F), confusion, rapid breathing, racing heart, hot dry skin or heavy sweating\n\n**Treatment:**\n1. Call 102/108 immediately\n2. Move person to cool, shaded area\n3. Remove excess clothing\n4. Cool person with water, ice packs, or wet towels\n5. Focus cooling on neck, armpits, groin\n6. Fan the person\n7. If conscious and able, give cool water to drink\n\n⚠️ Heatstroke can be fatal - seek immediate medical help!',
    relatedTopics: ['heat exhaustion', 'dehydration', 'summer safety']
  }
};

// Disaster management knowledge base
const DISASTER_KNOWLEDGE: { [key: string]: OfflineResponse } = {
  'earthquake': {
    category: 'disaster',
    answer: '🌍 EARTHQUAKE - Safety Actions:\n\n**During earthquake:**\n1. DROP to hands and knees\n2. COVER head and neck under sturdy table\n3. HOLD ON until shaking stops\n4. Stay away from windows, mirrors, heavy objects\n5. If outside, move to open area away from buildings\n6. If in car, stop safely and stay inside\n\n**After earthquake:**\n1. Check for injuries\n2. Inspect home for damage\n3. Watch for aftershocks\n4. Avoid damaged buildings\n5. Listen to emergency broadcasts\n6. Use phone only for emergencies',
    relatedTopics: ['aftershocks', 'building collapse', 'emergency kit']
  },
  'flood': {
    category: 'disaster',
    answer: '🌊 FLOOD - Safety Guidelines:\n\n**Before flood:**\n1. Move to higher ground immediately\n2. Avoid walking/driving through flood water\n3. Turn off utilities if instructed\n4. Take emergency kit\n\n**During flood:**\n1. Get to highest level of building\n2. 6 inches of moving water can knock you down\n3. 2 feet of water can sweep away vehicles\n4. Avoid contact with flood water (may be contaminated)\n5. Stay away from power lines\n\n**After flood:**\n1. Return home only when authorities say safe\n2. Avoid flood water and standing water\n3. Document damage with photos\n4. Clean and disinfect everything that got wet',
    relatedTopics: ['water purification', 'evacuation', 'contamination']
  },
  'cyclone': {
    category: 'disaster',
    answer: '🌪️ CYCLONE/HURRICANE - Preparation:\n\n**Before cyclone:**\n1. Secure outdoor items\n2. Board up windows\n3. Fill bathtubs with water for washing\n4. Charge all devices\n5. Stock food, water, medicines for 3-7 days\n6. Identify safe room (interior, no windows)\n\n**During cyclone:**\n1. Stay indoors away from windows\n2. Go to safe room or under sturdy furniture\n3. Do NOT go outside during eye of storm\n4. Listen to weather updates\n\n**After cyclone:**\n1. Avoid flood water\n2. Watch for damaged power lines\n3. Check for gas leaks\n4. Use flashlights, not candles',
    relatedTopics: ['flood', 'power outage', 'emergency kit']
  },
  'fire': {
    category: 'disaster',
    answer: '🔥 FIRE - Escape Plan:\n\n**If fire starts:**\n1. Alert everyone immediately\n2. Get out fast - do NOT stop to gather belongings\n3. Feel doors before opening (hot = fire on other side)\n4. Stay low to ground (smoke rises)\n5. Cover nose and mouth with cloth\n6. Once out, stay out - call 101\n7. If clothes catch fire: STOP, DROP, and ROLL\n\n**If trapped:**\n1. Close doors between you and fire\n2. Seal cracks with cloth\n3. Signal for help from window\n4. If smoke enters, stay low\n\n**Fire Extinguisher (PASS):**\nPull pin, Aim low, Squeeze handle, Sweep side to side',
    relatedTopics: ['burn treatment', 'smoke inhalation', 'emergency exit']
  },
  'tsunami': {
    category: 'disaster',
    answer: '🌊 TSUNAMI - Warning Signs & Actions:\n\n**Warning signs:**\n1. Strong earthquake near coast\n2. Unusual ocean behavior (sudden withdrawal)\n3. Loud roar from ocean\n4. Official tsunami warning\n\n**Immediate actions:**\n1. Move to high ground or inland IMMEDIATELY\n2. Do NOT wait for official warning if you see signs\n3. Go as far inland and as high as possible\n4. Stay away from coast for several hours\n5. Tsunamis come in waves - first may not be largest\n6. Listen to emergency broadcasts\n\n**Do NOT:**\n- Go to beach to watch\n- Return until authorities say safe\n- Assume danger has passed after first wave',
    relatedTopics: ['earthquake', 'coastal safety', 'evacuation']
  },
  'landslide': {
    category: 'disaster',
    answer: '⛰️ LANDSLIDE - Warning Signs & Safety:\n\n**Warning signs:**\n1. Cracks in ground or pavement\n2. Tilting trees, poles, or fences\n3. New springs or seeps in hillside\n4. Rumbling sounds\n5. Unusual sounds (trees cracking)\n\n**During landslide:**\n1. Move away from path immediately\n2. Move to high ground perpendicular to flow\n3. Protect head from debris\n4. If indoors, stay inside and take cover\n\n**After landslide:**\n1. Stay away from affected area\n2. Watch for more slides\n3. Check for injured and trapped people\n4. Report broken utility lines\n5. Replant damaged ground to reduce erosion',
    relatedTopics: ['heavy rain', 'flood', 'evacuation']
  },
  'emergency kit': {
    category: 'disaster',
    answer: '🎒 EMERGENCY KIT - Essentials:\n\n**Basic supplies (72-hour kit):**\n\n💧 Water: 1 gallon/person/day (3-day supply)\n🍞 Non-perishable food (3-day supply)\n🔦 Flashlight + extra batteries\n📻 Battery/hand-crank radio\n💊 First aid kit\n🔧 Multi-tool or knife\n💰 Cash and important documents (copies)\n📱 Phone chargers (solar/battery)\n🧴 Hygiene items\n🩹 Prescription medications\n🧥 Warm clothes and blankets\n🔥 Matches in waterproof container\n📋 Emergency contact list\n🗺️ Local maps\n\n**Additional items:**\nWhistle, dust masks, plastic sheeting, duct tape, wrench for utilities',
    relatedTopics: ['evacuation', 'disaster preparation', 'food storage']
  }
};

// General safety and emergency information
const GENERAL_KNOWLEDGE: { [key: string]: OfflineResponse } = {
  'emergency numbers': {
    category: 'general',
    answer: '📞 INDIA EMERGENCY NUMBERS:\n\n🚨 Police: 100 or 112\n🚑 Ambulance: 102 or 108\n🚒 Fire: 101\n🆘 Emergency (All): 112\n⚡ Electricity: 1912\n💧 Water: 1916\n🚗 Road Accident: 1073\n☠️ Poison Control: 1800-11-6666\n👮 Women Helpline: 1091\n👶 Child Helpline: 1098\n🌧️ Disaster Management: 1078\n🚢 Coast Guard: 1554\n⛰️ Tourist Helpline: 1363\n\nNational Emergency Number: 112 (works even without network coverage)',
    relatedTopics: ['police', 'ambulance', 'fire department']
  },
  'evacuation': {
    category: 'general',
    answer: '🚶 EVACUATION - Planning & Execution:\n\n**Before evacuation:**\n1. Know multiple evacuation routes\n2. Identify meeting points\n3. Keep emergency kit ready\n4. Know location of nearest shelter\n5. Plan for pets\n6. Keep important documents handy\n\n**During evacuation:**\n1. Follow official instructions\n2. Take emergency kit and essentials only\n3. Lock doors and windows\n4. Turn off utilities if instructed\n5. Wear sturdy shoes and protective clothing\n6. Use recommended routes only\n7. Inform family/friends of your plans\n8. Do NOT take shortcuts\n\n**Special considerations:**\n- Elderly and disabled persons\n- Infants and children\n- Pets and service animals\n- Medications',
    relatedTopics: ['emergency kit', 'shelter', 'family planning']
  },
  'shelter': {
    category: 'general',
    answer: '🏠 EMERGENCY SHELTER - Finding Safety:\n\n**Public shelters:**\n1. Schools, community centers, religious buildings\n2. Government-designated relief camps\n3. Follow official announcements for locations\n\n**At shelter:**\n1. Register upon arrival\n2. Follow shelter rules\n3. Bring own supplies if possible\n4. Be patient and cooperative\n5. Help others if able\n6. Keep track of family members\n\n**If no shelter available:**\n1. Find sturdy building on high ground\n2. Avoid flood-prone areas\n3. Stay away from power lines\n4. Seek interior rooms away from windows\n5. Avoid damaged structures\n\n**Temporary shelter needs:**\nWater, food, first aid, sanitation, communication, blankets',
    relatedTopics: ['evacuation', 'emergency kit', 'disaster relief']
  },
  'first aid kit': {
    category: 'general',
    answer: '🏥 FIRST AID KIT - Essential Items:\n\n**Bandages & Dressings:**\n- Adhesive bandages (various sizes)\n- Sterile gauze pads\n- Roller bandages\n- Triangular bandages\n- Medical tape\n\n**Medical Supplies:**\n- Antiseptic wipes/solution\n- Antibiotic ointment\n- Burn gel\n- Eye wash solution\n- Thermometer\n- Tweezers and scissors\n- Safety pins\n- Disposable gloves\n\n**Medications:**\n- Pain relievers (paracetamol, ibuprofen)\n- Antihistamines\n- Anti-diarrheal\n- Antacids\n- Prescribed medications\n\n**Emergency Items:**\n- CPR face shield\n- Cold pack\n- Emergency blanket\n- First aid manual\n- Emergency numbers list',
    relatedTopics: ['emergency kit', 'wound care', 'medications']
  },
  'water purification': {
    category: 'general',
    answer: '💧 WATER PURIFICATION - Making Water Safe:\n\n**Boiling (most effective):**\n1. Bring water to rolling boil\n2. Boil for 1 minute (3 minutes at high altitude)\n3. Let cool and store in clean container\n\n**Chlorination:**\n1. Add 2 drops of household bleach (5% chlorine) per liter\n2. Mix well and let stand for 30 minutes\n3. Water should have slight chlorine smell\n\n**Filtration:**\n1. Use clean cloth to filter visible particles\n2. Use commercial water filter if available\n3. Always boil or treat after filtering\n\n**Solar disinfection:**\n1. Fill clear plastic bottle\n2. Place in direct sunlight for 6 hours\n3. Works only for clear water\n\n⚠️ Do NOT drink flood water or standing water without treatment!',
    relatedTopics: ['flood', 'emergency supplies', 'disease prevention']
  }
};

// Combine all knowledge bases
const ALL_KNOWLEDGE = {
  ...MEDICAL_KNOWLEDGE,
  ...DISASTER_KNOWLEDGE,
  ...GENERAL_KNOWLEDGE
};

/**
 * Search for relevant offline knowledge based on user query
 */
export function searchOfflineKnowledge(query: string): OfflineResponse | null {
  const normalizedQuery = query.toLowerCase().trim();
  
  // Direct match
  for (const [key, value] of Object.entries(ALL_KNOWLEDGE)) {
    if (normalizedQuery.includes(key)) {
      return value;
    }
  }
  
  // Keyword matching
  const keywords = normalizedQuery.split(' ');
  for (const [key, value] of Object.entries(ALL_KNOWLEDGE)) {
    const keyWords = key.split(' ');
    const matchCount = keywords.filter(kw => 
      keyWords.some(kWord => kWord.includes(kw) || kw.includes(kWord))
    ).length;
    
    if (matchCount >= Math.min(2, keywords.length)) {
      return value;
    }
  }
  
  return null;
}

/**
 * Get all available offline topics organized by category
 */
export function getOfflineTopics() {
  const topics = {
    medical: Object.keys(MEDICAL_KNOWLEDGE),
    disaster: Object.keys(DISASTER_KNOWLEDGE),
    general: Object.keys(GENERAL_KNOWLEDGE)
  };
  
  return topics;
}

/**
 * Check if a query can be answered offline
 */
export function canAnswerOffline(query: string): boolean {
  return searchOfflineKnowledge(query) !== null;
}

/**
 * Get suggested topics based on partial query
 */
export function getSuggestedTopics(partialQuery: string): string[] {
  const normalized = partialQuery.toLowerCase().trim();
  if (normalized.length < 2) return [];
  
  return Object.keys(ALL_KNOWLEDGE).filter(key => 
    key.includes(normalized) || normalized.includes(key.split(' ')[0])
  ).slice(0, 5);
}

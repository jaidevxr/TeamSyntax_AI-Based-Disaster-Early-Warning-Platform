import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, ExternalLink, FileText, Phone, Shield } from 'lucide-react';

const DisasterGuidelines: React.FC = () => {
  const guidelines = [
    {
      disaster: 'Earthquake',
      icon: '⚡',
      severity: 'high',
      before: [
        'Secure heavy furniture and appliances to walls',
        'Identify safe spots in each room (under sturdy tables, against interior walls)',
        'Keep emergency supplies ready (water, food, flashlight, first-aid kit)',
        'Know how to turn off gas, water, and electricity',
      ],
      during: [
        'DROP, COVER, and HOLD ON - get under a sturdy desk or table',
        'Stay away from windows, mirrors, and heavy objects that could fall',
        'If outdoors, move away from buildings, trees, and power lines',
        'If driving, pull over safely and stay inside the vehicle',
      ],
      after: [
        'Check for injuries and provide first aid',
        'Inspect home for damage; evacuate if structure is unsafe',
        'Listen to radio/TV for emergency information',
        'Avoid using elevators; use stairs instead',
      ],
      resources: [
        { name: 'NDMA Earthquake Guidelines', url: 'https://ndma.gov.in/Natural-Hazards/Earthquakes' },
      ],
    },
    {
      disaster: 'Flood',
      icon: '🌊',
      severity: 'high',
      before: [
        'Know your area\'s flood risk and evacuation routes',
        'Keep important documents in waterproof containers',
        'Install check valves in plumbing to prevent backflow',
        'Stock emergency supplies on higher floors',
      ],
      during: [
        'Move to higher ground immediately',
        'Never walk, swim, or drive through flood waters (6 inches can knock you down)',
        'Avoid contact with flood water (may be contaminated)',
        'Listen to emergency broadcasts for updates',
      ],
      after: [
        'Return home only when authorities say it\'s safe',
        'Avoid flood waters (may contain debris, chemicals, or waste)',
        'Document property damage with photos',
        'Throw away contaminated food and water',
      ],
      resources: [
        { name: 'NDMA Flood Management', url: 'https://ndma.gov.in/Natural-Hazards/Floods' },
        { name: 'CWC Flood Forecasting', url: 'http://www.cwc.gov.in/' },
      ],
    },
    {
      disaster: 'Cyclone',
      icon: '🌀',
      severity: 'high',
      before: [
        'Monitor cyclone warnings from IMD regularly',
        'Secure or bring indoors all outdoor objects',
        'Close and board up windows; close internal doors',
        'Stock up on food, water, medicines, and fuel',
      ],
      during: [
        'Stay indoors in the strongest part of the building',
        'Keep away from windows and doors',
        'Listen to battery-powered radio for updates',
        'Do not venture outside during the eye of the storm',
      ],
      after: [
        'Wait for official all-clear before going outside',
        'Watch for weakened roads, bridges, trees, and power lines',
        'Report damaged utility lines to authorities',
        'Avoid driving unless necessary',
      ],
      resources: [
        { name: 'IMD Cyclone Warnings', url: 'https://mausam.imd.gov.in/' },
        { name: 'NDMA Cyclone Guidelines', url: 'https://ndma.gov.in/Natural-Hazards/Cyclone' },
      ],
    },
    {
      disaster: 'Landslide',
      icon: '⛰️',
      severity: 'medium',
      before: [
        'Learn about landslide risk in your area',
        'Plant ground cover on slopes and build retaining walls',
        'Install flexible pipe fittings to avoid gas or water leaks',
        'Have an evacuation plan ready',
      ],
      during: [
        'Move away from the path of a landslide as quickly as possible',
        'Move to higher ground if possible',
        'Listen for unusual sounds (trees cracking, boulders knocking)',
        'Alert others in the area',
      ],
      after: [
        'Stay away from the slide area',
        'Check for injured and trapped persons',
        'Report broken utility lines',
        'Watch for flooding which may occur after a landslide',
      ],
      resources: [
        { name: 'NDMA Landslide Guidelines', url: 'https://ndma.gov.in/Natural-Hazards/Landslides' },
      ],
    },
    {
      disaster: 'Fire',
      icon: '🔥',
      severity: 'medium',
      before: [
        'Install smoke alarms on every level of your home',
        'Keep fire extinguishers in kitchen and garage',
        'Plan and practice escape routes from every room',
        'Keep flammable materials away from heat sources',
      ],
      during: [
        'Get out fast and stay out; never go back inside',
        'If smoke is heavy, crawl low under the smoke',
        'If clothes catch fire: STOP, DROP, and ROLL',
        'Call fire brigade (101) from a safe location',
      ],
      after: [
        'Let fire department check that structure is safe',
        'Do not enter until authorities give permission',
        'Document damage with photos for insurance',
        'Contact your insurance company',
      ],
      resources: [
        { name: 'Fire Services Portal', url: 'https://www.ndma.gov.in/' },
      ],
    },
  ];

  const emergencyContacts = [
    { name: 'NDRF Helpline', number: '011-24363260', description: 'National Disaster Response Force' },
    { name: 'Police Emergency', number: '100', description: 'Police assistance' },
    { name: 'Fire Brigade', number: '101', description: 'Fire emergency' },
    { name: 'Ambulance', number: '102', description: 'Medical emergency' },
    { name: 'Disaster Helpline', number: '1078', description: 'NDMA disaster helpline' },
    { name: 'Women Helpline', number: '1091', description: 'Women safety emergency' },
  ];

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high':
        return 'severity-high';
      case 'medium':
        return 'severity-medium';
      default:
        return 'severity-low';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-primary/10">
          <Shield className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-foreground">Disaster Preparedness Guidelines</h2>
          <p className="text-sm text-muted-foreground">Official guidelines from Indian government agencies</p>
        </div>
      </div>

      {/* Emergency Contacts */}
      <Card className="glass border-border/20 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Phone className="h-5 w-5 text-destructive" />
          <h3 className="text-lg font-semibold text-foreground">Emergency Contacts</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {emergencyContacts.map((contact) => (
            <div key={contact.number} className="flex items-center gap-3 p-3 rounded-lg bg-background/50">
              <Phone className="h-4 w-4 text-primary flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-foreground">{contact.name}</div>
                <div className="text-xl font-bold text-primary">{contact.number}</div>
                <div className="text-xs text-muted-foreground">{contact.description}</div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Disaster-specific guidelines */}
      {guidelines.map((guideline) => (
        <Card key={guideline.disaster} className={`glass border-border/20 p-6 ${getSeverityColor(guideline.severity)}`}>
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <span className="text-3xl">{guideline.icon}</span>
              <div>
                <h3 className="text-lg font-semibold text-foreground">{guideline.disaster} Safety Guidelines</h3>
                <Badge className={getSeverityColor(guideline.severity)}>
                  {guideline.severity} risk
                </Badge>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            {/* Before */}
            <div>
              <h4 className="font-medium text-foreground mb-2 flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Before Disaster:
              </h4>
              <ul className="space-y-1 ml-6">
                {guideline.before.map((item, idx) => (
                  <li key={idx} className="text-sm text-muted-foreground flex items-start gap-2">
                    <span className="text-primary mt-1">•</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* During */}
            <div>
              <h4 className="font-medium text-foreground mb-2 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                During Disaster:
              </h4>
              <ul className="space-y-1 ml-6">
                {guideline.during.map((item, idx) => (
                  <li key={idx} className="text-sm text-muted-foreground flex items-start gap-2">
                    <span className="text-primary mt-1">•</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* After */}
            <div>
              <h4 className="font-medium text-foreground mb-2 flex items-center gap-2">
                <Shield className="h-4 w-4" />
                After Disaster:
              </h4>
              <ul className="space-y-1 ml-6">
                {guideline.after.map((item, idx) => (
                  <li key={idx} className="text-sm text-muted-foreground flex items-start gap-2">
                    <span className="text-primary mt-1">•</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* Resources */}
            <div className="pt-3 border-t border-border/20">
              <h4 className="font-medium text-foreground mb-2">Official Resources:</h4>
              <div className="flex flex-wrap gap-2">
                {guideline.resources.map((resource, idx) => (
                  <Button
                    key={idx}
                    variant="outline"
                    size="sm"
                    asChild
                  >
                    <a href={resource.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2">
                      <ExternalLink className="h-3 w-3" />
                      {resource.name}
                    </a>
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </Card>
      ))}

      {/* Additional Resources */}
      <Card className="glass border-border/20 p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4">Additional Resources</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Button variant="outline" asChild>
            <a href="https://ndma.gov.in/" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2">
              <ExternalLink className="h-4 w-4" />
              National Disaster Management Authority
            </a>
          </Button>
          <Button variant="outline" asChild>
            <a href="https://ndrf.gov.in/" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2">
              <ExternalLink className="h-4 w-4" />
              National Disaster Response Force
            </a>
          </Button>
          <Button variant="outline" asChild>
            <a href="https://mausam.imd.gov.in/" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2">
              <ExternalLink className="h-4 w-4" />
              India Meteorological Department
            </a>
          </Button>
          <Button variant="outline" asChild>
            <a href="https://incois.gov.in/" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2">
              <ExternalLink className="h-4 w-4" />
              Indian National Centre for Ocean Info
            </a>
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default DisasterGuidelines;
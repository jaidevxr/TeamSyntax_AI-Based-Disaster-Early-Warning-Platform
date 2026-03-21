import React from 'react';
import { Activity, BellRing, Bot, Cloud, Menu } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MobileBottomNavProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  onOpenMenu: () => void;
  language: 'en' | 'hi';
}

const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activeTab,
  onTabChange,
  onOpenMenu,
  language
}) => {
  const tabs = [
    { id: 'overview', label: language === 'en' ? 'Overview' : 'हीटमैप', icon: Activity },
    { id: 'early-alerts', label: language === 'en' ? 'Alerts' : 'चेतावनी', icon: BellRing },
    { id: 'ai-insights', label: language === 'en' ? 'Copilot' : 'कोपायलट', icon: Bot },
    { id: 'weather', label: language === 'en' ? 'Weather' : 'मौसम', icon: Cloud },
  ];

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-[1000] px-1 pb-safe pt-1 bg-background/95 backdrop-blur-xl border-t border-border/40 shadow-[0_-4px_20px_rgba(0,0,0,0.08)] dark:shadow-[0_-4px_20px_rgba(0,0,0,0.25)]">
      <div className="flex items-center justify-around w-full mb-0.5">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;

          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className="relative flex flex-col items-center justify-center w-12 h-10 transition-all duration-300 group"
            >
              <div
                className={cn(
                  "flex items-center justify-center w-7 h-7 rounded-full mb-0.5 transition-all duration-300",
                  isActive
                    ? "bg-primary/20 scale-110 shadow-inner"
                    : "bg-transparent text-muted-foreground group-hover:scale-105 group-hover:bg-primary/5"
                )}
              >
                <Icon
                  className={cn(
                    "w-4 h-4 transition-colors duration-300",
                    isActive ? "text-primary" : "text-muted-foreground"
                  )}
                  strokeWidth={isActive ? 2.5 : 2}
                />
              </div>
              <span
                className={cn(
                  "text-[10px] sm:text-[11px] font-semibold transition-colors duration-300 tracking-tight",
                  isActive ? "text-primary" : "text-muted-foreground"
                )}
              >
                {tab.label}
              </span>
              
              {isActive && (
                <span className="absolute -top-1 left-1/2 -translate-x-1/2 w-6 h-0.5 bg-primary rounded-b-full shadow-[0_2px_8px_rgba(0,200,100,0.5)]" />
              )}
            </button>
          );
        })}

        {/* Menu Button to trigger the main Sidebar */}
        <button
          onClick={onOpenMenu}
          className="relative flex flex-col items-center justify-center w-12 h-10 transition-all duration-300 group"
        >
          <div className="flex items-center justify-center w-7 h-7 rounded-full mb-0.5 transition-all duration-300 bg-transparent text-muted-foreground group-hover:scale-105 group-hover:bg-primary/5">
            <Menu className="w-4 h-4 text-muted-foreground" strokeWidth={2} />
          </div>
          <span className="text-[10px] sm:text-[11px] font-semibold text-muted-foreground transition-colors duration-300 tracking-tight">
            {language === 'en' ? 'More' : 'अधिक'}
          </span>
        </button>
      </div>
    </div>
  );
};

export default MobileBottomNav;

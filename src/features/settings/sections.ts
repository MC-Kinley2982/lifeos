import { BatteryMedium, Cloud, Coffee, Database, GraduationCap, Moon, Sparkles, Tags, Thermometer, TreePalm, UserRound, Utensils, type LucideIcon } from 'lucide-react';

export interface SettingsSectionMeta {
  id: string;
  label: string;
  description: string;
  icon: LucideIcon;
}

export const SETTINGS_SECTIONS: SettingsSectionMeta[] = [
  { id: 'profil', label: 'Profil & Allgemein', description: 'Name, Wochenstart', icon: UserRound },
  { id: 'konto', label: 'Konto & Integrationen', description: 'Geräte synchronisieren, Google Kalender', icon: Cloud },
  { id: 'schule', label: 'Schule', description: 'Schulzeit, Hausaufgaben, Lernzeit', icon: GraduationCap },
  { id: 'schlaf', label: 'Schlaf', description: 'Aufstehen & Schlafenszeit, pro Wochentag', icon: Moon },
  { id: 'mahlzeiten', label: 'Mahlzeiten', description: 'Frühstück, Mittag, Abendessen …', icon: Utensils },
  { id: 'pausen', label: 'Pausen', description: 'Pausen nach Schule oder langen Blöcken', icon: Coffee },
  { id: 'energie', label: 'Energie', description: 'Automatische Energie-Annahmen', icon: BatteryMedium },
  { id: 'zustaende', label: 'Tageszustände', description: 'Krank, Urlaub, Ferien – was gilt wann', icon: Thermometer },
  { id: 'urlaub', label: 'Urlaub & besondere Tage', description: 'Zeiträume und einzelne Tage', icon: TreePalm },
  { id: 'planung', label: 'Planung', description: 'Freizeit-Schutz, Puffer, Arbeitszeiten', icon: Sparkles },
  { id: 'kategorien', label: 'Kategorien', description: 'Farben und Namen', icon: Tags },
  { id: 'daten', label: 'Daten & Backup', description: 'Export, Import, Zurücksetzen', icon: Database },
];

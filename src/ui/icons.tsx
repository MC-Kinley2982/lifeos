import {
  Backpack,
  Bed,
  Bike,
  BookOpen,
  Brain,
  Briefcase,
  Car,
  Circle,
  Code,
  Coffee,
  Dumbbell,
  Footprints,
  Gamepad2,
  Gift,
  GraduationCap,
  Heart,
  House,
  Leaf,
  Map,
  Moon,
  Mountain,
  Music,
  Palette,
  PartyPopper,
  Plane,
  Snowflake,
  Sparkles,
  Star,
  Sun,
  Tent,
  Thermometer,
  TreePalm,
  Users,
  Utensils,
  type LucideIcon,
} from 'lucide-react';

/**
 * Icon-Registry: Daten speichern nur einen Schlüssel (z. B. "dumbbell"),
 * die UI löst ihn hier in ein Lucide-Icon auf.
 */
export const ICONS: Record<string, LucideIcon> = {
  sun: Sun,
  moon: Moon,
  thermometer: Thermometer,
  palmtree: TreePalm,
  sparkles: Sparkles,
  map: Map,
  star: Star,
  'graduation-cap': GraduationCap,
  dumbbell: Dumbbell,
  'book-open': BookOpen,
  palette: Palette,
  utensils: Utensils,
  home: House,
  users: Users,
  heart: Heart,
  gamepad: Gamepad2,
  circle: Circle,
  briefcase: Briefcase,
  music: Music,
  code: Code,
  brain: Brain,
  bike: Bike,
  footprints: Footprints,
  coffee: Coffee,
  plane: Plane,
  backpack: Backpack,
  car: Car,
  tent: Tent,
  mountain: Mountain,
  snowflake: Snowflake,
  gift: Gift,
  party: PartyPopper,
  leaf: Leaf,
  bed: Bed,
};

export const ICON_KEYS = Object.keys(ICONS);

export function iconFor(key: string | undefined): LucideIcon {
  return (key && ICONS[key]) || Circle;
}

export function DynamicIcon({ name, className, size = 16, color }: { name?: string; className?: string; size?: number; color?: string }) {
  const Icon = iconFor(name);
  return <Icon className={className} size={size} color={color} />;
}

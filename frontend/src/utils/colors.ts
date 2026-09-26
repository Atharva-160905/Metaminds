export interface RiderColor {
  name: string;
  stroke: string;
  glow: string;
  fill: string;
  badgeBg: string;
  badgeText: string;
}

export const RIDER_COLORS: RiderColor[] = [
  {
    name: 'Vehicle 1',
    stroke: '#EF4444', // Red
    glow: 'rgba(239, 68, 68, 0.4)',
    fill: '#DC2626',
    badgeBg: 'bg-red-50',
    badgeText: 'text-red-700',
  },
  {
    name: 'Vehicle 2',
    stroke: '#3B82F6', // Blue
    glow: 'rgba(59, 130, 246, 0.4)',
    fill: '#2563EB',
    badgeBg: 'bg-blue-50',
    badgeText: 'text-blue-700',
  },
  {
    name: 'Vehicle 3',
    stroke: '#10B981', // Green
    glow: 'rgba(16, 185, 129, 0.4)',
    fill: '#059669',
    badgeBg: 'bg-emerald-50',
    badgeText: 'text-emerald-700',
  },
  {
    name: 'Vehicle 4',
    stroke: '#8B5CF6', // Purple
    glow: 'rgba(139, 92, 246, 0.4)',
    fill: '#7C3AED',
    badgeBg: 'bg-purple-50',
    badgeText: 'text-purple-700',
  },
  {
    name: 'Vehicle 5',
    stroke: '#F97316', // Orange
    glow: 'rgba(249, 115, 22, 0.4)',
    fill: '#EA580C',
    badgeBg: 'bg-orange-50',
    badgeText: 'text-orange-700',
  },
  {
    name: 'Vehicle 6',
    stroke: '#06B6D4', // Cyan
    glow: 'rgba(6, 182, 212, 0.4)',
    fill: '#0891B2',
    badgeBg: 'bg-cyan-50',
    badgeText: 'text-cyan-700',
  },
  {
    name: 'Vehicle 7',
    stroke: '#EC4899', // Pink
    glow: 'rgba(236, 72, 153, 0.4)',
    fill: '#DB2777',
    badgeBg: 'bg-pink-50',
    badgeText: 'text-pink-700',
  },
  {
    name: 'Vehicle 8',
    stroke: '#EAB308', // Amber
    glow: 'rgba(234, 179, 8, 0.4)',
    fill: '#CA8A04',
    badgeBg: 'bg-amber-50',
    badgeText: 'text-amber-700',
  },
];

export function getRiderColor(index: number): RiderColor {
  return RIDER_COLORS[index % RIDER_COLORS.length];
}

import { InventoryVariant } from '../types';

export interface TingiPreset {
  name: string;
  icon: string;
  category: string;
  unit: string;
  defaultPrice: number;
  defaultCost: number;
  color: string;
  suggestedVariants: Array<{ label: string; unitPrice: number; unitCost: number }>;
}

export const TINGI_PRESETS: TingiPreset[] = [
  {
    name: 'Yelo (Ice)',
    icon: '🧊',
    category: 'Frozen / Ice',
    unit: 'Piece',
    defaultPrice: 5,
    defaultCost: 1,
    color: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30',
    suggestedVariants: [
      { label: '1 Tubig Yelo', unitPrice: 5, unitCost: 1 },
      { label: '3 Yelo Bundle', unitPrice: 12, unitCost: 3 },
    ],
  },
  {
    name: 'Asukal (Sugar)',
    icon: '🍚',
    category: 'Repacked / Grocery',
    unit: 'Kilo',
    defaultPrice: 80,
    defaultCost: 65,
    color: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    suggestedVariants: [
      { label: '1/4 kg', unitPrice: 22, unitCost: 16.5 },
      { label: '1/2 kg', unitPrice: 42, unitCost: 32.5 },
      { label: '1 kg', unitPrice: 80, unitCost: 65 },
    ],
  },
  {
    name: 'Yosi (Cigarette)',
    icon: '🚬',
    category: 'Cigarettes',
    unit: 'Stick',
    defaultPrice: 9,
    defaultCost: 7,
    color: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
    suggestedVariants: [
      { label: '1 Stick', unitPrice: 9, unitCost: 7 },
      { label: 'Pack of 20', unitPrice: 170, unitCost: 140 },
    ],
  },
  {
    name: 'Mantika (Cooking Oil)',
    icon: '🛢️',
    category: 'Repacked / Grocery',
    unit: 'Pouch',
    defaultPrice: 15,
    defaultCost: 10,
    color: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
    suggestedVariants: [
      { label: 'Small Plastic', unitPrice: 15, unitCost: 10 },
      { label: 'Medium Plastic', unitPrice: 30, unitCost: 20 },
      { label: '1 Liter Bottle', unitPrice: 90, unitCost: 70 },
    ],
  },
  {
    name: 'Uling (Charcoal)',
    icon: '🪵',
    category: 'Hardware / Houseware',
    unit: 'Bag',
    defaultPrice: 20,
    defaultCost: 12,
    color: 'bg-stone-500/10 text-stone-300 border-stone-500/30',
    suggestedVariants: [
      { label: '1 Plastic Bag', unitPrice: 20, unitCost: 12 },
      { label: '3 Bags Bundle', unitPrice: 55, unitCost: 36 },
    ],
  },
  {
    name: 'Itlog (Eggs)',
    icon: '🥚',
    category: 'Fresh Produce',
    unit: 'Piece',
    defaultPrice: 9,
    defaultCost: 7,
    color: 'bg-orange-500/10 text-orange-400 border-orange-500/30',
    suggestedVariants: [
      { label: 'Medium Egg (1pc)', unitPrice: 8, unitCost: 6.5 },
      { label: 'Large Egg (1pc)', unitPrice: 9, unitCost: 7.2 },
      { label: '1 Tray (30pcs)', unitPrice: 250, unitCost: 200 },
    ],
  },
  {
    name: 'Bawang (Garlic)',
    icon: '🧄',
    category: 'Fresh Produce',
    unit: 'Piece',
    defaultPrice: 10,
    defaultCost: 6,
    color: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
    suggestedVariants: [
      { label: '1 Tumpok (3pcs)', unitPrice: 10, unitCost: 6 },
      { label: '1/4 kg Mesh', unitPrice: 35, unitCost: 22 },
    ],
  },
  {
    name: 'Sibuyas (Onion)',
    icon: '🧅',
    category: 'Fresh Produce',
    unit: 'Piece',
    defaultPrice: 15,
    defaultCost: 9,
    color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    suggestedVariants: [
      { label: '1 Tumpok (3pcs)', unitPrice: 15, unitCost: 9 },
      { label: '1/2 kg', unitPrice: 45, unitCost: 30 },
    ],
  },
];

/**
 * Calculates suggested prices based on a base per-kilo or per-liter price.
 */
export function calculateWeightVariants(baseKiloPrice: number, baseKiloCost: number): Array<{ label: string; unitPrice: number; unitCost: number }> {
  return [
    {
      label: '1/4 kg',
      unitPrice: Math.ceil(baseKiloPrice * 0.27), // slight markup for smaller pack
      unitCost: Number((baseKiloCost * 0.25).toFixed(2)),
    },
    {
      label: '1/2 kg',
      unitPrice: Math.ceil(baseKiloPrice * 0.52),
      unitCost: Number((baseKiloCost * 0.50).toFixed(2)),
    },
    {
      label: '1 kg',
      unitPrice: baseKiloPrice,
      unitCost: baseKiloCost,
    },
  ];
}

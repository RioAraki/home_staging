// Domain types matching the YAML schemas in ../md/

export type RoomSlot = 'I' | 'II' | 'III' | 'IV' | 'V';
export type WallEdge = 'top' | 'right' | 'bottom' | 'left';

// ────────────────────── Furniture ──────────────────────

export interface FurnitureOption {
  option_index: number;
  name_zh: string;
  name_en: string;
  bbox: [number, number];           // [rows, cols] of the option's bbox
  shape: Array<[number, number]>;   // occupied cells (row, col)
  open_spaces: Array<[number, number]>;
  wall_edges: WallEdge[];
  printed_markers: number;
  notes?: string;
  verify?: boolean;
}

export interface FurnitureCard {
  number: number;
  variant: 'A' | 'B';
  image: string;
  options: FurnitureOption[];
}

export interface FurnitureData {
  cards: FurnitureCard[];
}

// ────────────────────── Map / scenario ──────────────────────

export interface Room {
  slot: RoomSlot;
  name_zh: string;
  name_en: string;
  furniture_numbers: number[];
}

export interface CellAttrs {
  terrain?: 'outdoor' | 'indoor' | 'water' | 'road' | 'obstacle';
  feature?: string;        // tree, column, stairs_marker, etc.
  zone?: string;
  sub_zone?: string;
}

export interface Grid {
  ascii: string;
  legend: Record<string, CellAttrs>;
  verify?: boolean;
}

export interface PreDrawnDoor {
  cell: [number, number];
  edge: 'N' | 'S' | 'E' | 'W';
  target?: string;
  notes?: string;
  notes_zh?: string;
  notes_en?: string;
  verify?: boolean;
}

export interface PreDrawnWindow {
  cell: [number, number];
  edge?: 'N' | 'S' | 'E' | 'W';
  notes?: string;
  notes_zh?: string;
  notes_en?: string;
  verify?: boolean;
}

export interface PreDrawn {
  doors: PreDrawnDoor[];
  windows: PreDrawnWindow[];
  walls_interior: Array<[number, number, number, number]>;
}

export interface BonusPoint {
  text_zh: string;
  text_en: string;
  points: number;
  condition?: Record<string, unknown>;
}

export interface DrawingRule {
  id: string;
  kind: string;
  text_zh: string;
  text_en: string;
  adds_cell_feature?: string;
  adds_zone?: Record<string, unknown>;
  [k: string]: unknown;
}

export interface ScenarioRules {
  hallway: { required: boolean; notes_zh?: string; notes_en?: string };
  front_door: {
    on_exterior_wall_anywhere: boolean;
    forced_edges?: WallEdge[];
    forced_cells?: Array<[number, number]>;
    notes?: string;
  };
  drawing: DrawingRule[];
  scoring: unknown[];
}

export interface Scenario {
  id: string;
  title_zh: string;
  title_en: string;
  chapter_zh: string;
  difficulty: 'training' | 'easy' | 'medium' | 'hard';
  pages_in_book: number[];
  page_image: string;
  rooms: Room[];
  grid: Grid;
  zones: Record<string, Record<string, unknown>>;
  pre_drawn: PreDrawn;
  rules: ScenarioRules;
  bonus_points: BonusPoint[];
  stats?: Record<string, unknown>;
}

export interface MapsData {
  scenarios: Scenario[];
}

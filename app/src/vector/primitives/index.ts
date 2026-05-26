// Registry mapping a primitive `kind` (string from the visual schema) to its
// React component. Add new primitives here as you implement them.

import type { ComponentType } from 'react';
import type { PrimitiveProps } from '../types';
import { PlantLeafBurst } from './PlantLeafBurst';
import { PlantPotted } from './PlantPotted';
import { SofaRun } from './SofaRun';
import { ChairDot } from './ChairDot';
import { ShelfUnit } from './ShelfUnit';
import { TableTop } from './TableTop';
import { RawSvg } from './RawSvg';

export const primitiveRegistry: Record<string, ComponentType<PrimitiveProps>> = {
  plant_leaf_burst: PlantLeafBurst,
  plant_potted: PlantPotted,
  sofa_run: SofaRun,
  chair_dot: ChairDot,
  shelf_unit: ShelfUnit,
  table_top: TableTop,
  raw_svg: RawSvg,
};

export function getPrimitive(kind: string): ComponentType<PrimitiveProps> | null {
  return primitiveRegistry[kind] ?? null;
}

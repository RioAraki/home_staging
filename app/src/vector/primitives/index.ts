// Registry mapping a primitive `kind` (string from the visual schema) to its
// React component. Add new primitives here as you implement them.

import type { ComponentType } from 'react';
import type { PrimitiveProps } from '../types';
import { PlantLeafBurst } from './PlantLeafBurst';

export const primitiveRegistry: Record<string, ComponentType<PrimitiveProps>> = {
  plant_leaf_burst: PlantLeafBurst,
};

export function getPrimitive(kind: string): ComponentType<PrimitiveProps> | null {
  return primitiveRegistry[kind] ?? null;
}

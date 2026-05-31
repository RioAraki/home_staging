// Inlined Zustand vanilla store (24 lines from zustand@5.0.13/esm/vanilla.mjs)
// with TypeScript types added.
//
// Why inlined: Cocos Creator 3.8's module resolver does not honor Zustand 5's
// package.json `exports` map ("./*" wildcard), so `import { createStore } from
// 'zustand/vanilla'` fails at scene-import time. Inlining the tiny vanilla
// implementation avoids the dependency entirely and unblocks the gameStore
// port. License: Zustand is MIT (Paul Henschel). Original:
// https://github.com/pmndrs/zustand/blob/main/src/vanilla.ts

export type Listener<T> = (state: T, prevState: T) => void;

export interface StoreApi<T> {
  setState: (partial: Partial<T> | ((s: T) => Partial<T> | T), replace?: boolean) => void;
  getState: () => T;
  getInitialState: () => T;
  subscribe: (listener: Listener<T>) => () => void;
}

export type StateCreator<T> = (
  set: StoreApi<T>['setState'],
  get: StoreApi<T>['getState'],
  api: StoreApi<T>,
) => T;

const createStoreImpl = <T>(createState: StateCreator<T>): StoreApi<T> => {
  let state: T;
  const listeners = new Set<Listener<T>>();
  const setState: StoreApi<T>['setState'] = (partial, replace) => {
    const nextState =
      typeof partial === 'function'
        ? (partial as (s: T) => Partial<T> | T)(state)
        : partial;
    if (!Object.is(nextState, state)) {
      const previousState = state;
      state =
        (replace != null ? replace : typeof nextState !== 'object' || nextState === null)
          ? (nextState as T)
          : Object.assign({}, state, nextState);
      listeners.forEach((listener) => listener(state, previousState));
    }
  };
  const getState = () => state;
  const getInitialState = () => initialState;
  const subscribe: StoreApi<T>['subscribe'] = (listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  };
  const api: StoreApi<T> = { setState, getState, getInitialState, subscribe };
  const initialState: T = (state = createState(setState, getState, api));
  return api;
};

export const createStore = <T>(createState: StateCreator<T>): StoreApi<T> =>
  createStoreImpl(createState);

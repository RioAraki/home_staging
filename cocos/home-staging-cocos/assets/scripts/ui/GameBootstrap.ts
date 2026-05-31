import { _decorator, Component, resources, JsonAsset } from 'cc';
import { setLoadedData, scenarioById } from '../core/dataLoader';
import { gameStore } from '../state/gameStore';
const { ccclass } = _decorator;

@ccclass('GameBootstrap')
export class GameBootstrap extends Component {
  async start() {
    const maps = await new Promise<JsonAsset>((res, rej) =>
      resources.load('data/maps_data', JsonAsset, (e, a) => e ? rej(e) : res(a))
    );
    const furniture = await new Promise<JsonAsset>((res, rej) =>
      resources.load('data/furniture_data', JsonAsset, (e, a) => e ? rej(e) : res(a))
    );

    setLoadedData(maps.json as any, furniture.json as any);
    console.log('[bootstrap] data loaded, scenarios:', (maps.json as any).scenarios.length);

    const training = scenarioById('training');
    if (!training) { console.error('[bootstrap] training scenario missing'); return; }

    gameStore.getState().initRun(training);
    console.log('[bootstrap] store initialized for training:',
      gameStore.getState().scenario?.title_en);

    // Expose to console for manual smoke tests.
    (globalThis as any).gameStore = gameStore;
  }
}

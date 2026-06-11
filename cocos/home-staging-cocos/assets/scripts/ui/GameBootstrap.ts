import { _decorator, Component, resources, JsonAsset, Node, Canvas, director } from 'cc';
import { setLoadedData } from '../core/dataLoader';
import { gameStore } from '../state/gameStore';
import { audioManager } from '../platform/audio';
import { AudioControls } from './AudioControls';
import { RoomProgressPanel } from './RoomProgressPanel';
import { ScenarioSelectScreen } from './ScenarioSelectScreen';
const { ccclass } = _decorator;

@ccclass('GameBootstrap')
export class GameBootstrap extends Component {
  async start() {
    // A failed load would otherwise become an unhandled rejection and the
    // game would silently never initialise.
    let maps: JsonAsset, furniture: JsonAsset;
    try {
      maps = await new Promise<JsonAsset>((res, rej) =>
        resources.load('data/maps_data', JsonAsset, (e, a) => e ? rej(e) : res(a))
      );
      furniture = await new Promise<JsonAsset>((res, rej) =>
        resources.load('data/furniture_data', JsonAsset, (e, a) => e ? rej(e) : res(a))
      );
    } catch (e) {
      console.error('[bootstrap] failed to load game data:', e);
      return;
    }

    setLoadedData(maps.json as any, furniture.json as any);
    console.log('[bootstrap] data loaded, scenarios:', (maps.json as any).scenarios.length);

    audioManager.init();
    audioManager.setBgmMuted(gameStore.getState().bgmMuted);
    audioManager.setSfxMuted(gameStore.getState().sfxMuted);

    const canvas = director.getScene()?.getComponentInChildren(Canvas);

    // Settings gear (BGM/SFX toggles) — top-right corner.
    if (canvas && !canvas.node.getChildByName('AudioControls')) {
      const n = new Node('AudioControls');
      canvas.node.addChild(n);
      n.addComponent(AudioControls);
    }

    // Persistent room-progress panel — top-left corner.
    if (canvas && !canvas.node.getChildByName('RoomProgressPanel')) {
      const n = new Node('RoomProgressPanel');
      canvas.node.addChild(n);
      n.addComponent(RoomProgressPanel);
    }

    // Scenario select — shows itself immediately, so boot lands on the
    // select screen instead of hardcoding a scenario. Picking a level runs
    // initRun + first-room select (see startScenario).
    if (canvas && !canvas.node.getChildByName('ScenarioSelectScreen')) {
      const n = new Node('ScenarioSelectScreen');
      canvas.node.addChild(n);
      n.addComponent(ScenarioSelectScreen);
    }

    // Expose to console for manual smoke tests.
    (globalThis as any).gameStore = gameStore;
  }
}

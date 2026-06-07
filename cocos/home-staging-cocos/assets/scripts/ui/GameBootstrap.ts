import { _decorator, Component, resources, JsonAsset, Node, Canvas, director } from 'cc';
import { setLoadedData, scenarioById } from '../core/dataLoader';
import { gameStore } from '../state/gameStore';
import { audioManager } from '../platform/audio';
import { AudioControls } from './AudioControls';
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
    // Sequential flow needs an active room; auto-select the first one.
    // (Room-to-room navigation UI is a separate follow-up.)
    const firstRoom = training.rooms[0];
    if (firstRoom) gameStore.getState().selectRoom(firstRoom.slot);
    console.log('[bootstrap] store initialized for training:',
      gameStore.getState().scenario?.title_en, 'room:', gameStore.getState().activeRoomSlot);

    audioManager.init();
    audioManager.setBgmMuted(gameStore.getState().bgmMuted);
    audioManager.setSfxMuted(gameStore.getState().sfxMuted);

    // Mount the persistent BGM/SFX mute toggles in the top-right corner. Built
    // in code and parented to the Canvas so no scene wiring is needed.
    const canvas = director.getScene()?.getComponentInChildren(Canvas);
    if (canvas && !canvas.node.getChildByName('AudioControls')) {
      const n = new Node('AudioControls');
      canvas.node.addChild(n);
      n.addComponent(AudioControls);
    }

    // Expose to console for manual smoke tests.
    (globalThis as any).gameStore = gameStore;
  }
}

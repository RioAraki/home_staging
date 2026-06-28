import { _decorator, Component, resources, JsonAsset, Node, Canvas, director } from 'cc';
import { setLoadedData } from '../core/dataLoader';
import { gameStore } from '../state/gameStore';
import { audioManager } from '../platform/audio';
import { AudioControls } from './AudioControls';
import { RoomProgressPanel } from './RoomProgressPanel';
import { ScenarioSelectScreen } from './ScenarioSelectScreen';
import { HeaderBar } from './HeaderBar';
import { Background } from './Background';
import { TutorialController } from './TutorialController';
import { HandPointer } from './HandPointer';
import { TutorialOverlay } from './TutorialOverlay';
const { ccclass } = _decorator;

@ccclass('GameBootstrap')
export class GameBootstrap extends Component {
  async start() {
    // A failed load would otherwise become an unhandled rejection and the
    // game would silently never initialise.
    let maps: JsonAsset, furniture: JsonAsset, library: JsonAsset | null = null;
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
    // Named-furniture library — optional; absence just means named levels can't
    // resolve their pieces (numbered levels are unaffected).
    try {
      library = await new Promise<JsonAsset>((res, rej) =>
        resources.load('data/furniture_library', JsonAsset, (e, a) => e ? rej(e) : res(a))
      );
    } catch (e) {
      console.warn('[bootstrap] furniture_library not loaded (named furniture disabled):', e);
    }

    setLoadedData(maps.json as any, furniture.json as any, (library?.json as any) ?? undefined);
    console.log('[bootstrap] data loaded, scenarios:', (maps.json as any).scenarios.length);

    audioManager.init();
    audioManager.setBgmMuted(gameStore.getState().bgmMuted);
    audioManager.setSfxMuted(gameStore.getState().sfxMuted);

    const canvas = director.getScene()?.getComponentInChildren(Canvas);

    // Header band behind the top-bar content (room name / reward / gear) so the
    // top reads as one defined block (UI-improvement B1).
    if (canvas && !canvas.node.getChildByName('HeaderBar')) {
      const n = new Node('HeaderBar');
      canvas.node.addChild(n);
      n.setSiblingIndex(0);   // behind all header content
      n.addComponent(HeaderBar);
    }

    // Full-screen blueprint background (E1, direction B) — mounted last with
    // sibling index 0 so it ends up the deepest layer, behind even HeaderBar.
    if (canvas && !canvas.node.getChildByName('Background')) {
      const n = new Node('Background');
      canvas.node.addChild(n);
      n.setSiblingIndex(0);
      n.addComponent(Background);
    }

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

    // Interactive tutorial layer — a persistent top-most node that stays inert
    // until the player enters a scenario whose data carries a `tutorial` field
    // (e.g. 陋室/training). It self-starts via TutorialController.autoStart.
    if (canvas && !canvas.node.getChildByName('Tutorial')) {
      const root = new Node('Tutorial');
      canvas.node.addChild(root);
      root.setSiblingIndex(canvas.node.children.length - 1);   // top-most layer
      const overlayNode = new Node('TutorialOverlay');
      root.addChild(overlayNode);
      const overlay = overlayNode.addComponent(TutorialOverlay);
      // Hand is a CHILD of the overlay so both share one coordinate space — the
      // controller hands it overlay-local positions directly (no world conversion).
      const handNode = new Node('Hand');
      overlayNode.addChild(handNode);
      const hand = handNode.addComponent(HandPointer);
      const ctl = root.addComponent(TutorialController);
      ctl.autoStart(overlay, hand);
    }

    // Expose to console for manual smoke tests.
    (globalThis as any).gameStore = gameStore;
  }
}

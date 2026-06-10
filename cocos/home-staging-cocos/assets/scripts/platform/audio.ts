import { AudioClip, AudioSource, Node, resources, director } from 'cc';

type SfxKind = 'place' | 'remove';

class AudioManager {
  private bgm?: AudioSource;
  private sfxSource?: AudioSource;
  private hostNode?: Node;
  private clips: Record<string, AudioClip> = {};
  private _bgmMuted = false;
  private _sfxMuted = false;
  private initialized = false;

  init() {
    if (this.initialized) return;
    this.initialized = true;

    const scene = director.getScene();
    if (!scene) return;
    const root = new Node('AudioRoot');
    scene.addChild(root);
    this.hostNode = root;
    this.bgm = root.addComponent(AudioSource);
    this.bgm.loop = true;
    // Dedicated source for one-shots so SFX never interrupts BGM
    this.sfxSource = root.addComponent(AudioSource);

    this.preload('bgm', 'audio/bgm-ambient');
    this.preload('place', 'audio/sfx-place');
    this.preload('remove', 'audio/sfx-remove');
  }

  private preload(key: string, path: string) {
    resources.load(path, AudioClip, (err, clip) => {
      if (err || !clip) { return; }
      this.clips[key] = clip;
      if (key === 'bgm' && this.bgm) {
        // Always assign the clip — if we skipped assignment while muted,
        // setBgmMuted(false) would find clip=null and BGM could never start
        // for the rest of the session.
        this.bgm.clip = clip;
        if (!this._bgmMuted) this.bgm.play();
      }
    });
  }

  playSfx(kind: SfxKind) {
    if (this._sfxMuted) return;
    const clip = this.clips[kind];
    if (!clip || !this.sfxSource) return;
    this.sfxSource.playOneShot(clip);
  }

  setBgmMuted(m: boolean) {
    this._bgmMuted = m;
    if (!this.bgm) return;
    if (m) this.bgm.pause();
    else if (this.bgm.clip) this.bgm.play();
  }
  setSfxMuted(m: boolean) { this._sfxMuted = m; }
}

export const audioManager = new AudioManager();

import { AudioClip, AudioSource, Node, resources, director } from 'cc';

type SfxKind = 'place' | 'remove' | 'error';

class AudioManager {
  private bgm?: AudioSource;
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

    this.preload('bgm', 'audio/bgm-ambient');
    this.preload('place', 'audio/sfx-place');
    this.preload('remove', 'audio/sfx-remove');
  }

  private preload(key: string, path: string) {
    resources.load(path, AudioClip, (err, clip) => {
      if (err || !clip) { return; }
      this.clips[key] = clip;
      if (key === 'bgm' && this.bgm && !this._bgmMuted) {
        this.bgm.clip = clip;
        this.bgm.play();
      }
    });
  }

  playSfx(kind: SfxKind) {
    if (this._sfxMuted) return;
    const clip = this.clips[kind];
    if (!clip || !this.hostNode) return;
    AudioSource.playOneShot(clip);
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

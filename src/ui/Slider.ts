import Phaser from 'phaser';

/** Controle deslizante horizontal (0..1) desenhado por código, com arraste e toque. */
export class Slider extends Phaser.GameObjects.Container {
  private readonly track: Phaser.GameObjects.Graphics;
  private readonly knob: Phaser.GameObjects.Graphics;
  private valueInternal: number;
  private dragging = false;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    private readonly trackWidth: number,
    initial: number,
    private readonly onChange: (value: number) => void,
  ) {
    super(scene, x, y);
    this.valueInternal = Phaser.Math.Clamp(initial, 0, 1);
    this.track = scene.add.graphics();
    this.knob = scene.add.graphics();
    this.add([this.track, this.knob]);
    this.draw();

    const hit = new Phaser.Geom.Rectangle(-trackWidth / 2 - 24, -28, trackWidth + 48, 56);
    this.setInteractive(hit, Phaser.Geom.Rectangle.Contains);
    if (this.input) this.input.cursor = 'pointer';
    this.on('pointerdown', (p: Phaser.Input.Pointer) => {
      this.dragging = true;
      this.updateFromPointer(p);
    });
    scene.input.on('pointermove', this.handleMove, this);
    scene.input.on('pointerup', this.handleUp, this);
    this.once('destroy', () => {
      scene.input.off('pointermove', this.handleMove, this);
      scene.input.off('pointerup', this.handleUp, this);
    });
    scene.add.existing(this);
  }

  get value(): number {
    return this.valueInternal;
  }

  setValue(v: number): void {
    this.valueInternal = Phaser.Math.Clamp(v, 0, 1);
    this.draw();
  }

  private handleMove(p: Phaser.Input.Pointer): void {
    if (this.dragging) this.updateFromPointer(p);
  }

  private handleUp(): void {
    this.dragging = false;
  }

  private updateFromPointer(p: Phaser.Input.Pointer): void {
    const m = this.getWorldTransformMatrix();
    const local = m.applyInverse(p.worldX, p.worldY);
    const v = Phaser.Math.Clamp((local.x + this.trackWidth / 2) / this.trackWidth, 0, 1);
    if (v !== this.valueInternal) {
      this.valueInternal = v;
      this.draw();
      this.onChange(v);
    }
  }

  private draw(): void {
    const w = this.trackWidth;
    const t = this.track;
    t.clear();
    t.fillStyle(0x000000, 0.6);
    t.fillRoundedRect(-w / 2, -8, w, 16, 8);
    t.fillStyle(0xf3b63c, 1);
    t.fillRoundedRect(-w / 2, -8, Math.max(16, w * this.valueInternal), 16, 8);
    t.lineStyle(2, 0xd9a338, 0.8);
    t.strokeRoundedRect(-w / 2, -8, w, 16, 8);
    const k = this.knob;
    k.clear();
    const kx = -w / 2 + w * this.valueInternal;
    k.fillStyle(0x000000, 0.4);
    k.fillCircle(kx + 2, 4, 18);
    k.fillStyle(0xffe08a, 1);
    k.fillCircle(kx, 0, 18);
    k.fillStyle(0xf3b63c, 1);
    k.fillCircle(kx, 0, 12);
  }
}

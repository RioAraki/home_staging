import { Node, Graphics, UITransform, Color, Button } from 'cc';

/**
 * Paints a rounded-rectangle background on a Button node. Call from the owner
 * Component's start(). Idempotent — replaces existing 'Bg' child if present.
 */
export function styleButton(
  btn: Button | Node | null | undefined,
  fill: Color = new Color(252, 248, 240, 255),
  stroke: Color = new Color(30, 40, 60, 200),
): void {
  if (!btn) return;
  const node = (btn as any).node ?? btn as Node;
  if (!node || !(node as Node).getComponent) return;
  const ui = (node as Node).getComponent(UITransform);
  if (!ui) return;
  const w = ui.width, h = ui.height;
  if (w <= 0 || h <= 0) return;

  const existing = (node as Node).children.find((c: Node) => c.name === 'Bg');
  if (existing) existing.removeFromParent();

  const bg = new Node('Bg');
  (node as Node).insertChild(bg, 0);
  const bgUi = bg.addComponent(UITransform);
  bgUi.setContentSize(w, h);
  const g = bg.addComponent(Graphics);
  const r = Math.min(10, Math.min(w, h) * 0.25);

  drawRoundRect(g, -w / 2, h / 2, w, h, r);
  g.fillColor = fill;
  g.fill();
  g.strokeColor = stroke;
  g.lineWidth = 1.5;
  drawRoundRect(g, -w / 2, h / 2, w, h, r);
  g.stroke();
}

function drawRoundRect(g: Graphics, x: number, y: number, w: number, h: number, r: number) {
  const xR = x + w - r;
  const xL = x + r;
  const yT = y;
  const yB = y - h;

  g.moveTo(xL, yT);
  g.lineTo(xR, yT);
  g.arc(xR, yT - r, r, Math.PI / 2, 0, false);
  g.lineTo(x + w, yB + r);
  g.arc(xR, yB + r, r, 0, -Math.PI / 2, false);
  g.lineTo(xL, yB);
  g.arc(xL, yB + r, r, -Math.PI / 2, -Math.PI, false);
  g.lineTo(x, yT - r);
  g.arc(xL, yT - r, r, Math.PI, Math.PI / 2, false);
  g.close();
}

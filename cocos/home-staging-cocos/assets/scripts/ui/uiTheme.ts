import { Color } from 'cc';

/**
 * Shared UI-chrome palette: the "暖沙米色 (warm sand)" bright theme chosen in the
 * design review. These tokens style the chrome WRAPPING the floor plan — the
 * full-screen background, the top header band, the bottom furniture tray, and the
 * left-hand room-progress panel — so the whole game reads as one bright, warm,
 * "home-design magazine" surface instead of the old dark navy.
 *
 * NOT used for the floor plan itself: that layer's colours are scenario-`theme`
 * driven (see LayerRenderer) because each level paints its own walls/doors/bg.
 *
 * One constraint shapes the card colours: the furniture card art is WHITE
 * line-art on transparent, so it can only be read on a DARK tile. Hence the
 * cards keep a dark fill (a warm espresso, not navy, so it sits in the warm
 * palette) even though every panel around them is light.
 */

// ── Surfaces ──────────────────────────────────────────────────────────────
/** Full-screen background base (the dominant "is it dark?" colour). */
export const SAND_BG      = new Color(239, 230, 218, 255);   // #efe6da
/** Drifting diagonal background texture lines — visibly darker than the sand. */
export const SAND_TEXTURE = new Color(196, 174, 142, 205);   // #c4ae8e @ ~80%
/** Light panel fill for header band / tray / progress card. */
export const PANEL        = new Color(253, 246, 236, 240);   // #fdf6ec
/** Panel border / divider on the light surfaces. */
export const PANEL_LINE   = new Color(226, 211, 189, 255);   // #e2d3bd

// ── Accent (terracotta) ─────────────────────────────────────────────────────
/** Bright accent for dividers / selected outlines / primary action. */
export const ACCENT       = new Color(207, 123, 78, 255);    // #cf7b4e
/** Darker accent for titles / text that must read on a light panel. */
export const ACCENT_DARK  = new Color(168, 91, 52, 255);     // #a85b34

// ── Text on light surfaces ──────────────────────────────────────────────────
/** Primary dark text on cream panels. */
export const TEXT_DARK    = new Color(77, 64, 49, 255);      // #4d4031
/** Muted dark text (untouched rows / hints). */
export const TEXT_MUTED   = new Color(130, 116, 98, 255);    // #827462

// ── Cards (stay dark so the white line-art reads, but warm not black) ────────
// The vector card art is WHITE line-art on transparent, so it can only be read
// on a dark backing. We use a warm WALNUT (not near-black) so the cards look
// like wood/leather thumbnails that belong in the warm palette instead of jarring
// black blocks. Rounded corners (drawn in RoomPanel) complete the thumbnail feel.
export const CARD_FILL    = new Color(90, 70, 54, 255);      // #5a4636 walnut
/** Resting card border (lighter tan, reads on the walnut fill). */
export const CARD_LINE    = new Color(176, 150, 116, 255);   // #b09674
/** Card name label on the cream tray. */
export const CARD_NAME    = new Color(60, 50, 38, 255);      // #3c3226

// ── Buttons ─────────────────────────────────────────────────────────────────
export const BTN_GREEN    = new Color(78, 157, 84, 255);     // 放置
export const BTN_RED      = new Color(194, 90, 68, 255);     // 撤销
/** Primary action (完成摆放 / 结算) uses the terracotta accent. */
export const BTN_PRIMARY  = ACCENT;

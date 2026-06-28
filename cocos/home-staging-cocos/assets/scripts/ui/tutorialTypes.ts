/**
 * 通用强引导教程的声明式步骤格式。引擎(TutorialController)对所有关卡通用——
 * 每关只在 scenario.tutorial.steps 里写一份 JSON 即可挂上分步教学。
 */

/** 一步教程：指向谁 / 说什么 / 只放行什么动作 / 怎样算完成。 */
export interface TutorialStep {
  id: string;
  text: string;
  pointTo: PointTarget;
  hand: 'drag' | 'tap' | 'rotate';
  gate: GateRule;
  advanceOn: AdvanceRule;
}

/** 示意手指向的目标。 */
export type PointTarget =
  | { kind: 'card'; index: number }                         // 托盘里 card_<index> 节点
  | { kind: 'button'; name: '放置' | '拆除' }                // 动作按钮(按节点名找)
  | { kind: 'cell'; cell: [number, number] }                // 户型图某格(绝对网格坐标)
  | { kind: 'dragPath'; fromCard: number; to: [number, number] }; // 从卡片到某格的拖拽路径

/** 本步只放行的动作(强锁步)。 */
export type GateRule =
  | { action: 'drag'; cardIndex: number; toArea?: [number, number][] }
  | { action: 'rotate'; minTimes: number }
  // place: 可选 cell 锁定落点;requireShare 时只放行「会与已有家具共用开放格」的落点;
  // cardIndex 让该步仍能重新选中这张卡(防止丢失选中后卡死,因被拦的放置从未真正落子)。
  | { action: 'place'; cell?: [number, number]; requireShare?: boolean; cardIndex?: number }
  | { action: 'demolishToggle' }                            // 点「拆除」进入拆除模式
  | { action: 'demolishCell'; cell?: [number, number] };    // 点已放家具退回(cell 省略=任意一件)

/** 满足即跳下一步。 */
export type AdvanceRule =
  | { on: 'ghostPositioned' }
  | { on: 'placed'; sharesOpenCell?: boolean }
  | { on: 'rotatedAtLeast'; times: number }
  | { on: 'demolishModeOn' }                                // demolishMode 变 true
  | { on: 'removed' };                                      // placedPieces 数量减少

/** 运行时玩家动作——InputHandler / RoomPanel 调 gate() 时传入。 */
export type GateAction =
  | { kind: 'select'; slotIdx: number }
  | { kind: 'rotate' }
  | { kind: 'place'; origin: [number, number] }
  | { kind: 'demolishToggle' }
  | { kind: 'demolishCell'; cell: [number, number] };

export interface TutorialSpec { steps: TutorialStep[] }

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
  // 卡片→某格(to=footprint 左上角原点)。bad:true 时目标格高亮为红色(引导玩家去试「错误」位置)。
  | { kind: 'dragPath'; fromCard: number; to: [number, number]; bad?: boolean }
  | { kind: 'ghost' }                                       // 当前 ghost(选中家具)所在 footprint
  | { kind: 'lastPlaced' }                                  // 最近放下的家具 footprint(位置无关)
  // 旋转步「目标终点」:第 cardIndex 件家具在 origin、转到 rotation 时的 footprint。
  | { kind: 'goal'; cardIndex: number; rotation: number; origin: [number, number] }
  | { kind: 'openCells' }                                   // 所有已放家具的开放格(讲解用)
  // 红色错误格:引导玩家把家具拖去盖住它(会变红)。cell=footprint 左上角原点,
  // bbox 省略=1×1。fromCard 时同时高亮卡片、手从卡片滑过去。
  | { kind: 'badCell'; cell: [number, number]; bbox?: [number, number]; fromCard?: number }
  | { kind: 'none' };                                       // 纯文字步:不挖洞、不显示手

/** 本步只放行的动作(强锁步)。 */
export type GateRule =
  | { action: 'drag'; cardIndex: number; toArea?: [number, number][] }
  | { action: 'rotate'; minTimes: number }
  // place: 可选 cell 锁定落点;requireShare 时只放行「会与已有家具共用开放格」的落点;
  // cardIndex 让该步仍能重新选中这张卡(防止丢失选中后卡死,因被拦的放置从未真正落子)。
  // fixedGoal: 放置步高亮固定在该 footprint(不跟随会移动的 ghost),用于位置要求严格的步。
  | { action: 'place'; cell?: [number, number]; requireShare?: boolean; cardIndex?: number;
      fixedGoal?: { cardIndex: number; rotation: number; origin: [number, number] } }
  | { action: 'demolishToggle' }                            // 点「拆除」进入拆除模式
  | { action: 'demolishCell'; cell?: [number, number] }     // 点已放家具退回(cell 省略=任意一件)
  | { action: 'none' };                                     // 讲解步:不放行任何游戏操作

/** 满足即跳下一步。 */
export type AdvanceRule =
  | { on: 'ghostPositioned' }
  | { on: 'placed'; sharesOpenCell?: boolean }
  | { on: 'rotatedAtLeast'; times: number }
  | { on: 'demolishModeOn' }                                // demolishMode 变 true
  | { on: 'demolishModeOff' }                               // demolishMode 变 false(退出拆除模式)
  | { on: 'removed' }                                       // placedPieces 数量减少
  | { on: 'confirm' }                                       // 玩家点了教程气泡上的「确定」
  | { on: 'ghostCovers'; cell: [number, number] }           // 当前 ghost 的 footprint 盖住了某格
  // 盖住某格(变红)后,气泡下出现「我知道了」,点了才推进(错误示范:不帮玩家改对)。
  | { on: 'ackCovers'; cell: [number, number] };

/** 运行时玩家动作——InputHandler / RoomPanel 调 gate() 时传入。 */
export type GateAction =
  | { kind: 'select'; slotIdx: number }
  | { kind: 'rotate' }
  | { kind: 'place'; origin: [number, number] }
  | { kind: 'demolishToggle' }
  | { kind: 'demolishCell'; cell: [number, number] };

export interface TutorialSpec { steps: TutorialStep[] }

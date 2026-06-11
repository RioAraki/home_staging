# 关卡选择界面设计(Cocos 版)

日期:2026-06-11
状态:已确认

## 背景

`maps_data.json` 已包含全部 27 个关卡数据,但 `GameBootstrap.ts` 硬编码加载 `training`。
Web 版(`app/src/App.tsx`)白名单了 6 个已测试关卡,且这 6 关数据与 `md/maps_data.yaml`
(权威源)及 Cocos 的 JSON 副本完全一致。

## 决策

- **无进度存档**:游戏保持 stateless,不引入解锁/最高分持久化。
- **全部开放**:白名单内关卡全部可自由选择,无锁定状态。
- **首批关卡**:复刻 web 版的 6 个已测试关卡
  (training / alpine_wellness_hut / mountain_surgery / castle_cafe /
  rehearsal_room_old_barn / game_store_old_town)。

## 组件

### 1. 关卡白名单(core/dataLoader.ts)

- `AVAILABLE_SCENARIO_IDS` 常量(6 个 id,与 web 版一致)。
- `availableScenarios()` 返回按白名单顺序解析后的 Scenario 列表。
- 上架新关卡 = 验证通过后往数组加 id。

### 2. 选关界面(ui/ScenarioSelectScreen.ts,新文件)

- 纯代码动态构建(同 EndGameScreen 风格),全屏覆盖。
- 标题 + 6 个关卡按钮纵向排列,每行:title_zh + 难度标签。无滚动、无章节分组。
- 点击 → 销毁面板 → 启动该关(initRun + 自动选中第一个房间)。

### 3. 接线

- **GameBootstrap.ts**:数据加载后挂 ScenarioSelectScreen,不再硬编码 training;
  "启动一局"(initRun + selectRoom)抽成可复用函数。
- **EndGameScreen.ts**:按钮扩为"再来一局 / 下一关(有下一关时)/ 选择关卡"。
- **游戏内 HUD**:AudioControls 旁加"返回选关"按钮,点击弹**确认弹窗**
  (防误触,当前局面丢弃),确认后回选关页。

## 错误处理

- 选关时 scenario 查不到 → console.error 并留在选关页。

## 验证

6 个关卡逐一在 Cocos 预览冒烟:加载 → 摆放 → 结算跑通。
Web 版验证过规则数据,但 Cocos 渲染层(预绘墙、zones、多房间)未必覆盖,
发现问题单独修。

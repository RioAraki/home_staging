# 多 worktree 并行开发 → 单个 Cocos 预览

## 背景约束

- **Cocos Creator 一次只打开一个项目** = **主仓**(如 `D:\github\home_staging\cocos\home-staging-cocos`)。
- treehouse 的 worktree 是**独立目录树**(detached HEAD,按槽位 `1/2/…` 命名),Cocos **看不到**它们里的改动。
- **聚合生成物已移出 git**(见 `.gitignore`),只提交源、预览前 build:
  - `md/maps_data.yaml`
  - `asset/cards_furniture.json`
  - `cocos/home-staging-cocos/assets/resources/data/maps_data.json`
  - `cocos/home-staging-cocos/assets/resources/data/furniture_library.json`
  - 这些 cocos json 的 `.meta` 由 Cocos 本地生成、**未跟踪**,所以忽略 json 是安全的;build 重生成同路径 json 后 Cocos 重导即可。

## 策略:主仓当统一预览工作台

要预览某个 worktree/分支的内容,把它「带进主仓」再重建,然后在 Cocos Reimport。
(适合以关卡/家具**数据**为主的改动。若 feature 大改代码/场景/资产且长期停留,也可在
Cocos 里直接 `Open Project` 指向那个 worktree 的 cocos 目录 —— 代价是切工程要全量重导 Library。)

### 关键 git 约束

同一分支**不能**在两个 worktree 同时 checkout。所以主仓里**别**直接 `checkout feat/x`
(会被占用它的 worktree 挡),用**分离头**:`git checkout --detach origin/feat/x`。

### 固定流程

1. worktree(哪怕 detached)里提交改动。
2. 把 HEAD 推成按 **feature** 命名的远程分支:`git push origin HEAD:feat/<名>`
   (分支名跟 feature 走,不跟槽位走 —— 槽位 1/2 是会复用的工作区)。
3. 主仓里一键拉取 + 重建:`.\tools\preview-ref.ps1 feat/<名>`(动了 tile 加 `-Tiles`)。
4. Cocos:右键 `resources/data` → **Reimport**,等底部编译完成后 Preview。
5. 看完回主仓 main:`git checkout main`(脚本会提示;若它自动 stash 过本地改动,会提示 `git stash pop`)。

### 手动等价(不用脚本)

```sh
# 在主仓
git fetch origin
git checkout --detach origin/feat/<名>
cd cocos/home-staging-cocos
npm run scenarios:build          # 动了自定义家具再加:npm run furniture:library  (+ npm run sync:tiles 若新增/改了 tile)
# 回 Cocos:右键 resources/data → Reimport → Preview
```

## 多 worktree 改了多个关卡/家具,如何合并

- **源**(per-level `md/scenarios/<id>.json`、`asset/furniture_collection.json`)改不同文件
  → 合并**不冲突**;`_index.json`(关卡顺序数组)偶有小冲突,保留两边新增的 id 即可。
- **生成物**已 gitignore、不再进 git → 合并**零冲突**;合并后在主仓重 build 一次即可。

## 注意

- **fresh clone 后生成物不存在**,首次开 Cocos 前先 build 一次
  (`npm run scenarios:build` + `npm run furniture:library`),否则 Cocos 缺数据。
- 脚本 `tools/preview-ref.ps1` 在**主仓**运行,以自身所在仓库为操作对象;别在子 worktree 里跑。

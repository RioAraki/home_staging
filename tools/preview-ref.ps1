<#
.SYNOPSIS
  在「主仓」(Cocos 打开的那个 checkout)里一键拉取并预览某个 worktree/分支的内容。

.DESCRIPTION
  策略 A 的固定流程封装:fetch → 分离头检出目标 ref → 重建生成物。
  跑完后你只需回到 Cocos Creator,右键 resources/data → Reimport → Preview。

  用「分离头」检出(--detach)是为了绕开 git 限制:同一分支不能在两个 worktree
  同时 checkout —— 目标分支正被某个 worktree 占用时,直接 checkout 会被拒绝。

  ⚠ 在「主仓」(Cocos 打开的目录,如 D:\github\home_staging)里运行本脚本,
     而不是在子 worktree 里。脚本以自身所在仓库为操作对象。

.PARAMETER Ref
  要预览的分支名或提交。分支名会优先解析成 origin/<Ref>。
  例:feat/my-feature、origin/feat/my-feature、或某个 commit sha。

.PARAMETER Tiles
  额外跑 sync:tiles(仅当该 feature 新增/改动了 tile 时需要)。

.EXAMPLE
  # 在主仓:预览某个 feature 分支
  .\tools\preview-ref.ps1 feat/my-feature

.EXAMPLE
  .\tools\preview-ref.ps1 feat/new-furniture -Tiles
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory = $true, Position = 0)]
  [string]$Ref,
  [switch]$Tiles
)
$ErrorActionPreference = 'Stop'

$repo  = Split-Path -Parent $PSScriptRoot               # tools\ -> 仓库根
$cocos = Join-Path $repo 'cocos\home-staging-cocos'

Write-Host "▶ fetch origin..." -ForegroundColor Cyan
git -C $repo fetch origin --prune

# 解析 ref:优先 origin/<Ref>,否则原样使用
$target = $Ref
git -C $repo rev-parse --verify --quiet "origin/$Ref" > $null 2>&1
if ($LASTEXITCODE -eq 0) { $target = "origin/$Ref" }
Write-Host "▶ target = $target"

# 有本地改动先自动 stash(含未跟踪),保证检出干净;结束时提示如何恢复
$stashed = $false
if (git -C $repo status --porcelain) {
  Write-Host "▶ stash 本地改动 (preview-autostash)..." -ForegroundColor Yellow
  git -C $repo stash push -u -m "preview-autostash"
  $stashed = $true
}

Write-Host "▶ checkout --detach $target" -ForegroundColor Cyan
git -C $repo checkout --detach $target

Write-Host "▶ 重建生成物 (scenarios:build + furniture:library$(if ($Tiles) {' + sync:tiles'}))..." -ForegroundColor Cyan
Push-Location $cocos
try {
  npm run scenarios:build
  npm run furniture:library
  if ($Tiles) { npm run sync:tiles }
}
finally { Pop-Location }

Write-Host ""
Write-Host "✓ 已检出 $target 并重建。" -ForegroundColor Green
Write-Host "  在 Cocos 里:右键 resources/data → Reimport,等编译完成后 Preview。"
if ($Tiles) { Write-Host "  (动了 tile:同时 Reimport resources/tiles)" }
Write-Host ""
$back = "git -C `"$repo`" checkout main"
if ($stashed) { $back += " ; git -C `"$repo`" stash pop" }
Write-Host "  看完回到 main:  $back" -ForegroundColor DarkGray

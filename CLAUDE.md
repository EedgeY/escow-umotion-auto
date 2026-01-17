# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## プロジェクト概要

escow（U-motion / eedge.cloud 同期ツール） - 畜産管理システム間のデータ同期を自動化するCLIツール。U-motionから繁殖・妊娠診断データをスクレイピングし、eedge.cloudへ自動入力する。

## コマンド

```bash
# 依存関係インストール
pnpm install

# CLIツール起動（インタラクティブモード）
pnpm run escow

# 直接コマンド実行
pnpm run escow scrape -d 2026-01-16 -t breeding  # U-motionからスクレイピング
pnpm run escow submit -d 2026-01-16              # eedge.cloudへ入力
pnpm run escow sync -d 2026-01-16 -t all         # スクレイピング→入力の全工程
```

## アーキテクチャ

### データフロー
```
U-motion (Web) → UmotionScraper → data/*.json → data-converter → EedgeSubmitter → eedge.cloud (Web)
```

### 主要コンポーネント

- **src/cli/** - gunshi使用のCLIエントリポイント。インタラクティブREPLと直接コマンド両対応
- **src/umotion-scraper.ts** - Playwrightでの U-motion スクレイピング。繁殖(`/bred`)と妊娠診断(`/pregnant_diagnosis`)ページからデータ抽出
- **src/eedge-submitter.ts** - Playwrightでの eedge.cloud フォーム自動入力
- **src/data-converter.ts** - U-motion形式からeedge.cloud形式へのデータ変換
- **src/types.ts** - 全型定義（BreedingRecord, PregnancyRecord, EedgeInput等）

### データ種別と区分ID
- 繁殖: 授精(1), 移植(2), 発情(3)
- 妊娠診断: 妊鑑＋(4), 妊鑑−(5), 妊鑑+-(6)

### 特記事項
- `needsInseminationDate: true`（受胎=区分ID 4）の場合、memoはeedge.cloud側で自動設定されるため入力をスキップする
- 牛番号から畜主IDを抽出するロジック: 桁数に応じて前3桁を計算し先頭の0を除去
- ブラウザセッションは `.playwright-profile/` に永続化（ログイン状態維持）
- 出力JSONは `data/` ディレクトリに保存

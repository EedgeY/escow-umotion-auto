import { cli, define } from "gunshi";
import { scrapeCommand } from "./commands/scrape.js";
import { submitCommand } from "./commands/submit.js";
import { syncCommand } from "./commands/sync.js";
import { startRepl } from "./repl.js";

const args = process.argv.slice(2);

// 引数なし、または -i/--interactive の場合はインタラクティブモード
if (args.length === 0 || args.includes("-i") || args.includes("--interactive")) {
  await startRepl();
} else {
  const mainCommand = define({
    name: "escow",
    description: "U-motion / eedge.cloud 同期ツール",
    run: () => {
      console.log("使い方:");
      console.log("  pnpm run escow                          # インタラクティブモード");
      console.log("  pnpm run escow <command> [options]      # 直接実行");
      console.log("");
      console.log("コマンド:");
      console.log("  scrape   U-motionからスクレイピング");
      console.log("  submit   eedge.cloudへ入力");
      console.log("  sync     両方実行（デフォルト）");
      console.log("");
      console.log("共通オプション:");
      console.log("  -d, --date <YYYY-MM-DD>  対象日（必須）");
      console.log("  -t, --type <type>        データ種別（all | breeding | pregnancy）");
      console.log("  -i, --interactive        インタラクティブモードで起動");
      console.log("");
      console.log("例:");
      console.log("  pnpm run escow scrape -d 2026-01-16 -t breeding");
      console.log("  pnpm run escow submit -d 2026-01-16");
      console.log("  pnpm run escow sync -d 2026-01-16 -t all");
    },
  });

  await cli(args, mainCommand, {
    name: "escow",
    version: "1.0.0",
    subCommands: {
      scrape: scrapeCommand,
      submit: submitCommand,
      sync: syncCommand,
    },
  });
}

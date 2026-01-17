import * as readline from "readline";
import pc from "picocolors";
import { select, input, confirm } from "@inquirer/prompts";
import { runScrape } from "./commands/scrape.js";
import { runSubmit } from "./commands/submit.js";
import { runSync } from "./commands/sync.js";
import type { DataType } from "./types.js";

// 今日の日付を YYYY-MM-DD 形式で取得
function getToday(): string {
  const now = new Date();
  return now.toISOString().slice(0, 10);
}

// 対話式で同期を実行
async function interactiveSync(): Promise<void> {
  console.log();

  const dataType = await select<DataType>({
    message: "データ種別を選択",
    choices: [
      { name: "全て（繁殖 + 妊娠診断）", value: "all" },
      { name: "繁殖のみ", value: "breeding" },
      { name: "妊娠診断のみ", value: "pregnancy" },
    ],
  });

  const date = await input({
    message: "対象日（YYYY-MM-DD）",
    default: getToday(),
    validate: (value) => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return "YYYY-MM-DD 形式で入力してください";
      }
      return true;
    },
  });

  const typeLabel = dataType === "all" ? "全て" : dataType === "breeding" ? "繁殖" : "妊娠診断";
  console.log();
  console.log(pc.dim("─────────────────────────────"));
  console.log(`  種別: ${pc.cyan(typeLabel)}`);
  console.log(`  日付: ${pc.cyan(date)}`);
  console.log(pc.dim("─────────────────────────────"));

  const confirmed = await confirm({
    message: "同期を開始しますか？",
    default: true,
  });

  if (!confirmed) {
    console.log(pc.yellow("キャンセルしました"));
    return;
  }

  console.log();
  await runSync(date, dataType);
}

// 対話式でスクレイピングを実行
async function interactiveScrape(): Promise<void> {
  console.log();

  const dataType = await select<DataType>({
    message: "データ種別を選択",
    choices: [
      { name: "全て（繁殖 + 妊娠診断）", value: "all" },
      { name: "繁殖のみ", value: "breeding" },
      { name: "妊娠診断のみ", value: "pregnancy" },
    ],
  });

  const date = await input({
    message: "対象日（YYYY-MM-DD）",
    default: getToday(),
    validate: (value) => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return "YYYY-MM-DD 形式で入力してください";
      }
      return true;
    },
  });

  const typeLabel = dataType === "all" ? "全て" : dataType === "breeding" ? "繁殖" : "妊娠診断";
  console.log();
  console.log(pc.dim("─────────────────────────────"));
  console.log(`  種別: ${pc.cyan(typeLabel)}`);
  console.log(`  日付: ${pc.cyan(date)}`);
  console.log(pc.dim("─────────────────────────────"));

  const confirmed = await confirm({
    message: "スクレイピングを開始しますか？",
    default: true,
  });

  if (!confirmed) {
    console.log(pc.yellow("キャンセルしました"));
    return;
  }

  console.log();
  await runScrape(date, dataType);
}

// 対話式で入力を実行
async function interactiveSubmit(): Promise<void> {
  console.log();

  const dataType = await select<DataType>({
    message: "データ種別を選択",
    choices: [
      { name: "全て（繁殖 + 妊娠診断）", value: "all" },
      { name: "繁殖のみ", value: "breeding" },
      { name: "妊娠診断のみ", value: "pregnancy" },
    ],
  });

  const date = await input({
    message: "対象日（YYYY-MM-DD）",
    default: getToday(),
    validate: (value) => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return "YYYY-MM-DD 形式で入力してください";
      }
      return true;
    },
  });

  const typeLabel = dataType === "all" ? "全て" : dataType === "breeding" ? "繁殖" : "妊娠診断";
  console.log();
  console.log(pc.dim("─────────────────────────────"));
  console.log(`  種別: ${pc.cyan(typeLabel)}`);
  console.log(`  日付: ${pc.cyan(date)}`);
  console.log(pc.dim("─────────────────────────────"));

  const confirmed = await confirm({
    message: "eedge.cloudへの入力を開始しますか？",
    default: true,
  });

  if (!confirmed) {
    console.log(pc.yellow("キャンセルしました"));
    return;
  }

  console.log();
  await runSubmit(date, dataType);
}

function printHelp(): void {
  console.log();
  console.log(pc.bold(pc.cyan("コマンド")));
  console.log(`  ${pc.yellow("/s")}   同期（スクレイピング → 入力）`);
  console.log(`  ${pc.yellow("/sc")}  スクレイピングのみ`);
  console.log(`  ${pc.yellow("/su")}  入力のみ`);
  console.log(`  ${pc.yellow("/h")}   ヘルプ`);
  console.log(`  ${pc.yellow("/q")}   終了`);
  console.log();
}

function printWelcome(): void {
  const logo = `
${pc.yellow("  ███████╗")}${pc.cyan("███████╗")}${pc.green("██████╗")}${pc.magenta(" ██████╗")}${pc.blue("██╗    ██╗")}
${pc.yellow("  ██╔════╝")}${pc.cyan("██╔════╝")}${pc.green("██╔════╝")}${pc.magenta("██╔═══██╗")}${pc.blue("██║    ██║")}
${pc.yellow("  █████╗  ")}${pc.cyan("███████╗")}${pc.green("██║     ")}${pc.magenta("██║   ██║")}${pc.blue("██║ █╗ ██║")}
${pc.yellow("  ██╔══╝  ")}${pc.cyan("╚════██║")}${pc.green("██║     ")}${pc.magenta("██║   ██║")}${pc.blue("██║███╗██║")}
${pc.yellow("  ███████╗")}${pc.cyan("███████║")}${pc.green("╚██████╗")}${pc.magenta("╚██████╔╝")}${pc.blue("╚███╔███╔╝")}
${pc.yellow("  ╚══════╝")}${pc.cyan("╚══════╝")}${pc.green(" ╚═════╝")}${pc.magenta(" ╚═════╝")}${pc.blue(" ╚══╝╚══╝ ")}
`;

  console.log(logo);
  console.log(pc.dim("  ─────────────────────────────────────────────────"));
  console.log(`  ${pc.green("●")} Welcome to ${pc.bold("escow")} - U-motion / eedge.cloud sync tool`);
  console.log(pc.dim("  ─────────────────────────────────────────────────"));
  console.log();
  console.log(`  ${pc.yellow("/s")} 同期  ${pc.dim("/h ヘルプ  /q 終了")}`);
  console.log();
}

export async function startRepl(): Promise<void> {
  printWelcome();

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true,
  });

  const promptText = `${pc.bold(pc.green("escow"))}${pc.gray(">")} `;

  const prompt = (): void => {
    rl.question(promptText, async (input) => {
      const command = input.trim().toLowerCase();

      if (!command.startsWith("/")) {
        if (command) {
          console.log(pc.yellow("/ で始めてください") + pc.dim(" (/h でヘルプ)"));
        }
        prompt();
        return;
      }

      const cmd = command.slice(1);

      try {
        // readlineを一時停止してinquirerと競合しないようにする
        rl.pause();
        (rl as readline.Interface & { terminal?: boolean }).terminal = false;

        switch (cmd) {
          case "help":
          case "h":
            printHelp();
            break;

          case "exit":
          case "quit":
          case "q":
            console.log(pc.green("✓") + " 終了");
            rl.close();
            process.exit(0);

          case "s":
          case "sync":
          case "sy":
            await interactiveSync();
            break;

          case "sc":
          case "scrape":
            await interactiveScrape();
            break;

          case "su":
          case "submit":
            await interactiveSubmit();
            break;

          default:
            console.log(pc.yellow("?") + ` 不明: /${cmd}`);
            console.log(pc.dim("  /h でヘルプ"));
        }
      } catch (error) {
        if ((error as Error).name === "ExitPromptError") {
          // Ctrl+C でキャンセルされた場合
          console.log(pc.yellow("\nキャンセルしました"));
        } else {
          console.error(pc.red("✗") + " エラー:", error instanceof Error ? error.message : error);
        }
      } finally {
        // readlineを再開
        (rl as readline.Interface & { terminal?: boolean }).terminal = true;
        rl.resume();
      }

      prompt();
    });
  };

  prompt();
}

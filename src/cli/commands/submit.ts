import { define } from "gunshi";
import * as fs from "fs";
import * as path from "path";
import * as readline from "readline";
import { EedgeSubmitter } from "../../eedge-submitter.js";
import {
  convertRecords,
  convertPregnancyRecords,
  printPreview,
  printPregnancyPreview,
} from "../../data-converter.js";
import type {
  BreedingScrapingResult,
  PregnancyScrapingResult,
  EedgeInput,
} from "../../types.js";
import type { DataType } from "../types.js";

const DATA_DIR = path.join(process.cwd(), "data");

export const submitCommand = define({
  name: "submit",
  description: "eedge.cloudへデータを入力",
  args: {
    date: {
      type: "string",
      short: "d",
      description: "対象日（YYYY-MM-DD形式）",
      required: true,
    },
    type: {
      type: "string",
      short: "t",
      description: "データ種別（all | breeding | pregnancy）",
      default: "all",
    },
  },
  run: async (ctx) => {
    const { date, type = "all" } = ctx.values;

    // 日付フォーマットのバリデーション
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      console.error("エラー: 日付は YYYY-MM-DD 形式で指定してください。");
      process.exit(1);
    }

    const dataType = type as DataType;
    if (!["all", "breeding", "pregnancy"].includes(dataType)) {
      console.error("エラー: --type は all, breeding, pregnancy のいずれかを指定してください。");
      process.exit(1);
    }

    await runSubmit(date, dataType);
  },
});

function askQuestion(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

export async function runSubmit(date: string, dataType: DataType): Promise<void> {
  const allInputs: EedgeInput[] = [];

  // 繁殖データの読み込み
  if (dataType === "all" || dataType === "breeding") {
    const breedingJsonPath = path.join(DATA_DIR, `breeding-${date}.json`);
    if (fs.existsSync(breedingJsonPath)) {
      const breedingData: BreedingScrapingResult = JSON.parse(fs.readFileSync(breedingJsonPath, "utf-8"));
      const breedingInputs = convertRecords(breedingData.records);
      console.log(`\n繁殖データ: ${breedingInputs.length} 件`);
      printPreview(breedingData.records, breedingInputs);
      allInputs.push(...breedingInputs);
    } else {
      console.log(`\n繁殖データ: なし (${breedingJsonPath})`);
    }
  }

  // 妊娠診断データの読み込み
  if (dataType === "all" || dataType === "pregnancy") {
    const pregnancyJsonPath = path.join(DATA_DIR, `pregnancy-${date}.json`);
    if (fs.existsSync(pregnancyJsonPath)) {
      const pregnancyData: PregnancyScrapingResult = JSON.parse(fs.readFileSync(pregnancyJsonPath, "utf-8"));
      const pregnancyInputs = convertPregnancyRecords(pregnancyData.records);
      console.log(`\n妊娠診断データ: ${pregnancyInputs.length} 件`);
      printPregnancyPreview(pregnancyData.records, pregnancyInputs);
      allInputs.push(...pregnancyInputs);
    } else {
      console.log(`\n妊娠診断データ: なし (${pregnancyJsonPath})`);
    }
  }

  if (allInputs.length === 0) {
    console.error("\nエラー: データがありません。先に scrape コマンドでスクレイピングを実行してください。");
    process.exit(1);
  }

  console.log(`\n合計: ${allInputs.length} 件`);

  const answer = await askQuestion("\needge.cloudへの入力を開始しますか？ (y/N): ");
  if (answer.toLowerCase() !== "y") {
    console.log("キャンセルしました。");
    return;
  }

  const submitter = new EedgeSubmitter();

  process.on("SIGINT", async () => {
    console.log("\n\n中断シグナルを受信しました...");
    await submitter.close();
    process.exit(0);
  });

  try {
    await submitter.start(allInputs);
  } finally {
    await submitter.close();
  }
}

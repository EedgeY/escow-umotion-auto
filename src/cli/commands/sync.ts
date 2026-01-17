import { define } from "gunshi";
import * as fs from "fs";
import * as path from "path";
import { confirm } from "@inquirer/prompts";
import { UmotionScraper } from "../../umotion-scraper.js";
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

export const syncCommand = define({
  name: "sync",
  description: "U-motionからスクレイピングし、eedge.cloudへ入力（全工程）",
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

    await runSync(date, dataType);
  },
});

interface ScrapeResults {
  breeding: BreedingScrapingResult | null;
  pregnancy: PregnancyScrapingResult | null;
}

async function runScrapeInternal(date: string, dataType: DataType): Promise<ScrapeResults> {
  const scraper = new UmotionScraper();

  process.on("SIGINT", async () => {
    console.log("\n\n中断シグナルを受信しました...");
    await scraper.close();
    process.exit(0);
  });

  try {
    let breedingResult: BreedingScrapingResult | null = null;
    let pregnancyResult: PregnancyScrapingResult | null = null;

    // 繁殖データをスクレイピング
    if (dataType === "all" || dataType === "breeding") {
      breedingResult = await scraper.scrapeBreeding(date);
    }

    // 妊娠診断データをスクレイピング
    if (dataType === "all" || dataType === "pregnancy") {
      pregnancyResult = await scraper.scrapePregnancy(date);
    }

    return {
      breeding: breedingResult,
      pregnancy: pregnancyResult,
    };
  } finally {
    await scraper.close();
  }
}

export async function runSync(date: string, dataType: DataType): Promise<void> {
  const typeLabel = dataType === "all" ? "全データ" : dataType === "breeding" ? "繁殖" : "妊娠診断";

  // Step 1: スクレイピング
  console.log(`=== Step 1: U-motion から${typeLabel}を取得 ===\n`);
  const scrapeResults = await runScrapeInternal(date, dataType);

  const breedingCount = scrapeResults.breeding?.records.length || 0;
  const pregnancyCount = scrapeResults.pregnancy?.records.length || 0;

  if (breedingCount === 0 && pregnancyCount === 0) {
    console.log("\nデータがありません。終了します。");
    return;
  }

  // Step 2: データ変換とプレビュー
  console.log("\n=== Step 2: データ変換 ===\n");

  const allInputs: EedgeInput[] = [];
  let inputJsonPath = "";

  // 繁殖データの変換
  if (scrapeResults.breeding && scrapeResults.breeding.records.length > 0) {
    const breedingInputs = convertRecords(scrapeResults.breeding.records);
    printPreview(scrapeResults.breeding.records, breedingInputs);
    allInputs.push(...breedingInputs);

    const breedingInputJsonPath = path.join(DATA_DIR, `breeding-${date}-inputs.json`);
    fs.writeFileSync(breedingInputJsonPath, JSON.stringify(breedingInputs, null, 2), "utf-8");
    console.log(`繁殖入力データを保存: ${breedingInputJsonPath}`);

    if (dataType === "breeding") {
      inputJsonPath = breedingInputJsonPath;
    }
  }

  // 妊娠診断データの変換
  if (scrapeResults.pregnancy && scrapeResults.pregnancy.records.length > 0) {
    const pregnancyInputs = convertPregnancyRecords(scrapeResults.pregnancy.records);
    printPregnancyPreview(scrapeResults.pregnancy.records, pregnancyInputs);
    allInputs.push(...pregnancyInputs);

    const pregnancyInputJsonPath = path.join(DATA_DIR, `pregnancy-${date}-inputs.json`);
    fs.writeFileSync(pregnancyInputJsonPath, JSON.stringify(pregnancyInputs, null, 2), "utf-8");
    console.log(`妊娠診断入力データを保存: ${pregnancyInputJsonPath}`);

    if (dataType === "pregnancy") {
      inputJsonPath = pregnancyInputJsonPath;
    }
  }

  // 全入力データを結合して保存（allの場合のみ）
  if (dataType === "all") {
    inputJsonPath = path.join(DATA_DIR, `all-${date}-inputs.json`);
    fs.writeFileSync(inputJsonPath, JSON.stringify(allInputs, null, 2), "utf-8");
    console.log(`全入力データを保存: ${inputJsonPath}`);
  }

  // Step 3: 確認
  console.log("\n=== Step 3: 確認 ===");
  console.log(`\nJSONファイルを確認・編集できます:`);
  if (dataType === "all" || dataType === "breeding") {
    console.log(`   - 繁殖抽出データ: data/breeding-${date}.json`);
  }
  if (dataType === "all" || dataType === "pregnancy") {
    console.log(`   - 妊娠診断抽出データ: data/pregnancy-${date}.json`);
  }
  console.log(`   - 入力データ: ${inputJsonPath}`);
  console.log(`\n合計: ${allInputs.length} 件`);
  if (dataType === "all") {
    console.log(`  （繁殖: ${breedingCount}件, 妊娠診断: ${pregnancyCount}件）`);
  }

  console.log();
  const confirmed = await confirm({
    message: "確認が完了したら、eedge.cloudへの入力を開始しますか？",
    default: true,
  });
  if (!confirmed) {
    console.log("キャンセルしました。入力を行う場合は /su コマンドで再実行してください。");
    return;
  }

  // Step 4: 入力
  console.log("\n=== Step 4: eedge.cloud への入力 ===\n");

  // JSONから再読み込み（編集されている可能性があるため）
  const latestInputs: EedgeInput[] = JSON.parse(fs.readFileSync(inputJsonPath, "utf-8"));

  const submitter = new EedgeSubmitter();

  process.on("SIGINT", async () => {
    console.log("\n\n中断シグナルを受信しました...");
    await submitter.close();
    process.exit(0);
  });

  try {
    await submitter.start(latestInputs);
  } finally {
    await submitter.close();
  }
}

import { define } from "gunshi";
import { UmotionScraper } from "../../umotion-scraper.js";
import type { DataType } from "../types.js";

export const scrapeCommand = define({
  name: "scrape",
  description: "U-motionからデータをスクレイピング",
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

    await runScrape(date, dataType);
  },
});

export async function runScrape(date: string, dataType: DataType) {
  const scraper = new UmotionScraper();

  process.on("SIGINT", async () => {
    console.log("\n\n中断シグナルを受信しました...");
    await scraper.close();
    process.exit(0);
  });

  try {
    // 繁殖データをスクレイピング
    if (dataType === "all" || dataType === "breeding") {
      await scraper.scrapeBreeding(date);
    }

    // 妊娠診断データをスクレイピング
    if (dataType === "all" || dataType === "pregnancy") {
      await scraper.scrapePregnancy(date);
    }
  } finally {
    await scraper.close();
  }
}

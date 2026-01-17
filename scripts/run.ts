import { WamScraper } from "../src/scraper.js";

function printUsage(): void {
  console.log("使い方:");
  console.log("  pnpm run scrape    # 検索を実行");
  console.log("");
  console.log("入力ファイル: ./data/input.csv");
  console.log("形式: name,address (ヘッダー行あり)");
  console.log("");
  console.log("例:");
  console.log("  name,address");
  console.log("  つなぐ手ケアマネセンター,福島県いわき市勿来町");
}

async function main() {
  const args = process.argv.slice(2);

  if (args.includes("--help") || args.includes("-h")) {
    printUsage();
    return;
  }

  const scraper = new WamScraper();

  // Ctrl+Cでの中断時に保存
  process.on("SIGINT", async () => {
    console.log("\n\n中断シグナルを受信しました。ブラウザを閉じています...");
    await scraper.close();
    process.exit(0);
  });

  try {
    await scraper.start();
  } catch (error) {
    console.error("実行エラー:", error);
    await scraper.close();
    process.exit(1);
  }
}

main();

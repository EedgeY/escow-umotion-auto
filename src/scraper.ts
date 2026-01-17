import { chromium, type Browser, type Page } from "playwright";
import * as fs from "fs";
import { WAM_SEARCH_URL, randomDelay, INPUT_CSV_FILE, OUTPUT_FILE } from "./config.js";
import {
  parseInputCSV,
  parseSearchResults,
  isSimilarName,
  isSimilarAddress,
} from "./parser.js";
import type { InputRecord, MatchResult, ScrapingResult, SearchResult } from "./types.js";

export class WamScraper {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private result: ScrapingResult;

  constructor() {
    this.result = this.loadExistingResult();
  }

  private loadExistingResult(): ScrapingResult {
    try {
      if (fs.existsSync(OUTPUT_FILE)) {
        const data = fs.readFileSync(OUTPUT_FILE, "utf-8");
        return JSON.parse(data);
      }
    } catch {
      console.log("既存データなし、新規作成します");
    }
    return {
      results: [],
      lastUpdated: new Date().toISOString(),
      totalProcessed: 0,
      totalFound: 0,
      totalNotFound: 0,
      totalErrors: 0,
    };
  }

  private saveResult(): void {
    this.result.lastUpdated = new Date().toISOString();
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(this.result, null, 2), "utf-8");
  }

  private getProcessedKeys(): Set<string> {
    return new Set(this.result.results.map((r) => `${r.inputName}|${r.inputAddress}`));
  }

  async start(): Promise<void> {
    console.log("=== WAM事業所検索スクレイピング開始 ===\n");

    // 入力CSVを読み込み
    if (!fs.existsSync(INPUT_CSV_FILE)) {
      console.error(`エラー: ${INPUT_CSV_FILE} が見つかりません`);
      console.log("入力CSVファイルを作成してください。形式: name,address");
      return;
    }

    const inputRecords = parseInputCSV(INPUT_CSV_FILE);
    if (inputRecords.length === 0) {
      console.log("処理するレコードがありません。");
      return;
    }

    const processedKeys = this.getProcessedKeys();
    const pendingRecords = inputRecords.filter(
      (r) => !processedKeys.has(`${r.name}|${r.address}`)
    );

    console.log(`総レコード数: ${inputRecords.length}`);
    console.log(`処理済み: ${inputRecords.length - pendingRecords.length}`);
    console.log(`未処理: ${pendingRecords.length}\n`);

    if (pendingRecords.length === 0) {
      console.log("すべてのレコードは処理済みです。");
      return;
    }

    // ブラウザ起動
    console.log("ブラウザを起動中...");
    this.browser = await chromium.launch({
      headless: false,
      slowMo: 100,
    });
    this.page = await this.browser.newPage();

    try {
      for (let i = 0; i < pendingRecords.length; i++) {
        const record = pendingRecords[i];
        const progress = `[${i + 1}/${pendingRecords.length}]`;

        await this.processRecord(record, progress);

        // 最後以外は待機
        if (i < pendingRecords.length - 1) {
          const delay = randomDelay();
          console.log(`  → ${delay / 1000}秒待機...\n`);
          await this.sleep(delay);
        }
      }
    } finally {
      await this.close();
    }

    console.log("\n=== スクレイピング完了 ===");
    console.log(`処理件数: ${pendingRecords.length}`);
    console.log(`見つかった: ${this.result.totalFound}`);
    console.log(`見つからなかった: ${this.result.totalNotFound}`);
    console.log(`エラー件数: ${this.result.totalErrors}`);
    console.log(`出力ファイル: ${OUTPUT_FILE}`);
  }

  private async processRecord(record: InputRecord, progress: string): Promise<void> {
    console.log(`${progress} 検索: ${record.name}`);
    console.log(`  住所: ${record.address}`);

    const matchResult: MatchResult = {
      inputName: record.name,
      inputAddress: record.address,
      found: false,
      matchedResults: [],
      searchedAt: new Date().toISOString(),
    };

    try {
      // 検索ページに移動
      await this.page!.goto(WAM_SEARCH_URL, { waitUntil: "networkidle", timeout: 30000 });
      await this.sleep(500);

      // 検索テキストを入力
      await this.page!.fill("#searchtext", record.name);
      await this.sleep(300);

      // 検索ボタンをクリック
      await this.page!.click("#search_btn");

      // 結果が表示されるまで待機
      await this.page!.waitForSelector('tr[id^="datarow_"], .no-result, table.independent-table', {
        timeout: 15000,
      }).catch(() => {});
      await this.sleep(1000);

      // 検索結果を取得
      const searchResults = await parseSearchResults(this.page!);

      if (searchResults.length === 0) {
        console.log(`  → 検索結果なし`);
        matchResult.found = false;
        this.result.totalNotFound++;
      } else {
        console.log(`  → ${searchResults.length}件の結果`);

        // 名前と住所が近いものを探す
        const matchedResults = this.findMatchingResults(record, searchResults);

        if (matchedResults.length > 0) {
          matchResult.found = true;
          matchResult.matchedResults = matchedResults;
          console.log(`  → マッチ: ${matchedResults.length}件`);
          for (const match of matchedResults) {
            console.log(`    - ${match.name} (${match.address})`);
          }
          this.result.totalFound++;
        } else {
          console.log(`  → 名前・住所が一致する結果なし`);
          matchResult.found = false;
          this.result.totalNotFound++;
        }
      }
    } catch (error) {
      matchResult.error = true;
      matchResult.errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.log(`  → エラー: ${matchResult.errorMessage}`);
      this.result.totalErrors++;
    }

    this.result.results.push(matchResult);
    this.result.totalProcessed++;
    this.saveResult();
  }

  private findMatchingResults(input: InputRecord, results: SearchResult[]): SearchResult[] {
    return results.filter((r) => {
      const nameMatch = isSimilarName(input.name, r.name);
      const addressMatch = isSimilarAddress(input.address, r.address);

      // 名前が一致し、住所も一致する場合にマッチとする
      return nameMatch && addressMatch;
    });
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.page = null;
    }
  }
}

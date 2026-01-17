import { chromium, type BrowserContext, type Page } from "playwright";
import * as fs from "fs";
import * as path from "path";
import type { BreedingRecord, BreedingScrapingResult, PregnancyRecord, PregnancyScrapingResult } from "./types.js";

const USER_DATA_DIR = path.join(process.cwd(), ".playwright-profile");
const DATA_DIR = path.join(process.cwd(), "data");

export class UmotionScraper {
  private context: BrowserContext | null = null;
  private page: Page | null = null;

  private async ensureBrowser(): Promise<Page> {
    if (!this.context) {
      // データディレクトリ作成
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }

      // ブラウザ起動（プロファイル維持）
      console.log("ブラウザを起動中...");
      this.context = await chromium.launchPersistentContext(USER_DATA_DIR, {
        headless: false,
        slowMo: 100,
        viewport: { width: 1280, height: 900 },
      });
      this.page = this.context.pages()[0] || await this.context.newPage();
    }
    return this.page!;
  }

  private async navigateAndCheckLogin(url: string): Promise<void> {
    const page = await this.ensureBrowser();
    console.log(`\nページを開いています: ${url}`);
    await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });
    await this.sleep(2000);

    const currentUrl = page.url();
    if (currentUrl.includes("login") || currentUrl.includes("auth")) {
      console.log("\n⚠️  ログインが必要です。ブラウザでログインしてください。");
      console.log("ログイン完了後、Enterキーを押してください...");
      await this.waitForUserInput();
      await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });
      await this.sleep(2000);
    }
  }

  // 繁殖（人工授精・移植）のスクレイピング
  async scrapeBreeding(date: string): Promise<BreedingScrapingResult> {
    console.log("=== U-motion 繁殖データ スクレイピング ===\n");
    console.log(`対象日: ${date}`);

    const page = await this.ensureBrowser();
    const url = `https://ap.u-motion.co.jp/#/daily-report/details/${date}/bred`;
    await this.navigateAndCheckLogin(url);

    const records: BreedingRecord[] = [];

    try {
      console.log("\nグリッドデータを待機中...");
      await page.waitForSelector(".ui-grid-viewport", { timeout: 30000 });
      await this.sleep(1000);

      const rows = await page.locator(".ui-grid-row").all();
      console.log(`\n${rows.length} 件のレコードを検出`);

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const cells = await row.locator(".ui-grid-cell-contents").all();

        if (cells.length >= 18) {
          const cowNoLink = cells[0].locator("a");
          const cowNo = await cowNoLink.count() > 0
            ? await cowNoLink.textContent() || ""
            : await cells[0].textContent() || "";

          const record: BreedingRecord = {
            cowNo: cowNo.trim(),
            individualId: (await cells[1].textContent() || "").trim(),
            date: (await cells[2].textContent() || "").trim(),
            staff: (await cells[3].textContent() || "").trim(),
            time: (await cells[4].textContent() || "").trim(),
            method: (await cells[5].textContent() || "").trim(),
            semenName: (await cells[7].textContent() || "").trim(),
            semenNo: (await cells[8].textContent() || "").trim(),
            memo: (await cells[17].textContent() || "").trim(),
          };

          records.push(record);
          console.log(`  [${i + 1}] ${record.cowNo} - ${record.individualId} - ${record.method}`);
        }
      }
    } catch (error) {
      console.error("スクレイピングエラー:", error);
      throw error;
    }

    const result: BreedingScrapingResult = {
      records,
      scrapedAt: new Date().toISOString(),
      date,
      totalCount: records.length,
    };

    const outputPath = path.join(DATA_DIR, `breeding-${date}.json`);
    fs.writeFileSync(outputPath, JSON.stringify(result, null, 2), "utf-8");
    console.log(`\n✅ ${records.length} 件のデータを保存しました: ${outputPath}`);

    return result;
  }

  // 妊娠診断のスクレイピング
  async scrapePregnancy(date: string): Promise<PregnancyScrapingResult> {
    console.log("\n=== U-motion 妊娠診断データ スクレイピング ===\n");
    console.log(`対象日: ${date}`);

    const page = await this.ensureBrowser();
    const url = `https://ap.u-motion.co.jp/#/daily-report/details/${date}/pregnant_diagnosis`;
    await this.navigateAndCheckLogin(url);

    const records: PregnancyRecord[] = [];

    try {
      console.log("\nグリッドデータを待機中...");
      await page.waitForSelector(".ui-grid-viewport", { timeout: 30000 });
      await this.sleep(1000);

      const rows = await page.locator(".ui-grid-row").all();
      console.log(`\n${rows.length} 件のレコードを検出`);

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const cells = await row.locator(".ui-grid-cell-contents").all();

        // 妊娠診断のカラム構造
        // 0: 牛番号, 1: 個体識別番号, 2: 日付, 3: 担当者, 4: 結果, 5: 授精日?, ...
        if (cells.length >= 6) {
          const cowNoLink = cells[0].locator("a");
          const cowNo = await cowNoLink.count() > 0
            ? await cowNoLink.textContent() || ""
            : await cells[0].textContent() || "";

          const record: PregnancyRecord = {
            cowNo: cowNo.trim(),
            individualId: (await cells[1].textContent() || "").trim(),
            date: (await cells[2].textContent() || "").trim(),
            staff: (await cells[3].textContent() || "").trim(),
            time: "",  // 妊娠診断には時間なし
            result: (await cells[4].textContent() || "").trim(),  // 結果（受胎/未受胎）
            memo: cells.length > 6 ? (await cells[cells.length - 1].textContent() || "").trim() : "",
          };

          records.push(record);
          console.log(`  [${i + 1}] ${record.cowNo} - ${record.individualId} - ${record.result}`);
        }
      }
    } catch (error) {
      console.error("スクレイピングエラー:", error);
      throw error;
    }

    const result: PregnancyScrapingResult = {
      records,
      scrapedAt: new Date().toISOString(),
      date,
      totalCount: records.length,
    };

    const outputPath = path.join(DATA_DIR, `pregnancy-${date}.json`);
    fs.writeFileSync(outputPath, JSON.stringify(result, null, 2), "utf-8");
    console.log(`\n✅ ${records.length} 件のデータを保存しました: ${outputPath}`);

    return result;
  }

  // 後方互換性のためのエイリアス
  async start(date: string): Promise<BreedingScrapingResult> {
    return this.scrapeBreeding(date);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private waitForUserInput(): Promise<void> {
    return new Promise((resolve) => {
      process.stdin.once("data", () => resolve());
    });
  }

  async close(): Promise<void> {
    if (this.context) {
      await this.context.close();
      this.context = null;
      this.page = null;
    }
  }
}

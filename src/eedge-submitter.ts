import { chromium, type BrowserContext, type Page } from "playwright";
import * as path from "path";
import type { EedgeInput } from "./types.js";

const USER_DATA_DIR = path.join(process.cwd(), ".playwright-profile");

export class EedgeSubmitter {
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private submittedCount = 0;
  private errorCount = 0;

  async start(inputs: EedgeInput[]): Promise<void> {
    console.log("=== eedge.cloud 自動入力開始 ===\n");
    console.log(`入力件数: ${inputs.length} 件`);

    // ブラウザ起動（プロファイル維持）
    console.log("\nブラウザを起動中...");
    this.context = await chromium.launchPersistentContext(USER_DATA_DIR, {
      headless: false,
      slowMo: 150,
      viewport: { width: 1280, height: 900 },
    });
    this.page = this.context.pages()[0] || await this.context.newPage();

    // eedge.cloudを開く
    const date = inputs[0]?.date || new Date().toISOString().slice(0, 10);
    const url = `https://www.eedge.cloud/breeding?date=${date}`;
    console.log(`\nページを開いています: ${url}`);
    await this.page.goto(url, { waitUntil: "networkidle", timeout: 60000 });
    await this.sleep(2000);

    // ログインチェック
    const currentUrl = this.page.url();
    if (currentUrl.includes("login") || currentUrl.includes("auth") || currentUrl.includes("signin")) {
      console.log("\n⚠️  ログインが必要です。ブラウザでログインしてください。");
      console.log("ログイン完了後、Enterキーを押してください...");
      await this.waitForUserInput();
      await this.page.goto(url, { waitUntil: "networkidle", timeout: 60000 });
      await this.sleep(2000);
    }

    // フォームが表示されるまで待機
    await this.page.waitForSelector('form', { timeout: 30000 });

    // 各レコードを入力
    for (let i = 0; i < inputs.length; i++) {
      const input = inputs[i];
      console.log(`\n--- [${i + 1}/${inputs.length}] ${input.individualId} ---`);

      try {
        // 各レコード処理前にページをリロードしてフォームをリセット
        await this.page.goto(url, { waitUntil: "networkidle", timeout: 60000 });
        await this.page.waitForSelector('form', { timeout: 30000 });
        await this.sleep(500);

        await this.submitOne(input);
        this.submittedCount++;
        console.log(`  ✅ 登録完了`);
      } catch (error) {
        this.errorCount++;
        console.error(`  ❌ エラー:`, error instanceof Error ? error.message : error);
      }

      // 次のレコードの前に待機
      if (i < inputs.length - 1) {
        await this.sleep(500);
      }
    }

    console.log("\n=== 入力完了 ===");
    console.log(`成功: ${this.submittedCount} 件`);
    console.log(`失敗: ${this.errorCount} 件`);
  }

  private async submitOne(input: EedgeInput): Promise<void> {
    if (!this.page) throw new Error("Page not initialized");

    // 日付入力
    const dateInput = this.page.locator('input[name="date"]');
    await dateInput.fill(input.date);
    console.log(`  日付: ${input.date}`);

    // 畜主ID入力（入力後、個体データがロードされるのを待つ）
    const ownerInput = this.page.locator('input[name="selection_number"]');
    await ownerInput.fill(input.ownerId);
    console.log(`  畜主ID: ${input.ownerId}`);

    // Enterキーを押して確定、または少し待ってからTabで移動
    await ownerInput.press('Tab');
    await this.sleep(3000); // 個体データのロード待ち（長めに）
    console.log(`  → 個体データロード完了`);

    // 個体選択
    await this.selectIndividual(input.individualId);
    console.log(`  個体: ${input.individualId}`);

    // 区分ID入力
    const classificationInput = this.page.locator('input[name="classification_id"]');
    await classificationInput.fill(input.classificationId);
    console.log(`  区分ID: ${input.classificationId}`);
    await this.sleep(500);

    // 受胎（classification_id=4）の場合、対象授精日を選択
    if (input.needsInseminationDate || input.classificationId === "4") {
      await this.selectInseminationDate();
    }

    // 内容（精液番号）入力（妊娠診断の場合は空）
    if (input.contentId) {
      const contentInput = this.page.locator('input[name="content_id"]');
      await contentInput.fill(input.contentId);
      console.log(`  内容: ${input.contentId}`);
      await this.sleep(300);
    }

    // 数量入力
    const quantityInput = this.page.locator('input[name="quantity"]');
    await quantityInput.fill(String(input.quantity));

    // 料金入力
    const priceInput = this.page.locator('input[name="price"]');
    await priceInput.fill(String(input.price));

    // メモ入力（受胎の場合は自動入力されるのでスキップ）
    if (!input.needsInseminationDate) {
      const memoInput = this.page.locator('textarea[name="memo"]');
      await memoInput.fill(input.memo);
    }

    // 登録ボタンをクリック
    const submitButton = this.page.locator('button:has-text("登録")').last();
    await submitButton.click();
    console.log(`  → 登録ボタンをクリック`);

    // 登録完了を待機
    await this.sleep(1500);
  }

  private async selectInseminationDate(): Promise<void> {
    if (!this.page) throw new Error("Page not initialized");

    // 対象授精日のセレクトボックスを探す
    const selectBox = this.page.locator('select[aria-label="授精日選択"]');

    // セレクトボックスが表示されるまで待機
    try {
      await selectBox.waitFor({ state: "visible", timeout: 5000 });
    } catch {
      console.log(`  ⚠️ 対象授精日セレクトボックスが見つかりません`);
      throw new Error("対象授精日セレクトボックスが見つかりません");
    }

    await this.sleep(500); // セレクトボックスが安定するまで待機

    // オプションを取得
    const options = await selectBox.locator('option').all();

    // 空でない最初のオプション（value=""以外）を探す
    let selectedValue = "";
    for (const option of options) {
      const value = await option.getAttribute("value");
      if (value && value !== "") {
        selectedValue = value;
        break;
      }
    }

    if (!selectedValue) {
      console.log(`  ❌ 対象授精日のオプションがありません`);
      throw new Error("対象授精日のオプションがありません");
    }

    // 選択（クリックしてから選択）
    await selectBox.click();
    await this.sleep(200);
    await selectBox.selectOption(selectedValue);
    console.log(`  対象授精日: ${selectedValue}`);

    // 選択が安定するまで長めに待機
    await this.sleep(1000);

    // 選択されているか確認
    const currentValue = await selectBox.inputValue();
    if (currentValue !== selectedValue) {
      console.log(`  ⚠️ 対象授精日の選択が消えました。再選択します...`);
      await selectBox.selectOption(selectedValue);
      await this.sleep(500);
    }
  }

  private async selectIndividual(individualId: string): Promise<void> {
    if (!this.page) throw new Error("Page not initialized");

    // 「個体を選択」ボタンをクリック
    const selectButton = this.page.locator('button:has-text("個体を選択")');
    await selectButton.click();
    console.log(`    → 個体選択ボタンをクリック`);
    await this.sleep(500);

    // ダイアログが開くのを待つ
    try {
      await this.page.waitForSelector('[cmdk-input]', { timeout: 3000 });
    } catch {
      console.log(`    ⚠️ ダイアログが開きませんでした、スキップします`);
      return;
    }

    // 個体識別番号からハイフンを除去して検索
    // 例: "13470-0278-8" → "1347002788"
    const searchTerm = individualId.replace(/-/g, "");

    // 検索入力欄に入力
    const searchInput = this.page.locator('[cmdk-input]');
    await searchInput.fill(searchTerm);
    console.log(`    検索: ${searchTerm}`);
    await this.sleep(1000); // 検索結果のロード待ち

    // 検索結果から最初の選択肢をクリック
    const resultItem = this.page.locator('[cmdk-item][role="option"]').first();
    if (await resultItem.count() > 0) {
      await resultItem.click();
      console.log(`    → 個体を選択しました`);
      await this.sleep(300);
    } else {
      console.log(`    ⚠️ 検索結果が見つかりませんでした`);
    }
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

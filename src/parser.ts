import * as fs from "fs";
import type { Page } from "playwright";
import type { InputRecord, SearchResult } from "./types.js";

export function parseInputCSV(filePath: string): InputRecord[] {
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split("\n").filter((line) => line.trim());

  const records: InputRecord[] = [];
  let isHeader = true;

  for (const line of lines) {
    // ヘッダー行をスキップ
    if (isHeader) {
      isHeader = false;
      continue;
    }

    // CSVパース（シンプルな実装）
    const parts = parseCSVLine(line);
    if (parts.length >= 2) {
      records.push({
        name: parts[0].trim(),
        address: parts[1].trim(),
      });
    }
  }

  return records;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  result.push(current);
  return result;
}

export async function parseSearchResults(page: Page): Promise<SearchResult[]> {
  const results: SearchResult[] = [];

  // 検索結果のテーブル行を取得
  const rows = await page.locator('tr[id^="datarow_"]').all();

  for (const row of rows) {
    const cells = await row.locator("td").all();
    if (cells.length >= 5) {
      const serviceType = await cells[0].textContent() || "";
      const name = await cells[1].textContent() || "";
      const address = await cells[2].textContent() || "";

      // 事業所番号をURLから抽出
      const mapLink = cells[3].locator("a");
      let jigyoshoNo = "";
      if (await mapLink.count() > 0) {
        const href = await mapLink.getAttribute("href") || "";
        const match = href.match(/jno=(\d+)/);
        if (match) {
          jigyoshoNo = match[1];
        }
      }

      // 詳細URLを取得
      const detailLink = cells[4].locator("a");
      let detailUrl = "";
      if (await detailLink.count() > 0) {
        detailUrl = await detailLink.getAttribute("href") || "";
      }

      results.push({
        serviceType: serviceType.trim(),
        name: name.trim(),
        address: address.trim(),
        jigyoshoNo,
        detailUrl,
      });
    }
  }

  return results;
}

export function normalizeAddress(address: string): string {
  return address
    .replace(/[０-９]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xFEE0))
    .replace(/[Ａ-Ｚａ-ｚ]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xFEE0))
    .replace(/[\s\u3000]/g, "")
    .replace(/[ー－‐−]/g, "-")
    .replace(/丁目/g, "-")
    .replace(/番地?/g, "-")
    .replace(/号/g, "")
    .replace(/-+/g, "-")
    .replace(/-$/, "");
}

export function normalizeName(name: string): string {
  return name
    .replace(/[\s\u3000]/g, "")
    .replace(/[（\(]/g, "(")
    .replace(/[）\)]/g, ")")
    .trim();
}

export function isSimilarAddress(input: string, result: string): boolean {
  const normalizedInput = normalizeAddress(input);
  const normalizedResult = normalizeAddress(result);

  // 完全一致
  if (normalizedInput === normalizedResult) return true;

  // 片方がもう片方を含む
  if (normalizedResult.includes(normalizedInput)) return true;
  if (normalizedInput.includes(normalizedResult)) return true;

  // 都道府県と市区町村が一致していれば部分一致とみなす
  const prefectures = [
    "北海道", "青森県", "岩手県", "宮城県", "秋田県", "山形県", "福島県",
    "茨城県", "栃木県", "群馬県", "埼玉県", "千葉県", "東京都", "神奈川県",
    "新潟県", "富山県", "石川県", "福井県", "山梨県", "長野県", "岐阜県",
    "静岡県", "愛知県", "三重県", "滋賀県", "京都府", "大阪府", "兵庫県",
    "奈良県", "和歌山県", "鳥取県", "島根県", "岡山県", "広島県", "山口県",
    "徳島県", "香川県", "愛媛県", "高知県", "福岡県", "佐賀県", "長崎県",
    "熊本県", "大分県", "宮崎県", "鹿児島県", "沖縄県"
  ];

  for (const pref of prefectures) {
    if (normalizedInput.startsWith(pref) && normalizedResult.startsWith(pref)) {
      // 同じ都道府県の場合、市区町村レベルで比較
      const inputCity = normalizedInput.slice(pref.length).match(/^[^市区町村]+[市区町村]/);
      const resultCity = normalizedResult.slice(pref.length).match(/^[^市区町村]+[市区町村]/);

      if (inputCity && resultCity && inputCity[0] === resultCity[0]) {
        return true;
      }
    }
  }

  return false;
}

export function isSimilarName(input: string, result: string): boolean {
  const normalizedInput = normalizeName(input);
  const normalizedResult = normalizeName(result);

  // 完全一致
  if (normalizedInput === normalizedResult) return true;

  // 片方がもう片方を含む
  if (normalizedResult.includes(normalizedInput)) return true;
  if (normalizedInput.includes(normalizedResult)) return true;

  return false;
}

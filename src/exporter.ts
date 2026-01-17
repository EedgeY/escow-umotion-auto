import * as fs from "fs";
import { OUTPUT_FILE } from "./config.js";
import type { ScrapingResult, MatchResult } from "./types.js";

const CSV_HEADERS = [
  "入力事業所名",
  "入力住所",
  "見つかった",
  "マッチ件数",
  "マッチ事業所名",
  "マッチ住所",
  "サービス種類",
  "事業所番号",
  "詳細URL",
];

function escapeCSV(value: string | undefined | boolean | number): string {
  if (value === undefined || value === null) return '""';
  const str = String(value);
  const escaped = str.replace(/"/g, '""');
  return `"${escaped}"`;
}

function recordToCSVRows(result: MatchResult): string[] {
  const rows: string[] = [];

  if (result.matchedResults.length === 0) {
    // マッチなしの場合は1行
    const values = [
      result.inputName,
      result.inputAddress,
      result.found ? "TRUE" : "FALSE",
      0,
      "",
      "",
      "",
      "",
      "",
    ];
    rows.push(values.map(escapeCSV).join(","));
  } else {
    // マッチありの場合は各マッチごとに行を作成
    for (const match of result.matchedResults) {
      const values = [
        result.inputName,
        result.inputAddress,
        "TRUE",
        result.matchedResults.length,
        match.name,
        match.address,
        match.serviceType,
        match.jigyoshoNo,
        match.detailUrl,
      ];
      rows.push(values.map(escapeCSV).join(","));
    }
  }

  return rows;
}

export function exportToCSV(outputPath?: string): void {
  if (!fs.existsSync(OUTPUT_FILE)) {
    console.error(`エラー: ${OUTPUT_FILE} が見つかりません`);
    console.log("先にスクレイピングを実行してください: pnpm run scrape");
    process.exit(1);
  }

  const data: ScrapingResult = JSON.parse(fs.readFileSync(OUTPUT_FILE, "utf-8"));

  if (data.results.length === 0) {
    console.log("エクスポートするデータがありません。");
    return;
  }

  // エラーでないレコードのみ
  const validResults = data.results.filter((r) => !r.error);

  // デフォルトのファイル名
  const today = new Date().toISOString().split("T")[0];
  const csvPath = outputPath || `./data/wam_search_${today}.csv`;

  // BOM付きUTF-8でCSV作成
  const bom = "\uFEFF";
  const header = CSV_HEADERS.join(",");
  const rows: string[] = [];

  for (const result of validResults) {
    rows.push(...recordToCSVRows(result));
  }

  const csvContent = bom + header + "\n" + rows.join("\n");

  fs.writeFileSync(csvPath, csvContent, "utf-8");

  console.log("=== CSVエクスポート完了 ===");
  console.log(`出力ファイル: ${csvPath}`);
  console.log(`検索件数: ${validResults.length}件`);
  console.log(`見つかった: ${validResults.filter((r) => r.found).length}件`);
  console.log(`見つからなかった: ${validResults.filter((r) => !r.found).length}件`);
  console.log(`エラー: ${data.results.length - validResults.length}件`);
}

export function showStats(): void {
  if (!fs.existsSync(OUTPUT_FILE)) {
    console.log(`${OUTPUT_FILE} が見つかりません`);
    return;
  }

  const data: ScrapingResult = JSON.parse(fs.readFileSync(OUTPUT_FILE, "utf-8"));

  const foundResults = data.results.filter((r) => r.found);
  const notFoundResults = data.results.filter((r) => !r.found && !r.error);
  const errorResults = data.results.filter((r) => r.error);

  console.log("=== 検索結果統計 ===");
  console.log(`総検索数: ${data.results.length}`);
  console.log(`見つかった: ${foundResults.length}件`);
  console.log(`見つからなかった: ${notFoundResults.length}件`);
  console.log(`エラー: ${errorResults.length}件`);
  console.log(`最終更新: ${data.lastUpdated}`);
}

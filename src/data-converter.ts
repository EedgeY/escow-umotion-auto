import type { BreedingRecord, EedgeInput, PregnancyRecord } from "./types.js";

/**
 * 牛番号から畜主IDを抽出
 * 牛番号の前3桁を取得し、先頭の0を除去
 * 例: 20016 → "020" → "20"
 *     29935 → "029" → "29"
 *     185776 → "185" → "185"
 */
export function extractOwnerId(cowNo: string): string {
  // 牛番号を数字のみに正規化
  const numericCowNo = cowNo.replace(/\D/g, "");

  if (numericCowNo.length < 3) {
    return numericCowNo;
  }

  // 桁数に応じて前3桁を計算
  // 5桁の場合: 20016 → "020"（先頭に0を付けて3桁にする必要がある場合）
  // 6桁の場合: 185776 → "185"
  // 7桁の場合: 1073956 → "107"

  let prefix: string;
  if (numericCowNo.length <= 5) {
    // 5桁以下の場合、左に0を詰めて6桁にしてから前3桁を取る
    const padded = numericCowNo.padStart(6, "0");
    prefix = padded.slice(0, 3);
  } else {
    // 6桁以上の場合、単純に前3桁を取る
    prefix = numericCowNo.slice(0, 3);
  }

  // 先頭の0を除去
  return String(parseInt(prefix, 10));
}

/**
 * 作業種類から区分IDを取得
 * 人工授精 → 1
 * 移植 → 2
 */
export function getClassificationId(method: string): string {
  const methodLower = method.toLowerCase();

  if (methodLower.includes("授精") || methodLower.includes("ai")) {
    return "1"; // 授精
  }
  if (methodLower.includes("移植") || methodLower.includes("et")) {
    return "2"; // 移植
  }
  if (methodLower.includes("発情")) {
    return "3"; // 発情
  }

  // デフォルトは授精
  return "1";
}

/**
 * 日付フォーマットを変換
 * "2026/01/16" → "2026-01-16"
 */
export function formatDate(date: string): string {
  return date.replace(/\//g, "-");
}

/**
 * BreedingRecord を EedgeInput に変換
 */
export function convertToEedgeInput(record: BreedingRecord): EedgeInput {
  return {
    date: formatDate(record.date),
    ownerId: extractOwnerId(record.cowNo),
    individualId: record.individualId,
    classificationId: getClassificationId(record.method),
    contentId: record.semenNo,
    quantity: 1,
    price: 0,
    memo: "",  // 空白
  };
}

/**
 * 複数のレコードを一括変換
 */
export function convertRecords(records: BreedingRecord[]): EedgeInput[] {
  return records.map(convertToEedgeInput);
}

/**
 * 変換結果をプレビュー表示（繁殖）
 */
export function printPreview(records: BreedingRecord[], inputs: EedgeInput[]): void {
  console.log("\n=== 繁殖データ変換プレビュー ===\n");
  console.log("| 牛番号 | 畜主ID | 個体識別番号 | 区分 | 精液番号 |");
  console.log("|--------|--------|-------------|------|---------|");

  for (let i = 0; i < records.length; i++) {
    const rec = records[i];
    const inp = inputs[i];
    const classificationName = inp.classificationId === "1" ? "授精" : "移植";
    console.log(`| ${rec.cowNo.padEnd(6)} | ${inp.ownerId.padEnd(6)} | ${inp.individualId.padEnd(11)} | ${classificationName} | ${inp.contentId.padEnd(7)} |`);
  }

  console.log("");
}

/**
 * 妊娠診断結果から区分IDを取得
 * 受胎 → 4 (妊鑑＋)
 * 未受胎 → 5 (妊鑑−)
 * 不明/その他 → 6 (妊鑑+-)
 */
export function getPregnancyClassificationId(result: string): string {
  const resultLower = result.toLowerCase();

  if (resultLower.includes("受胎") || resultLower.includes("＋") || resultLower === "+") {
    return "4"; // 妊鑑＋
  }
  if (resultLower.includes("未受胎") || resultLower.includes("空胎") || resultLower.includes("−") || resultLower === "-") {
    return "5"; // 妊鑑−
  }

  // 不明やその他
  return "6"; // 妊鑑+-
}

/**
 * PregnancyRecord を EedgeInput に変換
 */
export function convertPregnancyToEedgeInput(record: PregnancyRecord): EedgeInput {
  const classificationId = getPregnancyClassificationId(record.result);

  return {
    date: formatDate(record.date),
    ownerId: extractOwnerId(record.cowNo),
    individualId: record.individualId,
    classificationId,
    contentId: "",  // 妊娠診断には精液番号なし
    quantity: 1,
    price: 0,
    memo: "",
    needsInseminationDate: classificationId === "4", // 受胎の場合のみ対象授精日が必要
  };
}

/**
 * 複数の妊娠診断レコードを一括変換
 */
export function convertPregnancyRecords(records: PregnancyRecord[]): EedgeInput[] {
  return records.map(convertPregnancyToEedgeInput);
}

/**
 * 変換結果をプレビュー表示（妊娠診断）
 */
export function printPregnancyPreview(records: PregnancyRecord[], inputs: EedgeInput[]): void {
  console.log("\n=== 妊娠診断データ変換プレビュー ===\n");
  console.log("| 牛番号 | 畜主ID | 個体識別番号 | 結果 | 区分ID |");
  console.log("|--------|--------|-------------|------|--------|");

  const classificationNames: Record<string, string> = {
    "4": "妊鑑＋",
    "5": "妊鑑−",
    "6": "妊鑑+-",
  };

  for (let i = 0; i < records.length; i++) {
    const rec = records[i];
    const inp = inputs[i];
    const className = classificationNames[inp.classificationId] || inp.classificationId;
    console.log(`| ${rec.cowNo.padEnd(6)} | ${inp.ownerId.padEnd(6)} | ${inp.individualId.padEnd(11)} | ${rec.result.padEnd(4)} | ${className.padEnd(6)} |`);
  }

  console.log("");
}

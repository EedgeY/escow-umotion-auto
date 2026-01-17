export interface InputRecord {
  name: string;
  address: string;
}

export interface SearchResult {
  serviceType: string;
  name: string;
  address: string;
  jigyoshoNo: string;
  detailUrl: string;
}

export interface MatchResult {
  inputName: string;
  inputAddress: string;
  found: boolean;
  matchedResults: SearchResult[];
  searchedAt: string;
  error?: boolean;
  errorMessage?: string;
}

export interface ScrapingResult {
  results: MatchResult[];
  lastUpdated: string;
  totalProcessed: number;
  totalFound: number;
  totalNotFound: number;
  totalErrors: number;
}

// U-motionからの抽出データ
export interface BreedingRecord {
  cowNo: string;           // 牛番号
  individualId: string;    // 個体識別番号
  date: string;            // 日付
  staff: string;           // 担当者
  time: string;            // 時間
  method: string;          // 作業種類（人工授精など）
  semenName: string;       // 精液名
  semenNo: string;         // 精液番号
  memo: string;            // 備考
}

// eedge.cloudへの入力データ
export interface EedgeInput {
  date: string;
  ownerId: string;         // 畜主ID（牛番号の前3桁）
  individualId: string;    // 個体識別番号
  classificationId: string; // 区分ID（1:授精, 2:移植, 4:妊鑑＋, 5:妊鑑−, 6:妊鑑+-）
  contentId: string;       // 内容（精液番号）
  quantity: number;        // 数量
  price: number;           // 料金
  memo: string;            // メモ
  staffId?: string;        // 担当者ID
  veterinarianId?: string; // 獣医師/授精師ID
  needsInseminationDate?: boolean; // 対象授精日の選択が必要か（受胎の場合）
}

// 抽出結果
export interface BreedingScrapingResult {
  records: BreedingRecord[];
  scrapedAt: string;
  date: string;
  totalCount: number;
}

// U-motionからの妊娠診断データ
export interface PregnancyRecord {
  cowNo: string;           // 牛番号
  individualId: string;    // 個体識別番号
  date: string;            // 日付
  staff: string;           // 担当者
  time: string;            // 時間
  result: string;          // 結果（受胎/未受胎/不明など）
  memo: string;            // 備考
}

// 妊娠診断抽出結果
export interface PregnancyScrapingResult {
  records: PregnancyRecord[];
  scrapedAt: string;
  date: string;
  totalCount: number;
}

export const WAM_SEARCH_URL = "https://www.wam.go.jp/wamappl/kpdrsys.nsf/vhtml/byname?Open";

export const REQUEST_DELAY_MIN = 2000; // 2秒
export const REQUEST_DELAY_MAX = 4000; // 4秒

export const INPUT_CSV_FILE = "./data/input.csv";
export const OUTPUT_FILE = "./data/output.json";

export function randomDelay(): number {
  return Math.floor(Math.random() * (REQUEST_DELAY_MAX - REQUEST_DELAY_MIN + 1)) + REQUEST_DELAY_MIN;
}

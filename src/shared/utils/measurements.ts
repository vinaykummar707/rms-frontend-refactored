/**
 * Returns the number of columns (width) of a multiline bitmap string
 */
export function getBitmapColumns(bitmap: string): number {
  if (bitmap) {
    const lines = bitmap.trim().split("\n");
    return lines.length > 0 ? lines[0].length : 0;
  }
  return 0;
}

/**
 * Returns the height (number of rows) of a multiline bitmap string
 */
export function getBitmapHeight(bitmap: string): number {
  if (bitmap) {
    const lines = bitmap.trim().split("\n");
    return lines.length;
  }
  return 0;
}

function getFormatByScreen(cols: number, _format: string): number {
  return cols;
}

/**
 * Returns the number of columns for each signboard type and format
 */
export function getColumnsByBoard(
  boardType: "front" | "side" | "rear" | string,
  format: string,
  frontBoardCols: number = 112
): number {
  switch (boardType) {
    case "front":
      return getFormatByScreen(frontBoardCols, format);
    case "side":
      return getFormatByScreen(96, format);
    case "rear":
      return getFormatByScreen(96, format);
    default:
      return getFormatByScreen(112, format);
  }
}

export function ensureNumber(val: any, defaultValue: number): number {
  const num = Number(val);
  return isNaN(num) ? defaultValue : num;
}

export function ensureMin(
  value: any,
  defaultValue: number,
  min: number = 0
): number {
  const num = Number(value);
  if (isNaN(num) || num < min) {
    return defaultValue;
  }
  return num;
}


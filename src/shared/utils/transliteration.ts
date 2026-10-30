/**
 * Fetches phonetic transliteration suggestions from Google Input Tools API
 */
export const fetchTransliteration = async (
  word: string,
  langCode: string
): Promise<string[]> => {
  try {
    const baseLangCode = langCode.replace(/\d+$/, "");
    const response = await fetch(
      `https://inputtools.google.com/request?text=${encodeURIComponent(
        word
      )}&itc=${baseLangCode}-t-i0-und&num=5&ie=utf-8&oe=utf-8&app=customApp`
    );
    const data = await response.json();
    if (data[0] === "SUCCESS" && data[1]?.[0]?.[1]) {
      return data[1][0][1];
    }
    return [];
  } catch (error) {
    console.error("Error fetching transliteration:", error);
    return [];
  }
};


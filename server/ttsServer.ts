import express, { type Request, type Response } from "express";
import cors from "cors";
import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";
import {
  INDIAN_LANGUAGES,
  DEFAULT_LANGUAGE,
  DEFAULT_VOICE,
  DEFAULT_RATE,
  resolveVoice,
} from "./voices.js";

const app = express();
const PORT = Number(process.env.PORT || process.env.TTS_PORT || 5050);

app.use(cors());
app.use(express.json());

/**
 * Normalizes transit stop names for natural speech pronunciation:
 * - Detects if text contains Latin / English characters vs Indic script
 * - For Latin text: converts ALL CAPS into Title Case and expands common transit shortcuts
 * - For Indic regional text: preserves native script characters without mangling
 */
export function normalizeStopNameForSpeech(text: string): string {
  if (!text) return "";
  let clean = text.trim();

  // If text contains primarily ASCII/Latin characters
  const isAscii = /^[\x00-\x7F\s\-\/\.,]+$/.test(clean);

  if (isAscii) {
    // If text is ALL-CAPS or short transit title, convert to Title Case
    if (clean === clean.toUpperCase() || clean.length < 5) {
      clean = clean.toLowerCase().replace(/(?:^|[\s\-/])\S/g, (c) => c.toUpperCase());
    }

    // Expand common Indian transit abbreviations
    const expansions: Record<string, string> = {
      jn: "Junction",
      stn: "Station",
      "b/s": "Bus Stop",
      bs: "Bus Stop",
      rd: "Road",
      opp: "Opposite",
      hosp: "Hospital",
      govt: "Government",
      clg: "College",
      univ: "University",
      rly: "Railway",
      dept: "Depot",
    };

    clean = clean.replace(
      /\b(jn|stn|b\/s|bs|rd|opp|hosp|govt|clg|univ|rly|dept)\b/gi,
      (match) => expansions[match.toLowerCase()] || match
    );
  }

  return clean;
}

// Health check endpoint
app.get("/api/tts/health", (_req: Request, res: Response) => {
  res.json({
    status: "ok",
    service: "edge-tts-relay",
    port: PORT,
    timestamp: new Date().toISOString(),
  });
});

// Catalog of supported Indian regional languages and voice actors
app.get("/api/tts/voices", (_req: Request, res: Response) => {
  res.json({
    languages: INDIAN_LANGUAGES,
    defaultLanguage: DEFAULT_LANGUAGE,
    defaultVoice: DEFAULT_VOICE,
    defaultRate: DEFAULT_RATE,
  });
});

// Synthesis endpoint (Pure Node.js via msedge-tts - No Python needed)
app.post("/api/tts/synthesize", async (req: Request, res: Response) => {
  try {
    const {
      text,
      voice,
      language,
      gender = "female",
      rate = DEFAULT_RATE,
      volume = "+0%",
      pitch = "+0Hz",
    } = req.body;

    if (!text || typeof text !== "string" || !text.trim()) {
      return res.status(400).json({ error: "Missing required parameter 'text'." });
    }

    const normalizedText = normalizeStopNameForSpeech(text);
    const chosenVoice = voice || resolveVoice(language, gender);

    console.log(
      `[TTS] Synthesizing "${normalizedText}" using voice "${chosenVoice}" (Rate: ${rate})...`
    );

    const tts = new MsEdgeTTS();
    await tts.setMetadata(chosenVoice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);

    const readable = tts.toStream(normalizedText, { rate, pitch, volume });
    const audioChunks: Buffer[] = [];

    await new Promise<void>((resolve, reject) => {
      readable.audioStream.on("data", (chunk: Buffer) => audioChunks.push(chunk));
      readable.audioStream.on("close", () => {
        try {
          tts.close();
        } catch {}
        resolve();
      });
      readable.audioStream.on("error", (err: Error) => {
        try {
          tts.close();
        } catch {}
        reject(err);
      });
    });

    const totalBuffer = Buffer.concat(audioChunks);

    if (totalBuffer.length === 0) {
      console.warn("[TTS] Zero bytes returned from synthesis.");
      if (!res.headersSent) {
        return res.status(502).json({
          error: "No audio data received from Edge TTS.",
        });
      }
      return;
    }

    console.log(
      `[TTS] Successfully synthesized "${normalizedText}" (${totalBuffer.length} bytes).`
    );

    res.writeHead(200, {
      "Content-Type": "audio/mpeg",
      "Content-Length": totalBuffer.length,
      "Content-Disposition": 'inline; filename="announcement.mp3"',
      "Cache-Control": "public, max-age=3600",
    });

    res.end(totalBuffer);
  } catch (error: any) {
    console.error("[TTS] Unhandled synthesis error:", error);
    if (!res.headersSent) {
      res.status(502).json({
        error: "Failed to synthesize audio with Edge TTS.",
        details: error?.message || String(error),
      });
    }
  }
});

if (process.env.NODE_ENV !== "test" && !process.env.VITEST) {
  app.listen(PORT, () => {
    console.log(`\n🎧 Edge-TTS Relay Server running on http://localhost:${PORT}`);
    console.log(`👉 Health check: http://localhost:${PORT}/api/tts/health`);
    console.log(`👉 Voices catalog: http://localhost:${PORT}/api/tts/voices\n`);
  });
}

export default app;

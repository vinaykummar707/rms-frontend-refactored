import express, { type Request, type Response } from "express";
import cors from "cors";
import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";
import crypto from "crypto";
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

// Synthesis endpoint
app.post("/api/tts/synthesize", async (req: Request, res: Response) => {
  let tempFilePath: string | null = null;

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

    // Write text to a temporary UTF-8 file to prevent command line encoding corruption
    const tempFileName = `edge-tts-${crypto.randomUUID()}.txt`;
    tempFilePath = path.join(os.tmpdir(), tempFileName);
    fs.writeFileSync(tempFilePath, normalizedText, "utf8");

    // Cleanly pass rate, volume, and pitch using key=value syntax so Python's argparse never treats negative rates as flags
    const safeRate = rate && typeof rate === "string" && rate.trim() ? rate.trim() : DEFAULT_RATE;
    const safeVolume = volume && typeof volume === "string" && volume.trim() ? volume.trim() : "+0%";
    const safePitch = pitch && typeof pitch === "string" && pitch.trim() ? pitch.trim() : "+0Hz";

    const args = [
      "--file",
      tempFilePath,
      "--voice",
      chosenVoice,
      `--rate=${safeRate}`,
      `--volume=${safeVolume}`,
      `--pitch=${safePitch}`,
    ];

    const child = spawn("edge-tts", args);
    const audioChunks: Buffer[] = [];
    let stderrData = "";

    const cleanupTempFile = () => {
      if (tempFilePath && fs.existsSync(tempFilePath)) {
        try {
          fs.unlinkSync(tempFilePath);
        } catch {}
      }
    };

    child.stdout.on("data", (chunk: Buffer) => {
      audioChunks.push(chunk);
    });

    child.stderr.on("data", (chunk: Buffer) => {
      stderrData += chunk.toString();
    });

    child.on("error", (err: Error) => {
      cleanupTempFile();
      console.error("[TTS] Process spawn error:", err);
      if (!res.headersSent) {
        res.status(500).json({
          error: "Failed to execute edge-tts process.",
          details: err.message,
        });
      }
    });

    child.on("close", (code: number) => {
      cleanupTempFile();

      if (code !== 0) {
        console.error(`[TTS] edge-tts exited with code ${code}. Stderr: ${stderrData}`);
        if (!res.headersSent) {
          return res.status(502).json({
            error: "Edge TTS service failed to generate audio.",
            details: stderrData || `Exit code ${code}`,
          });
        }
      }

      const totalBuffer = Buffer.concat(audioChunks);
      if (totalBuffer.length === 0) {
        console.warn("[TTS] Zero bytes returned from synthesis.");
        if (!res.headersSent) {
          return res.status(502).json({
            error: "No audio data received from Edge TTS.",
          });
        }
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
    });
  } catch (error: any) {
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      try {
        fs.unlinkSync(tempFilePath);
      } catch {}
    }

    console.error("[TTS] Unhandled synthesis error:", error);
    if (!res.headersSent) {
      res.status(500).json({
        error: "Internal server error during speech synthesis.",
        details: error?.message || String(error),
      });
    }
  }
});

// ─── Production Static File Serving (React SPA) ─────────────────────────────
const distPath = path.resolve(process.cwd(), "dist");
if (fs.existsSync(distPath)) {
  console.log(`📦 Serving compiled static React frontend from: ${distPath}`);
  app.use(express.static(distPath));

  // SPA fallback: any non-API GET request serves dist/index.html
  app.use((req, res, next) => {
    if (req.method === "GET" && !req.path.startsWith("/api")) {
      return res.sendFile(path.join(distPath, "index.html"));
    }
    next();
  });
}

if (process.env.NODE_ENV !== "test" && !process.env.VITEST) {
  app.listen(PORT, () => {
    console.log(`\n🎧 Edge-TTS Relay Server running on http://localhost:${PORT}`);
    console.log(`👉 Health check: http://localhost:${PORT}/api/tts/health`);
    console.log(`👉 Voices catalog: http://localhost:${PORT}/api/tts/voices\n`);
  });
}

export default app;

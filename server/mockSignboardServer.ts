import express, { type Request, type Response } from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import os from "os";

const app = express();
const PORT = Number(process.env.SIGNBOARD_PORT || process.env.PORT || 8266);
// Store outside the workspace to prevent Vite file watcher from triggering full page reloads
const MOCK_SD_DIR =
  process.env.MOCK_SD_DIR || path.join(os.tmpdir(), "navitronix_mock_sd_card");

// Ensure mock SD directory exists
if (!fs.existsSync(MOCK_SD_DIR)) {
  fs.mkdirSync(MOCK_SD_DIR, { recursive: true });
}

// Enable CORS for frontend requests from any origin/port (e.g. Vite on 5173)
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Accept", "Authorization"],
  })
);

// Support raw binary for /api/transfer/file/chunk
app.use(
  express.raw({
    type: "application/octet-stream",
    limit: "10mb",
  })
);

// Support JSON for control endpoints
app.use(express.json());

// Simulation configuration
interface IMockConfig {
  delayMs: number;
  failFileOnce: string | null;
  failChunkIndex: number | null;
  stm32Connected: boolean;
}

const mockConfig: IMockConfig = {
  delayMs: 20, // simulated UART/FatFs write latency
  failFileOnce: null,
  failChunkIndex: null,
  stm32Connected: true,
};

// Current active transfer session state
interface IActiveTransferState {
  transferId: string | null;
  status: "IDLE" | "STARTED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED" | "ERROR";
  totalFiles: number;
  totalFolders: number;
  filesStarted: number;
  filesSaved: number;
  filesFailed: number;
  currentFile: string;
  currentFileSize: number;
  currentFileBytes: number;
  currentFileChunksExpected: number;
  currentFileChunksReceived: number;
  foldersCreated: Set<string>;
  startTime: number;
}

const activeTransfer: IActiveTransferState = {
  transferId: null,
  status: "IDLE",
  totalFiles: 0,
  totalFolders: 0,
  filesStarted: 0,
  filesSaved: 0,
  filesFailed: 0,
  currentFile: "",
  currentFileSize: 0,
  currentFileBytes: 0,
  currentFileChunksExpected: 0,
  currentFileChunksReceived: 0,
  foldersCreated: new Set(),
  startTime: 0,
};

// Temporary in-memory write buffer for current file
let currentFileBuffer: Buffer = Buffer.alloc(0);

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// ============================================================================
// 1. Hardware Status API (/api/status & /api/ping)
// ============================================================================

app.get("/api/status", (_req: Request, res: Response) => {
  res.json({
    device_id: "BUS_001",
    esp_firmware: "0.4.1",
    wifi_status: "online",
    wifi_ip: `127.0.0.1:${PORT}`,
    storage_status: "ready",
    storage_type: "LittleFS",
    upload_format: "multipart/form-data",
    total_bytes: 1024000,
    used_bytes: 57344,
    free_bytes: 966656,
    max_zip_upload_bytes: 524288,
    upload_in_progress: activeTransfer.status === "IN_PROGRESS",
    last_upload_status: activeTransfer.status,
    last_saved_file: activeTransfer.currentFile,
    stm32_status: mockConfig.stm32Connected ? "ready" : "not_connected_in_this_version",
  });
});

app.get("/api/ping", (_req: Request, res: Response) => {
  res.json({
    deviceId: "BUS_001",
    wifi_status: "online",
    firmware: "0.4.1",
    stm32_status: mockConfig.stm32Connected ? "ready" : "offline",
    transfer_status: activeTransfer.status.toLowerCase(),
  });
});

// ============================================================================
// 2. Start Transfer (/api/transfer/start)
// ============================================================================

app.post("/api/transfer/start", async (req: Request, res: Response) => {
  const { transfer_id, total_files = 0, total_folders = 0 } = req.body || {};

  if (!transfer_id) {
    return res.status(400).json({
      success: false,
      error: "invalid_param",
      message: "transfer_id is required",
    });
  }

  if (mockConfig.delayMs > 0) {
    await sleep(mockConfig.delayMs);
  }

  activeTransfer.transferId = transfer_id;
  activeTransfer.status = "STARTED";
  activeTransfer.totalFiles = Number(total_files);
  activeTransfer.totalFolders = Number(total_folders);
  activeTransfer.filesStarted = 0;
  activeTransfer.filesSaved = 0;
  activeTransfer.filesFailed = 0;
  activeTransfer.currentFile = "";
  activeTransfer.currentFileSize = 0;
  activeTransfer.currentFileBytes = 0;
  activeTransfer.foldersCreated.clear();
  activeTransfer.startTime = Date.now();
  currentFileBuffer = Buffer.alloc(0);

  console.log(
    `\x1b[36m[ESP8266]\x1b[0m Transfer Started: ID=\x1b[33m${transfer_id}\x1b[0m (${total_files} files, ${total_folders} folders)`
  );
  console.log(`\x1b[32m[STM32 USART3]\x1b[0m CMD 0x01 TRANSFER_START -> ACK 0x7F`);

  res.json({
    success: true,
    transfer_id,
    status: "STARTED",
  });
});

// ============================================================================
// 3. Start File (/api/transfer/file/start)
// ============================================================================

app.post("/api/transfer/file/start", async (req: Request, res: Response) => {
  const { path: filePath, size_bytes = 0, file_index = 1, total_files = 1 } = req.body || {};

  if (!filePath) {
    return res.status(400).json({
      success: false,
      error: "invalid_path",
      message: "path is required",
    });
  }

  // Check FAT rules
  if (filePath.startsWith("/") || filePath.includes("..") || /[\x00-\x1F"*:<>?\\|]/.test(filePath)) {
    return res.status(400).json({
      success: false,
      error: "invalid_path",
      message: `Path violates FAT naming conventions: ${filePath}`,
      retryable: false,
    });
  }

  if (mockConfig.delayMs > 0) {
    await sleep(mockConfig.delayMs);
  }

  // Simulated failure check
  if (mockConfig.failFileOnce && filePath.includes(mockConfig.failFileOnce)) {
    mockConfig.failFileOnce = null; // consume trigger so retry succeeds!
    activeTransfer.filesFailed++;
    console.log(
      `\x1b[31m[STM32 SD]\x1b[0m Simulated error opening file: \x1b[33m${filePath}\x1b[0m (stm32_timeout)`
    );
    return res.status(500).json({
      success: false,
      error: "stm32_timeout",
      message: "STM32 did not acknowledge file open request over USART3",
      retryable: true,
    });
  }

  activeTransfer.status = "IN_PROGRESS";
  activeTransfer.filesStarted = Number(file_index);
  activeTransfer.currentFile = filePath;
  activeTransfer.currentFileSize = Number(size_bytes);
  activeTransfer.currentFileBytes = 0;
  activeTransfer.currentFileChunksExpected = Math.max(1, Math.ceil(size_bytes / 512));
  activeTransfer.currentFileChunksReceived = 0;
  currentFileBuffer = Buffer.alloc(0);

  // Simulate STM32 directory creation
  const targetFullPath = path.join(MOCK_SD_DIR, filePath);
  const parentDir = path.dirname(targetFullPath);
  if (!fs.existsSync(parentDir)) {
    fs.mkdirSync(parentDir, { recursive: true });
    activeTransfer.foldersCreated.add(path.dirname(filePath));
    console.log(`\x1b[32m[STM32 FatFs]\x1b[0m Created parent directory: \x1b[35m${path.dirname(filePath)}\x1b[0m`);
  }

  console.log(
    `\x1b[32m[STM32 FatFs]\x1b[0m File Open: [${file_index}/${total_files}] \x1b[33m${filePath}\x1b[0m (${size_bytes} B)`
  );

  res.json({
    success: true,
    path: filePath,
    status: "FILE_READY",
  });
});

// ============================================================================
// 4. Send File Chunk (/api/transfer/file/chunk)
// ============================================================================

app.post("/api/transfer/file/chunk", async (req: Request, res: Response) => {
  const chunkIndex = Number(req.query.index ?? 0);
  const offset = Number(req.query.offset ?? 0);

  const chunkBuffer: Buffer = Buffer.isBuffer(req.body)
    ? req.body
    : Buffer.from(req.body || "");

  if (mockConfig.delayMs > 0) {
    await sleep(mockConfig.delayMs);
  }

  // Simulated chunk failure
  if (mockConfig.failChunkIndex !== null && chunkIndex === mockConfig.failChunkIndex) {
    mockConfig.failChunkIndex = null;
    return res.status(500).json({
      success: false,
      error: "sd_write_failed",
      message: `STM32 FatFs write failure on chunk ${chunkIndex} at offset ${offset}`,
      retryable: true,
    });
  }

  // Append chunk to in-memory file buffer
  currentFileBuffer = Buffer.concat([currentFileBuffer, chunkBuffer]);
  activeTransfer.currentFileBytes = currentFileBuffer.length;
  activeTransfer.currentFileChunksReceived = chunkIndex + 1;

  res.json({
    success: true,
    chunk_index: chunkIndex,
    bytes_received: chunkBuffer.length,
    file_bytes_written: currentFileBuffer.length,
    status: "CHUNK_SAVED",
  });
});

// ============================================================================
// 5. Finish File (/api/transfer/file/end)
// ============================================================================

app.post("/api/transfer/file/end", async (req: Request, res: Response) => {
  const { path: filePath, expected_size_bytes = 0 } = req.body || {};

  if (mockConfig.delayMs > 0) {
    await sleep(mockConfig.delayMs);
  }

  // Confirm size matches
  if (currentFileBuffer.length !== Number(expected_size_bytes)) {
    return res.status(400).json({
      success: false,
      error: "chunk_offset_mismatch",
      message: `File size mismatch: expected ${expected_size_bytes} bytes, received ${currentFileBuffer.length} bytes.`,
      retryable: true,
    });
  }

  // Persist to mock SD directory
  const targetFullPath = path.join(MOCK_SD_DIR, filePath);
  fs.writeFileSync(targetFullPath, currentFileBuffer);

  activeTransfer.filesSaved++;
  console.log(
    `\x1b[32m[STM32 FatFs]\x1b[0m \x1b[1mSAVED\x1b[0m: \x1b[33m${filePath}\x1b[0m (${currentFileBuffer.length} B written to SD card)`
  );

  res.json({
    success: true,
    path: filePath,
    saved_bytes: currentFileBuffer.length,
    status: "FILE_SAVED",
  });
});

// ============================================================================
// 6. Transfer Status (/api/transfer/status)
// ============================================================================

app.get("/api/transfer/status", (_req: Request, res: Response) => {
  res.json({
    success: true,
    transfer_id: activeTransfer.transferId || "none",
    status: activeTransfer.status,
    total_files: activeTransfer.totalFiles,
    files_started: activeTransfer.filesStarted,
    files_saved: activeTransfer.filesSaved,
    files_failed: activeTransfer.filesFailed,
    current_file: activeTransfer.currentFile,
    current_file_bytes: activeTransfer.currentFileBytes,
    current_file_size: activeTransfer.currentFileSize,
    folders_created: activeTransfer.foldersCreated.size,
  });
});

// ============================================================================
// 7. Complete Transfer (/api/transfer/complete)
// ============================================================================

app.post("/api/transfer/complete", async (req: Request, res: Response) => {
  const { transfer_id } = req.body || {};

  if (mockConfig.delayMs > 0) {
    await sleep(mockConfig.delayMs);
  }

  activeTransfer.status = "COMPLETED";
  const durationSec = ((Date.now() - activeTransfer.startTime) / 1000).toFixed(1);

  console.log(
    `\x1b[32m[STM32 USART3]\x1b[0m \x1b[1;32mTRANSFER COMPLETED\x1b[0m (ID=${transfer_id}): ${activeTransfer.filesSaved}/${activeTransfer.totalFiles} files saved, ${activeTransfer.foldersCreated.size} folders created in ${durationSec}s`
  );

  res.json({
    success: true,
    transfer_id,
    status: "COMPLETED",
    total_files: activeTransfer.totalFiles,
    files_saved: activeTransfer.filesSaved,
    files_failed: activeTransfer.filesFailed,
    folders_created: activeTransfer.foldersCreated.size,
  });
});

// ============================================================================
// 8. Cancel Transfer (/api/transfer/cancel)
// ============================================================================

app.post("/api/transfer/cancel", (req: Request, res: Response) => {
  const { transfer_id } = req.body || {};
  activeTransfer.status = "CANCELLED";
  currentFileBuffer = Buffer.alloc(0);

  console.log(
    `\x1b[33m[ESP8266]\x1b[0m Transfer Cancelled by client (ID=${transfer_id || activeTransfer.transferId})`
  );

  res.json({
    success: true,
    message: "Transfer cancelled successfully.",
  });
});

// ============================================================================
// 9. Mock Testing Utilities (/api/mock/*)
// ============================================================================

// Configure simulated failures (e.g. fail a specific file to test retry)
app.post("/api/mock/config", (req: Request, res: Response) => {
  const { failFileOnce, failChunkIndex, delayMs, stm32Connected } = req.body || {};
  if (failFileOnce !== undefined) mockConfig.failFileOnce = failFileOnce;
  if (failChunkIndex !== undefined) mockConfig.failChunkIndex = failChunkIndex;
  if (typeof delayMs === "number") mockConfig.delayMs = delayMs;
  if (typeof stm32Connected === "boolean") mockConfig.stm32Connected = stm32Connected;

  console.log("\x1b[36m[Mock Config Updated]\x1b[0m", mockConfig);
  res.json({ success: true, config: mockConfig });
});

// List files saved on the mock SD card
app.get("/api/mock/sd-files", (_req: Request, res: Response) => {
  const listFilesRecursively = (dir: string, base: string = ""): string[] => {
    let results: string[] = [];
    if (!fs.existsSync(dir)) return results;
    const list = fs.readdirSync(dir);
    for (const file of list) {
      const fullPath = path.join(dir, file);
      const relPath = base ? `${base}/${file}` : file;
      const stat = fs.statSync(fullPath);
      if (stat && stat.isDirectory()) {
        results = results.concat(listFilesRecursively(fullPath, relPath));
      } else {
        results.push(relPath);
      }
    }
    return results;
  };

  const files = listFilesRecursively(MOCK_SD_DIR);
  res.json({
    mock_sd_dir: MOCK_SD_DIR,
    file_count: files.length,
    files,
  });
});

// Clear mock SD card
app.post("/api/mock/clear-sd", (_req: Request, res: Response) => {
  if (fs.existsSync(MOCK_SD_DIR)) {
    fs.rmSync(MOCK_SD_DIR, { recursive: true, force: true });
    fs.mkdirSync(MOCK_SD_DIR, { recursive: true });
  }
  res.json({ success: true, message: "Mock SD card cleared." });
});

export { app };

// Start listening if not imported in test environment
if (process.env.NODE_ENV !== "test") {
  app.listen(PORT, () => {
    console.log(`\n======================================================`);
    console.log(`  \x1b[1;36mNavitronix PIS - Mock Signboard Microcontroller\x1b[0m`);
    console.log(`======================================================`);
    console.log(`  ESP8266 + STM32 USART3 Mock running at: \x1b[32mhttp://localhost:${PORT}\x1b[0m`);
    console.log(`  Mock SD Card Directory:                 \x1b[33m${MOCK_SD_DIR}\x1b[0m`);
    console.log(`\n  Endpoints:`);
    console.log(`    GET  http://localhost:${PORT}/api/status`);
    console.log(`    POST http://localhost:${PORT}/api/transfer/start`);
    console.log(`    POST http://localhost:${PORT}/api/transfer/file/start`);
    console.log(`    POST http://localhost:${PORT}/api/transfer/file/chunk`);
    console.log(`    POST http://localhost:${PORT}/api/transfer/file/end`);
    console.log(`    GET  http://localhost:${PORT}/api/transfer/status`);
    console.log(`    POST http://localhost:${PORT}/api/transfer/complete`);
    console.log(`    POST http://localhost:${PORT}/api/transfer/cancel`);
    console.log(`    GET  http://localhost:${PORT}/api/mock/sd-files`);
    console.log(`\n  To connect from the UI, set hardware IP to: \x1b[1;32mlocalhost:${PORT}\x1b[0m\n`);
  });
}

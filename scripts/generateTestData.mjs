#!/usr/bin/env node
// Generates folder structure + two large TransferData.json files for testing.
//
// Layout produced (default):
//   test-data/Sample/
//     Upload API Logs/TransferData.json
//     Download API Logs/TransferData.json
//
// Each JSON is pretty-printed to approximately --lines lines (default 100000),
// with records nested 2-3 layers deep (meta.source, meta.target, payload.*).
// A configurable number of intentional differences are introduced so the diff
// viewer has meaningful output.
//
// Usage:
//   node scripts/generateTestData.mjs
//   node scripts/generateTestData.mjs --out test-data --root Sample --lines 50000 --diffs 50 --seed 42

import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { argv, stdout } from "node:process";

// ---------- CLI parsing ----------
function parseArgs(argv) {
  const opts = {
    out: "test-data",
    root: "Sample",
    lines: 100000,
    diffs: 1000,
    seed: 42,
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    const next = argv[i + 1];
    switch (a) {
      case "--out": opts.out = next; i++; break;
      case "--root": opts.root = next; i++; break;
      case "--lines": opts.lines = Number(next); i++; break;
      case "--diffs": opts.diffs = Number(next); i++; break;
      case "--seed": opts.seed = Number(next); i++; break;
      case "-h": case "--help":
        console.log("Usage: node scripts/generateTestData.mjs [--out dir] [--root name] [--lines N] [--diffs N] [--seed N]");
        process.exit(0);
      default:
        console.error(`Unknown arg: ${a}`);
        process.exit(1);
    }
  }
  return opts;
}

// ---------- Seedable RNG (mulberry32) ----------
function mulberry32(seed) {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = t;
    r = Math.imul(r ^ (r >>> 15), r | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}

function hex(rng, n) {
  let s = "";
  for (let i = 0; i < n; i++) s += Math.floor(rng() * 16).toString(16);
  return s;
}

// ---------- Record shape ----------
// Records are nested 2-3 layers deep (record -> meta/payload -> source/target).
// Pretty-printed record (with trailing comma) is 22 lines:
//   {                        1
//     "id": ...              2
//     "timestamp": ...       3
//     "type": ...            4
//     "status": ...          5
//     "meta": {              6
//       "source": {          7
//         "client": ...      8
//         "region": ...      9
//       },                  10
//       "target": {         11
//         "server": ...     12
//         "zone": ...       13
//       }                   14
//     },                    15
//     "payload": {          16
//       "sizeBytes": ...    17
//       "checksum": ...     18
//       "attempts": ...     19
//       "durationMs": ...   20
//     }                     21
//   }                       22
const STATUSES = ["ok", "pending", "retry", "failed"];
const TYPES = ["TRANSFER", "SYNC", "BACKUP", "RESTORE"];
const CLIENTS = ["client-a", "client-b", "client-c", "client-d"];
const REGIONS = ["us-west", "us-east", "eu-central", "ap-south"];
const SERVERS = ["server-1", "server-2", "server-3"];
const ZONES = ["zone-a", "zone-b", "zone-c"];

function makeRecord(i, rng) {
  const ts = new Date(Date.UTC(2026, 0, 1) + i * 60_000).toISOString();
  return {
    id: `R-${String(i).padStart(6, "0")}`,
    timestamp: ts,
    type: pick(rng, TYPES),
    status: pick(rng, STATUSES),
    meta: {
      source: {
        client: pick(rng, CLIENTS),
        region: pick(rng, REGIONS),
      },
      target: {
        server: pick(rng, SERVERS),
        zone: pick(rng, ZONES),
      },
    },
    payload: {
      sizeBytes: Math.floor(rng() * 1_000_000),
      checksum: hex(rng, 32),
      attempts: Math.floor(rng() * 5),
      durationMs: Math.floor(rng() * 10_000),
    },
  };
}

const LINES_PER_RECORD = 22;
const WRAPPER_LINES = 4; // { \n "metadata": {..one-liner..}, \n "records": [\n ... \n ] \n }

function buildPayload({ lines, seed, side }) {
  const rng = mulberry32(seed);
  const recordCount = Math.max(1, Math.floor((lines - WRAPPER_LINES) / LINES_PER_RECORD));
  const records = [];
  for (let i = 0; i < recordCount; i++) records.push(makeRecord(i, rng));
  return {
    metadata: {
      side,
      generatedAt: "2026-04-23T00:00:00.000Z",
      recordCount,
      schemaVersion: "1.0.0",
    },
    records,
  };
}

// ---------- Diff injection ----------
// Mutates `download` payload so it differs from `upload` in `count` places.
// Differences are varied (field change, extra field, missing field, reorder)
// to exercise the diff viewer.
function injectDiffs(upload, download, count, seed) {
  const rng = mulberry32(seed ^ 0xdeadbeef);
  const n = download.records.length;
  const picked = new Set();
  while (picked.size < Math.min(count, n)) {
    picked.add(Math.floor(rng() * n));
  }
  const indices = [...picked];
  for (const idx of indices) {
    const kind = Math.floor(rng() * 6);
    const rec = download.records[idx];
    switch (kind) {
      case 0: // top-level value change
        rec.status = "MISMATCH";
        break;
      case 1: // nested value change (layer 2)
        rec.meta.source.region = "REGION-DRIFT";
        break;
      case 2: // deep nested change (layer 3)
        rec.meta.target.zone = "ZONE-DRIFT";
        break;
      case 3: // extra nested field
        rec.payload.extraNote = `anomaly-${idx}`;
        break;
      case 4: // missing nested field
        delete rec.payload.checksum;
        break;
      case 5: // numeric drift
        rec.payload.sizeBytes = rec.payload.sizeBytes + 1;
        break;
    }
  }
  download.metadata.recordCount = download.records.length;
}

// ---------- Main ----------
async function main() {
  const opts = parseArgs(argv);
  const outRoot = resolve(opts.out, opts.root);
  const uploadDir = join(outRoot, "Upload API Logs");
  const downloadDir = join(outRoot, "Download API Logs");

  stdout.write(`Generating into ${outRoot}\n`);

  const upload = buildPayload({ lines: opts.lines, seed: opts.seed, side: "upload" });
  const download = buildPayload({ lines: opts.lines, seed: opts.seed, side: "download" });
  injectDiffs(upload, download, opts.diffs, opts.seed);

  await mkdir(uploadDir, { recursive: true });
  await mkdir(downloadDir, { recursive: true });

  const uploadJson = JSON.stringify(upload, null, 2);
  const downloadJson = JSON.stringify(download, null, 2);

  await writeFile(join(uploadDir, "TransferData.json"), uploadJson, "utf8");
  await writeFile(join(downloadDir, "TransferData.json"), downloadJson, "utf8");

  const uploadLines = uploadJson.split("\n").length;
  const downloadLines = downloadJson.split("\n").length;

  stdout.write(`  Upload API Logs/TransferData.json   ${upload.records.length} records, ${uploadLines} lines\n`);
  stdout.write(`  Download API Logs/TransferData.json ${download.records.length} records, ${downloadLines} lines\n`);
  stdout.write(`  Injected ${opts.diffs} diffs\n`);
  stdout.write(`Done. Point the app's folder picker at: ${outRoot}\n`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

/**
 * One-time provenance script: turns the Family Feud source workbook into the
 * committed `apps/api/src/seed/questions.seed.json` fixture. The JSON is the
 * source of truth for the seed runner; this script only regenerates it.
 *
 * Usage (from apps/api):  ts-node scripts/parse-dataset.ts [path/to/workbook.xlsx]
 * With no path arg it downloads the workbook from the documented Drive URL.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import ExcelJS from 'exceljs';

export type SeedKind = 'standard' | 'fast_money';
export interface SeedAnswer {
  text: string;
  points: number;
  rank: number;
}
export interface SeedQuestion {
  kind: SeedKind;
  prompt: string;
  answers: SeedAnswer[];
}

const DRIVE_URL =
  'https://drive.google.com/uc?export=download&id=0Bzs-xvR-5hQ3WktpWVA2RmROY1U';

// Sheets to import and the kind each maps to. Everything else (No Points *,
// Broken Fast Money) is intentionally skipped.
const SHEETS: { name: string; kind: SeedKind }[] = [
  { name: '3 Answers', kind: 'standard' },
  { name: '4 Answers', kind: 'standard' },
  { name: '5 Answers', kind: 'standard' },
  { name: '6 Answers', kind: 'standard' },
  { name: '7 Answers', kind: 'standard' },
  { name: 'Fast Money', kind: 'fast_money' },
];

const OUT = join(__dirname, '..', 'src', 'seed', 'questions.seed.json');

/**
 * Maps one worksheet row (exceljs 1-indexed `row.values`) to a SeedQuestion.
 * Column A (index 1) is the prompt; columns then alternate answer text / points.
 * Returns null for header rows, empty prompts, or rows with no scored answers.
 */
export function parseRow(
  cells: (string | number | undefined)[],
  kind: SeedKind,
): SeedQuestion | null {
  const prompt = String(cells[1] ?? '').trim();
  if (!prompt || prompt === 'Question') return null;

  const answers: SeedAnswer[] = [];
  for (let i = 2; i < cells.length; i += 2) {
    const text = String(cells[i] ?? '').trim();
    const points = Number(cells[i + 1]);
    if (!text || !Number.isFinite(points)) break;
    answers.push({ text, points, rank: answers.length });
  }

  if (answers.length === 0) return null;
  return { kind, prompt, answers };
}

async function download(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed: ${res.status}`);
  const path = join(tmpdir(), 'family-feud-dataset.xlsx');
  await writeFile(path, Buffer.from(await res.arrayBuffer()));
  return path;
}

async function main(): Promise<void> {
  const src = process.argv[2] ?? (await download(DRIVE_URL));
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(src);

  const out: SeedQuestion[] = [];
  for (const { name, kind } of SHEETS) {
    const sheet = wb.getWorksheet(name);
    if (!sheet) throw new Error(`Missing sheet: ${name}`);
    sheet.eachRow((row) => {
      const parsed = parseRow(
        row.values as (string | number | undefined)[],
        kind,
      );
      if (parsed) out.push(parsed);
    });
  }

  await mkdir(dirname(OUT), { recursive: true });
  await writeFile(OUT, JSON.stringify(out, null, 2) + '\n');

  const standard = out.filter((q) => q.kind === 'standard').length;
  const fastMoney = out.filter((q) => q.kind === 'fast_money').length;
  console.log(
    `Wrote ${out.length} questions (${standard} standard, ${fastMoney} fast_money) to ${OUT}`,
  );
}

// Only run when invoked directly, so the spec can import parseRow cleanly.
if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

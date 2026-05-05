import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { AuditResult } from '@/types';

/**
 * Singleton SQLite handle. Uses WAL mode so readers don't block the writer
 * (single audit loop) and the status endpoint always sees the latest progress.
 *
 * The DB file lives at `data/lighthouse.db` by default; override with
 * `LIGHTHOUSE_DB_PATH` for tests or alternate hosts.
 */
function resolveDbPath(): string {
  if (process.env.LIGHTHOUSE_DB_PATH) return process.env.LIGHTHOUSE_DB_PATH;
  const dir = path.join(process.cwd(), 'data');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, 'lighthouse.db');
}

let dbInstance: Database.Database | null = null;

export function getDb(): Database.Database {
  if (dbInstance) return dbInstance;

  const db = new Database(resolveDbPath());
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('synchronous = NORMAL');

  runMigrations(db);
  dbInstance = db;
  return db;
}

const MIGRATIONS: Array<{ id: number; sql: string }> = [
  {
    id: 1,
    sql: `
      CREATE TABLE users (
        id INTEGER PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        created_at INTEGER NOT NULL
      );

      CREATE TABLE sessions (
        id TEXT PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        status TEXT NOT NULL CHECK (status IN ('processing','completed','error')),
        form_factor TEXT NOT NULL,
        current_url TEXT,
        progress INTEGER NOT NULL DEFAULT 0,
        total INTEGER NOT NULL,
        insights_path TEXT,
        error TEXT,
        created_at INTEGER NOT NULL,
        completed_at INTEGER
      );

      CREATE TABLE audit_results (
        id INTEGER PRIMARY KEY,
        session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
        url TEXT NOT NULL,
        performance INTEGER,
        accessibility INTEGER,
        best_practices INTEGER,
        seo INTEGER,
        opportunities_json TEXT,
        html_path TEXT,
        json_path TEXT,
        error TEXT,
        created_at INTEGER NOT NULL
      );

      CREATE INDEX idx_results_url_created
        ON audit_results(url, created_at DESC);
      CREATE INDEX idx_results_session
        ON audit_results(session_id);
      CREATE INDEX idx_sessions_user_created
        ON sessions(user_id, created_at DESC);
    `
  },
  {
    id: 2,
    // Relax sessions.status CHECK to allow 'cancelled'. SQLite can't ALTER a
    // CHECK constraint in place, so recreate the table and rebuild indexes.
    sql: `
      CREATE TABLE sessions_new (
        id TEXT PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        status TEXT NOT NULL CHECK (status IN ('processing','completed','error','cancelled')),
        form_factor TEXT NOT NULL,
        current_url TEXT,
        progress INTEGER NOT NULL DEFAULT 0,
        total INTEGER NOT NULL,
        insights_path TEXT,
        error TEXT,
        created_at INTEGER NOT NULL,
        completed_at INTEGER
      );

      INSERT INTO sessions_new
        SELECT id, user_id, status, form_factor, current_url, progress, total,
               insights_path, error, created_at, completed_at
        FROM sessions;

      DROP TABLE sessions;
      ALTER TABLE sessions_new RENAME TO sessions;

      CREATE INDEX idx_sessions_user_created
        ON sessions(user_id, created_at DESC);
    `
  }
];

function runMigrations(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id INTEGER PRIMARY KEY,
      applied_at INTEGER NOT NULL
    );
  `);

  const applied = new Set(
    db.prepare('SELECT id FROM schema_migrations').all().map((r: any) => r.id)
  );

  const insert = db.prepare(
    'INSERT INTO schema_migrations (id, applied_at) VALUES (?, ?)'
  );

  for (const m of MIGRATIONS) {
    if (applied.has(m.id)) continue;
    db.transaction(() => {
      db.exec(m.sql);
      insert.run(m.id, Date.now());
    })();
  }
}

// --- Session helpers ---------------------------------------------------------

export type SessionStatus = 'processing' | 'completed' | 'error' | 'cancelled';

export interface SessionRow {
  id: string;
  status: SessionStatus;
  form_factor: string;
  current_url: string | null;
  progress: number;
  total: number;
  insights_path: string | null;
  error: string | null;
  created_at: number;
  completed_at: number | null;
}

export function createSession(params: {
  id: string;
  formFactor: string;
  total: number;
  userId?: number | null;
}): void {
  getDb().prepare(`
    INSERT INTO sessions (id, user_id, status, form_factor, total, progress, created_at)
    VALUES (?, ?, 'processing', ?, ?, 0, ?)
  `).run(params.id, params.userId ?? null, params.formFactor, params.total, Date.now());
}

export function getSession(id: string): SessionRow | undefined {
  return getDb()
    .prepare('SELECT * FROM sessions WHERE id = ?')
    .get(id) as SessionRow | undefined;
}

export function updateSessionProgress(id: string, currentUrl: string, progress: number): void {
  getDb().prepare(`
    UPDATE sessions SET current_url = ?, progress = ? WHERE id = ?
  `).run(currentUrl, progress, id);
}

export function completeSession(id: string, insightsPath?: string | null): void {
  getDb().prepare(`
    UPDATE sessions
    SET status = 'completed', current_url = NULL, completed_at = ?, insights_path = ?
    WHERE id = ?
  `).run(Date.now(), insightsPath ?? null, id);
}

export function failSession(id: string, errorMessage: string): void {
  getDb().prepare(`
    UPDATE sessions SET status = 'error', error = ?, completed_at = ? WHERE id = ?
  `).run(errorMessage, Date.now(), id);
}

/**
 * Mark a still-processing session as cancelled. The audit loop polls
 * `getSessionStatus` between URLs and exits cleanly when it sees this.
 * Returns true if a row was actually flipped (i.e. the session existed
 * and was still 'processing').
 */
export function cancelSession(id: string): boolean {
  const info = getDb().prepare(`
    UPDATE sessions
    SET status = 'cancelled', current_url = NULL, completed_at = ?
    WHERE id = ? AND status = 'processing'
  `).run(Date.now(), id);
  return info.changes > 0;
}

export function getSessionStatus(id: string): SessionStatus | undefined {
  const row = getDb()
    .prepare('SELECT status FROM sessions WHERE id = ?')
    .get(id) as { status: SessionStatus } | undefined;
  return row?.status;
}

// --- Result helpers ----------------------------------------------------------

export function insertResult(sessionId: string, result: AuditResult): void {
  getDb().prepare(`
    INSERT INTO audit_results (
      session_id, url, performance, accessibility, best_practices, seo,
      opportunities_json, html_path, json_path, error, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    sessionId,
    result.url,
    result.scores?.performance ?? null,
    result.scores?.accessibility ?? null,
    result.scores?.['best-practices'] ?? null,
    result.scores?.seo ?? null,
    result.opportunities ? JSON.stringify(result.opportunities.slice(0, 5)) : null,
    result.reportPaths?.html ?? null,
    result.reportPaths?.json ?? null,
    result.error ?? null,
    Date.now()
  );
}

export function getResultsForSession(sessionId: string): AuditResult[] {
  const rows = getDb().prepare(`
    SELECT url, performance, accessibility, best_practices, seo,
           opportunities_json, html_path, json_path, error
    FROM audit_results
    WHERE session_id = ?
    ORDER BY id ASC
  `).all(sessionId) as any[];

  return rows.map(rowToAuditResult);
}

function rowToAuditResult(r: any): AuditResult {
  if (r.error) {
    return { url: r.url, error: r.error };
  }
  return {
    url: r.url,
    scores: {
      performance: r.performance ?? 0,
      accessibility: r.accessibility ?? 0,
      'best-practices': r.best_practices ?? 0,
      seo: r.seo ?? 0
    },
    opportunities: r.opportunities_json ? JSON.parse(r.opportunities_json) : [],
    reportPaths: (r.html_path || r.json_path)
      ? { html: r.html_path, json: r.json_path }
      : undefined
  };
}

/**
 * Drop sessions older than the cutoff. Cascades to audit_results.
 */
export function purgeOldSessions(olderThanMs: number): number {
  const cutoff = Date.now() - olderThanMs;
  const info = getDb()
    .prepare('DELETE FROM sessions WHERE created_at < ?')
    .run(cutoff);
  return info.changes;
}

// --- History helpers ---------------------------------------------------------

export interface UrlHistoryEntry {
  url: string;
  formFactor: string;
  runCount: number;
  lastRunAt: number;
  latestScores: {
    performance: number;
    accessibility: number;
    'best-practices': number;
    seo: number;
  };
  perfTrend: number[]; // up to 10 most-recent performance scores, oldest-first
}

const SPARKLINE_WINDOW = 10;

/**
 * One row per (url, form_factor) with the latest scores, run count, last run
 * timestamp, and the last N performance scores (oldest-first) for sparkline.
 *
 * Implemented as two queries to keep the SQL readable:
 *   1) latest run per (url, form_factor) — window function on rn = 1
 *   2) last N perf scores per (url, form_factor) — window function on rn <= N
 * Then joined in memory. Both queries are bounded by `idx_results_url_created`.
 */
export function listUrlHistory(formFactor: string): UrlHistoryEntry[] {
  const db = getDb();

  const latestRows = db.prepare(`
    WITH ranked AS (
      SELECT
        ar.url,
        ar.performance,
        ar.accessibility,
        ar.best_practices,
        ar.seo,
        s.created_at,
        ROW_NUMBER() OVER (
          PARTITION BY ar.url ORDER BY s.created_at DESC, ar.id DESC
        ) AS rn,
        COUNT(*) OVER (PARTITION BY ar.url) AS run_count
      FROM audit_results ar
      JOIN sessions s ON ar.session_id = s.id
      WHERE ar.error IS NULL
        AND s.form_factor = ?
        AND ar.performance IS NOT NULL
    )
    SELECT url, performance, accessibility, best_practices, seo, created_at, run_count
    FROM ranked
    WHERE rn = 1
    ORDER BY created_at DESC
  `).all(formFactor) as any[];

  if (latestRows.length === 0) return [];

  const trendRows = db.prepare(`
    WITH ranked AS (
      SELECT
        ar.id AS id,
        ar.url,
        ar.performance,
        s.created_at,
        ROW_NUMBER() OVER (
          PARTITION BY ar.url ORDER BY s.created_at DESC, ar.id DESC
        ) AS rn
      FROM audit_results ar
      JOIN sessions s ON ar.session_id = s.id
      WHERE ar.error IS NULL
        AND s.form_factor = ?
        AND ar.performance IS NOT NULL
    )
    SELECT url, performance, created_at, id FROM ranked
    WHERE rn <= ?
    ORDER BY url ASC, created_at ASC, id ASC
  `).all(formFactor, SPARKLINE_WINDOW) as Array<{ url: string; performance: number }>;

  const trendByUrl = new Map<string, number[]>();
  for (const row of trendRows) {
    const arr = trendByUrl.get(row.url) ?? [];
    arr.push(row.performance);
    trendByUrl.set(row.url, arr);
  }

  return latestRows.map(r => ({
    url: r.url,
    formFactor,
    runCount: r.run_count,
    lastRunAt: r.created_at,
    latestScores: {
      performance: r.performance,
      accessibility: r.accessibility,
      'best-practices': r.best_practices,
      seo: r.seo
    },
    perfTrend: trendByUrl.get(r.url) ?? []
  }));
}

export interface UrlRun {
  id: number;
  url: string;
  formFactor: string;
  createdAt: number;
  scores?: {
    performance: number;
    accessibility: number;
    'best-practices': number;
    seo: number;
  };
  reportPaths?: { html: string; json: string };
  opportunities?: Array<{ title: string; displayValue?: string }>;
  error?: string;
}

/**
 * All runs for a given (url, formFactor), newest first.
 * Used by the detail page to render the chart + per-run table.
 */
export function getRunsForUrl(url: string, formFactor: string): UrlRun[] {
  const rows = getDb().prepare(`
    SELECT ar.id, ar.url, ar.performance, ar.accessibility,
           ar.best_practices, ar.seo, ar.html_path, ar.json_path,
           ar.opportunities_json, ar.error,
           s.created_at, s.form_factor
    FROM audit_results ar
    JOIN sessions s ON ar.session_id = s.id
    WHERE ar.url = ? AND s.form_factor = ?
    ORDER BY s.created_at DESC, ar.id DESC
  `).all(url, formFactor) as any[];

  return rows.map((r): UrlRun => {
    const base = {
      id: r.id,
      url: r.url,
      formFactor: r.form_factor,
      createdAt: r.created_at
    };
    if (r.error) {
      return { ...base, error: r.error };
    }
    return {
      ...base,
      scores: {
        performance: r.performance ?? 0,
        accessibility: r.accessibility ?? 0,
        'best-practices': r.best_practices ?? 0,
        seo: r.seo ?? 0
      },
      reportPaths: (r.html_path || r.json_path)
        ? { html: r.html_path, json: r.json_path }
        : undefined,
      opportunities: r.opportunities_json ? JSON.parse(r.opportunities_json) : []
    };
  });
}

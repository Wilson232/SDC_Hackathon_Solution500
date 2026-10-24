#!/usr/bin/env bash
set -euo pipefail
# Post-merge runs in development only. Never run schema DDL during app startup/build.
if [[ "${NODE_ENV:-}" == "production" ]]; then
  echo "Post-merge schema setup is development-only." >&2
  exit 1
fi
node --input-type=module <<'NODE'
import { readFile } from 'node:fs/promises';
import { pool } from './server/db.mjs';
try {
  await pool.query(await readFile('server/schema.sql', 'utf8'));
  console.log('Development schema is ready.');
} finally {
  await pool.end();
}
NODE

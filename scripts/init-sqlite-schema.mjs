#!/usr/bin/env node
/**
 * Exact SQLite DDL initializer parsed directly from prisma/schema.prisma.
 * Generates PRIMARY KEY, NOT NULL, DEFAULT, @unique, @@unique, and @@index
 * without requiring remote Prisma binary downloads.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@libsql/client';

const rawUrl = (process.env.DATABASE_URL || 'file:./db/custom.db').trim();
if (rawUrl.startsWith('file:')) {
  const filePart = rawUrl.slice('file:'.length).split('?')[0];
  if (filePart && filePart !== ':memory:') {
    const abs = path.isAbsolute(filePart) ? filePart : path.resolve(process.cwd(), filePart);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
  }
}

const schemaText = fs.readFileSync(path.resolve(process.cwd(), 'prisma/schema.prisma'), 'utf8');

const SCALAR_TYPES = new Set(['String', 'Int', 'BigInt', 'Float', 'Decimal', 'Boolean', 'DateTime', 'Json', 'Bytes']);

function mapSqliteType(prismaType) {
  switch (prismaType) {
    case 'Int':
    case 'BigInt':
      return 'INTEGER';
    case 'Float':
    case 'Decimal':
      return 'REAL';
    case 'Boolean':
      return 'BOOLEAN';
    case 'DateTime':
      return 'DATETIME';
    case 'Bytes':
      return 'BLOB';
    default:
      return 'TEXT';
  }
}

function parseDefault(attrText, prismaType) {
  const m = attrText.match(/@default\(([^)]*(?:\([^)]*\)[^)]*)*)\)/);
  if (!m) return { clause: '', autoIncrement: false };
  const val = m[1].trim();
  if (val === 'autoincrement()') return { clause: '', autoIncrement: true };
  if (val === 'now()') return { clause: ' DEFAULT CURRENT_TIMESTAMP', autoIncrement: false };
  if (val === 'cuid()' || val === 'uuid()') return { clause: '', autoIncrement: false };
  if (val === 'true') return { clause: ' DEFAULT 1', autoIncrement: false };
  if (val === 'false') return { clause: ' DEFAULT 0', autoIncrement: false };
  if (/^-?\d+(\.\d+)?$/.test(val)) return { clause: ` DEFAULT ${val}`, autoIncrement: false };
  if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
    const inner = val.slice(1, -1).replace(/\\"/g, '"').replace(/'/g, "''");
    return { clause: ` DEFAULT '${inner}'`, autoIncrement: false };
  }
  if (prismaType === 'String' && /^[A-Za-z0-9_-]+$/.test(val)) {
    return { clause: ` DEFAULT '${val}'`, autoIncrement: false };
  }
  return { clause: '', autoIncrement: false };
}

function parseModels(source) {
  const models = [];
  const enumNames = new Set();
  for (const em of source.matchAll(/^\s*enum\s+([A-Za-z0-9_]+)\s*\{/gm)) {
    enumNames.add(em[1]);
  }

  const modelRegex = /^\s*model\s+([A-Za-z0-9_]+)\s*\{([\s\S]*?)^\s*\}/gm;
  for (const match of source.matchAll(modelRegex)) {
    const modelName = match[1];
    const body = match[2];
    let tableName = modelName;
    const cols = [];
    const uniques = [];
    const indexes = [];
    let compoundPk = null;

    for (const rawLine of body.split('\n')) {
      const line = rawLine.replace(/\/\/.*$/, '').trim();
      if (!line) continue;

      if (line.startsWith('@@')) {
        const mapMatch = line.match(/^@@map\(["']([^"']+)["']\)/);
        if (mapMatch) tableName = mapMatch[1];

        const uqMatch = line.match(/^@@unique\(\[([^\]]+)\]/);
        if (uqMatch) {
          uniques.push(uqMatch[1].split(',').map((s) => s.trim()).filter(Boolean));
        }

        const idMatch = line.match(/^@@id\(\[([^\]]+)\]/);
        if (idMatch) {
          compoundPk = idMatch[1].split(',').map((s) => s.trim()).filter(Boolean);
        }

        const idxMatch = line.match(/^@@index\(\[([^\]]+)\]/);
        if (idxMatch) {
          indexes.push(idxMatch[1].split(',').map((s) => s.trim().replace(/\([^)]*\)/g, '')).filter(Boolean));
        }
        continue;
      }

      const tokens = line.split(/\s+/);
      if (tokens.length < 2) continue;
      const fieldName = tokens[0];
      const rawType = tokens[1];
      if (rawType.endsWith('[]')) continue; // relation array

      const isOptional = rawType.endsWith('?');
      const baseType = rawType.replace(/\?$/, '');
      if (!SCALAR_TYPES.has(baseType) && !enumNames.has(baseType)) {
        continue; // relation object
      }

      const rest = tokens.slice(2).join(' ');
      if (rest.includes('@relation(')) continue;

      const colMap = rest.match(/@map\(["']([^"']+)["']\)/);
      const colName = colMap ? colMap[1] : fieldName;
      const isId = /\b@id\b/.test(rest) || /(?:^|\s)@id(?:\s|$)/.test(line);
      const isUnique = /(?:^|\s)@unique(?:\s|\(|$)/.test(line);
      const { clause: defClause, autoIncrement } = parseDefault(rest, baseType);

      cols.push({
        fieldName,
        colName,
        sqlType: mapSqliteType(baseType),
        isOptional,
        isId,
        isUnique,
        defClause,
        autoIncrement,
      });
    }

    models.push({ modelName, tableName, cols, uniques, indexes, compoundPk });
  }
  return models;
}

async function main() {
  const client = createClient({ url: rawUrl });
  const models = parseModels(schemaText);
  let tableCount = 0;
  let uniqueCount = 0;
  let indexCount = 0;

  for (const m of models) {
    const fieldNameToCol = Object.fromEntries(m.cols.map((c) => [c.fieldName, c.colName]));
    const colSql = m.cols.map((c) => {
      let s = `"${c.colName}" ${c.sqlType}`;
      if (c.isId && !m.compoundPk) {
        s += c.autoIncrement ? ' PRIMARY KEY AUTOINCREMENT' : ' PRIMARY KEY NOT NULL';
      } else if (!c.isOptional) {
        s += ' NOT NULL';
      }
      s += c.defClause;
      return s;
    });

    if (m.compoundPk?.length) {
      colSql.push(`PRIMARY KEY (${m.compoundPk.map((f) => `"${fieldNameToCol[f] || f}"`).join(', ')})`);
    }

    await client.execute(`CREATE TABLE IF NOT EXISTS "${m.tableName}" (\n  ${colSql.join(',\n  ')}\n);`);
    tableCount += 1;

    for (const c of m.cols) {
      if (c.isUnique) {
        const idx = `${m.tableName}_${c.colName}_key`;
        await client.execute(`CREATE UNIQUE INDEX IF NOT EXISTS "${idx}" ON "${m.tableName}"("${c.colName}");`);
        uniqueCount += 1;
      }
    }

    for (const uq of m.uniques) {
      const mapped = uq.map((f) => fieldNameToCol[f] || f);
      const idx = `${m.tableName}_${mapped.join('_')}_key`;
      await client.execute(`CREATE UNIQUE INDEX IF NOT EXISTS "${idx}" ON "${m.tableName}"(${mapped.map((x) => `"${x}"`).join(', ')});`);
      uniqueCount += 1;
    }

    for (const ix of m.indexes) {
      const mapped = ix.map((f) => fieldNameToCol[f] || f);
      const idx = `${m.tableName}_${mapped.join('_')}_idx`;
      await client.execute(`CREATE INDEX IF NOT EXISTS "${idx}" ON "${m.tableName}"(${mapped.map((x) => `"${x}"`).join(', ')});`);
      indexCount += 1;
    }
  }

  console.log(`Initialized ${tableCount} tables, ${uniqueCount} unique constraints, and ${indexCount} indexes in ${rawUrl}.`);
  client.close();
}

main().catch((err) => {
  console.error('Failed to initialize SQLite schema:', err);
  process.exit(1);
});

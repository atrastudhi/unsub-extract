'use strict';

const fs = require('fs');
const path = require('path');
const { connect, fetchMessages } = require('./lib/imap');
const { parseMessage } = require('./lib/parser');
const { getUnsubscribeUrl } = require('./lib/extractor');
const {
  BATCH_SIZE,
  DEFAULT_MAILBOX,
  DEFAULT_OUTPUT_FILE,
  DEFAULT_PORT,
  MAIL_SCAN_MONTHS_AGO,
  PROGRESS_BAR_WIDTH,
  UNKNOWN_FROM,
} = require('./constants');
const CLEAR_TO_END = '\x1b[K';
const PAD = '  ';

const style = {
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  bold: '\x1b[1m',
  reset: '\x1b[0m',
};

function progressLine(count, total) {
  const width = PROGRESS_BAR_WIDTH;
  const filled = total ? Math.min(Math.round((count / total) * width), width) : 0;
  const rest = Math.max(0, width - filled - (filled < width ? 1 : 0));
  const bar = '[' + '='.repeat(filled) + (filled < width ? '>' : '') + ' '.repeat(rest) + ']';
  return '\r' + PAD + bar + '  ' + count + '/' + total + CLEAR_TO_END;
}

async function processOne(msg) {
  let parsed;
  try {
    parsed = await parseMessage(msg.source);
  } catch (err) {
    process.stderr.write(`Message UID ${msg.uid}: parse error - ${err.message}\n`);
    return null;
  }
  const fromAddress = parsed.from || UNKNOWN_FROM;
  const url = getUnsubscribeUrl(parsed);
  if (url) return { from: fromAddress, url, date: parsed.date || null };
  return null;
}

function mergeResultsInto(bySender, results) {
  for (const r of results) {
    if (!r || !r.url) continue;
    const existing = bySender.get(r.from);
    const rTime = r.date ? r.date.getTime() : 0;
    if (!existing || rTime > existing.dateTime) {
      bySender.set(r.from, { url: r.url, dateTime: rTime, date: r.date });
    }
  }
}

/**
 * Run extraction: connect, fetch messages in batches, parse in parallel, write to file.
 * Progress is logged to stderr; results are written only to the output file.
 */
async function run(options) {
  const {
    host,
    port = DEFAULT_PORT,
    user,
    pass,
    mailbox = DEFAULT_MAILBOX,
    outputFile = DEFAULT_OUTPUT_FILE,
  } = options;

  const resolvedPath = path.resolve(process.cwd(), outputFile);
  const log = (msg) => process.stderr.write(msg + '\n');
  let summaryCount = 0;
  let summaryLinks = 0;

  const outDir = path.dirname(resolvedPath);
  if (outDir) fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(resolvedPath, '(Scanning… results will appear here.)\n', 'utf8');

  log('');
  process.stderr.write(PAD + '🔌 ' + style.dim + 'Connecting to ' + style.reset + style.bold + host + style.reset + style.dim + '…' + style.reset);
  const client = await connect({ host, port, user, pass, secure: true });
  process.stderr.write(' ' + style.green + '✅' + style.reset + '\n');
  const bySender = new Map();
  try {
    const monthsLabel = MAIL_SCAN_MONTHS_AGO === 1 ? '1 month' : `${MAIL_SCAN_MONTHS_AGO} months`;
    log(PAD + '📬 ' + style.dim + 'Scanning ' + style.reset + style.bold + mailbox + style.reset + style.dim + ` (last ${monthsLabel})…` + style.reset);
    log(PAD + style.dim + '📄 Output: ' + resolvedPath + style.reset);
    log('');
    let count = 0;
    let total = 0;
    let batch = [];
    for await (const msg of fetchMessages(client, mailbox)) {
      total = msg.total;
      batch.push(msg);
      if (batch.length < BATCH_SIZE) continue;
      const results = await Promise.all(batch.map((m) => processOne(m)));
      mergeResultsInto(bySender, results);
      count += batch.length;
      process.stderr.write(progressLine(count, total));
      batch = [];
    }
    if (batch.length > 0) {
      const results = await Promise.all(batch.map((m) => processOne(m)));
      mergeResultsInto(bySender, results);
      count += batch.length;
      process.stderr.write(progressLine(count, total));
    }
    process.stderr.write('\n');
    summaryCount = count;
    summaryLinks = bySender.size;
    const dateStr = (d) => (d && !isNaN(d.getTime()) ? d.toISOString().slice(0, 10) : 'unknown');
    const entries = [...bySender.entries()].sort((a, b) => b[1].dateTime - a[1].dateTime);
    const lines = entries.map(([s, o]) => '[' + dateStr(o.date) + '/' + s + ']: ' + o.url);
    const content = lines.join('\n') + '\n';
    fs.writeFileSync(resolvedPath, content, 'utf8');
    if (!fs.existsSync(resolvedPath)) {
      throw new Error('Failed to write output file: ' + resolvedPath);
    }
    log(PAD + style.green + '✅ File written: ' + style.reset + resolvedPath);
  } catch (err) {
    const errMsg = 'Error: ' + (err.message || String(err));
    try {
      fs.writeFileSync(resolvedPath, '(Scan failed)\n\n' + errMsg + '\n', 'utf8');
    } catch (_) {}
    log(PAD + style.dim + errMsg + style.reset);
    throw err;
  } finally {
    await client.logout();
  }

  return { outputPath: resolvedPath, linkCount: summaryLinks, messageCount: summaryCount };
}

module.exports = { run };

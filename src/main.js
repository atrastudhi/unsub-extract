#!/usr/bin/env node
'use strict';

const readlineSync = require('readline-sync');
const { run } = require('./run');
const {
  DEFAULT_MAILBOX,
  DEFAULT_OUTPUT_FILE,
  DEFAULT_PORT,
  KNOWN_IMAP_HOSTS,
  MAIL_SCAN_MONTHS_AGO,
} = require('./constants');

const C = {
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  reset: '\x1b[0m',
};

const PAD = '  ';

function out(msg) {
  process.stderr.write(msg + '\n');
}

function style(text, ...modifiers) {
  return modifiers.join('') + text + C.reset;
}

function section(title) {
  out(style(PAD + title, C.dim));
  out(style(PAD + '─'.repeat(title.length), C.dim));
}

function ask(label, opts = {}) {
  const prompt = PAD + style(label, C.cyan) + ' : ';
  return readlineSync.question(prompt, opts).trim();
}

function askRequired(label, opts = {}) {
  let value;
  for (;;) {
    value = ask(label, opts).trim();
    if (value.length > 0) return value;
    out(style(PAD + 'This field is required.', C.yellow));
  }
}

function bannerLines() {
  const W = 41;
  const months = MAIL_SCAN_MONTHS_AGO === 1 ? '1 month' : `${MAIL_SCAN_MONTHS_AGO} months`;
  const line = (content) => '│' + content.padEnd(W - 2) + '│';
  return [
    '╭' + '─'.repeat(W - 2) + '╮',
    line('  Unsubscribe Link Extractor'),
    line('  Connect via IMAP · Last ' + months),
    '╰' + '─'.repeat(W - 2) + '╯',
  ];
}

function imapHostFromEmail(email) {
  const at = (email || '').trim().indexOf('@');
  if (at === -1) return null;
  const domain = email.slice(at + 1).toLowerCase();
  return KNOWN_IMAP_HOSTS[domain] || `imap.${domain}`;
}

function promptInteractive() {
  out('');
  bannerLines().forEach((line) => out(style(PAD + line, C.bold, C.cyan)));
  out('');

  section('📧 Account');
  const user = askRequired('Email');
  let host = imapHostFromEmail(user);
  if (!host) {
    host = askRequired('IMAP host');
  } else {
    out(style(`${PAD}IMAP host    : ${host} (from email)`, C.dim));
  }
  const pass = askRequired('Password', { hideEchoBack: true });

  out('');
  section('⚙️  Options');
  const defaultHint = ' (enter to use default)';
  const mailbox = ask(`Mailbox (${DEFAULT_MAILBOX})${defaultHint}`, { defaultInput: DEFAULT_MAILBOX }) || DEFAULT_MAILBOX;
  const portStr = ask(`Port (${DEFAULT_PORT})${defaultHint}`, { defaultInput: String(DEFAULT_PORT) });
  const outputFile = ask(`Output file (${DEFAULT_OUTPUT_FILE})${defaultHint}`, { defaultInput: DEFAULT_OUTPUT_FILE }) || DEFAULT_OUTPUT_FILE;
  const port = portStr ? parseInt(portStr, 10) : DEFAULT_PORT;

  out('');
  return { host: host || '', port, user, pass, mailbox, outputFile };
}

async function main() {
  const creds = promptInteractive();
  const { host, user, pass, port, mailbox, outputFile } = creds;

  if (!host || !user || !pass) {
    out(style(PAD + '⚠️  Email and password are required.', C.yellow));
    process.exit(1);
  }

  out(style(PAD + '🔌 Connecting…', C.green) + '\n');

  try {
    const result = await run({ host, port, user, pass, mailbox, outputFile });
    out('');
    out(PAD + '----------------------------------------');
    out(PAD + style('✅ Done.', C.green) + ' ' + result.linkCount + ' unsubscribe link' + (result.linkCount === 1 ? '' : 's') + ' saved to:');
    out(PAD + result.outputPath);
    out(PAD + '(from ' + result.messageCount + ' message' + (result.messageCount === 1 ? '' : 's') + ' scanned)');
    out('');
  } catch (err) {
    out('');
    const message =
      err.authenticationFailed ? 'Invalid credentials. Check your email and password.'
      : err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT' ? 'Connection failed. Check host and port.'
      : err.message;
    out(style(PAD + '⚠️  ' + message, C.yellow));
    out('');
    process.exit(1);
  }
}

main();

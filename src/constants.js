'use strict';

const KNOWN_IMAP_HOSTS = {
  'gmail.com': 'imap.gmail.com',
  'googlemail.com': 'imap.gmail.com',
  'outlook.com': 'outlook.office365.com',
  'hotmail.com': 'outlook.office365.com',
  'live.com': 'outlook.office365.com',
  'yahoo.com': 'imap.mail.yahoo.com',
  'icloud.com': 'imap.mail.me.com',
  'me.com': 'imap.mail.me.com',
  'mac.com': 'imap.mail.me.com',
  'aol.com': 'imap.aol.com',
};

const DEFAULT_PORT = 993;
const DEFAULT_MAILBOX = 'INBOX';
const DEFAULT_OUTPUT_FILE = 'output/unsubs.txt';

const BATCH_SIZE = 40;
const PROGRESS_BAR_WIDTH = 24;

const CONNECTION_TIMEOUT_MS = 30000;
const MAIL_SCAN_MONTHS_AGO = 3;

const LIST_UNSUBSCRIBE_HEADER = 'list-unsubscribe';
const HTTP_PREFIX = 'http://';
const HTTPS_PREFIX = 'https://';
const MAILTO_PREFIX = 'mailto:';

const UNKNOWN_FROM = '(unknown)';

module.exports = {
  KNOWN_IMAP_HOSTS,
  DEFAULT_PORT,
  DEFAULT_MAILBOX,
  DEFAULT_OUTPUT_FILE,
  BATCH_SIZE,
  PROGRESS_BAR_WIDTH,
  CONNECTION_TIMEOUT_MS,
  MAIL_SCAN_MONTHS_AGO,
  LIST_UNSUBSCRIBE_HEADER,
  HTTP_PREFIX,
  HTTPS_PREFIX,
  MAILTO_PREFIX,
  UNKNOWN_FROM,
};

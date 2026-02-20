'use strict';

const { ImapFlow } = require('imapflow');
const { CONNECTION_TIMEOUT_MS, DEFAULT_PORT, MAIL_SCAN_MONTHS_AGO } = require('../constants');

/**
 * Create and connect an ImapFlow client.
 * @param {object} config - { host, port, user, pass, secure }
 * @returns {Promise<ImapFlow>}
 */
async function connect(config) {
  const client = new ImapFlow({
    host: config.host,
    port: config.port ?? DEFAULT_PORT,
    secure: config.secure !== false,
    auth: {
      user: config.user,
      pass: config.pass,
    },
    logger: false,
    connectionTimeout: CONNECTION_TIMEOUT_MS,
  });
  await client.connect();
  return client;
}

/**
 * Date for "since" search: N months ago from today.
 * @returns {Date}
 */
function sinceMonthsAgo() {
  const d = new Date();
  d.setMonth(d.getMonth() - MAIL_SCAN_MONTHS_AGO);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Stream messages one-by-one from a mailbox (last 3 months only).
 * Yields { uid, seq, source, total } so caller can show progress.
 * @param {ImapFlow} client - Connected client
 * @param {string} mailbox - Mailbox name (e.g. 'INBOX', '[Gmail]/Promotions')
 * @returns {AsyncGenerator<{ uid: number, seq: number, source: Buffer, total: number }>}
 */
async function* fetchMessages(client, mailbox) {
  const lock = await client.getMailboxLock(mailbox);
  try {
    const since = sinceMonthsAgo();
    const uids = await client.search({ since }, { uid: true });
    const total = uids.length;
    if (total === 0) return;
    for await (const msg of client.fetch(uids, { source: true }, { uid: true })) {
      yield { uid: msg.uid, seq: msg.seq, source: msg.source, total };
    }
  } finally {
    lock.release();
  }
}

module.exports = { connect, fetchMessages };

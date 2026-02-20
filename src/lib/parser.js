'use strict';

const { simpleParser } = require('mailparser');

/**
 * Parse raw RFC822 email buffer into a structured object.
 * @param {Buffer|string} raw - Raw message source from IMAP
 * @returns {Promise<{ headers: Map, from: string|null, date: Date|null, html: string|null, text: string|null }>}
 */
async function parseMessage(raw) {
  const mail = await simpleParser(typeof raw === 'string' ? Buffer.from(raw) : raw);
  const from = mail.from && mail.from.value && mail.from.value[0]
    ? mail.from.value[0].address
    : null;
  return {
    headers: mail.headers,
    from,
    date: mail.date || null,
    html: mail.html || null,
    text: mail.text || null,
  };
}

module.exports = { parseMessage };

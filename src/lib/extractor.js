'use strict';

const { parse } = require('node-html-parser');
const {
  LIST_UNSUBSCRIBE_HEADER,
  HTTP_PREFIX,
  HTTPS_PREFIX,
  MAILTO_PREFIX,
} = require('../constants');

/**
 * Extract URL from a single List-Unsubscribe part (e.g. "<https://...>" or "<mailto:...>").
 * @param {string} part - Trimmed part of the header value
 * @returns {string|null}
 */
function extractUrlFromAngleBrackets(part) {
  const trimmed = part.trim();
  const match = trimmed.match(/<([^>]+)>/);
  if (!match) return null;
  return match[1].trim();
}

/**
 * Parse List-Unsubscribe header (RFC 2369): comma-separated URLs in angle brackets.
 * Prefer first http(s) URL; else first mailto.
 * @param {Map|object} headers - Parsed headers (mailparser uses Map with lowercase keys)
 * @returns {string|null}
 */
function extractFromListUnsubscribeHeader(headers) {
  const raw = headers.get ? headers.get(LIST_UNSUBSCRIBE_HEADER) : headers[LIST_UNSUBSCRIBE_HEADER];
  if (!raw) return null;
  const value = typeof raw === 'string' ? raw : (raw && raw.value ? raw.value : String(raw));
  const parts = value.split(',');
  let firstMailto = null;
  for (const part of parts) {
    const url = extractUrlFromAngleBrackets(part);
    if (!url) continue;
    const lower = url.toLowerCase();
    if (lower.startsWith(HTTPS_PREFIX) || lower.startsWith(HTTP_PREFIX)) return url;
    if (lower.startsWith(MAILTO_PREFIX) && !firstMailto) firstMailto = url;
  }
  return firstMailto;
}

/**
 * Check if href is http(s) or mailto.
 * @param {string} href
 * @returns {boolean}
 */
function isValidUnsubscribeHref(href) {
  if (!href || typeof href !== 'string') return false;
  const lower = href.trim().toLowerCase();
  return (
    lower.startsWith(HTTPS_PREFIX) ||
    lower.startsWith(HTTP_PREFIX) ||
    lower.startsWith(MAILTO_PREFIX)
  );
}

/**
 * Extract unsubscribe URL from HTML body: find <a> with "unsubscribe" in text or href.
 * @param {string} html
 * @returns {string|null}
 */
function extractFromHtmlBody(html) {
  if (!html || typeof html !== 'string') return null;
  let root;
  try {
    root = parse(html);
  } catch {
    return null;
  }
  const anchors = root.querySelectorAll('a');
  const lower = 'unsubscribe';
  for (const a of anchors) {
    const href = a.getAttribute('href');
    const text = (a.textContent || '').trim().toLowerCase();
    const hrefLower = (href || '').toLowerCase();
    if (!text.includes(lower) && !hrefLower.includes(lower)) continue;
    if (isValidUnsubscribeHref(href)) return href.trim();
  }
  return null;
}

/**
 * Get unsubscribe URL from a parsed message: header first, then HTML body fallback.
 * @param {{ headers: Map|object, html?: string|null }} parsed - Output from parser.parseMessage
 * @returns {string|null}
 */
function getUnsubscribeUrl(parsed) {
  const fromHeader = extractFromListUnsubscribeHeader(parsed.headers);
  if (fromHeader) return fromHeader;
  return extractFromHtmlBody(parsed.html || '');
}

module.exports = {
  extractFromListUnsubscribeHeader,
  extractFromHtmlBody,
  getUnsubscribeUrl,
};

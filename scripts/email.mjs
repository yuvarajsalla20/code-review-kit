#!/usr/bin/env node
// Prepares the report email; the assistant sends it with the owner's mail connector. The kit itself never sends mail.
//   node path/to/review-kit/scripts/email.mjs --summary summary.json [--to main|all|a@x.com,b@y.com] [--out review-out/email.json]
//   node path/to/review-kit/scripts/email.mjs --check        (only checks the setup and lists the allowed addresses)
// Needs an `email` block in review.config.json and the local addresses file it names (default review.email.json, kept out of git).
// --to defaults to the main address. An address that is not on the allowed list stops the run: nothing is prepared.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { guard, loadConfig, parseArgs } from './lib/cli.mjs';
import { attachments, buildMessage, emailSettings, loadRecipients, pickRecipients } from './email/index.mjs';

const root = process.cwd();
const args = parseArgs();
const config = loadConfig(root, args.configPath);
const settings = emailSettings(config);
if (!settings) {
  console.log('Email is off: review.config.json has no "email" block (or "enabled": false). Nothing to send.');
  process.exit(0);
}
const recipients = guard(() => loadRecipients(root, settings));
if (recipients.warning) console.error(`Warning: ${recipients.warning}`);
if (process.argv.includes('--check')) {
  console.log(`Email is on. Main: ${recipients.main}. Allowed (${recipients.allowed.length}): ${recipients.allowed.join(', ')}. Sends: ${settings.send}.`);
  process.exit(0);
}
if (!args.summary) {
  console.error('Usage: email.mjs --summary summary.json [--to main|all|a@x.com,b@y.com] [--out review-out/email.json]');
  process.exit(2);
}
const to = guard(() => pickRecipients(recipients, args.to));
const model = JSON.parse(readFileSync(args.summary, 'utf8'));
const files = attachments(root, settings);
const message = { to, ...buildMessage(model, settings), attachments: files.found, missing: files.missing, send: settings.send };
const out = JSON.stringify(message, null, 2);
if (args.out) {
  mkdirSync(dirname(args.out), { recursive: true });
  writeFileSync(args.out, `${out}\n`);
  console.log(`Email prepared for ${to.join(', ')}: ${args.out}${files.missing.length ? ` (missing attachments: ${files.missing.join(', ')})` : ''}`);
} else console.log(out);

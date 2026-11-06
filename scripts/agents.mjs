#!/usr/bin/env node
// Checks the kit's own agents:
//   node path/to/review-kit/scripts/agents.mjs [review.config.json] [--report out.md] [--json]
// Run from the kit root. A config is optional; the `agents` block sets paths, limits and the gate.
import { runCli } from './lib/cli.mjs';
import { areaRun } from './areas.mjs';
import { toMarkdown } from './agents/report.mjs';

runCli({ run: areaRun('agents'), toMarkdown, optionalConfig: true });

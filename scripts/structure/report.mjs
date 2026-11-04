// Writes the structure findings as markdown tables, one per check, ready to show the owner.
import { couldNotVerify, decisionSections, header, summaryTable } from '../lib/table.mjs';

export const TITLES = {
  cycles: 'Circular imports',
  layers: 'Layer rules',
  restricted: 'Packages used outside their place',
  duplicates: 'Duplicate code',
  repeated: 'Repeated lists and text',
  size: 'Size',
};

export function toMarkdown(project, kitVersion, date, result) {
  const unseen = [
    'Duplicate and size checks are text-based: they cannot tell whether two matching blocks should really be one, so each row needs a person to decide.',
    'Function sizes are measured for top-level functions and classes only, by matching braces.',
  ];
  if (!result.layered) unseen.push('No layer map is configured, so layer rules were not checked. Add `structure.layers` to review.config.json.');
  return [...header('Structure report', project, kitVersion, date, `   Files read: ${result.files}`), ...summaryTable(TITLES, result), ...decisionSections(TITLES, result.findings), ...couldNotVerify(unseen)].join('\n');
}

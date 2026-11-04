// One shape for every speed finding: where it is, what is wrong, how to fix it, how big the job is.
/** `where` is `file:line` unless given (a row about a package, not a line). */
export const row = ({ file, line = 1, where = `${file}:${line}`, what, fix, effort = 'small' }) => ({ where, what, fix, effort, places: [{ file, from: line }] });

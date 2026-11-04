// Plain-language wording for every script finding, so the summary reads without jargon.
// `meaning` says what is wrong; `impact` says what it costs the user or the project; `term` is explained once in the glossary.
const t = (term, meaning) => ({ term, meaning });

export const PLAIN = {
  structure: {
    cycles: { meaning: 'Parts of the code depend on each other in a loop', impact: 'A change in one can break the other, and loops make bugs hard to trace or can stop the app from starting.', term: t('circular import', 'Files that import each other in a loop.') },
    layers: { meaning: 'A part of the code reaches into a part it should not know about', impact: 'Changing one area forces changes in others, so new features get slower and riskier.', term: t('layer', 'A group of folders with a rule about which other groups it may use, for example screens may use data, but data may not use screens.') },
    restricted: { meaning: 'A package is used outside the one place meant to own it', impact: 'Replacing or upgrading it later means editing many files, and mistakes can break the backend.' },
    duplicates: { meaning: 'The same code is written in more than one place', impact: 'A fix in one copy can be missed in the other, so the copies drift apart and one stays buggy.' },
    repeated: { meaning: 'The same list or text is written in several places', impact: 'One copy gets updated and another does not, so the app shows conflicting things.' },
    size: { meaning: 'A file or function does too many jobs', impact: 'It is harder to understand and change safely, so bugs hide there.' },
  },
  release: {
    lockfile: { meaning: 'The dependency lock file does not match the package list, so a clean install fails', impact: 'The build service cannot build the app, so you cannot ship.', term: t('lock file', 'The file that pins the exact version of every package so every build installs the same ones.') },
    appConfig: { meaning: 'A setting the store needs is missing or wrong', impact: 'The store can reject the app, or the build can fail.' },
    permissions: { meaning: 'The app asks for a permission without a clear reason text', impact: 'Apple rejects apps that ask for a permission without telling the user why.' },
    tracked: { meaning: 'A secret file is stored in the repository', impact: 'Anyone who can read the repository can read the secret, so it must be replaced.' },
    privacy: { meaning: 'The privacy policy does not mention something the app uses', impact: 'The store can reject the app, and users are not told what is collected.' },
  },
  tests: {
    untested: { meaning: 'Important code that no test covers', impact: 'A change there can break something the project promises, such as a feature that stops working, without anyone noticing.' },
  },
  agents: {
    frontmatter: { meaning: "A reviewer's setup block is wrong or missing", impact: 'The reviewer may not load, may have the wrong permissions, or may be able to edit your code.' },
    sections: { meaning: 'A reviewer is missing a required section', impact: 'Its reports can be incomplete or inconsistent.' },
    references: { meaning: 'A file or reviewer is mentioned that does not exist', impact: 'A reviewer or skill will not find what it needs and will review without it.' },
    shared: { meaning: 'A reviewer does not point to the shared rules', impact: 'It may follow different rules from the others, so reports disagree.' },
    repeated: { meaning: 'The same instruction is written in several reviewers', impact: 'One copy gets updated and another does not, so reviewers behave differently.' },
    orphan: { meaning: 'No skill starts this reviewer', impact: 'It never runs.' },
    size: { meaning: 'A reviewer file is very long', impact: 'Long instructions are followed less carefully.' },
  },
};

export const AREA_TITLES = { structure: 'Code structure', release: 'Release readiness', tests: 'Tests', agents: 'Review agents', security: 'Security', usability: 'Usability', speed: 'Speed and cost', design: 'Design' };

export const GATED = t('gated check', 'A check that must pass, or be accepted by you in the config, before release.');

/** What no script can see, in plain words, per area. */
export const COULD_NOT = {
  structure: 'Whether two similar pieces of code should really be one, and how the app is wired while it runs.',
  release: 'The signed build, the live store listing and the store account settings: these need the build service and App Store Connect.',
  tests: 'Whether a test checks the right thing, and behaviour only a real phone shows (alerts firing, permissions, the keyboard).',
  agents: 'Whether each reviewer finds real problems (that needs a trial on a project with planted defects) and whether an installed plugin finds its files.',
};

# Review agents

## Each agent
- [ ] One job, stated in the description, that no other agent also owns, as the owner table in `rules/review-rules.md` says.
- [ ] Read-only: no Edit or Write tools; shell limits come from `rules/review-rules.md`, which the agent points to.
- [ ] Inputs are listed and the agent can actually get each one (kit path, config, script output).
- [ ] A method of numbered steps, each producing something the report shows.
- [ ] Every rule can be checked ("report only what you traced" can; "be thorough" cannot).
- [ ] Every finding must carry where, what goes wrong, what triggers it and a concrete fix.
- [ ] Says what it could not check, and marks uncertain findings "unverified".
- [ ] Output names the template, and the template ends with the "could not verify" list.

## The kit
- [ ] The severity scale, conduct rules and topic owners are written once, in `rules/review-rules.md`, and every agent points to it.
- [ ] Every agent is started by a skill, and every skill hand-off supplies what the agent's inputs need.
- [ ] Every path and agent name mentioned exists.
- [ ] Each agent sits in the category folder for the question it answers, and the README lists it.
- [ ] Each script that feeds an agent is named in that agent's inputs.

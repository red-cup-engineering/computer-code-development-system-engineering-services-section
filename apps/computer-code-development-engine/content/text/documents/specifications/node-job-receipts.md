# Why the host's jobs no longer open pull requests for their receipts

The change itself is in `emsenn/bare-cedar-fog` (pull request 349), whose machine snapshot may hold no prose
(its build refuses "application source" such as a `.md` file, and `deploy/jobs/` refuses anything but `<id>.json`).
So this note lives beside the code that generates the pull requests, `git/working-tree.mjs` and `git/github-candidate.mjs`
of this engine.

## What happened

From 2026-10-07 this repository collected an open pull request about every hour, from
branches named `codex/node/personas-web-turn-what-they-syndicated-and-what-d3ccb970-<12 hex>`
(thirteen of them, #322 to #342), and one from `codex/node/launch-census-2026-10-07-the-publisher-s-launch-7bb206f9-<12 hex>` (#319).
Each one carried a single commit that touched only data on the host: a persona's notes, inbox, presences,
reach readings, syndication and site-deployment records, or the one-file launch census.
None was ever a change a person was meant to review, and each was a snapshot of state that the next
hour's run superseded.

## The generator

Three jobs in `deploy/jobs/` ended their command line with `--retain`: `persona-tend`,
`launch-census` and `book-outreach`. Each also declares `workingTree.custody`, so the node
runs it with `NODE_JOB_WORKING_TREE` and `NODE_JOB_CUSTODY` set. The chain was:

1. The program (`scripts/persona-tend.mjs` in `causeway-services/public-services-section`,
   `scripts/derive-launch-census.mjs` in `red-cup-engineering/computer-engineering-services-section`) writes
   its records into the working tree, then, given `--retain`, calls `workingTreeOf(...).retain({ paths, message })`.
2. `retain` (`git/working-tree.mjs` in `computer-code-development-engine`) defaults to `push: true`
   and calls `commitGitPaths`.
3. With `push`, `commitGitPaths` does not commit in the checkout. It calls `landPathsSync`, which builds
   a commit of the named paths over `origin/main` and calls `nameCandidateSync` (`git/github-candidate.mjs`).
4. `nameCandidateSync` pushes the commit to `codex/<candidate name>-<first 12 of the commit id>` and runs
   `gh pr create`. The candidate name is derived from the commit message and a hash of the path list, and
   the branch suffix from the commit id, so every run with a different state is a new branch and a new PR.
   The PR body is the text "Exact source commit ... Review and merge in the owning repository", which is how
   the generator is recognised.

The persona job runs hourly (`everySeconds: 3600`) and always has new reach readings or deployment
records to write, hence an hourly PR. The census job runs daily and opens one when the census changes.
`book-outreach` had the same wiring but no PR was open from it when this was fixed.

## The fix

`--retain` is removed from the three job declarations. Nothing else about the jobs changes: they still
run under the same custody, in the same working tree, and write the same files.
The records are runtime state of the node. They stay on the host as files in the data package
(`NODE_JOB_DATA_PACKAGE_ROOT`), where the programs read them back on the next turn, and are never committed,
pushed or proposed. The programs keep their `--retain` option for a person running them from a checkout
and deliberately choosing to propose records.

The summaries of `persona-tend` and `launch-census` said "retained"; they now say the records are kept as the
node's runtime state.

This is a change to a job declaration and not to program code because the programs are right to offer
`--retain`; what was wrong was that the host's schedule asked for it unattended. No data or record file was
added or edited by hand.

## Who reads these records

No reader reads them from git. Both programs read their own previous output from the working tree on disk:
`persona-tend` reads each persona's inbox, notes, syndication and reach files to decide what is due;
`derive-launch-census` re-reads the previous `census.json` to decide whether anything changed, and the
publisher's enterprise is described as deriving its launch requests from that same file (I did not trace that reader further, and found none that reads git). The host job runner is the
only process that sees them, and it sees files, not commits. Removing the commit therefore removes no input.

The cost is that these records are no longer versioned or visible in GitHub, and the host checkout's
working tree stays dirty with them. If a durable, reviewable history of them is wanted, it needs a
store built for it (an append-only evidence store or object storage the program writes to), not a pull request.

## Disposal of the existing pull requests

The thirteen `persona-tend` pull requests (#322, #324, #326, #328, #331, #333, #335, #337 to #342) and the
`launch-census` pull request (#319) in `emsenn/bare-cedar-fog` were closed with a comment naming the fix pull request, and their
`codex/node/` branches were deleted. Any remaining `codex/node/personas-web-turn-*` or `codex/node/launch-census-*`
branches whose pull requests were closed, or whose commits were already reachable from `main`, were deleted too.
Other open pull requests in this repository are different work and were left alone.

## How it takes effect

Merging to `main` runs the `GitHub Guix machine release` workflow on the self-hosted runner, which builds the exact
machine snapshot and, on `main`, deploys it through the single-writer promotion; the node then reads the new
`deploy/jobs/*.json`. No host was edited by hand and no deploy was run from here.

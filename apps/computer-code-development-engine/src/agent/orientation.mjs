/** Agent orientation read model. */

function record(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value : undefined;
}

export async function agentOrientationReadout(input) {
  const topology = record(input.topology);
  const fleet = record(input.fleet);
  const hookState = record(input.hookState);
  const fileCensus = record(input.fileCensus);
  const codex = record(input.codex);
  const presence = record(input.presence);
  const doctrine = record(input.doctrine);
  const presenceSessions = Array.isArray(presence?.["sessions"]) ? presence["sessions"] : [];
  const presenceBySession = new Map();
  for (const entry of presenceSessions) {
    const session = record(entry);
    const sessionId = session?.["session"];
    if (session !== undefined && typeof sessionId === "string") presenceBySession.set(sessionId, session);
  }
  const staleAfterSeconds = presence?.["staleAfterSeconds"];
  const liveCount = presenceSessions.filter((entry) => {
    const session = record(entry);
    return session !== undefined && session["state"] === "deshrouded"
      && typeof session["idleSeconds"] === "number" && typeof staleAfterSeconds === "number"
      && (session["idleSeconds"]) <= staleAfterSeconds;
  }).length;

  const glued = record(fleet?.["glued"]);
  const sessions = Array.isArray(fleet?.["sessions"]) ? fleet["sessions"] : [];
  const byId = new Map();
  for (const entry of sessions) {
    const session = record(entry);
    const sessionId = session?.["sessionId"];
    if (session === undefined || typeof sessionId !== "string") continue;
    const prior = byId.get(sessionId);
    if (prior === undefined || Number(session["claims"] ?? 0) > Number(prior["claims"] ?? 0)) byId.set(sessionId, session);
  }
  const topSessionsRanked = [...byId.values()]
    .sort((left, right) => Number(right["claims"] ?? 0) - Number(left["claims"] ?? 0))
    .slice(0, 8);
  const topSessions = await Promise.all(topSessionsRanked.map(async (session) => {
    const sessionId = session["sessionId"];
    const presenceEntry = typeof sessionId === "string" ? presenceBySession.get(sessionId) : undefined;
    return Object.freeze({
      sessionId: sessionId ?? null,
      goals: session["goals"] ?? null,
      obligations: session["obligations"] ?? null,
      regime: session["regime"] ?? null,
      ...(typeof session["latestGoal"] === "string" ? { latestGoal: (session["latestGoal"]).slice(0, 160) } : {}),
      duties: await input.dutiesCountOf(session["sessionId"]),
      ...(presenceEntry === undefined ? {} : {
        presence: Object.freeze({
          state: presenceEntry["state"],
          lastEventAt: presenceEntry["lastEventAt"],
          idleSeconds: presenceEntry["idleSeconds"],
        }),
      }),
    });
  }));

  const trees = Array.isArray(fileCensus?.["trees"]) ? fileCensus["trees"] : [];
  const topTrees = [...trees]
    .map(record)
    .filter((tree) => tree !== undefined)
    .sort((left, right) => Number(right["files"] ?? 0) - Number(left["files"] ?? 0))
    .slice(0, 6)
    .map((tree) => Object.freeze({ path: tree["path"] ?? null, files: tree["files"] ?? null, loc: tree["loc"] ?? null }));

  return Object.freeze({
    kind: "metroplat.holography.orientation-settlement",
    date: input.date,
    scale: Object.freeze({
      ...(topology === undefined ? {} : {
        modules: topology["files"] ?? null,
        loc: topology["loc"] ?? null,
        sloc: topology["sloc"] ?? null,
        functions: topology["functions"] ?? null,
        classes: topology["classes"] ?? null,
      }),
      ...(fileCensus === undefined ? {} : {
        fileCensusFiles: fileCensus["files"] ?? null,
        fileCensusLoc: fileCensus["loc"] ?? null,
        trees: topTrees,
      }),
    }),
    ...(fleet === undefined ? {} : {
      fleet: Object.freeze({
        sessions: byId.size,
        claims: glued?.["claims"] ?? null,
        regime: glued?.["regime"] ?? null,
        coordination: glued?.["coordination"] ?? null,
        ...(presence === undefined ? {} : {
          live: liveCount,
          liveThresholdSeconds: staleAfterSeconds ?? null,
        }),
        top: topSessions,
      }),
    }),
    adjudication: Object.freeze({
      conflicts: Array.isArray(glued?.["conflicts"]) ? glued["conflicts"] : [],
      obstructions: record(glued?.["coordination"])?.["obstructions"] ?? [],
      held: hookState?.["held"] ?? [],
    }),
    ...(doctrine === undefined ? {} : { doctrine }),
    ...(codex !== undefined && typeof codex["statusline"] === "string" ? { codexLatest: codex["statusline"] } : {}),
    ...(input.failures === undefined || input.failures.length === 0 ? {} : { readingFailures: Object.freeze(input.failures) }),
  });
}

Arbeite auf dem tatsächlich aktuellen Remote-Stand von
`KlausUllrich/numberdroid`.

Verifiziere zuerst ausschließlich über den GitHub-Connector:

- Remote-HEAD und Tree von `main`;
- offene PRs und vorhandene Room-Editor-/A4c-Branches;
- aktuelle GitHub-Actions-Läufe;
- den unveränderten Merge- und post-merge-CI-Status der zuletzt relevanten PRs.

Remote-GitHub-Lese- und Schreiboperationen erfolgen ausschließlich über den
GitHub-Connector.

Lies `AGENTS.md` vollständig und führe den Universal Bootstrap aus. Lies danach
die universelle Reihenfolge und die vorgeschriebenen Rollenrouten. Verwende
QA / Integrator / Release als primäre Route für den aktuellen Verifikations- und
Akzeptanzstand, Coordinator / cross-domain für Sequenzierung und Engineer /
Runtime Developer erst bei einem konkreten akzeptierten Finding oder einer neu
autorisierten Quell-Slice.

Lies anschließend vollständig als aktuellen Task-Snapshot:

`docs/history/handoffs/HANDOFF_2026-09-02_NUMBERDROID_STUDIO_ROOM_EDITOR_REPAIR_COMPLETE.md`

Lies alle darin verlangten Dokumente vollständig und halte Autoritätsgrenzen,
Quellpfade, Akzeptanzzustände, Definition of Done und Testanweisungen exakt ein.

Der Room-Editor-L3-Quellstand einschließlich der Reparaturen aus PR #201 ist
integriert und automatisiert, im Browser und auf Windows grün. VT-001 bleibt
dennoch `REVISE`; insbesondere PR #191 und #192 und die späteren Room-Slices
bleiben bis Klaus' Live-Retest produktseitig nicht akzeptiert. Die getrennten
A4c-Slices für den unveränderlichen Level Candidate und das strikt abgeschwächte
Derived Child sind als VT-014 ausdrücklich seit 2026-09-02 user-accepted. Diese
Akzeptanz gilt nicht für A3a/A4a/A4b und erteilt keine A5-Autorität.

Bereite nur auf konkrete Anforderung den sicheren VT-001-Retest mit den exakt im
Vacation-Test-Backlog beschriebenen frischen Fixtures vor. Prüfe zuerst Fit,
Resize, direkte Palette-Auswahl, wiederholte Platzierung, sicheren Pending-Retry,
Clear und sichtbare Rotation; setze danach die zuvor ungetesteten späteren
Schritte fort. Akzeptanz darf niemals aus CI, Screenshots, Compiler-Ausgabe,
Reviews oder Source-Integration abgeleitet werden.

Beginne ohne neue ausdrückliche Scope-Entscheidung keine A5-/A6-, 2.5D-,
Remote-Backup-/MCP-/Pairing-/HostBinding-/Funnel-, O3-/O4-, Auto-Accept-,
Löschungs-/Aktivierungs-, Produktmaterialisierungs-, Repository-Publikations-
oder Release-Arbeit. EngineBridge bleibt validate-only. Die gewöhnliche Studio
Preview bleibt engine-neutral und read-only.

Jeder Befehl und Test erhält einen expliziten Timeout. Heartbeat spätestens alle
120 Sekunden. CI-Polling alle 30–60 Sekunden, höchstens 20 Minuten; nach zwei
unveränderten Polls diagnostizieren. Integriere nur unveränderte Heads mit allen
durch den tatsächlichen Diff ausgelösten grünen Gates und blockerfreien
unabhängigen Reviews; beobachte post-merge CI vor abhängiger Folgearbeit.

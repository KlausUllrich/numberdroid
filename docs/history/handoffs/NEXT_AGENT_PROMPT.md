Arbeite auf dem tatsächlich aktuellen Remote-Stand von
`KlausUllrich/numberdroid`.

Verifiziere zuerst ausschließlich über den GitHub-Connector:

- Remote-HEAD und Tree von `main`;
- offene PRs und vorhandene Room-Editor-/A4c-Branches;
- aktuelle GitHub-Actions-Läufe;
- Merge- und post-merge-CI-Status von PR #191 und PR #192.

Remote-GitHub-Lese- und Schreiboperationen erfolgen ausschließlich über den
GitHub-Connector.

Lies `AGENTS.md` vollständig und führe den Universal Bootstrap aus. Lies danach
die universelle Reihenfolge und die dort vorgeschriebenen Rollenrouten. Verwende
Engineer / Runtime Developer als primäre Autorenroute, QA / Integrator / Release
für Verifikation/Integration und Coordinator / cross-domain für Sequenzierung.

Lies anschließend vollständig als aktuellen Task-Snapshot:

`docs/history/handoffs/HANDOFF_2026-09-01_NUMBERDROID_STUDIO_ROOM_EDITOR_PREVIEW_NEXT.md`

Lies alle darin verlangten Dokumente vollständig und halte Autoritätsgrenzen,
Quellpfade, Akzeptanzzustände, Definition of Done und Testanweisungen exakt ein.

Setze die verbleibenden Room-Editor-L3-Slices autonom und getrennt fort:

1. Placement-Ghost sowie direktes Auswählen, Verschieben, Drehen und Löschen
   über die bestehenden semantischen Commands;
2. sichtbare Task-Konflikte/Aktionsanforderungen und persistierte Room-Errors
   bereits in Übersichten sowie stabile, lesbare Findings-Navigation;
3. engine-neutrale, read-only Top-down Studio Preview vom exakten
   Room-/Project-Stand.

Die gewöhnliche Preview ist keine Numberdroid-Runtime-Preview. Verwende ein
portables Preview-Szenenmodell. Trenne logischen Footprint strikt von
Ground-Anchor, visuellen Bounds/Offset, Elevation und Überhang. Transparente oder
seitlich dargestellte Assets dürfen visuell über andere Zellen hinausragen, ohne
diese logisch zu belegen. Bereite die Modellgrenze für eine spätere
2.5D/isometrische Projektion vor; der 2.5D-Renderer selbst ist kein aktuelles
Completion Gate. EngineBridge bleibt validate-only und wird nicht für Preview
erweitert.

Nutze großzügig unabhängige Subagenten für Interaction/UX, Security/Authority,
Persistence/Idempotency, Preview-/Rendering-Architektur und tatsächlichen
Test-/CI-Scope. Der Hauptagent liest alle bindenden Dokumente selbst, integriert
die Ergebnisse und prüft den kombinierten Diff.

Jeder Befehl und Test erhält einen expliziten Timeout. Heartbeat spätestens alle
120 Sekunden. CI-Polling alle 30–60 Sekunden, höchstens 20 Minuten; nach zwei
unveränderten Polls diagnostizieren. Sichere wertvolle Arbeit früh als Commit
und Remote-Checkpoint. Integriere nur unveränderte Heads mit vollständig grünen,
durch den tatsächlichen Diff ausgelösten lokalen/CI/Browser-/Windows-Gates und
blockerfreien unabhängigen Reviews. Beobachte post-merge CI vor abhängiger
Folgearbeit.

Keine Remote-Backup-/MCP-/Pairing-/HostBinding-/Funnel-Erweiterung, keine
Löschung/Aktivierung, kein Auto-Accept, kein O3/O4/A5/A6, keine
Produktmaterialisierung, Repository-Publikation oder Release-Autorität.

Nach vollständiger Integration der Room-Editor-Slices aktualisiere Roadmap,
Entwicklungsplan, Status/Backlog und schreibe gemäß
`docs/agents/HANDOFF_PROTOCOL.md` eine neue datierte Abschlussübergabe.
Erst danach A4c unter dessen vollständigem bindenden Dokumentpaket fortsetzen.

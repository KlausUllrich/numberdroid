import { useEffect, useMemo, useState } from "react";
import type { RobotBody } from "../game/types";

type Props = {
  oldBody: RobotBody;
  newBody: RobotBody;
  onComplete: () => void;
};

const STAGES = ["SCAN", "EXTRAKTION", "UPLOAD", "SYNCHRONISATION", "AKTIVIERUNG"] as const;

export function TransferScreen({ oldBody, newBody, onComplete }: Props) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const start = performance.now();
    const timer = window.setInterval(() => {
      const next = Math.min(100, Math.round(((performance.now() - start) / 4300) * 100));
      setProgress(next);
      if (next >= 100) window.clearInterval(timer);
    }, 80);
    return () => window.clearInterval(timer);
  }, [oldBody.id, newBody.id]);

  const stageIndex = Math.min(4, Math.floor((progress / 100) * 5));
  const activated = progress >= 100;
  const status = activated
    ? newBody.abilityId ? `NEUE KÖRPERFÄHIGKEIT FREIGESCHALTET: ${newBody.abilityLabel}` : "NEUER KÖRPER AKTIV."
    : stageIndex < 4 ? "BEWUSSTSEIN WIRD IN DEN NEUEN KÖRPER ÜBERTRAGEN …" : "NEUER KÖRPER WIRD AKTIVIERT …";
  const stageName = activated ? "TRANSFER ERFOLGREICH" : STAGES[stageIndex];
  const stepState = useMemo(() => STAGES.map((_, index) => index <= stageIndex), [stageIndex]);

  return (
    <main className="zk-transfer clean-transfer-screen">
      <div className="zk-transfer-title">KÖRPERTRANSFER</div>
      <div className="zk-transfer-main">
        <section className="zk-transfer-body">
          <header>AKTUELLER KÖRPER · DEIN KÖRPER</header>
          <div className="zk-transfer-robot"><img src={oldBody.sprite} alt={oldBody.name} /></div>
          <div className="zk-transfer-card">
            <b>{oldBody.name}</b><span>{oldBody.bodyClass}</span><strong>{oldBody.abilityLabel}</strong>
          </div>
        </section>

        <section className="zk-transfer-progress" aria-live="polite">
          <small>TRANSFERPROTOKOLL</small>
          <h2>{stageName}</h2>
          <div className="zk-transfer-steps" aria-label={`Schritt ${stageIndex + 1} von 5`}>
            {stepState.map((done, index) => <i key={index} className={done ? "done" : ""}>{index + 1}</i>)}
          </div>
          <div className="zk-transfer-bar" aria-label={`Transfer ${progress} Prozent`}><div style={{ width: `${progress}%` }} /></div>
          <div className="zk-transfer-percent">{progress}%</div>
          <small className="zk-transfer-status">{status}</small>
        </section>

        <section className={`zk-transfer-body new ${activated ? "activated" : ""}`}>
          <header>{activated ? "NEUER KÖRPER · DEIN KÖRPER" : "BESIEGTER ROBOTER · FEINDLICH"}</header>
          <div className="zk-transfer-robot"><img src={newBody.sprite} alt={newBody.name} /></div>
          <div className="zk-transfer-card">
            <b>{newBody.name}</b><span>{newBody.bodyClass}</span><strong>{activated ? `NEU: ${newBody.abilityLabel}` : "FÄHIGKEIT WIRD SYNCHRONISIERT"}</strong>
          </div>
        </section>
      </div>
      <footer className="zk-transfer-footer">
        <button className="zk-transfer-continue" disabled={!activated} onClick={onComplete}>WEITER</button>
      </footer>
    </main>
  );
}

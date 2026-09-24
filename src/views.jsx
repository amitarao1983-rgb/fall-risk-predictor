import { COGNITION, MOBILITY, POSTURE_STEPS, TOILETING, tierMeta } from "./lib/engine.js";

const TIERS = ["red", "orange", "yellow", "green"];

export function Sidebar({ view, live, onLive, onNavigate, alertCount }) {
  const items = [
    ["command", "Command"],
    ["census", "Census"],
    ["alerts", "Alerts"],
    ["rooms", "Rooms"],
    ["assess", "Admission"],
    ["model", "Model"],
  ];
  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="mark">NP</span>
        <div>
          <strong>NeuraPulse</strong>
          <em>Fall prevention</em>
        </div>
      </div>
      <nav>
        {items.map(([id, label]) => (
          <button key={id} className={view === id ? "active" : ""} onClick={() => onNavigate(id)} type="button">
            {label}
            {id === "alerts" && alertCount > 0 ? <span className="badge">{alertCount}</span> : null}
          </button>
        ))}
      </nav>
      <label className="live-toggle">
        <input type="checkbox" checked={live} onChange={(event) => onLive(event.target.checked)} />
        <span>{live ? "Live recalculation on" : "Live recalculation paused"}</span>
      </label>
      <p className="side-note">Synthetic cohort for demonstration. Not a medical device and not for clinical use.</p>
    </aside>
  );
}

export function Topbar({ hospital, now, live, count }) {
  return (
    <header className="topbar">
      <div>
        <p className="kicker">{hospital.name}</p>
        <strong>{hospital.system}</strong>
      </div>
      <div className="top-meta">
        <span>{count} patients matched to room sensors</span>
        <span>{live ? "Event pass every 15s in this demo" : "Live pass paused"}</span>
        <time>{now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</time>
        <span>Next quarter-hour pass {quarterCountdown(now)}</span>
      </div>
    </header>
  );
}

function quarterCountdown(now) {
  const minutes = now.getMinutes();
  const seconds = now.getSeconds();
  const into = (minutes % 15) * 60 + seconds;
  const left = 15 * 60 - into;
  const m = Math.floor(left / 60);
  const s = left % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function Command({ rows, feed, onOpen, onRecalc, onFilter }) {
  const counts = Object.fromEntries(TIERS.map((tier) => [tier, rows.filter((row) => row.result.tier === tier).length]));
  const moving = rows.filter((row) => isUnsafe(row)).length;
  const rising = rows.filter((row) => row.result.when !== "no acute accelerator right now").length;
  return (
    <section className="view">
      <div className="view-head">
        <div>
          <p className="kicker">Continuous fall prevention</p>
          <h1>Four questions, answered from the live ward.</h1>
        </div>
        <button className="primary" type="button" onClick={onRecalc}>
          Recalculate now
        </button>
      </div>
      <div className="q-grid">
        <article>
          <p>Who is at risk?</p>
          <strong>
            {counts.red + counts.orange} patients
          </strong>
          <span>
            {counts.red} critical · {counts.orange} high · {counts.yellow} moderate
          </span>
        </article>
        <article>
          <p>When is risk increasing?</p>
          <strong>{rising} with an active accelerator</strong>
          <span>Sedatives, low blood pressure, post-op, night toileting, or movement intent</span>
        </article>
        <article>
          <p>Is anyone moving unsafely?</p>
          <strong>{moving} unsafe movements</strong>
          <span>Unassisted exit, fall posture, or a long bathroom stay</span>
        </article>
        <article>
          <p>What should the nurse do?</p>
          <strong>Tiered actions, not a raw score</strong>
          <span>Rounds, footwear and low bed, assisted toileting, or bedside now</span>
        </article>
      </div>
      <div className="stat-grid">
        {TIERS.map((tier) => (
          <button key={tier} className={`stat tier-${tier}`} type="button" onClick={() => onFilter(tier)}>
            <span>{tierMeta(tier).label}</span>
            <strong>{counts[tier]}</strong>
            <em>{tierMeta(tier).channel}</em>
          </button>
        ))}
      </div>
      <div className="card dist">
        <header>
          <h2>Risk mix</h2>
          <span>{rows.length} on census</span>
        </header>
        <div className="stackbar" aria-hidden="true">
          {TIERS.map((tier) => (
            <div key={tier} className={`seg tier-${tier}`} style={{ width: `${(counts[tier] / rows.length) * 100}%` }} />
          ))}
        </div>
        <ul className="legend">
          {TIERS.map((tier) => (
            <li key={tier}>
              <i className={`dot tier-${tier}`} />
              {tierMeta(tier).label} {counts[tier]}
            </li>
          ))}
        </ul>
      </div>
      <div className="split">
        <section className="card">
          <header>
            <h2>Needs a nurse first</h2>
          </header>
          <ul className="people">
            {rows.slice(0, 6).map(({ patient, result }) => (
              <li key={patient.id}>
                <button type="button" onClick={() => onOpen(patient.id)}>
                  <TierDot tier={result.tier} />
                  <span>
                    <strong>{patient.name}</strong>
                    <em>
                      {patient.room} · {result.trigger}
                    </em>
                  </span>
                  <b>{result.score}</b>
                </button>
              </li>
            ))}
          </ul>
        </section>
        <section className="card">
          <header>
            <h2>Clinical event feed</h2>
          </header>
          <ul className="feed">
            {feed.map((item) => (
              <li key={item.id}>
                <time>{clock(item.at)}</time>
                <span>{item.text}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </section>
  );
}

function isUnsafe(row) {
  const { patient, result } = row;
  return (
    result.tier === "red" ||
    patient.posture === "fall" ||
    (!patient.assisted && (patient.posture === "standing" || patient.posture === "legs_over")) ||
    (patient.location === "bathroom" && !patient.assisted && patient.bathroomMinutes >= 18)
  );
}

export function Census({ rows, query, tierFilter, unitFilter, units, onQuery, onTier, onUnit, onOpen }) {
  const visible = rows.filter(({ patient, result }) => {
    const hay = `${patient.name} ${patient.mrn} ${patient.room} ${patient.unit} ${patient.nurse}`.toLowerCase();
    if (query.trim() && !hay.includes(query.trim().toLowerCase())) return false;
    if (tierFilter !== "all" && result.tier !== tierFilter) return false;
    if (unitFilter !== "all" && patient.unit !== unitFilter) return false;
    return true;
  });
  return (
    <section className="view">
      <div className="view-head">
        <div>
          <p className="kicker">EMR census</p>
          <h1>{visible.length} patients on this view</h1>
        </div>
      </div>
      <div className="filters">
        <input
          value={query}
          onChange={(event) => onQuery(event.target.value)}
          placeholder="Search name, MRN, room, nurse"
          aria-label="Search patients"
        />
        <select value={unitFilter} onChange={(event) => onUnit(event.target.value)} aria-label="Unit">
          <option value="all">All units</option>
          {units.map((unit) => (
            <option key={unit}>{unit}</option>
          ))}
        </select>
        <div className="chips">
          <button type="button" className={tierFilter === "all" ? "on" : ""} onClick={() => onTier("all")}>
            All
          </button>
          {TIERS.map((tier) => (
            <button key={tier} type="button" className={tierFilter === tier ? "on" : ""} onClick={() => onTier(tier)}>
              {tierMeta(tier).label}
            </button>
          ))}
        </div>
      </div>
      {visible.length === 0 ? (
        <p className="empty">No patients match those filters.</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Patient</th>
                <th>Location</th>
                <th>Score</th>
                <th>Morse</th>
                <th>Posture</th>
                <th>Tier</th>
                <th>Nurse</th>
              </tr>
            </thead>
            <tbody>
              {visible.map(({ patient, result }) => (
                <tr key={patient.id} onClick={() => onOpen(patient.id)}>
                  <td>
                    <strong>{patient.name}</strong>
                    <span>
                      {patient.age}
                      {patient.sex} · {patient.mrn}
                    </span>
                  </td>
                  <td>
                    {patient.room}
                    <span>{patient.unit}</span>
                  </td>
                  <td className="num">{result.score}</td>
                  <td className="num">
                    {result.morse.score}
                    <span>{result.morse.band}</span>
                  </td>
                  <td>{postureLabel(patient)}</td>
                  <td>
                    <TierPill tier={result.tier} />
                  </td>
                  <td>{patient.nurse}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export function Alerts({ rows, acks, onOpen, onAck }) {
  return (
    <section className="view">
      <div className="view-head">
        <div>
          <p className="kicker">Alerting and clinical action</p>
          <h1>Each tier has a channel and a next action.</h1>
        </div>
      </div>
      {TIERS.map((tier) => {
        const group = rows.filter((row) => row.result.tier === tier);
        return (
          <section key={tier} className="tier-block">
            <header>
              <TierPill tier={tier} />
              <span>{tierMeta(tier).channel}</span>
              <em>{group.length}</em>
            </header>
            {group.length === 0 ? <p className="empty">No patients in this tier.</p> : null}
            <div className="alert-grid">
              {group.map(({ patient, result }) => (
                <article key={patient.id} className={acks[patient.id] ? "acked" : ""}>
                  <button type="button" className="plain" onClick={() => onOpen(patient.id)}>
                    <strong>{patient.name}</strong>
                    <span>
                      {patient.room} · {patient.nurse}
                    </span>
                    <em>{result.trigger}</em>
                  </button>
                  <ol>
                    {result.actions.slice(0, 3).map((action) => (
                      <li key={action}>{action}</li>
                    ))}
                  </ol>
                  {acks[patient.id] ? (
                    <p className="acked-note">Acknowledged {clock(acks[patient.id])} · written to the chart</p>
                  ) : (
                    <button type="button" className="ghost" onClick={() => onAck(patient, result)}>
                      Acknowledge and write back
                    </button>
                  )}
                </article>
              ))}
            </div>
          </section>
        );
      })}
    </section>
  );
}

export function Rooms({ rows, onOpen }) {
  const moving = rows.filter(
    ({ patient }) => patient.posture !== "lying" || patient.location === "bathroom"
  );
  const quiet = rows.length - moving.length;
  return (
    <section className="view">
      <div className="view-head">
        <div>
          <p className="kicker">Ambient layer</p>
          <h1>Intent before the feet hit the floor.</h1>
          <p className="lede">
            The sequence is lying, repositioning, sitting, legs over the bed, then standing. Repositioning stays silent.
            A long unassisted bathroom stay escalates on its own.
          </p>
        </div>
      </div>
      <p className="quiet-count">{quiet} patients are lying quietly and are not on this board.</p>
      <div className="room-grid">
        {moving.map(({ patient, result }) => (
          <article key={patient.id} className={`room tier-${result.tier}`}>
            <header>
              <button type="button" onClick={() => onOpen(patient.id)}>
                <strong>{patient.name}</strong>
                <span>
                  {patient.room} · {patient.deviceId}
                </span>
              </button>
              <TierPill tier={result.tier} />
            </header>
            <PostureTrack posture={patient.posture} />
            {patient.posture === "repositioning" ? (
              <p className="suppress">Repositioning only. Exit alarm suppressed.</p>
            ) : (
              <p>{result.moving}</p>
            )}
            {patient.location === "bathroom" ? <BathMeter minutes={patient.bathroomMinutes} assisted={patient.assisted} /> : null}
          </article>
        ))}
      </div>
    </section>
  );
}

export function PatientChart({ row, history, writes, ackedAt, onBack, onAck }) {
  if (!row) {
    return (
      <section className="view">
        <p className="empty">That chart is no longer on the census.</p>
        <button type="button" className="ghost" onClick={onBack}>
          Back
        </button>
      </section>
    );
  }
  const { patient, result } = row;
  const abnormal = abnormalVitals(patient.vitals);
  return (
    <section className="view chart">
      <button type="button" className="textback" onClick={onBack}>
        Back
      </button>
      <div className="chart-hero">
        <div>
          <p className="kicker">
            {patient.unit} · {patient.room} · {patient.deviceId}
          </p>
          <h1>{patient.name}</h1>
          <p className="lede">
            {patient.age}
            {patient.sex} · {patient.weightKg} kg · day {patient.losDays} · {patient.mrn} · {patient.nurse}
          </p>
          <p className="dx">{patient.diagnoses.join(" · ")}</p>
        </div>
        <ScoreRing score={result.score} tier={result.tier} />
      </div>
      <div className="compare">
        <div>
          <span>NeuraPulse index</span>
          <strong>{result.score}</strong>
          <TierPill tier={result.tier} />
          <em>{result.trigger}</em>
        </div>
        <div>
          <span>Morse fall scale</span>
          <strong>{result.morse.score}</strong>
          <em className="band">{result.morse.band} on the manual scale</em>
          <ul>
            {result.morse.reasons.length ? result.morse.reasons.map((reason) => <li key={reason}>{reason}</li>) : <li>No Morse points</li>}
          </ul>
        </div>
        <div>
          <span>Score across this shift</span>
          <Spark values={history || []} tier={result.tier} />
          <em>{result.when}</em>
        </div>
      </div>
      <div className="q-grid slim">
        <article>
          <p>Who</p>
          <strong>{tierMeta(result.tier).headline}</strong>
          <span>{result.parts[0] ? `Largest factor: ${result.parts[0].label}` : "Few risk factors"}</span>
        </article>
        <article>
          <p>When</p>
          <strong>{result.when}</strong>
          <span>Recalculated from the latest vitals, medicines, and posture</span>
        </article>
        <article>
          <p>Moving</p>
          <strong>{result.moving}</strong>
          <span>{patient.assisted ? "Staff are with the patient" : "No staff currently in the room"}</span>
        </article>
        <article>
          <p>Intervention</p>
          <strong>{result.channel}</strong>
          <span>{result.actions[0]}</span>
        </article>
      </div>
      <div className="split">
        <section className="card">
          <header>
            <h2>Why this score</h2>
          </header>
          <ul className="bars">
            {result.parts.map((part) => (
              <li key={part.key}>
                <div>
                  <strong>{part.label}</strong>
                  <span>{part.detail}</span>
                </div>
                <div className="track">
                  <span style={{ width: `${Math.min(100, part.points * 4)}%` }} />
                </div>
                <b>+{part.points}</b>
              </li>
            ))}
          </ul>
          {result.parts.reduce((sum, part) => sum + part.points, 0) > 100 ? (
            <p className="empty">Contributions add past 100. The displayed index stops at 100.</p>
          ) : null}
        </section>
        <section className="card">
          <header>
            <h2>Do this now</h2>
          </header>
          <ol className="actions">
            {result.actions.map((action) => (
              <li key={action}>{action}</li>
            ))}
          </ol>
          {ackedAt ? (
            <p className="acked-note">Charted {clock(ackedAt)}</p>
          ) : (
            <button type="button" className="primary" onClick={() => onAck(patient, result)}>
              Acknowledge and write back
            </button>
          )}
          <h3>Posture track</h3>
          <PostureTrack posture={patient.posture} />
          {patient.location === "bathroom" ? <BathMeter minutes={patient.bathroomMinutes} assisted={patient.assisted} /> : null}
        </section>
      </div>
      <div className="split">
        <section className="card">
          <header>
            <h2>Vitals and labs</h2>
          </header>
          <dl className="vitals">
            <Vital label="SBP" value={`${patient.vitals.sbp}`} unit="mmHg" bad={abnormal.sbp} />
            <Vital label="HR" value={`${patient.vitals.hr}`} unit="bpm" bad={abnormal.hr} />
            <Vital label="SpO2" value={`${patient.vitals.spo2}`} unit="%" bad={abnormal.spo2} />
            <Vital label="Hb" value={`${patient.vitals.hb}`} unit="g/dL" bad={abnormal.hb} />
            <Vital label="Na" value={`${patient.vitals.na}`} unit="mmol/L" bad={abnormal.na} />
            <Vital label="K" value={`${patient.vitals.k}`} unit="mmol/L" bad={abnormal.k} />
            <Vital label="Orthostatic" value={`${patient.vitals.orthostaticDrop}`} unit="mmHg" bad={abnormal.ortho} />
          </dl>
          <h3>Medicines in the fall model</h3>
          <ul className="meds">
            {patient.meds.length === 0 ? <li>None mapped to opioid, sedative, or antihypertensive risk.</li> : null}
            {patient.meds.map((med) => (
              <li key={med.name}>
                <strong>{med.name}</strong>
                <span>{med.class}</span>
                {med.lastDoseMinAgo != null ? <em>{med.lastDoseMinAgo} min ago</em> : null}
              </li>
            ))}
          </ul>
        </section>
        <section className="card">
          <header>
            <h2>Nursing note, normalized</h2>
          </header>
          <blockquote>{patient.rawNote}</blockquote>
          <ul className="mapped">
            <li>
              <span>Cognition</span>
              <strong>{COGNITION[patient.cognition] || patient.cognition}</strong>
            </li>
            <li>
              <span>Mobility</span>
              <strong>{MOBILITY[patient.mobility]}</strong>
            </li>
            <li>
              <span>Toileting</span>
              <strong>{TOILETING[patient.toileting]}</strong>
            </li>
          </ul>
          <h3>EMR write-back</h3>
          {writes.length === 0 ? <p className="empty">Nothing written back yet.</p> : null}
          <ul className="feed">
            {writes.map((entry) => (
              <li key={entry.id}>
                <time>{clock(entry.at)}</time>
                <span>{entry.text}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </section>
  );
}

export function Admission({ form, onChange, onAdd, preview }) {
  const set = (key) => (event) => {
    const target = event.target;
    const value = target.type === "checkbox" ? target.checked : target.value;
    onChange({ ...form, [key]: value });
  };
  return (
    <section className="view">
      <div className="view-head">
        <div>
          <p className="kicker">Predict at admission</p>
          <h1>Score a patient before the first manual Morse form.</h1>
        </div>
      </div>
      <div className="split admit">
        <form
          className="card form"
          onSubmit={(event) => {
            event.preventDefault();
            onAdd();
          }}
        >
          <label>
            Name
            <input value={form.name} onChange={set("name")} placeholder="Patient name" required />
          </label>
          <div className="pair">
            <label>
              Age
              <input type="number" min="18" max="110" value={form.age} onChange={set("age")} required />
            </label>
            <label>
              Sex
              <select value={form.sex} onChange={set("sex")}>
                <option value="F">Female</option>
                <option value="M">Male</option>
              </select>
            </label>
          </div>
          <div className="pair">
            <label>
              Weight kg
              <input type="number" min="30" max="200" value={form.weightKg} onChange={set("weightKg")} />
            </label>
            <label>
              Stay days
              <input type="number" min="0" max="60" value={form.losDays} onChange={set("losDays")} />
            </label>
          </div>
          <label className="check">
            <input type="checkbox" checked={form.historyOfFalls} onChange={set("historyOfFalls")} />
            History of falls
          </label>
          <label>
            Cognition
            <select value={form.cognition} onChange={set("cognition")}>
              <option value="alert">Alert and oriented</option>
              <option value="confused">Confused</option>
              <option value="delirium">Delirium</option>
            </select>
          </label>
          <label>
            Mobility
            <select value={form.mobility} onChange={set("mobility")}>
              {Object.entries(MOBILITY).map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Toileting
            <select value={form.toileting} onChange={set("toileting")}>
              {Object.entries(TOILETING).map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <div className="checks">
            <label className="check">
              <input type="checkbox" checked={form.opioid} onChange={set("opioid")} /> Opioid
            </label>
            <label className="check">
              <input type="checkbox" checked={form.sedative} onChange={set("sedative")} /> Sedative
            </label>
            <label className="check">
              <input type="checkbox" checked={form.antihypertensive} onChange={set("antihypertensive")} /> Antihypertensive
            </label>
          </div>
          <div className="pair">
            <label>
              SBP
              <input type="number" value={form.sbp} onChange={set("sbp")} />
            </label>
            <label>
              HR
              <input type="number" value={form.hr} onChange={set("hr")} />
            </label>
          </div>
          <div className="pair">
            <label>
              SpO2
              <input type="number" value={form.spo2} onChange={set("spo2")} />
            </label>
            <label>
              Hb
              <input type="number" step="0.1" value={form.hb} onChange={set("hb")} />
            </label>
          </div>
          <div className="pair">
            <label>
              Sodium
              <input type="number" value={form.na} onChange={set("na")} />
            </label>
            <label>
              Orthostatic drop
              <input type="number" value={form.orthostaticDrop} onChange={set("orthostaticDrop")} />
            </label>
          </div>
          <label>
            Hours since surgery
            <input type="number" min="0" placeholder="Blank if none" value={form.surgeryHoursAgo} onChange={set("surgeryHoursAgo")} />
          </label>
          <div className="checks">
            <label className="check">
              <input type="checkbox" checked={form.icu} onChange={set("icu")} /> Recent ICU transfer
            </label>
            <label className="check">
              <input type="checkbox" checked={form.nerveBlock} onChange={set("nerveBlock")} /> Nerve block
            </label>
            <label className="check">
              <input type="checkbox" checked={form.assisted} onChange={set("assisted")} /> Staff present
            </label>
          </div>
          <label>
            Posture now
            <select value={form.posture} onChange={set("posture")}>
              {POSTURE_STEPS.map((step) => (
                <option key={step.id} value={step.id}>
                  {step.label}
                </option>
              ))}
              <option value="fall">Fall detected</option>
            </select>
          </label>
          <button className="primary" type="submit">
            Add to census
          </button>
        </form>
        <aside className="card preview">
          <p className="kicker">Live score</p>
          <ScoreRing score={preview.score} tier={preview.tier} />
          <TierPill tier={preview.tier} />
          <p>{preview.trigger}</p>
          <ol className="actions">
            {preview.actions.map((action) => (
              <li key={action}>{action}</li>
            ))}
          </ol>
          <ul className="bars">
            {preview.parts.map((part) => (
              <li key={part.key}>
                <div>
                  <strong>{part.label}</strong>
                  <span>{part.detail}</span>
                </div>
                <b>+{part.points}</b>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </section>
  );
}

export function ModelBrief() {
  return (
    <section className="view model">
      <div className="view-head">
        <div>
          <p className="kicker">How the engine is built</p>
          <h1>EMR features, ambient intent, and a written-back action.</h1>
        </div>
      </div>
      <div className="q-grid">
        {[
          ["1 · Connect", "Read encounters through an HL7 FHIR interface compatible with Epic, Cerner, or MEDITECH."],
          ["2 · Match", "Tie the MRN to the room and bed, then to the sensor, so an alert cannot land on the wrong patient."],
          ["3 · Normalize", "Map local phrases such as “one person assist” onto one mobility feature."],
          ["4 · Write back", "Store the reassessment, the alert, and the nursing action on the chart."],
        ].map(([title, copy]) => (
          <article key={title}>
            <p>{title}</p>
            <strong>{copy}</strong>
          </article>
        ))}
      </div>
      <div className="split">
        <section className="card">
          <header>
            <h2>What the chart contributes</h2>
          </header>
          <table className="plain-table">
            <thead>
              <tr>
                <th>Group</th>
                <th>Examples</th>
                <th>Why it matters</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Demographics</td>
                <td>Age, weight, length of stay</td>
                <td>Baseline frailty</td>
              </tr>
              <tr>
                <td>Medicines</td>
                <td>Opioids, sedatives, antihypertensives, prior falls</td>
                <td>Chemical and orthostatic risk</td>
              </tr>
              <tr>
                <td>Vitals and labs</td>
                <td>Blood pressure, heart rate, SpO2, hemoglobin, sodium, potassium</td>
                <td>Acute dizziness and weakness</td>
              </tr>
              <tr>
                <td>Nursing notes</td>
                <td>Delirium, mobility, toileting</td>
                <td>Impulse control and unassisted trips</td>
              </tr>
              <tr>
                <td>Hospital events</td>
                <td>Surgery, ICU transfer, nerve block, IV lines</td>
                <td>Post-procedure escalation</td>
              </tr>
            </tbody>
          </table>
        </section>
        <section className="card">
          <header>
            <h2>Alert contract</h2>
          </header>
          <table className="plain-table">
            <tbody>
              <tr>
                <td>Green</td>
                <td>Low and stable</td>
                <td>Dashboard · hourly rounds</td>
              </tr>
              <tr>
                <td>Yellow</td>
                <td>Moderate, often after a sedative</td>
                <td>Workstation · non-slip footwear, low bed</td>
              </tr>
              <tr>
                <td>Orange</td>
                <td>High risk, including a move to sitting</td>
                <td>Nurse handset · assisted toileting</td>
              </tr>
              <tr>
                <td>Red</td>
                <td>Unassisted exit, long bathroom stay, or a fall</td>
                <td>Handset plus central alarm · bedside now</td>
              </tr>
            </tbody>
          </table>
          <p className="fine">
            The platform brief cites a Johns Hopkins comparison in which a model of this kind reached AUROC 0.91 against 0.86 for the Morse Fall Scale. That figure is from the cited research, not from these 25 synthetic patients. Morse is shown beside each score so a clinician can see both instruments on the same chart.
          </p>
        </section>
      </div>
    </section>
  );
}

function ScoreRing({ score, tier }) {
  const radius = 52;
  const circ = 2 * Math.PI * radius;
  const offset = circ - (Math.max(0, Math.min(100, score)) / 100) * circ;
  return (
    <svg className={`ring tier-${tier}`} viewBox="0 0 140 140" role="img" aria-label={`Score ${score}`}>
      <circle cx="70" cy="70" r={radius} className="track" />
      <circle cx="70" cy="70" r={radius} className="value" strokeDasharray={circ} strokeDashoffset={offset} />
      <text x="70" y="66" textAnchor="middle">
        {score}
      </text>
      <text x="70" y="86" textAnchor="middle" className="sub">
        {tierMeta(tier).label}
      </text>
    </svg>
  );
}

function Spark({ values, tier }) {
  if (!values?.length) return null;
  const width = 180;
  const height = 48;
  const min = Math.min(...values);
  const max = Math.max(...values, min + 1);
  const d = values
    .map((value, index) => {
      const x = (index / Math.max(1, values.length - 1)) * width;
      const y = height - 4 - ((value - min) / (max - min)) * (height - 10);
      return `${index === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg className={`spark tier-${tier}`} viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Score trend">
      <path d={d} />
    </svg>
  );
}

function PostureTrack({ posture }) {
  const fallen = posture === "fall";
  const index = POSTURE_STEPS.findIndex((step) => step.id === posture);
  return (
    <ol className={`steps ${fallen ? "fallen" : ""}`}>
      {POSTURE_STEPS.map((step, stepIndex) => (
        <li key={step.id} className={fallen || stepIndex <= index ? "done" : ""}>
          {step.label}
        </li>
      ))}
      {fallen ? <li className="done fall">Fall</li> : null}
    </ol>
  );
}

function BathMeter({ minutes, assisted }) {
  const width = Math.min(100, (minutes / 18) * 100);
  return (
    <div className="bath">
      <span>
        Bathroom {minutes} min {assisted ? "· staff present" : "· unassisted"}
      </span>
      <div className="track">
        <span className={minutes >= 18 ? "hot" : ""} style={{ width: `${width}%` }} />
      </div>
      <em>Safety window 18 min</em>
    </div>
  );
}

function TierPill({ tier }) {
  return <span className={`pill tier-${tier}`}>{tierMeta(tier).label}</span>;
}

function TierDot({ tier }) {
  return <i className={`dot tier-${tier}`} />;
}

function Vital({ label, value, unit, bad }) {
  return (
    <div className={bad ? "bad" : ""}>
      <dt>{label}</dt>
      <dd>
        {value} <small>{unit}</small>
      </dd>
    </div>
  );
}

function abnormalVitals(vitals) {
  return {
    sbp: vitals.sbp < 100,
    hr: vitals.hr >= 110 || vitals.hr <= 50,
    spo2: vitals.spo2 < 94,
    hb: vitals.hb < 10,
    na: vitals.na < 134,
    k: vitals.k < 3.2 || vitals.k > 5.4,
    ortho: vitals.orthostaticDrop >= 12,
  };
}

function postureLabel(patient) {
  if (patient.posture === "fall") return "Fall";
  if (patient.location === "bathroom") return `Bathroom · ${patient.bathroomMinutes}m`;
  const step = POSTURE_STEPS.find((item) => item.id === patient.posture);
  return step ? step.label : patient.posture;
}

function clock(iso) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

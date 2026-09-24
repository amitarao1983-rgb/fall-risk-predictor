import { useEffect, useMemo, useRef, useState } from "react";
import { HOSPITAL, PATIENTS } from "./data/patients.js";
import {
  advanceAmbient,
  assess,
  assessmentToPatient,
  emptyAssessment,
  nextClinicalEvent,
  seedHistory,
} from "./lib/engine.js";
import {
  Admission,
  Alerts,
  Census,
  Command,
  ModelBrief,
  PatientChart,
  Rooms,
  Sidebar,
  Topbar,
} from "./views.jsx";

const TIER_RANK = { red: 0, orange: 1, yellow: 2, green: 3 };

function minutesAgo(minutes) {
  return new Date(Date.now() - minutes * 60000).toISOString();
}

export default function App() {
  const [patients, setPatients] = useState(PATIENTS);
  const [view, setView] = useState("command");
  const [returnView, setReturnView] = useState("census");
  const [selectedId, setSelectedId] = useState(null);
  const [query, setQuery] = useState("");
  const [tierFilter, setTierFilter] = useState("all");
  const [unitFilter, setUnitFilter] = useState("all");
  const [live, setLive] = useState(true);
  const [now, setNow] = useState(() => new Date());
  const [acks, setAcks] = useState({});
  const [histories, setHistories] = useState(() =>
    Object.fromEntries(PATIENTS.map((patient) => [patient.id, seedHistory(patient)]))
  );
  const [feed, setFeed] = useState(() => [
    { id: "f4", at: minutesAgo(4), text: "220-B · Legs over the bed · unassisted exit" },
    { id: "f3", at: minutesAgo(6), text: "427-A · Fall posture in the bathroom · critical alarm" },
    { id: "f2", at: minutesAgo(17), text: "Patient, room, and sensor IDs matched" },
    { id: "f1", at: minutesAgo(18), text: "FHIR sync complete · 25 inpatient encounters" },
  ]);
  const [writes, setWrites] = useState(() => [
    {
      id: "w1",
      patientId: "p17",
      at: minutesAgo(6),
      text: "Critical fall alarm written to the chart. Bathroom floor contact. Central station notified.",
    },
    {
      id: "w2",
      patientId: "p02",
      at: minutesAgo(4),
      text: "Bed-exit escalation written to the chart. Legs over the side, no staff in the room.",
    },
  ]);
  const [form, setForm] = useState(emptyAssessment);
  const patientsRef = useRef(patients);
  patientsRef.current = patients;
  const runPassRef = useRef(null);

  const assessed = useMemo(
    () =>
      patients
        .map((patient) => ({ patient, result: assess(patient) }))
        .sort((a, b) => TIER_RANK[a.result.tier] - TIER_RANK[b.result.tier] || b.result.score - a.result.score),
    [patients]
  );

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  function pushFeed(text, patient) {
    setFeed((items) => [{ id: crypto.randomUUID(), at: new Date().toISOString(), text }, ...items].slice(0, 14));
    if (!patient) return;
    setHistories((prev) => {
      const score = assess(patient).score;
      const series = prev[patient.id] || [score];
      if (series[series.length - 1] === score) return prev;
      return { ...prev, [patient.id]: [...series.slice(-11), score] };
    });
  }

  function runPass() {
    const ambient = advanceAmbient(patientsRef.current);
    const event = nextClinicalEvent(ambient);
    const nextPatients = event ? event.patients : ambient;
    const changed = event?.patients.find((patient) => patient.id === event.patientId);
    if (event) pushFeed(event.message, changed);
    else pushFeed("Scheduled pass complete · no new clinical delta");
    setPatients(nextPatients);
  }

  runPassRef.current = runPass;

  useEffect(() => {
    if (!live) return undefined;
    const id = setInterval(() => runPassRef.current?.(), 15000);
    return () => clearInterval(id);
  }, [live]);

  function openPatient(id) {
    if (!id) return;
    setReturnView(view === "chart" ? returnView : view);
    setSelectedId(id);
    setView("chart");
  }

  function acknowledge(patient, result) {
    setAcks((current) => ({ ...current, [patient.id]: new Date().toISOString() }));
    setWrites((current) => [
      {
        id: crypto.randomUUID(),
        patientId: patient.id,
        at: new Date().toISOString(),
        text: `${result.tier.toUpperCase()} alert acknowledged on ${result.channel}. ${result.actions[0]}.`,
      },
      ...current,
    ]);
    pushFeed(`${patient.room} · ${patient.name.split(" ")[0]} alert acknowledged`);
  }

  function addAdmission() {
    const patient = assessmentToPatient(form);
    setPatients((current) => [patient, ...current]);
    setHistories((current) => ({ ...current, [patient.id]: seedHistory(patient) }));
    setForm(emptyAssessment());
    pushFeed(`Admission scored · ${patient.name} added to the census`, patient);
    openPatient(patient.id);
  }

  const selected = assessed.find((row) => row.patient.id === selectedId) || null;
  const units = [...new Set(patients.map((patient) => patient.unit))];

  return (
    <div className="app">
      <Sidebar
        view={view}
        live={live}
        onLive={setLive}
        onNavigate={(next) => setView(next)}
        alertCount={assessed.filter((row) => (row.result.tier === "red" || row.result.tier === "orange") && !acks[row.patient.id]).length}
      />
      <div className="main">
        <Topbar hospital={HOSPITAL} now={now} live={live} count={patients.length} />
        {view === "command" && (
          <Command
            rows={assessed}
            feed={feed}
            onOpen={openPatient}
            onRecalc={runPass}
            onFilter={(tier) => {
              setTierFilter(tier);
              setUnitFilter("all");
              setQuery("");
              setView("census");
            }}
          />
        )}
        {view === "census" && (
          <Census
            rows={assessed}
            query={query}
            tierFilter={tierFilter}
            unitFilter={unitFilter}
            units={units}
            onQuery={setQuery}
            onTier={setTierFilter}
            onUnit={setUnitFilter}
            onOpen={openPatient}
          />
        )}
        {view === "alerts" && <Alerts rows={assessed} acks={acks} onOpen={openPatient} onAck={acknowledge} />}
        {view === "rooms" && <Rooms rows={assessed} onOpen={openPatient} />}
        {view === "assess" && (
          <Admission form={form} onChange={setForm} onAdd={addAdmission} preview={assess(assessmentToPatient(form))} />
        )}
        {view === "model" && <ModelBrief />}
        {view === "chart" && (
          <PatientChart
            row={selected}
            history={selected ? histories[selected.patient.id] : []}
            writes={writes.filter((entry) => entry.patientId === selectedId)}
            ackedAt={selected ? acks[selected.patient.id] : null}
            onBack={() => setView(returnView)}
            onAck={acknowledge}
          />
        )}
      </div>
    </div>
  );
}

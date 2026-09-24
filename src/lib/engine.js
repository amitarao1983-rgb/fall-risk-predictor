/** Explainable fall-risk index derived from the NeuraPulse EMR feature set. */

export const POSTURE_STEPS = [
  { id: "lying", label: "Lying" },
  { id: "repositioning", label: "Repositioning" },
  { id: "sitting", label: "Sitting" },
  { id: "legs_over", label: "Legs over bed" },
  { id: "standing", label: "Standing" },
];

export const MOBILITY = {
  independent: "Independent",
  assist_x1: "Assist ×1",
  assist_x2: "Assist ×2",
  unsteady: "Unsteady gait",
  impulsive_bedbound: "Impulsive, limited mobility",
};

export const TOILETING = {
  independent: "Independent toileting",
  assist: "Needs toileting assist",
  urgency: "Urinary urgency",
  night: "Nocturnal toileting pattern",
};

export const COGNITION = {
  alert: "Alert and oriented",
  confused: "Confused",
  delirium: "Delirium (CAM+)",
};

const TIER_META = {
  green: {
    label: "Low",
    channel: "EHR patient dashboard",
    headline: "Stable baseline",
  },
  yellow: {
    label: "Moderate",
    channel: "Nurse workstation",
    headline: "Risk rising",
  },
  orange: {
    label: "High",
    channel: "Assigned nurse handset",
    headline: "High fall risk",
  },
  red: {
    label: "Critical",
    channel: "Handset and central alarm",
    headline: "Immediate response",
  },
};

export function tierMeta(tier) {
  return TIER_META[tier];
}

function recentSedative(patient) {
  return (patient.meds || []).some(
    (med) => med.class === "sedative" && med.lastDoseMinAgo != null && med.lastDoseMinAgo <= 90
  );
}

export function assess(patient) {
  const parts = [];
  const add = (key, label, points, detail) => {
    if (points > 0) parts.push({ key, label, points, detail });
  };

  if (patient.age >= 85) add("age", "Age", 12, `${patient.age} years`);
  else if (patient.age >= 75) add("age", "Age", 8, `${patient.age} years`);
  else if (patient.age >= 65) add("age", "Age", 4, `${patient.age} years`);

  if (patient.weightKg < 48) add("weight", "Low admission weight", 4, `${patient.weightKg} kg`);
  if (patient.losDays >= 10) add("los", "Length of stay", 4, `${patient.losDays} days`);
  else if (patient.losDays >= 5) add("los", "Length of stay", 2, `${patient.losDays} days`);

  if (patient.historyOfFalls) {
    add(
      "falls",
      "Past fall history",
      patient.fallCount >= 2 ? 16 : 12,
      patient.fallCount ? `${patient.fallCount} prior fall${patient.fallCount > 1 ? "s" : ""}` : "Documented"
    );
  }

  const meds = patient.meds || [];
  const byClass = (name) => meds.filter((med) => med.class === name);
  const opioids = byClass("opioid");
  const sedatives = byClass("sedative");
  const antihtn = byClass("antihypertensive");
  if (opioids.length) add("opioid", "Opioid", 8, opioids.map((med) => med.name).join(", "));
  if (sedatives.length) add("sedative", "Sedative", 10, sedatives.map((med) => med.name).join(", "));
  if (antihtn.length) add("antihtn", "Antihypertensive", 6, antihtn.map((med) => med.name).join(", "));
  const riskClasses = new Set(
    meds.filter((med) => ["opioid", "sedative", "antihypertensive"].includes(med.class)).map((med) => med.class)
  );
  if (riskClasses.size >= 2) add("poly", "High-risk polypharmacy", 4, `${riskClasses.size} fall-risk classes`);
  if (recentSedative(patient)) add("recentsed", "Recent sedative dose", 7, "Given within 90 minutes");

  const vitals = patient.vitals;
  if (vitals.sbp < 90) add("sbp", "Hypotension", 14, `SBP ${vitals.sbp} mmHg`);
  else if (vitals.sbp < 100) add("sbp", "Low systolic pressure", 8, `SBP ${vitals.sbp} mmHg`);
  if (vitals.orthostaticDrop >= 20) add("ortho", "Orthostatic drop", 8, `${vitals.orthostaticDrop} mmHg`);
  else if (vitals.orthostaticDrop >= 12) add("ortho", "Orthostatic drop", 5, `${vitals.orthostaticDrop} mmHg`);
  if (vitals.hr >= 120 || vitals.hr <= 48) add("hr", "Extreme heart rate", 4, `HR ${vitals.hr}`);
  if (vitals.spo2 < 92) add("spo2", "Low oxygen saturation", 6, `SpO2 ${vitals.spo2}%`);
  else if (vitals.spo2 < 94) add("spo2", "Borderline saturation", 3, `SpO2 ${vitals.spo2}%`);
  if (vitals.hb < 8) add("hb", "Severe anemia", 7, `Hb ${vitals.hb} g/dL`);
  else if (vitals.hb < 10) add("hb", "Anemia", 4, `Hb ${vitals.hb} g/dL`);
  if (vitals.na < 130) add("na", "Hyponatremia", 6, `Na ${vitals.na} mmol/L`);
  else if (vitals.na < 134) add("na", "Low sodium", 3, `Na ${vitals.na} mmol/L`);
  if (vitals.k < 3.2 || vitals.k > 5.4) add("k", "Potassium imbalance", 3, `K ${vitals.k} mmol/L`);

  if (patient.cognition === "delirium") add("cog", "Delirium", 12, "CAM positive");
  else if (patient.cognition === "confused") add("cog", "Confusion", 7, "Disoriented");

  const mobilityPoints = { independent: 0, assist_x1: 5, assist_x2: 9, unsteady: 8, impulsive_bedbound: 10 };
  add("mob", "Mobility", mobilityPoints[patient.mobility] || 0, MOBILITY[patient.mobility] || patient.mobility);

  const toiletPoints = { independent: 0, assist: 4, urgency: 7, night: 6 };
  add("toi", "Toileting", toiletPoints[patient.toileting] || 0, TOILETING[patient.toileting] || patient.toileting);

  const events = patient.events || {};
  if (events.surgeryHoursAgo != null && events.surgeryHoursAgo <= 12) {
    add("surg", "Recent surgery", 10, `${events.surgeryHoursAgo}h post-op`);
  } else if (events.surgeryHoursAgo != null && events.surgeryHoursAgo <= 48) {
    add("surg", "Post-operative state", 5, `${events.surgeryHoursAgo}h post-op`);
  }
  if (events.icuTransferHoursAgo != null && events.icuTransferHoursAgo <= 24) {
    add("icu", "Recent ICU transfer", 8, `${events.icuTransferHoursAgo}h ago`);
  }
  if (events.nerveBlock) add("block", "Active nerve block", 7, "Limb block in effect");
  if (events.ivLines >= 2) add("iv", "IV tethers", 5, `${events.ivLines} lines`);
  else if (events.ivLines === 1) add("iv", "IV line", 2, "1 line");

  const posturePoints = { lying: 0, repositioning: 3, sitting: 8, legs_over: 14, standing: 18, fall: 24 };
  const postureLabels = {
    lying: "Lying",
    repositioning: "Repositioning in bed",
    sitting: "Sitting on bed edge",
    legs_over: "Legs over the side",
    standing: "Standing",
    fall: "Fall detected",
  };
  add("posture", "Ambient posture", posturePoints[patient.posture] || 0, postureLabels[patient.posture] || patient.posture);

  if (patient.location === "bathroom") {
    if (patient.bathroomMinutes >= 18) add("bath", "Prolonged bathroom stay", 12, `${patient.bathroomMinutes} min`);
    else if (patient.bathroomMinutes >= 8) add("bath", "Bathroom duration", 6, `${patient.bathroomMinutes} min`);
    else add("bath", "Bathroom entry", 2, `${patient.bathroomMinutes} min`);
  }

  const score = Math.max(0, Math.min(100, parts.reduce((sum, part) => sum + part.points, 0)));
  const tier = resolveTier(patient, score);
  const morse = morseScore(patient);

  return {
    score,
    tier,
    parts: parts.sort((a, b) => b.points - a.points),
    morse,
    actions: actionsFor(patient, tier),
    trigger: triggerFor(patient, tier),
    channel: TIER_META[tier].channel,
    moving: movingSummary(patient),
    when: whenSummary(patient, score),
  };
}

function resolveTier(patient, score) {
  const alone = !patient.assisted;
  if (patient.posture === "fall") return "red";
  if (alone && (patient.posture === "standing" || patient.posture === "legs_over")) return "red";
  if (patient.location === "bathroom" && alone && patient.bathroomMinutes >= 18) return "red";
  if (score >= 55) return "orange";
  if (score >= 28 || recentSedative(patient)) return "yellow";
  return "green";
}

export function morseScore(patient) {
  let score = 0;
  const reasons = [];
  if (patient.historyOfFalls) {
    score += 25;
    reasons.push("History of falling +25");
  }
  if ((patient.diagnoses || []).length > 1) {
    score += 15;
    reasons.push("Secondary diagnosis +15");
  }
  if (patient.mobility === "assist_x2" || patient.mobility === "impulsive_bedbound") {
    score += 30;
    reasons.push("Furniture / two-person aid +30");
  } else if (patient.mobility === "assist_x1" || patient.mobility === "unsteady") {
    score += 15;
    reasons.push("Walking aid or unsteady gait +15");
  }
  if ((patient.events?.ivLines || 0) > 0) {
    score += 20;
    reasons.push("IV or heparin lock +20");
  }
  if (patient.mobility === "unsteady" || patient.mobility === "impulsive_bedbound") {
    score += 20;
    reasons.push("Impaired gait +20");
  } else if (patient.mobility === "assist_x1" || patient.mobility === "assist_x2") {
    score += 10;
    reasons.push("Weak gait +10");
  }
  if (patient.cognition === "delirium" || patient.cognition === "confused") {
    score += 15;
    reasons.push("Forgets limitations +15");
  }
  const band = score >= 45 ? "High" : score >= 25 ? "Medium" : "Low";
  return { score, band, reasons };
}

function actionsFor(patient, tier) {
  const base = {
    green: ["Continue standard hourly nursing rounds", "Keep call bell in reach"],
    yellow: ["Apply non-slip footwear", "Set low bed height"],
    orange: [
      "Start scheduled assisted toileting",
      "Arm ambient exit monitoring",
      "Request a physiotherapy review",
      "Keep bed at the lowest safe height",
    ],
    red: [
      "Go to the bedside now",
      "Sound the central station alarm",
      "Stay with the patient until they are safe",
      "Write the event back to the chart",
    ],
  }[tier];

  const extra = [];
  if (patient.location === "bathroom" && !patient.assisted) extra.push("Check the bathroom immediately");
  if (recentSedative(patient)) extra.push("Reassess when the sedative effect peaks");
  if (patient.cognition === "delirium") extra.push("Use a calm reorientation approach before mobilizing");
  if ((patient.vitals?.orthostaticDrop || 0) >= 12 || patient.vitals?.sbp < 100) {
    extra.push("Measure lying and standing blood pressure before walking");
  }
  if (patient.events?.surgeryHoursAgo != null && patient.events.surgeryHoursAgo <= 24) {
    extra.push("First walk only with staff assist");
  }
  return [...base, ...extra].slice(0, 5);
}

function triggerFor(patient, tier) {
  if (patient.posture === "fall") return "Fall detected on ambient sensors";
  if (!patient.assisted && patient.posture === "standing") return "Unassisted stand detected";
  if (!patient.assisted && patient.posture === "legs_over") return "Unassisted bed-exit sequence";
  if (patient.location === "bathroom" && !patient.assisted && patient.bathroomMinutes >= 18) {
    return `Bathroom stay ${patient.bathroomMinutes} min past the safety window`;
  }
  if (tier === "orange" && patient.posture === "sitting") return "High risk and posture shifted to sitting";
  if (tier === "orange") return "High clinical risk on the latest recalculation";
  if (recentSedative(patient)) return "Moderate risk after sedative dosing";
  if (tier === "yellow") return "Moderate risk from EMR features";
  return "Low baseline risk with stable vitals and mobility";
}

function movingSummary(patient) {
  if (patient.posture === "fall") return "Fall posture on the floor sensor";
  if (patient.location === "bathroom") {
    return patient.assisted
      ? `In bathroom with staff · ${patient.bathroomMinutes} min`
      : `In bathroom alone · ${patient.bathroomMinutes} min`;
  }
  const step = POSTURE_STEPS.find((item) => item.id === patient.posture);
  const assist = patient.assisted ? "staff present" : "no staff in the room";
  return `${step ? step.label : patient.posture} · ${assist}`;
}

function whenSummary(patient, score) {
  const reasons = [];
  if (patient.posture === "fall") reasons.push("a fall is in progress");
  if (recentSedative(patient)) reasons.push("sedative given this hour");
  if (patient.vitals.sbp < 100) reasons.push("blood pressure is low");
  if (patient.events?.surgeryHoursAgo != null && patient.events.surgeryHoursAgo <= 12) reasons.push("early post-op window");
  if (patient.toileting === "night") reasons.push("night toileting window");
  if (patient.posture === "sitting" || patient.posture === "legs_over" || patient.posture === "standing") {
    reasons.push("movement intent is active");
  }
  if (!reasons.length) reasons.push(score >= 55 ? "score is in the high band" : "no acute accelerator right now");
  return reasons.join(" · ");
}

export function seedHistory(patient) {
  const { score } = assess(patient);
  const points = [];
  let value = Math.max(4, score - 16);
  for (let index = 0; index < 7; index += 1) {
    const drift = ((index * 5 + patient.age) % 7) - 3;
    value = Math.max(0, Math.min(100, Math.round(value + (score - value) * 0.32 + drift)));
    points.push(value);
  }
  points.push(score);
  return points;
}

let eventCursor = 0;

const LIVE_EVENTS = [
  {
    roomMatch: (patient) => patient.posture === "lying" && patient.tierHint !== "green",
    apply(patient) {
      return {
        ...patient,
        posture: "repositioning",
        note: "Edge model: repositioning, not a bed exit. Alarm suppressed.",
      };
    },
    message: (patient) => `${patient.room} · Repositioning distinguished from bed exit`,
  },
  {
    roomMatch: (patient) => patient.posture === "repositioning",
    apply(patient) {
      return { ...patient, posture: "sitting", assisted: false };
    },
    message: (patient) => `${patient.room} · Posture advanced to sitting`,
  },
  {
    roomMatch: (patient) => patient.meds?.some((med) => med.class === "sedative"),
    apply(patient) {
      return {
        ...patient,
        meds: patient.meds.map((med) =>
          med.class === "sedative" ? { ...med, lastDoseMinAgo: 12 } : med
        ),
      };
    },
    message: (patient) => `${patient.room} · Sedative dose charted · score refresh`,
  },
  {
    roomMatch: (patient) => patient.vitals.sbp >= 108,
    apply(patient) {
      return { ...patient, vitals: { ...patient.vitals, sbp: patient.vitals.sbp - 16 } };
    },
    message: (patient) => `${patient.room} · Systolic pressure fell 16 mmHg`,
  },
  {
    roomMatch: (patient) => patient.location !== "bathroom" && patient.posture === "lying",
    apply(patient) {
      return { ...patient, location: "bathroom", bathroomMinutes: 4, posture: "standing", assisted: true };
    },
    message: (patient) => `${patient.room} · Assisted bathroom entry`,
  },
];

export function nextClinicalEvent(patients) {
  for (let attempt = 0; attempt < LIVE_EVENTS.length; attempt += 1) {
    const event = LIVE_EVENTS[(eventCursor + attempt) % LIVE_EVENTS.length];
    const index = patients.findIndex((patient) => !patient.pinned && event.roomMatch(patient));
    if (index === -1) continue;
    eventCursor = (eventCursor + attempt + 1) % LIVE_EVENTS.length;
    const current = patients[index];
    const next = event.apply(current);
    const copy = patients.slice();
    copy[index] = next;
    return { patients: copy, message: event.message(next), patientId: current.id };
  }
  return null;
}

export function advanceAmbient(patients) {
  return patients.map((patient) => {
    if (patient.location !== "bathroom" || patient.assisted || patient.pinned) return patient;
    return { ...patient, bathroomMinutes: patient.bathroomMinutes + 1 };
  });
}

export function emptyAssessment() {
  return {
    name: "",
    age: 76,
    sex: "F",
    weightKg: 62,
    losDays: 1,
    historyOfFalls: false,
    fallCount: 0,
    cognition: "alert",
    mobility: "unsteady",
    toileting: "assist",
    opioid: false,
    sedative: false,
    antihypertensive: true,
    sbp: 128,
    hr: 78,
    spo2: 97,
    hb: 12.4,
    na: 138,
    k: 4.1,
    orthostaticDrop: 0,
    surgeryHoursAgo: "",
    icu: false,
    nerveBlock: false,
    ivLines: 0,
    posture: "lying",
    location: "bed",
    bathroomMinutes: 0,
    assisted: true,
  };
}

export function assessmentToPatient(form) {
  const meds = [];
  if (form.opioid) meds.push({ name: "Morphine", class: "opioid", lastDoseMinAgo: 60 });
  if (form.sedative) meds.push({ name: "Lorazepam", class: "sedative", lastDoseMinAgo: 30 });
  if (form.antihypertensive) meds.push({ name: "Amlodipine", class: "antihypertensive", lastDoseMinAgo: 180 });
  const surgery = form.surgeryHoursAgo === "" || form.surgeryHoursAgo == null ? null : Number(form.surgeryHoursAgo);
  return {
    id: `new-${Date.now()}`,
    mrn: `MRN-${String(Date.now()).slice(-6)}`,
    name: form.name.trim() || "New admission",
    age: Number(form.age),
    sex: form.sex,
    weightKg: Number(form.weightKg),
    losDays: Number(form.losDays) || 0,
    unit: "Admissions",
    room: "Pending",
    bed: "A",
    deviceId: "Unpaired",
    nurse: "Unassigned",
    diagnoses: ["Admission assessment"],
    meds,
    historyOfFalls: Boolean(form.historyOfFalls),
    fallCount: form.historyOfFalls ? Number(form.fallCount) || 1 : 0,
    vitals: {
      sbp: Number(form.sbp),
      dbp: 70,
      hr: Number(form.hr),
      spo2: Number(form.spo2),
      hb: Number(form.hb),
      na: Number(form.na),
      k: Number(form.k),
      orthostaticDrop: Number(form.orthostaticDrop) || 0,
    },
    cognition: form.cognition,
    mobility: form.mobility,
    toileting: form.toileting,
    events: {
      surgeryHoursAgo: Number.isFinite(surgery) ? surgery : null,
      icuTransferHoursAgo: form.icu ? 6 : null,
      nerveBlock: Boolean(form.nerveBlock),
      ivLines: Number(form.ivLines) || 0,
    },
    posture: form.posture,
    location: form.location,
    bathroomMinutes: Number(form.bathroomMinutes) || 0,
    assisted: Boolean(form.assisted),
    rawNote: "Entered on the admission predictor. Terms normalized to the shared feature set.",
    pinned: false,
  };
}

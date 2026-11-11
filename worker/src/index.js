// Busy-only schedule endpoint. No titles, locations, or attendees ever leave this file.
import ICAL from "ical.js";
import { EmailMessage } from "cloudflare:email";

const ALLOWED_ORIGINS = ["https://danielxie.com", "https://www.danielxie.com"];
const ZONE = "America/New_York";
const OPEN_MIN = 9 * 60, CLOSE_MIN = 21 * 60, DAYS = 7;
const STUDIO_URL = "https://claude.ai/artifact/73tgC5rcgY6QGii8PTCCoF";
const DEFAULT_PASSCODE_HASH = "79b9f10f0712ad8032d0bb38925eba0b2ed148bf1e0abb2e8cbdf8b26ae75101";

const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: ZONE, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
function wall(ms) {
  const p = {}; fmt.formatToParts(new Date(ms)).forEach((x) => { p[x.type] = x.value; });
  return { date: `${p.year}-${p.month}-${p.day}`, min: +p.hour * 60 + +p.minute };
}
function addDays(date, n) {
  const d = new Date(date + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10);
}
// Calendar titles stop here. Visitors only ever see one of these friendly labels.
const LABELS = [
  [/^(COM|CHNS|ASAM|FLM)\b|\b(class|lecture|lec|lab|exam|quiz)\b/i, "In class"],
  [/\bCASA\b|\bSASE\b/i, "CASA stuff"],
  [/\b(lunch|dinner|breakfast|brunch|food|eat|eating)\b/i, "Eating"],
  [/\b(sleep|nap)\b/i, "Sleeping"],
  [/\b(gym|workout|lift)\b/i, "At the gym"],
  [/chamberstone|lazy dog|chubby taco|biang|bryant park|lobster pot|seapark|munchy|influencer|toast/i, "Running the shop"],
];
function labelFor(comp) {
  const title = String(comp.getFirstPropertyValue("summary") || "");
  const hit = LABELS.find(([re]) => re.test(title));
  return hit ? hit[1] : "Busy";
}
function isFree(comp) {
  const transp = String(comp.getFirstPropertyValue("transp") || "").toUpperCase();
  const status = String(comp.getFirstPropertyValue("status") || "").toUpperCase();
  const ms = String(comp.getFirstPropertyValue("x-microsoft-cdo-busystatus") || "").toUpperCase();
  return transp === "TRANSPARENT" || status === "CANCELLED" || ms === "FREE";
}

export function busyFromIcs(text, nowMs) {
  const root = new ICAL.Component(ICAL.parse(text));
  root.getAllSubcomponents("vtimezone").forEach((v) => {
    const tz = new ICAL.Timezone(v);
    if (tz.tzid && !ICAL.TimezoneService.has(tz.tzid)) ICAL.TimezoneService.register(tz.tzid, tz);
  });
  const start = wall(nowMs).date;
  const startMs = nowMs - 36 * 3600000, stopMs = nowMs + (DAYS + 2) * 86400000;
  const blocks = [];
  const vevents = root.getAllSubcomponents("vevent");
  const overrides = vevents.filter((c) => c.hasProperty("recurrence-id"));
  const add = (s, e, comp) => {
    if (s.isDate || isFree(comp)) return; // all-day and "free" entries don't block meetings
    const a = s.toJSDate().getTime(), b = e.toJSDate().getTime();
    if (b > startMs && a < stopMs) blocks.push([a, b, labelFor(comp)]);
  };
  vevents.filter((c) => !c.hasProperty("recurrence-id")).forEach((comp) => {
    const ev = new ICAL.Event(comp);
    overrides.filter((o) => o.getFirstPropertyValue("uid") === ev.uid).forEach((o) => ev.relateException(o));
    if (!ev.isRecurring()) { add(ev.startDate, ev.endDate, comp); return; }
    const it = ev.iterator(); let next, guard = 0;
    while ((next = it.next()) && guard++ < 5000) {
      if (next.toJSDate().getTime() > stopMs) break;
      const d = ev.getOccurrenceDetails(next);
      add(d.startDate, d.endDate, d.item.component);
    }
  });
  const days = {};
  for (let i = 0; i < DAYS; i++) days[addDays(start, i)] = [];
  blocks.forEach(([a, b, label]) => {
    const wa = wall(a), wb = wall(b);
    Object.keys(days).forEach((date) => {
      const from = wa.date < date ? 0 : wa.date === date ? wa.min : null;
      const to = wb.date > date ? 1440 : wb.date === date ? wb.min : null;
      if (from === null || to === null) return;
      const s = Math.max(from, OPEN_MIN), e = Math.min(to, CLOSE_MIN);
      if (e > s) days[date].push([s, e, label]);
    });
  });
  return Object.keys(days).map((date) => {
    const merged = [];
    days[date].sort((x, y) => x[0] - y[0]).forEach(([s, e, label]) => {
      const last = merged[merged.length - 1];
      if (last && s <= last[1] && label === last[2]) last[1] = Math.max(last[1], e); else merged.push([s, e, label]);
    });
    return { date, busy: merged.map(([s, e, label]) => ({ start: s, end: e, label })) };
  });
}

async function sha256(value) {
  const bytes = new TextEncoder().encode(String(value).trim().toLowerCase());
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ---- Bookings: a picked slot becomes an Outlook invite in Daniel's inbox, which Outlook drops on his calendar. ----
const clean = (v, max) => String(v == null ? "" : v).replace(/[\u0000-\u001f\u007f]+/g, " ").trim().slice(0, max);
const icsText = (v) => v.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
const stamp = (ms) => new Date(ms).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const EMAIL_RE = /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/;
// Find the UTC instant for a New York wall-clock date + minutes (handles daylight saving).
function utcFor(date, min) {
  let guess = Date.parse(date + "T00:00:00Z") + min * 60000 + 5 * 3600000;
  for (let i = 0; i < 3; i++) {
    const w = wall(guess);
    const diff = (Date.parse(date + "T00:00:00Z") - Date.parse(w.date + "T00:00:00Z")) / 60000 + (min - w.min);
    if (!diff) break;
    guess += diff * 60000;
  }
  return guess;
}
function fold(line) {
  const out = []; let rest = line;
  while (rest.length > 74) { out.push(rest.slice(0, 74)); rest = " " + rest.slice(74); }
  out.push(rest); return out.join("\r\n");
}
function inviteIcs({ uid, startMs, endMs, from, to, name, email, topic }) {
  const desc = `Booked from danielxie.com/availability\nName: ${name}\nEmail: ${email}\nAbout: ${topic || "(not given)"}`;
  return [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//danielxie.com//schedule//EN", "METHOD:REQUEST", "BEGIN:VEVENT",
    `UID:${uid}`, `DTSTAMP:${stamp(Date.now())}`, `DTSTART:${stamp(startMs)}`, `DTEND:${stamp(endMs)}`,
    `SUMMARY:${icsText("Meeting with " + name)}`, `DESCRIPTION:${icsText(desc)}`,
    `ORGANIZER;CN=danielxie.com:mailto:${from}`,
    `ATTENDEE;CN=Daniel Xie;ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE:mailto:${to}`,
    "STATUS:CONFIRMED", "TRANSP:OPAQUE", "SEQUENCE:0",
    "BEGIN:VALARM", "ACTION:DISPLAY", "DESCRIPTION:Meeting from your schedule page", "TRIGGER:-PT15M", "END:VALARM",
    "END:VEVENT", "END:VCALENDAR", "",
  ].map(fold).join("\r\n");
}
function mime({ from, to, replyTo, subject, text, ics }) {
  const b = "b_" + crypto.randomUUID().replace(/-/g, "");
  const b64 = (str) => btoa(String.fromCharCode(...new TextEncoder().encode(str))).replace(/.{76}/g, "$&\r\n");
  return [
    `From: Daniel's schedule <${from}>`, `To: ${to}`, `Reply-To: ${replyTo}`,
    `Subject: =?UTF-8?B?${b64(subject).replace(/\r\n/g, "")}?=`, `Date: ${new Date().toUTCString()}`,
    `Message-ID: <${crypto.randomUUID()}@${from.split("@")[1]}>`, "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${b}"`, "",
    `--${b}`, "Content-Type: text/plain; charset=UTF-8", "Content-Transfer-Encoding: base64", "", b64(text),
    `--${b}`, 'Content-Type: text/calendar; charset=UTF-8; method=REQUEST', "Content-Transfer-Encoding: base64", "", b64(ics),
    `--${b}--`, "",
  ].join("\r\n");
}
async function book(request, env, send) {
  if (!env.SEND_EMAIL || !env.BOOKING_FROM || !env.BOOKING_TO) return send(503, { error: "booking_not_configured" });
  let body; try { body = await request.json(); } catch { return send(400, { error: "bad_request" }); }
  if (clean(body.website, 200)) return send(200, { ok: true }); // honeypot: bots fill hidden fields
  const date = clean(body.date, 10), start = Number(body.start);
  const name = clean(body.name, 80), email = clean(body.email, 120), topic = clean(body.topic, 500);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isInteger(start) || start % 30 || start < OPEN_MIN || start + 30 > CLOSE_MIN) return send(400, { error: "bad_time" });
  if (!name || !EMAIL_RE.test(email)) return send(400, { error: "bad_contact" });
  const startMs = utcFor(date, start), endMs = startMs + 30 * 60000;
  if (startMs <= Date.now() || startMs > Date.now() + DAYS * 86400000) return send(400, { error: "bad_time" });
  // Double-check the slot is still open on the real calendar.
  if (env.CALENDAR_ICS_URL) {
    try {
      const r = await fetch(env.CALENDAR_ICS_URL, { headers: { accept: "text/calendar" } });
      if (r.ok) {
        const day = busyFromIcs(await r.text(), Date.now()).find((d) => d.date === date);
        if (day && day.busy.some((b) => b.start < start + 30 && start < b.end)) return send(409, { error: "taken" });
      }
    } catch (e) { /* calendar check is best effort; Daniel still sees the request */ }
  }
  const when = new Date(startMs).toLocaleString("en-US", { timeZone: ZONE, weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit" }) + " ET";
  const ics = inviteIcs({ uid: crypto.randomUUID() + "@danielxie.com", startMs, endMs, from: env.BOOKING_FROM, to: env.BOOKING_TO, name, email, topic });
  const text = `New booking from your schedule page.\n\nWhen: ${when} (30 min)\nName: ${name}\nEmail: ${email}\nAbout: ${topic || "(not given)"}\n\nReply to this email to reach them.`;
  try {
    await env.SEND_EMAIL.send(new EmailMessage(env.BOOKING_FROM, env.BOOKING_TO, mime({ from: env.BOOKING_FROM, to: env.BOOKING_TO, replyTo: email, subject: `Booking: ${name}, ${when}`, text, ics })));
  } catch (e) { return send(502, { error: "send_failed" }); }
  return send(200, { ok: true, when });
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("origin") || "";
    const allowed = ALLOWED_ORIGINS.includes(origin);
    const headers = { "cache-control": "no-store", "content-type": "application/json", vary: "origin" };
    if (allowed) headers["access-control-allow-origin"] = origin;
    const send = (status, body) => new Response(JSON.stringify(body), { status, headers });

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: { ...headers, "access-control-allow-methods": "GET, POST", "access-control-allow-headers": "x-passcode, content-type", "access-control-max-age": "86400" } });
    }
    if (request.method === "POST" && new URL(request.url).pathname === "/book") {
      if (!allowed) return send(403, { error: "forbidden" });
      return book(request, env, send);
    }
    if (request.method !== "GET") return send(405, { error: "method_not_allowed" });

    if (new URL(request.url).pathname === "/studio") {
      const expected = env.SCHEDULE_PASSCODE ? await sha256(env.SCHEDULE_PASSCODE) : DEFAULT_PASSCODE_HASH;
      if ((await sha256(request.headers.get("x-passcode") || "")) !== expected) return send(401, { error: "wrong_passcode" });
      return send(200, { url: STUDIO_URL });
    }
    if (!env.CALENDAR_ICS_URL) return send(503, { error: "not_configured" });

    try {
      const r = await fetch(env.CALENDAR_ICS_URL, { headers: { accept: "text/calendar" }, cf: { cacheTtl: 300, cacheEverything: true } });
      if (!r.ok) throw new Error("calendar fetch failed");
      return send(200, { zone: ZONE, open: OPEN_MIN, close: CLOSE_MIN, days: busyFromIcs(await r.text(), Date.now()) });
    } catch (e) {
      return send(502, { error: "calendar_unavailable" });
    }
  },
};

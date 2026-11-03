// Busy-only schedule endpoint. No titles, locations, or attendees ever leave this file.
import ICAL from "ical.js";

const ZONE = "America/New_York";
const OPEN_MIN = 9 * 60, CLOSE_MIN = 21 * 60, DAYS = 7;
const DEFAULT_PASSCODE_HASH = "79b9f10f0712ad8032d0bb38925eba0b2ed148bf1e0abb2e8cbdf8b26ae75101";

const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: ZONE, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
function wall(ms) {
  const p = {}; fmt.formatToParts(new Date(ms)).forEach((x) => { p[x.type] = x.value; });
  return { date: `${p.year}-${p.month}-${p.day}`, min: +p.hour * 60 + +p.minute };
}
function addDays(date, n) {
  const d = new Date(date + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10);
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
    if (b > startMs && a < stopMs) blocks.push([a, b]);
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
  blocks.forEach(([a, b]) => {
    const wa = wall(a), wb = wall(b);
    Object.keys(days).forEach((date) => {
      const from = wa.date < date ? 0 : wa.date === date ? wa.min : null;
      const to = wb.date > date ? 1440 : wb.date === date ? wb.min : null;
      if (from === null || to === null) return;
      const s = Math.max(from, OPEN_MIN), e = Math.min(to, CLOSE_MIN);
      if (e > s) days[date].push([s, e]);
    });
  });
  return Object.keys(days).map((date) => {
    const merged = [];
    days[date].sort((x, y) => x[0] - y[0]).forEach(([s, e]) => {
      const last = merged[merged.length - 1];
      if (last && s <= last[1]) last[1] = Math.max(last[1], e); else merged.push([s, e]);
    });
    return { date, busy: merged.map(([s, e]) => ({ start: s, end: e })) };
  });
}

async function sha256(value) {
  const bytes = new TextEncoder().encode(String(value).trim().toLowerCase());
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("origin") || "";
    const allowed = String(env.ALLOWED_ORIGINS || "").split(",").includes(origin);
    const headers = { "cache-control": "no-store", "content-type": "application/json", vary: "origin" };
    if (allowed) headers["access-control-allow-origin"] = origin;
    const send = (status, body) => new Response(JSON.stringify(body), { status, headers });

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: { ...headers, "access-control-allow-methods": "GET", "access-control-allow-headers": "x-passcode", "access-control-max-age": "86400" } });
    }
    if (request.method !== "GET") return send(405, { error: "method_not_allowed" });

    const expected = env.SCHEDULE_PASSCODE ? await sha256(env.SCHEDULE_PASSCODE) : DEFAULT_PASSCODE_HASH;
    if ((await sha256(request.headers.get("x-passcode") || "")) !== expected) return send(401, { error: "wrong_passcode" });
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

/** Real-estate showing desk. Times are America/Mexico_City (UTC−6). */

const MX_OFFSET_MS = 6 * 60 * 60 * 1000;
const BUFFER_MIN = 40;
const SLOT_MIN = 45;

export type PropertyZone = "polanco" | "coyoacan" | "roma";

export type ShowingProperty = {
  id: string;
  name: string;
  address: string;
  zone: PropertyZone;
  mapsUrl: string;
};

export type ShowingSlot = {
  start: string;
  end: string;
  label: string;
  zoneFit: boolean;
};

export type ShowingEvent = {
  provider: "google_calendar" | "outlook";
  title: string;
  location: string;
  mapsUrl: string;
  description: string;
  start: string;
  end: string;
  reminders: Array<{ channel: "whatsapp"; offset: "24h" | "2h" }>;
};

export type ShowingPlan = {
  channel: "WhatsApp" | "SMS" | "Email";
  intent: "visit" | "call" | "meeting";
  property: ShowingProperty;
  status: "offer" | "confirm" | "conflict" | "book";
  summary: string;
  slots: ShowingSlot[];
  draft: string;
  event: ShowingEvent | null;
};

const PROPERTIES: Array<ShowingProperty & { aliases: string[] }> = [
  {
    id: "polanco",
    name: "Apartamento Polanco",
    address: "Campos Elíseos 218, Polanco, CDMX",
    zone: "polanco",
    mapsUrl: "https://maps.google.com/?q=Campos+Eliseos+218+Polanco+CDMX",
    aliases: ["polanco", "campos elíseos", "campos eliseos"],
  },
  {
    id: "coyoacan",
    name: "Casa Coyoacán",
    address: "Francisco Sosa 42, Coyoacán, CDMX",
    zone: "coyoacan",
    mapsUrl: "https://maps.google.com/?q=Francisco+Sosa+42+Coyoacan+CDMX",
    aliases: ["coyoacán", "coyoacan", "francisco sosa"],
  },
  {
    id: "roma",
    name: "Departamento Roma Norte",
    address: "Córdoba 48, Roma Norte, CDMX",
    zone: "roma",
    mapsUrl: "https://maps.google.com/?q=Cordoba+48+Roma+Norte+CDMX",
    aliases: ["roma norte", "roma", "córdoba 48", "cordoba 48"],
  },
];

const WEEKDAYS: Record<string, number> = {
  domingo: 0,
  sunday: 0,
  lunes: 1,
  monday: 1,
  martes: 2,
  tuesday: 2,
  miércoles: 3,
  miercoles: 3,
  wednesday: 3,
  jueves: 4,
  thursday: 4,
  viernes: 5,
  friday: 5,
  sábado: 6,
  sabado: 6,
  saturday: 6,
};

type Busy = { start: number; end: number; zone: PropertyZone; title: string };

const BUSY_TEMPLATE: Array<{ dow: number; startHour: number; endHour: number; zone: PropertyZone; title: string }> = [
  { dow: 4, startHour: 15, endHour: 16, zone: "polanco", title: "Visita Polanco · Ana López" },
  { dow: 5, startHour: 9, endHour: 10, zone: "coyoacan", title: "Visita Coyoacán · Jorge Díaz" },
  { dow: 2, startHour: 11, endHour: 12, zone: "roma", title: "Recorrido Roma Norte" },
];

type MxParts = { y: number; m: number; d: number; h: number; min: number; dow: number };

function mxParts(date: Date): MxParts {
  const local = new Date(date.getTime() - MX_OFFSET_MS);
  return {
    y: local.getUTCFullYear(),
    m: local.getUTCMonth(),
    d: local.getUTCDate(),
    h: local.getUTCHours(),
    min: local.getUTCMinutes(),
    dow: local.getUTCDay(),
  };
}

function fromMx(y: number, m: number, d: number, h: number, min = 0): Date {
  return new Date(Date.UTC(y, m, d, h + 6, min));
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86_400_000);
}

function labelSlot(start: Date): string {
  const p = mxParts(start);
  const day = new Intl.DateTimeFormat("es-MX", {
    weekday: "long",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(p.y, p.m, p.d)));
  const hh = String(p.h).padStart(2, "0");
  const mm = String(p.min).padStart(2, "0");
  return `${day} ${hh}:${mm}`;
}

function busyBlocks(now: Date): Busy[] {
  const startDay = fromMx(mxParts(now).y, mxParts(now).m, mxParts(now).d, 0);
  const blocks: Busy[] = [];
  for (let i = 0; i < 10; i++) {
    const day = addDays(startDay, i);
    const dow = mxParts(day).dow;
    for (const row of BUSY_TEMPLATE) {
      if (row.dow !== dow) continue;
      const p = mxParts(day);
      const start = fromMx(p.y, p.m, p.d, row.startHour).getTime();
      const end = fromMx(p.y, p.m, p.d, row.endHour).getTime();
      if (end <= now.getTime()) continue;
      blocks.push({ start, end, zone: row.zone, title: row.title });
    }
  }
  return blocks;
}

function overlaps(start: number, end: number, blocks: Busy[]): Busy | null {
  const pad = BUFFER_MIN * 60_000;
  return blocks.find((b) => start < b.end + pad && end > b.start - pad) ?? null;
}

function previousZone(start: number, blocks: Busy[]): PropertyZone | null {
  const sameDay = blocks
    .filter((b) => b.end <= start && mxParts(new Date(b.start)).d === mxParts(new Date(start)).d)
    .sort((a, b) => b.end - a.end);
  return sameDay[0]?.zone ?? null;
}

function openSlots(now: Date, property: ShowingProperty, limit: number): ShowingSlot[] {
  const blocks = busyBlocks(now);
  const scored: Array<ShowingSlot & { score: number }> = [];
  const origin = fromMx(mxParts(now).y, mxParts(now).m, mxParts(now).d, 9);
  for (let day = 0; day < 8; day++) {
    const morning = addDays(origin, day);
    const p = mxParts(morning);
    if (p.dow === 0) continue;
    for (let hour = 9; hour <= 17; hour++) {
      for (const min of [0, 30]) {
        const startDate = fromMx(p.y, p.m, p.d, hour, min);
        if (startDate.getTime() < now.getTime() + 60 * 60_000) continue;
        const endDate = new Date(startDate.getTime() + SLOT_MIN * 60_000);
        if (overlaps(startDate.getTime(), endDate.getTime(), blocks)) continue;
        const zone = previousZone(startDate.getTime(), blocks);
        const zoneFit = zone === property.zone;
        const soon = day * 10 + hour;
        scored.push({
          start: startDate.toISOString(),
          end: endDate.toISOString(),
          label: labelSlot(startDate),
          zoneFit,
          score: (zoneFit ? -20 : 0) + soon,
        });
      }
    }
  }
  return scored
    .sort((a, b) => a.score - b.score)
    .slice(0, limit)
    .map(({ score: _score, ...slot }) => slot);
}

function detectIntent(text: string): ShowingPlan["intent"] | null {
  if (/ver\b|visita|visitar|mostrar|recorrer|tour|showing|ir a ver/i.test(text)) return "visit";
  if (/llamad[ao]|call\b|llamarme/i.test(text)) return "call";
  if (/reuni[oó]n|junta|meeting/i.test(text)) return "meeting";
  return null;
}

function matchProperty(text: string): ShowingProperty | null {
  const hay = text.toLowerCase();
  const hit = PROPERTIES.map((property) => ({
    property,
    len: Math.max(...property.aliases.map((alias) => (hay.includes(alias) ? alias.length : 0))),
  }))
    .filter((row) => row.len > 0)
    .sort((a, b) => b.len - a.len)[0];
  return hit?.property ?? null;
}

function channelOf(subject: string): ShowingPlan["channel"] {
  if (/whatsapp/i.test(subject)) return "WhatsApp";
  if (/\bsms\b/i.test(subject)) return "SMS";
  return "Email";
}

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || name;
}

function proposedStart(text: string, now: Date): Date | null {
  const hay = text.toLowerCase();
  const dayName = Object.keys(WEEKDAYS).find((name) => hay.includes(name));
  const clock = hay.match(/(?:a las|at)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/);
  let hour = 16;
  let minute = 0;
  if (clock) {
    hour = Number(clock[1]);
    minute = Number(clock[2] ?? 0);
    if (clock[3] === "pm" && hour < 12) hour += 12;
    if (clock[3] === "am" && hour === 12) hour = 0;
  } else if (/mañana|morning/.test(hay)) hour = 10;
  else if (/tarde|afternoon/.test(hay)) hour = 16;
  else if (/noche|evening/.test(hay)) hour = 18;
  else if (!dayName) return null;

  if (!dayName) {
    const p = mxParts(now);
    let target = fromMx(p.y, p.m, p.d, hour, minute);
    if (target.getTime() <= now.getTime()) target = addDays(target, 1);
    return target;
  }
  const want = WEEKDAYS[dayName];
  const p = mxParts(now);
  let add = (want - p.dow + 7) % 7;
  const sameDay = fromMx(p.y, p.m, p.d, hour, minute);
  if (add === 0 && sameDay.getTime() <= now.getTime()) add = 7;
  return addDays(sameDay, add);
}

function isConfirmation(text: string): boolean {
  return /confirm|confirmo|me queda|agéndalo|agendalo|dale,?\s*el|perfecto/i.test(text);
}

function eventFor(input: {
  property: ShowingProperty;
  client: string;
  body: string;
  slot: ShowingSlot;
}): ShowingEvent {
  return {
    provider: "google_calendar",
    title: `[Visita Inmobiliaria] - ${input.property.name} - ${input.client}`,
    location: input.property.address,
    mapsUrl: input.property.mapsUrl,
    description: `Cliente: ${input.client}\n${input.body.slice(0, 280)}\nPropiedad: ${input.property.name}, ${input.property.address}`,
    start: input.slot.start,
    end: input.slot.end,
    reminders: [
      { channel: "whatsapp", offset: "24h" },
      { channel: "whatsapp", offset: "2h" },
    ],
  };
}

export type AgendaMeeting = {
  id: string;
  source: "desk" | "calendly";
  title: string;
  start: string;
  end: string;
  location: string;
  href: string;
  hrefLabel: string;
};

const ZONE_PROPERTY: Record<PropertyZone, (typeof PROPERTIES)[number]> = {
  polanco: PROPERTIES[0],
  coyoacan: PROPERTIES[1],
  roma: PROPERTIES[2],
};

/** Upcoming visits already on the agent desk, each with a map link. */
export function deskAgenda(now = new Date()): AgendaMeeting[] {
  return busyBlocks(now).map((block) => {
    const property = ZONE_PROPERTY[block.zone];
    return {
      id: `desk-${block.start}`,
      source: "desk",
      title: block.title,
      start: new Date(block.start).toISOString(),
      end: new Date(block.end).toISOString(),
      location: property.address,
      href: property.mapsUrl,
      hrefLabel: "Mapa",
    };
  });
}

export function planShowing(input: {
  fromName: string;
  subject: string;
  body: string;
  now?: Date;
}): ShowingPlan | null {
  const text = `${input.subject}\n${input.body}`;
  const intent = detectIntent(text);
  const property = matchProperty(text);
  if (!intent || !property) return null;

  const now = input.now ?? new Date();
  const name = firstName(input.fromName);
  const channel = channelOf(input.subject);
  const proposed = proposedStart(text, now);
  const blocks = busyBlocks(now);
  const noun = intent === "call" ? "la llamada" : intent === "meeting" ? "la reunión" : property.name;

  if (proposed && isConfirmation(text)) {
    const end = new Date(proposed.getTime() + SLOT_MIN * 60_000);
    const clash = overlaps(proposed.getTime(), end.getTime(), blocks);
    if (!clash) {
      const slot: ShowingSlot = {
        start: proposed.toISOString(),
        end: end.toISOString(),
        label: labelSlot(proposed),
        zoneFit: previousZone(proposed.getTime(), blocks) === property.zone,
      };
      return {
        channel,
        intent,
        property,
        status: "book",
        summary: `${name} confirmó ${slot.label}. El horario está libre, con ${BUFFER_MIN} min de traslado.`,
        slots: [slot],
        draft: `Hola ${name}, queda agendada la visita a ${property.name} el ${slot.label}. Te escribo 24 h y 2 h antes para confirmar. La dirección es ${property.address}.`,
        event: eventFor({ property, client: input.fromName, body: input.body, slot }),
      };
    }
  }

  if (proposed) {
    const end = new Date(proposed.getTime() + SLOT_MIN * 60_000);
    const clash = overlaps(proposed.getTime(), end.getTime(), blocks);
    const alternatives = openSlots(now, property, 2);
    if (!clash) {
      const slot: ShowingSlot = {
        start: proposed.toISOString(),
        end: end.toISOString(),
        label: labelSlot(proposed),
        zoneFit: previousZone(proposed.getTime(), blocks) === property.zone,
      };
      return {
        channel,
        intent,
        property,
        status: "confirm",
        summary: `${labelSlot(proposed)} está libre para ${noun}.`,
        slots: [slot, ...alternatives.filter((item) => item.start !== slot.start)].slice(0, 3),
        draft: `Hola ${name}, el ${slot.label} está libre para mostrarte ${property.name}. ¿Lo confirmo?`,
        event: null,
      };
    }
    const alt = alternatives[0];
    return {
      channel,
      intent,
      property,
      status: "conflict",
      summary: `${labelSlot(proposed)} choca con otra cita. El margen de traslado es ${BUFFER_MIN} min.`,
      slots: alternatives,
      draft: alt
        ? `Hola ${name}, el ${labelSlot(proposed)} ya tengo una visita. Puedo mostrarte ${property.name} el ${alt.label}${alternatives[1] ? ` o el ${alternatives[1].label}` : ""}. ¿Cuál te acomoda mejor?`
        : `Hola ${name}, ese horario ya está ocupado. Te escribo en cuanto abra el siguiente espacio para ${property.name}.`,
      event: null,
    };
  }

  const slots = openSlots(now, property, 3);
  const [a, b] = slots;
  return {
    channel,
    intent,
    property,
    status: "offer",
    summary: slots.some((slot) => slot.zoneFit)
      ? `Prioricé un horario junto a otra visita en ${property.zone}.`
      : `Estos son los siguientes huecos libres, con ${BUFFER_MIN} min entre citas.`,
    slots,
    draft: a
      ? `Hola ${name}, con gusto te muestro ${property.name}. Tengo disponibilidad el ${a.label}${b ? ` o el ${b.label}` : ""}. ¿Cuál te acomoda mejor?`
      : `Hola ${name}, reviso la agenda y te confirmo el siguiente horario para ${property.name}.`,
    event: null,
  };
}

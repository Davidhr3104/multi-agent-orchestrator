import { describe, expect, it } from "vitest";
import { planShowing } from "./showing-schedule";

const NOW = new Date("2026-10-07T15:00:00.000Z");

describe("planShowing", () => {
  it("offers nearby slots when the buyer asks for a general visit", () => {
    const plan = planShowing({
      fromName: "Camila Soto",
      subject: "WhatsApp · Casa Coyoacán",
      body: "Hola, ¿qué horarios tienes para ver la casa en Coyoacán?",
      now: NOW,
    });
    expect(plan?.status).toBe("offer");
    expect(plan?.property.id).toBe("coyoacan");
    expect(plan?.slots.length).toBeGreaterThanOrEqual(2);
    expect(plan?.draft).toMatch(/Camila/);
    expect(plan?.draft).toMatch(/Coyoacán/);
    expect(plan?.event).toBeNull();
  });

  it("rejects a Thursday afternoon that sits inside the travel buffer", () => {
    const plan = planShowing({
      fromName: "Camila Soto",
      subject: "WhatsApp · Polanco",
      body: "¿Cuándo puedo ir a ver el apartamento en Polanco? Estoy libre el jueves por la tarde.",
      now: NOW,
    });
    expect(plan?.status).toBe("conflict");
    expect(plan?.draft).toMatch(/ya tengo una visita/);
    expect(plan?.slots.length).toBeGreaterThan(0);
  });

  it("builds a calendar payload when the buyer confirms a free hour", () => {
    const plan = planShowing({
      fromName: "Andrés Vega",
      subject: "SMS · Coyoacán",
      body: "Confirmo el viernes a las 11:00 para ver la casa en Coyoacán. Presupuesto 8 millones, 3 recámaras.",
      now: NOW,
    });
    expect(plan?.status).toBe("book");
    expect(plan?.event?.title).toContain("Casa Coyoacán");
    expect(plan?.event?.title).toContain("Andrés Vega");
    expect(plan?.event?.reminders.map((item) => item.offset)).toEqual(["24h", "2h"]);
    expect(plan?.event?.mapsUrl).toContain("maps.google.com");
  });

  it("ignores threads that are not about a showing", () => {
    expect(
      planShowing({
        fromName: "Dana Ruiz",
        subject: "Invoice #4471",
        body: "Invoice #4471 for $1,240 is due on the 5th.",
        now: NOW,
      })
    ).toBeNull();
  });
});

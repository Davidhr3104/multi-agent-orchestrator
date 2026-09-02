export type SalesRepRecord = {
  id: string;
  name: string;
  email: string;
  territory: string;
  industry_focus: string;
  current_load: number;
};

const reps: SalesRepRecord[] = [
  {
    id: "rep-enterprise",
    name: "Sam Patel",
    email: "sam@helix.local",
    territory: "us",
    industry_focus: "Enterprise",
    current_load: 0,
  },
  {
    id: "rep-ana",
    name: "Ana Ruiz",
    email: "ana@helix.local",
    territory: "latam",
    industry_focus: "SMB",
    current_load: 0,
  },
  {
    id: "rep-luis",
    name: "Luis Ortega",
    email: "luis@helix.local",
    territory: "us",
    industry_focus: "SMB",
    current_load: 0,
  },
];

export function listSalesReps(): SalesRepRecord[] {
  return reps.map((r) => ({ ...r }));
}

export function assignSalesRep(score: number): SalesRepRecord & { reason: string } {
  if (score > 90) {
    const enterprise = reps.find((r) => r.industry_focus === "Enterprise");
    if (enterprise) {
      enterprise.current_load += 1;
      return { ...enterprise, reason: "score > 90 → Enterprise focus" };
    }
  }
  const pick = [...reps].sort((a, b) => a.current_load - b.current_load)[0] ?? reps[0];
  pick.current_load += 1;
  return { ...pick, reason: "round-robin lowest current_load" };
}

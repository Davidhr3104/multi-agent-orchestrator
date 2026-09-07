import type { FirmClient, FirmKnowledge, FirmMatter } from "@/lib/conflict-types";

const CLIENTS: FirmClient[] = [
  { id: "c-northstar", clientName: "Northstar PI Consortium", clientType: "Corporate", status: "Active" },
  { id: "c-harbor", clientName: "Harbor Occupational Health", clientType: "Corporate", status: "Inactive" },
  { id: "c-tech", clientName: "TechVentures LLC", clientType: "Corporate", status: "Active" },
];

const MATTERS: FirmMatter[] = [
  {
    id: "m-northstar-tort",
    clientId: "c-northstar",
    clientName: "Northstar PI Consortium",
    matterName: "Mass Tort Defense 2024",
    opposingParty: "Plaintiff Group A",
    matterType: "Litigation",
    status: "Active",
  },
  {
    id: "m-harbor-audit",
    clientId: "c-harbor",
    clientName: "Harbor Occupational Health",
    matterName: "Workers Comp Audit",
    opposingParty: "State Labor Board",
    matterType: "RFP Response",
    status: "Closed",
  },
];

export function memoryFirmKnowledge(): FirmKnowledge {
  return { clients: CLIENTS, matters: MATTERS, source: "memory" };
}

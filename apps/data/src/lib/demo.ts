import { DEMO_DATASET_ID, type SheetGrid } from "@/lib/types";

/** Invented dirty leads — labeled Demo data. Not a live CRM extract. */
export function dirtyLeadsGrid(): SheetGrid {
  return {
    headers: ["Name", "Email", "Phone", "Signup Date", "Deal Size", "Company", "City"],
    rows: [
      ["  jane doe  ", "Jane.Doe@EXAMPLE.com", "(555) 123-4567", "03/04/2026", "$85000", "ACME INC", "NY"],
      ["JOHN SMITH", "john@acme", "5559876543", "2026-09-18", "125000", "Acme Inc", "New York"],
      ["Maya Chen", "maya.chen@northwind.test", "+1 415 555 0199", "09/18/2026", "$9,400", "Northwind HVAC", "Austin"],
      ["  Luis Perez", "luis@example.com", "(312) 555-0144", "Sep 7, 2026", "$85,000", "Helix", "Chicago"],
      ["jane doe", "Jane.Doe@EXAMPLE.com", "5551234567", "03/04/2026", "$85000", "ACME INC", "NY"],
      ["Ava Patel", "ava.patel@northwind.test", "415-555-0100", "09/18/2026", "$1,200,000", "Northwind HVAC", "SF"],
      ["", "not-an-email", "123", "13/13/2026", "n/a", "", ""],
      ["Sam Okonkwo", "sam.okonkwo@example.com", "(214) 555-0198", "2026-01-05", "$12,500", "example co", "Dallas"],
    ],
  };
}

export const DEMO_META = {
  id: DEMO_DATASET_ID,
  name: "Dirty inbound leads.csv",
  originalFileName: "dirty-leads.csv",
  invented: true as const,
};

export const DIRTY_LEADS_CSV = `Name,Email,Phone,Signup Date,Deal Size,Company,City
  jane doe  ,Jane.Doe@EXAMPLE.com,"(555) 123-4567",03/04/2026,$85000,ACME INC,NY
JOHN SMITH,john@acme,5559876543,2026-09-18,125000,Acme Inc,New York
Maya Chen,maya.chen@northwind.test,+1 415 555 0199,09/18/2026,"$9,400",Northwind HVAC,Austin
  Luis Perez,luis@example.com,"(312) 555-0144","Sep 7, 2026","$85,000",Helix,Chicago
jane doe,Jane.Doe@EXAMPLE.com,5551234567,03/04/2026,$85000,ACME INC,NY
Ava Patel,ava.patel@northwind.test,415-555-0100,09/18/2026,"$1,200,000",Northwind HVAC,SF
,not-an-email,123,13/13/2026,n/a,,
Sam Okonkwo,sam.okonkwo@example.com,"(214) 555-0198",2026-01-05,"$12,500",example co,Dallas
`;

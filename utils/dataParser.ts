
import { DashboardData } from "../types";

export const parseCSV = (csvText: string): DashboardData => {
  const lines = csvText.split(/\r?\n/).filter(line => line.trim() !== "");
  if (lines.length === 0) return { headers: [], rows: [] };

  const headers = lines[0].split(',').map(h => h.trim());
  const rows = lines.slice(1).map(line => {
    // Simple CSV split (note: doesn't handle quoted commas, but sufficient for standard Sheets numeric data)
    const values = line.split(',').map(v => v.trim());
    const row: Record<string, any> = {};
    headers.forEach((header, index) => {
      let val: any = values[index];
      // Convert to number if possible
      if (!isNaN(val) && val !== "") {
        val = Number(val);
      }
      row[header] = val;
    });
    return row;
  });

  return { headers, rows };
};

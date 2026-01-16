
import { DashboardData } from "../types";

export const parseCSV = (csvText: string): DashboardData => {
  const lines = csvText.split(/\r?\n/).filter(line => line.trim() !== "");
  if (lines.length === 0) return { headers: [], rows: [] };

  const headers = lines[0].split(',').map(h => h.trim());
  const rows = lines.slice(1).map(line => {
    // Basic CSV splitting (does not handle nested commas in quotes, 
    // but typically sufficient for exported spreadsheet data)
    const values = line.split(',').map(v => v.trim());
    const row: Record<string, any> = {};
    
    headers.forEach((header, index) => {
      let val: any = values[index] || "";
      
      // Sanitization: If it's a percentage string like "89.91%", keep the string for display 
      // but ensure other parts of the app can parse it.
      
      // Check if value is numeric or can be a number
      if (val !== "" && !isNaN(val as any)) {
        row[header] = Number(val);
      } else {
        row[header] = val;
      }
    });
    return row;
  });

  return { headers, rows };
};

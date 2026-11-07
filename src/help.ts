/** Hover help (data-nc-help, nc-ui installHelpTips): at most 200 characters each, short plain sentences. */
export const HELP: Record<string, string> = {
  "page:hold":
    "Freeze what ARIA sends: the Ground table and Energy stay where they are until you release Hold.",
  "page:save": "Download ARIA's settings (station, Smoothing) as a file.",
  "page:load": "Load an ARIA file.",
  station:
    "The seismometer ARIA listens to, live from EarthScope. Its ground motion becomes the Ground table and Energy.",
  custom: "Any station EarthScope streams, as NET STA LOC CHA (for example IU ANMO 00 BHZ).",
  status:
    "Live: data is arriving. Quiet: connected, nothing for two minutes. Offline: reconnecting; the 2010 recording plays meanwhile.",
  wave: "The last ten minutes at this station. The line is where ARIA is playing; the shaded slice is the table.",
  table: "One cycle of ground motion, mirrored so it loops. ASTRID plays it as its Ground table.",
  energy:
    "How much the ground moves against this station's last 30 minutes: its normal reads 0.5. ASTRID can use it as ARIA Energy.",
  smoothing: "How slowly Energy follows the ground, in seconds.",
};
export const helpFor = (key: string) => HELP[key] ?? "";

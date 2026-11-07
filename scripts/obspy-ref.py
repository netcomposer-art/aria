"""Regenerate tests/fixtures/obspy-ref.json: ObsPy's decoding of each fixture (python3 scripts/obspy-ref.py)."""
import glob, json, os
from obspy import read
os.chdir(os.path.join(os.path.dirname(__file__), "..", "tests", "fixtures"))
ref = {}
for f in sorted(glob.glob("*.mseed")):
    st = read(f, details=True)
    ref[f] = [{"id": tr.id, "start": tr.stats.starttime.timestamp * 1000, "rate": tr.stats.sampling_rate,
               "data": [float(x) for x in tr.data]} for tr in st]
json.dump({"obspy": __import__("obspy").__version__, "files": ref}, open("obspy-ref.json", "w"))

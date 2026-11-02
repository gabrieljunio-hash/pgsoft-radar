#!/usr/bin/env python3
"""Collect public PG Soft daily totals from Farra.bet; never fabricates events."""
import json, re, sys
from datetime import datetime, timezone, timedelta
from pathlib import Path
from urllib.request import Request, urlopen
from html import unescape

URL = "https://farra.bet/cassino/pg-soft"
ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
DATA.mkdir(exist_ok=True)

def fetch():
    req = Request(URL, headers={"User-Agent": "Mozilla/5.0 (compatible; PGSoftRadar/1.0; +https://github.com/gabrieljunio-hash/pgsoft-radar)"})
    with urlopen(req, timeout=30) as response:
        raw = response.read().decode("utf-8", "replace")
    text = re.sub(r"<(script|style)[^>]*>.*?</\\1>", " ", raw, flags=re.I|re.S)
    text = re.sub(r"<[^>]+>", " ", text)
    text = unescape(re.sub(r"\s+", " ", text))
    pattern = re.compile(r"([A-Za-zÀ-ÿ0-9][A-Za-zÀ-ÿ0-9 '’&:!?().-]{1,75}?)\s+Pagou hoje\s+R\$\s*([0-9.]+,[0-9]{2})", re.I)
    games = {}
    for name, value in pattern.findall(text):
        name = re.sub(r"\s+", " ", name).strip(" -|")
        if len(name) > 75:
            name = name[-75:].strip()
        amount = float(value.replace(".", "").replace(",", "."))
        if amount >= 0:
            games[name] = amount
    if len(games) < 5:
        raise RuntimeError(f"Parser encontrou apenas {len(games)} jogos; coleta descartada para evitar dados incompletos.")
    return games

def main():
    games = fetch()
    now = datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    history_path = DATA / "history.json"
    try:
        history = json.loads(history_path.read_text(encoding="utf-8"))
    except (FileNotFoundError, json.JSONDecodeError):
        history = {"snapshots": []}
    snapshots = history.get("snapshots", [])
    if snapshots and snapshots[-1].get("collected_at") == now:
        print("Snapshot já existe para este instante.")
        return
    snapshots.append({"source":"farra.bet","collected_at":now,"currency":"BRL","metric":"daily_cumulative_total","games":games})
    cutoff = datetime.now(timezone.utc) - timedelta(days=30)
    snapshots = [s for s in snapshots if datetime.fromisoformat(s["collected_at"].replace("Z","+00:00")) >= cutoff]
    payload = {"schema_version":1,"notice":"Valores acumulados diários publicados pela fonte; diferenças entre coletas são variações observadas, não prêmios individuais.","snapshots":snapshots}
    history_path.write_text(json.dumps(payload,ensure_ascii=False,separators=(",",":"))+"\n",encoding="utf-8")
    (DATA / "latest.json").write_text(json.dumps(snapshots[-1],ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print(f"Coleta concluída: {len(games)} jogos em {now}")

if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"ERRO NA COLETA: {exc}", file=sys.stderr)
        raise

#!/usr/bin/env python3
"""Collect public daily cumulative totals, tagged by game provider."""
import json
import re
import sys
from datetime import datetime, timezone, timedelta
from pathlib import Path
from urllib.request import Request, urlopen
from html import unescape

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
DATA.mkdir(exist_ok=True)
SOURCES = [
    {"id": "farra.bet", "name": "Farra.bet", "url": "https://farra.bet/cassino/pg-soft", "provider": "PG Soft"},
    {"id": "jogou.io", "name": "Jogou", "url": "https://jogou.io/cassino/pg-soft", "provider": "PG Soft"},
    {"id": "cassino365.bet", "name": "Cassino10", "url": "https://www.cassino365.bet/cassino/pg-soft", "provider": "PG Soft"},
    {"id": "tokyoclubbet.com", "name": "Tokyo Club", "url": "https://tokyoclubbet.com/cassino/pg-soft", "provider": "PG Soft"},
    {"id": "betz1nha.com", "name": "Betzinha", "url": "https://betz1nha.com/cassino/pg-soft", "provider": "PG Soft"},
    {"id": "jogofacil.net.br", "name": "Jogo Fácil", "url": "https://jogofacil.net.br/cassino/pg-soft", "provider": "PG Soft"},
    {"id": "farra.bet:tada", "name": "Farra.bet", "url": "https://farra.bet/cassino/tada", "provider": "TaDa Gaming"},
    {"id": "jogou.io:tada", "name": "Jogou", "url": "https://jogou.io/cassino/tada", "provider": "TaDa Gaming"},
    {"id": "farra.bet:pragmatic", "name": "Farra.bet", "url": "https://farra.bet/cassino/pragmatic", "provider": "Pragmatic Play"},
    {"id": "jogou.io:pragmatic", "name": "Jogou", "url": "https://jogou.io/cassino/pragmatic", "provider": "Pragmatic Play"},
    {"id": "cazebetbr.com:popok", "name": "Cazé Bet", "url": "https://cazebetbr.com/cassino?lista=popok", "provider": "PopOK", "layout": "after"},
]
AMOUNT = r"([0-9]{1,3}(?:\.[0-9]{3})*(?:,[0-9]{2})?|[0-9]+(?:,[0-9]{2})?)"

def parse_amount(value):
    return float(value.replace(".", "").replace(",", "."))

def clean_name(value):
    name = re.sub(r"\s+", " ", unescape(value)).strip(" -|—:·")
    name = re.sub(r"\s+Jogar$", "", name, flags=re.I)
    name = re.sub(r"\s+(?:PG\s*Soft|TaDa\s*Gaming|Pragmatic\s*Play|PopOK)$", "", name, flags=re.I)
    name = re.sub(r"^(?:Quente|Popular|Novo)\s+", "", name, flags=re.I)
    return name.strip()

def parse_games(raw, layout="before"):
    text = re.sub(r"<(script|style)[^>]*>.*?</\1>", " ", raw, flags=re.I | re.S)
    text = re.sub(r"<[^>]+>", " ", text)
    text = unescape(re.sub(r"\s+", " ", text))
    games = {}
    if layout == "after":
        patterns = [
            re.compile(r"Pagou hoje\s+R\$\s*" + AMOUNT + r"\s+(.{2,90}?)\s+(?:PG\s*Soft|TaDa\s*Gaming|Pragmatic\s*Play|PopOK|RTP)", re.I),
        ]
        for pattern in patterns:
            for value, raw_name in pattern.findall(text):
                name = clean_name(raw_name)
                if name and len(name) <= 85:
                    games[name] = parse_amount(value)
    else:
        pattern = re.compile(r"([A-Za-zÀ-ÿ0-9][A-Za-zÀ-ÿ0-9 '’&:!?().-]{1,100}?)\s+(?:Jogar\s+)?Pagou hoje\s+R\$\s*" + AMOUNT, re.I)
        for raw_name, value in pattern.findall(text):
            name = clean_name(raw_name)
            if name and len(name) <= 85:
                games[name] = parse_amount(value)
    return games

def fetch_source(source):
    req = Request(source["url"], headers={
        "User-Agent": "Mozilla/5.0 (compatible; PGSoftRadar/1.0; +https://github.com/gabrieljunio-hash/pgsoft-radar)",
        "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
    })
    with urlopen(req, timeout=25) as response:
        raw = response.read().decode("utf-8", "replace")
    games = parse_games(raw, source.get("layout", "before"))
    if len(games) < 5:
        raise RuntimeError(f"parser encontrou apenas {len(games)} jogos")
    return games

def load_history(path):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (FileNotFoundError, json.JSONDecodeError):
        return {"schema_version": 2, "snapshots": []}

def main():
    history_path = DATA / "history.json"
    history = load_history(history_path)
    snapshots = history.get("snapshots", [])
    successes, failures = [], []
    print(f"Iniciando monitoramento de {len(SOURCES)} fontes/provedoras.")
    for source in SOURCES:
        try:
            games = fetch_source(source)
            now = datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
            snapshots.append({
                "source": source["id"],
                "source_name": source["name"],
                "source_url": source["url"],
                "provider": source["provider"],
                "collected_at": now,
                "currency": "BRL",
                "metric": "daily_cumulative_total",
                "games": games,
            })
            successes.append((source["name"], source["provider"], len(games)))
            print(f"OK {source['name']} / {source['provider']}: {len(games)} jogos")
        except Exception as exc:
            failures.append((source["name"], source["provider"], str(exc)))
            print(f"FALHA {source['name']} / {source['provider']}: {exc}", file=sys.stderr)

    if not successes:
        raise RuntimeError("Nenhuma fonte produziu dados válidos; histórico preservado.")
    cutoff = datetime.now(timezone.utc) - timedelta(days=30)
    snapshots = [
        s for s in snapshots
        if datetime.fromisoformat(s["collected_at"].replace("Z", "+00:00")) >= cutoff
    ]
    snapshots.sort(key=lambda s: s["collected_at"])
    payload = {
        "schema_version": 3,
        "notice": "Valores acumulados diários publicados por cada fonte. Variações entre coletas não são prêmios individuais nem previsões.",
        "snapshots": snapshots,
    }
    history_path.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    latest_by_source = {}
    for snapshot in snapshots:
        latest_by_source[snapshot["source"] + "|" + snapshot.get("provider", "PG Soft")] = snapshot
    (DATA / "latest.json").write_text(
        json.dumps({"updated_at": datetime.now(timezone.utc).isoformat(), "sources": latest_by_source}, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"Coleta finalizada: {len(successes)}/{len(SOURCES)} fontes válidas; {len(snapshots)} snapshots no histórico.")
    if failures:
        print("Fontes indisponíveis: " + "; ".join(f"{name}/{provider}" for name, provider, _ in failures))

if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Collect individually published wins (>=50x) from public casino feeds."""
import hashlib
import json
import re
import sys
from datetime import datetime, timezone, timedelta
from html.parser import HTMLParser
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.parse import urljoin

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
HISTORY = DATA / "history.json"
OUTPUT = DATA / "wins.json"
SOURCES = [
    {"id": "gigabet.com.br", "name": "GigaBet", "url": "https://gigabet.com.br/user/wallet"},
    {"id": "pixway.bet", "name": "Pixway", "url": "https://pixway.bet/user/wallet"},
    {"id": "betboa.net.br", "name": "Betboa", "url": "https://betboa.net.br/user/wallet"},
]
BR_TZ = timezone(timedelta(hours=-3))
AMOUNT_RE = re.compile(r"R?\$?\s*([0-9.]+(?:,[0-9]{1,2})?|[0-9]+(?:\.[0-9]{1,2})?)")

def norm(value):
    return re.sub(r"[^a-z0-9]+", " ", str(value).lower()).strip()

def amount(value):
    value = str(value).replace("R$", "").replace(" ", "").strip()
    if "," in value:
        value = value.replace(".", "").replace(",", ".")
    return float(value)

def multiplier(value):
    match = re.search(r"([0-9]+(?:[.,][0-9]+)?)\s*[x×]", str(value), re.I)
    return float(match.group(1).replace(",", ".")) if match else None

def parse_time(value, now=None):
    now = now or datetime.now(BR_TZ)
    value = re.sub(r"\s+", " ", value.replace(" às ", " ")).strip()
    for fmt in ("%d/%m/%Y %H:%M", "%d/%m %H:%M", "%d/%m, %H:%M"):
        try:
            parsed = datetime.strptime(value, fmt)
            if "%Y" not in fmt:
                parsed = parsed.replace(year=now.year)
                if parsed > now.replace(tzinfo=None) + timedelta(days=1):
                    parsed = parsed.replace(year=now.year - 1)
            return parsed.replace(tzinfo=BR_TZ).astimezone(timezone.utc).isoformat().replace("+00:00", "Z")
        except ValueError:
            pass
    return None

class TableParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.rows = []
        self.row = None
        self.cell = None
        self.image = ""

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "tr":
            self.row = []
        elif tag in ("td", "th") and self.row is not None:
            self.cell = []
            self.image = ""
        elif tag == "img" and self.cell is not None:
            self.image = attrs.get("src") or attrs.get("data-src") or ""
            alt = attrs.get("alt")
            if alt:
                self.cell.append(alt)

    def handle_data(self, data):
        if self.cell is not None:
            self.cell.append(data)

    def handle_endtag(self, tag):
        if tag in ("td", "th") and self.cell is not None and self.row is not None:
            self.row.append({"text": re.sub(r"\s+", " ", " ".join(self.cell)).strip(), "image": self.image})
            self.cell = None
        elif tag == "tr" and self.row is not None:
            if self.row:
                self.rows.append(self.row)
            self.row = None
            self.cell = None

def parse_rows(raw, known_games, now=None, source=None):
    source = source or SOURCES[0]
    parser = TableParser()
    parser.feed(raw)
    records = []
    for row in parser.rows:
        cells = [c["text"] for c in row]
        joined = " ".join(cells).lower()
        if len(cells) < 6 or "multiplicador" in joined or "pagamento" in joined:
            continue
        # Feed columns: game, masked player, date/time, bet, multiplier, payout.
        raw_game = cells[0]
        key = norm(raw_game)
        matched = next((k for k in sorted(known_games, key=len, reverse=True) if k and (k in key or key in k)), None)
        if not matched:
            continue
        game = known_games[matched] if isinstance(known_games, dict) else raw_game
        bet_match = AMOUNT_RE.search(cells[3])
        payout_match = AMOUNT_RE.search(cells[5])
        mult = multiplier(cells[4])
        if not bet_match or not payout_match or not mult:
            continue
        bet, payout = amount(bet_match.group(1)), amount(payout_match.group(1))
        ratio = payout / bet if bet else 0
        if ratio < 50 and mult < 50:
            continue
        occurred = parse_time(cells[2], now)
        if not occurred:
            continue
        image = next((urljoin(source["url"], c["image"]) for c in row if c["image"]), "")
        event = {
            "source": source["id"], "source_name": source["name"],
            "game": game, "bet": bet, "payout": payout,
            "multiplier": round(max(mult, ratio), 2),
            "occurred_at": occurred, "image": image,
        }
        raw_id = "|".join([event["source"], key, occurred, str(bet), str(payout)])
        event["id"] = hashlib.sha256(raw_id.encode()).hexdigest()[:20]
        records.append(event)
    return records

def main():
    DATA.mkdir(exist_ok=True)
    history = json.loads(HISTORY.read_text(encoding="utf-8"))
    known_games = {norm(name): name for snap in history.get("snapshots", []) for name in snap.get("games", {})}
    found = []
    checked = []
    for source in SOURCES:
        try:
            req = Request(source["url"], headers={
                "User-Agent": "Mozilla/5.0 (compatible; PGSoftRadar/1.0)",
                "Accept-Language": "pt-BR,pt;q=0.9",
            })
            with urlopen(req, timeout=30) as response:
                raw = response.read().decode("utf-8", "replace")
            rows = parse_rows(raw, known_games, source=source)
            found.extend(rows)
            checked.append({"id": source["id"], "name": source["name"], "status": "ok", "events": len(rows)})
            print(f"OK {source['name']}: {len(rows)} pagamentos PG Soft >=50x")
        except Exception as exc:
            checked.append({"id": source["id"], "name": source["name"], "status": "error", "error": str(exc)})
            print(f"FALHA {source['name']}: {exc}", file=sys.stderr)
    if not any(x["status"] == "ok" for x in checked):
        raise RuntimeError("Nenhum feed de pagamentos pôde ser consultado.")
    old = json.loads(OUTPUT.read_text(encoding="utf-8")) if OUTPUT.exists() else {"events": []}
    by_id = {e["id"]: e for e in old.get("events", [])}
    for event in found:
        by_id[event["id"]] = event
    cutoff = datetime.now(timezone.utc) - timedelta(days=30)
    events = [e for e in by_id.values() if datetime.fromisoformat(e["occurred_at"].replace("Z", "+00:00")) >= cutoff]
    events.sort(key=lambda e: e["occurred_at"])
    OUTPUT.write_text(json.dumps({
        "schema_version": 1,
        "notice": "Pagamentos individuais exibidos publicamente pela fonte; somente multiplicadores >=50x. Dados observacionais, sem capacidade preditiva.",
        "updated_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "sources": checked,
        "events": events,
    }, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    print(f"Feeds individuais: {len(found)} pagamentos PG Soft >=50x reconhecidos; {len(events)} eventos únicos no histórico.")
    if not found:
        print("AVISO: nenhum pagamento PG Soft >=50x encontrado nesta coleta.", file=sys.stderr)

if __name__ == "__main__":
    main()

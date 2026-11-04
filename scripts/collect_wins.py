#!/usr/bin/env python3
"""Collect individually published wins (>=50x) from public casino feeds."""
import hashlib
import json
import re
import sys
from datetime import datetime, timezone, timedelta
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urljoin
from playwright.sync_api import sync_playwright

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

def header_map(cells):
    aliases = {
        "game": ("jogo", "game", "slot"),
        "time": ("data e hora", "data/hora", "horario", "hora", "date", "time"),
        "bet": ("aposta", "valor apostado", "bet"),
        "multiplier": ("multiplicador", "multiplier", "x"),
        "payout": ("pagamento", "premio", "prêmio", "ganho", "payout", "win"),
    }
    normalized = [norm(x) for x in cells]
    result = {}
    for field, names in aliases.items():
        for i, value in enumerate(normalized):
            if any(norm(name) == value or norm(name) in value for name in names):
                result[field] = i
                break
    return result

def parse_rows(raw, known_games, now=None, source=None, diagnostics=None):
    source = source or SOURCES[0]
    parser = TableParser()
    parser.feed(raw)
    records = []
    if diagnostics is not None:
        diagnostics.update({"table_rows": len(parser.rows), "pgsoft_rows": 0, "eligible_rows": 0, "candidate_rows": 0})
    required = {"game", "time", "bet", "multiplier", "payout"}
    aliases = sorted(known_games, key=len, reverse=True)
    for row in parser.rows:
        cells = [c["text"] for c in row]
        if not cells:
            continue
        headers = header_map(cells)
        if required.issubset(headers):
            continue
        if not required.issubset(headers):
            continue
        if diagnostics is not None:
            diagnostics["candidate_rows"] += 1
        matched = None
        raw_game = ""
        for candidate in [cells[headers["game"]]] + [cells[i] for i in range(len(cells)) if i != headers["game"]]:
            key = norm(candidate)
            matched = next((k for k in aliases if k and (k == key or k in key or key in k)), None)
            if matched:
                raw_game = candidate
                break
        if not matched:
            continue
        if diagnostics is not None:
            diagnostics["pgsoft_rows"] += 1
        game = known_games[matched] if isinstance(known_games, dict) else raw_game
        try:
            bet_match = AMOUNT_RE.search(cells[headers["bet"]])
            payout_match = AMOUNT_RE.search(cells[headers["payout"]])
            mult = multiplier(cells[headers["multiplier"]])
            if not bet_match or not payout_match or mult is None:
                continue
            bet, payout = amount(bet_match.group(1)), amount(payout_match.group(1))
            ratio = payout / bet if bet else 0
            if ratio < 50 and mult < 50:
                continue
            occurred = parse_time(cells[headers["time"]], now)
            if not occurred:
                continue
        except (ValueError, IndexError):
            continue
        image = next((urljoin(source["url"], c["image"]) for c in row if c["image"]), "")
        event = {"source": source["id"], "source_name": source["name"], "game": game, "bet": bet, "payout": payout,
                 "multiplier": round(max(mult, ratio), 2), "occurred_at": occurred, "image": image}
        raw_id = "|".join([event["source"], norm(raw_game), occurred, str(bet), str(payout)])
        event["id"] = hashlib.sha256(raw_id.encode()).hexdigest()[:20]
        records.append(event)
        if diagnostics is not None:
            diagnostics["eligible_rows"] += 1
    return records
def classify_source(diagnostics):
    if diagnostics.get("redirected_home", False):
        return "redirected_no_feed"
    if diagnostics.get("pgsoft_rows", 0) <= 0:
        return "no_pgsoft_data"
    if diagnostics.get("eligible_rows", 0) <= 0:
        return "no_50x_events"
    return "ok"

def should_fail_collection(checked):
    return bool(checked) and all(x.get("status") == "error" for x in checked)

def main():
    DATA.mkdir(exist_ok=True)
    history = json.loads(HISTORY.read_text(encoding="utf-8"))
    known_games = {norm(name): name for snap in history.get("snapshots", []) for name in snap.get("games", {})}
    found = []
    checked = []
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, args=["--no-sandbox"])
        for source in SOURCES:
            page = browser.new_page(locale="pt-BR", user_agent="Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/128.0.0.0 Safari/537.36")
            try:
                response = page.goto(source["url"], wait_until="domcontentloaded", timeout=45000)
                page.wait_for_timeout(4000)
                raw = page.content()
                diagnostics = {}
                rows = parse_rows(raw, known_games, source=source, diagnostics=diagnostics)
                found.extend(rows)
                diagnostics["redirected_home"] = page.url.rstrip("/") == source["url"].split("/user/")[0].rstrip("/")
                status = classify_source(diagnostics)
                messages = {
                    "ok": "Feed PG Soft identificado e pagamentos >=50x processados.",
                    "no_50x_events": "Jogos PG Soft identificados, mas nenhum pagamento >=50x apareceu nesta coleta.",
                    "no_pgsoft_data": "Feed consultado, mas nenhuma linha de jogo PG Soft foi reconhecida.",
                    "redirected_no_feed": "A rota de pagamentos redirecionou para a página inicial; nenhum feed público foi encontrado.",
                }
                checked.append({
                    "id": source["id"], "name": source["name"], "status": status,
                    "message": messages[status], "events": len(rows),
                    "http_status": response.status if response else None,
                    "page_title": page.title(), "page_url": page.url, **diagnostics,
                })
                print(f"{status.upper()} {source['name']}: HTTP {response.status if response else 'n/d'}; "
                      f"{diagnostics.get('table_rows', 0)} linhas; "
                      f"{diagnostics.get('pgsoft_rows', 0)} jogos PG Soft; {len(rows)} pagamentos >=50x")
            except Exception as exc:
                checked.append({"id": source["id"], "name": source["name"], "status": "error", "error": str(exc)})
                print(f"FALHA {source['name']}: {exc}", file=sys.stderr)
            finally:
                page.close()
        browser.close()
    # Páginas acessíveis sem dados PG Soft também são um resultado válido:
    # salvar o diagnóstico permite ao painel mostrar a cobertura real das fontes.
    # Só falhar quando todas as fontes apresentarem erro de acesso/coleta.
    if checked and all(x.get("status") == "error" for x in checked):
        raise RuntimeError("Nenhuma fonte de pagamentos pôde ser consultada.")
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

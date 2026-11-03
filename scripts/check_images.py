#!/usr/bin/env python3
"""Check a small live sample of image URLs stored in the public history."""
import json
import random
import sys
from pathlib import Path
from urllib.request import Request, urlopen

history_file = Path(__file__).resolve().parents[1] / "data" / "history.json"
data = json.loads(history_file.read_text(encoding="utf-8"))
candidates = []
seen = set()
for snapshot in reversed(data.get("snapshots", [])):
    referer = snapshot.get("source_url", "")
    for url in (snapshot.get("game_images") or {}).values():
        if not isinstance(url, str) or not url.startswith(("https://", "http://")) or url in seen:
            continue
        seen.add(url)
        candidates.append((url, referer))
    if len(candidates) >= 40:
        break

sample = candidates[:12]
if not sample:
    print("AVISO: histórico ainda não contém URLs de capas para testar.")
    sys.exit(0)

ok = 0
for url, referer in sample:
    try:
        request = Request(url, headers={
            "User-Agent": "Mozilla/5.0 (compatible; PGSoftRadar/1.0)",
            "Referer": referer,
            "Range": "bytes=0-63",
        })
        with urlopen(request, timeout=12) as response:
            content_type = response.headers.get("Content-Type", "").lower()
            first_bytes = response.read(32)
            if response.status < 400 and (content_type.startswith("image/") or first_bytes.startswith((b"RIFF", b"\x89PNG", b"\xff\xd8", b"GIF8"))):
                ok += 1
                print(f"OK {response.status} {content_type or 'imagem'} {url}")
            else:
                print(f"AVISO resposta não reconhecida: {response.status} {content_type} {url}")
    except Exception as error:
        print(f"AVISO imagem indisponível: {type(error).__name__}: {url}")

print(f"Teste de imagens: {ok}/{len(sample)} URLs responderam como imagem.")
if ok == 0:
    print("AVISO: nenhuma imagem do lote respondeu ao teste; verificar bloqueio externo ou URLs expiradas.")

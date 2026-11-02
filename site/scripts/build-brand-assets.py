"""Gera variantes de marca a partir do logotipo oficial (frontend/src/assets/logo.png).

Uso: python3 scripts/build-brand-assets.py  (a partir de site/)
- logo-on-dark.png: mesma lógica da variante oficial para fundo escuro
  (texto preto vira branco, caixa "HUB" invertida, verde "CHAT" preservado).
- favicon/ícones: recorte da caixa "HUB" do logotipo.
"""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT.parent / "frontend/src/assets/logo.png"
BRAND = ROOT / "src/assets/brand"
PUBLIC = ROOT / "public"

logo = Image.open(SRC).convert("RGBA")
# O PNG oficial tem ~29% de margem transparente nas laterais; o recorte só remove essa
# margem (a arte não muda) para o logo ocupar o espaço reservado no layout.
TRIM = logo.getchannel("A").getbbox()

dark = logo.copy()
px = dark.load()
w, h = dark.size
for y in range(h):
    for x in range(w):
        r, g, b, a = px[x, y]
        if a == 0:
            continue
        is_green = g > 90 and g > r * 1.6 and g > b * 1.6
        if not is_green:
            px[x, y] = (255 - r, 255 - g, 255 - b, a)
pad = 2
crop = (TRIM[0] - pad, TRIM[1] - pad, TRIM[2] + pad, TRIM[3] + pad)
logo.crop(crop).save(BRAND / "logo-on-light.png")
dark.crop(crop).save(BRAND / "logo-on-dark.png")

# Caixa "HUB" (bbox medido no arquivo 1340x281): x 695..1080, y 7..270
box = dark.crop((694, 6, 1081, 271))  # caixa branca com "HUB" vazado
side = max(box.size)
icon = Image.new("RGBA", (side, side), (0, 0, 0, 0))
icon.paste(box, ((side - box.width) // 2, (side - box.height) // 2), box)
# fundo preto opaco com cantos arredondados para ícones de app
from PIL import ImageDraw
def app_icon(size, pad_ratio=0.1):
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, size - 1, size - 1), radius=int(size * 0.22), fill=255)
    bg = Image.new("RGBA", (size, size), (10, 12, 11, 255))
    canvas.paste(bg, (0, 0), mask)
    inner = int(size * (1 - 2 * pad_ratio))
    b = box.resize((inner, int(inner * box.height / box.width)), Image.LANCZOS)
    canvas.alpha_composite(b, ((size - b.width) // 2, (size - b.height) // 2))
    # traço verde de assinatura (cor do "CHAT")
    d = ImageDraw.Draw(canvas)
    bar_h = max(2, size // 16)
    d.rounded_rectangle((size * 0.3, size * 0.8, size * 0.7, size * 0.8 + bar_h), radius=bar_h // 2, fill=(22, 163, 74, 255))
    return canvas

app_icon(180).convert("RGB").save(PUBLIC / "apple-touch-icon.png")
app_icon(512).save(PUBLIC / "icon-512.png")
app_icon(192).save(PUBLIC / "icon-192.png")
app_icon(64).save(PUBLIC / "favicon.ico", sizes=[(16, 16), (32, 32), (48, 48), (64, 64)])
print("ok", dark.size)

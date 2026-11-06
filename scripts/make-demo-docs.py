"""Creates clearly-labelled SYNTHETIC demo documents (not part of the supplied dataset) for the Sharma-ji persona:
an electricity bill and a signatory ID for a fictional Indore pharmacy, in the same layout as the supplied specimens."""
from PIL import Image, ImageDraw, ImageFont
import math, os

OUT = "fixtures/demo_documents"
os.makedirs(OUT, exist_ok=True)
REG = "/System/Library/Fonts/Supplemental/Arial.ttf"
BOLD = "/System/Library/Fonts/Supplemental/Arial Bold.ttf"
f = lambda p, s: ImageFont.truetype(p, s)

def watermark(img, text, step, size):
    layer = Image.new("RGBA", img.size, (255, 255, 255, 0))
    d = ImageDraw.Draw(layer)
    font = f(BOLD, size)
    for y in range(0, img.height + 400, step):
        tmp = Image.new("RGBA", (img.width * 2, size * 2), (255, 255, 255, 0))
        ImageDraw.Draw(tmp).text((0, 0), text, font=font, fill=(200, 40, 40, 70))
        tmp = tmp.rotate(25, expand=True)
        layer.alpha_composite(tmp, (-200, y - 400))
    return Image.alpha_composite(img.convert("RGBA"), layer).convert("RGB")

def page(title, sub, rows):
    img = Image.new("RGB", (1240, 1754), "#FDFDF9")
    d = ImageDraw.Draw(img)
    d.rectangle([40, 40, 1200, 190], fill="#E8EBF4")
    d.text((80, 70), title, font=f(BOLD, 44), fill="#141B3C")
    d.text((80, 130), sub, font=f(REG, 24), fill="#444")
    d.rectangle([40, 190, 1200, 1714], outline="#333", width=3)
    y = 250
    for label, value in rows:
        d.text((90, y), label, font=f(BOLD, 26), fill="#222")
        d.text((520, y), value, font=f(REG, 28), fill="#111")
        y += 70
    d.text((80, 1670), "Accel YTL Hackathon - Track A DEMO document. Fictional business, person and identifiers.", font=f(REG, 22), fill="#8B1A1A")
    return watermark(img, "SYNTHETIC SPECIMEN - NOT A VALID DOCUMENT", 420, 46)

bill = page("Specimen: Electricity Bill", "Fictional utility - address proof for OCR testing", [
    ("Consumer no.", "5521098734"), ("Billed to", "Sharma Medical Store"),
    ("Supply address", "Shop 14, MG Road, Indore, Madhya Pradesh"), ("", "- 452008"),
    ("Bill date", "2026-06-20"), ("Units consumed", "412"), ("Amount due (INR)", "3,176"),
])
bill.save(f"{OUT}/D01_address_proof.png")

idc = Image.new("RGB", (1012, 638), "#F4F7FD")
d = ImageDraw.Draw(idc)
d.rounded_rectangle([10, 10, 1002, 628], radius=28, outline="#2A3F6B", width=5)
d.text((40, 30), "Specimen: Authorised Signatory ID", font=f(BOLD, 36), fill="#14275E")
d.rectangle([40, 120, 300, 440], fill="#D2D6DE")
d.ellipse([110, 160, 230, 280], fill="#A9AEB8"); d.rectangle([90, 300, 250, 440], fill="#A9AEB8")
y = 125
for label, value, bold in [("Name", "Ramesh Sharma", True), ("Designation", "Owner", True), ("For business", "Sharma Medical Store", True), ("ID no.", "SYN-ID-552109", True), ("Valid till", "2029-03-31", True)]:
    d.text((340, y), label, font=f(REG, 22), fill="#555"); d.text((340, y + 22), value, font=f(BOLD, 28), fill="#000"); y += 62
d.text((40, 520), "SYNTHETIC SPECIMEN - NOT A VALID DOCUMENT", font=f(BOLD, 30), fill="#D97B7B")
idc.save(f"{OUT}/D01_signatory_id.png")
print("created", os.listdir(OUT))

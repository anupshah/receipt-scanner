#!/usr/bin/env python3
"""Generate sample receipt JPEGs for the receipt-scanner demo.

Run from project root:
  python3 scripts/generate-examples.py

Requires Pillow:
  pip3 install Pillow
"""

import os
import random
from PIL import Image, ImageDraw, ImageFont, ImageFilter

OUT_DIR = os.path.join(os.path.dirname(__file__), '..', 'public', 'examples')
os.makedirs(OUT_DIR, exist_ok=True)

# ── Font paths (macOS system fonts) ───────────────────────────
HELVETICA     = '/System/Library/Fonts/Helvetica.ttc'
HELVETICA_NEW = '/System/Library/Fonts/HelveticaNeue.ttc'
COURIER       = '/System/Library/Fonts/Courier.ttc'


# ══════════════════════════════════════════════════════════════
# 1. OFFICE EQUIPMENT RECEIPT  (professional letterhead style)
# ══════════════════════════════════════════════════════════════

def make_office_receipt():
    W, H = 794, 1000   # A4-ish at 96 dpi equivalent
    img  = Image.new('RGB', (W, H), '#ffffff')
    draw = ImageDraw.Draw(img)

    # ── Fonts ────────────────────────────────────────────────
    fco  = lambda s: ImageFont.truetype(HELVETICA_NEW, s)  # condensed-ish
    f    = lambda s: ImageFont.truetype(HELVETICA, s)
    mono = lambda s: ImageFont.truetype(COURIER, s)

    ACCENT  = '#1a6b45'   # dark green
    DARK    = '#111111'
    MID     = '#444444'
    LIGHT   = '#888888'
    RULE    = '#cccccc'

    # ── Letterhead bar ───────────────────────────────────────
    draw.rectangle([0, 0, W, 90], fill=ACCENT)
    draw.text((40, 18), 'TECHDESK SOLUTIONS LTD', font=f(26), fill='#ffffff')
    draw.text((40, 52), 'Unit 4, Innovation Park · Milton Keynes · MK9 2FG', font=f(12), fill='#b2dfc8')

    # Right-align contact in header
    contact = 'Tel: 01908 456789'
    cw = draw.textlength(contact, font=f(11))
    draw.text((W - 40 - cw, 58), contact, font=f(11), fill='#b2dfc8')

    website = 'www.techdesksolutions.co.uk'
    ww = draw.textlength(website, font=f(11))
    draw.text((W - 40 - ww, 72), website, font=f(11), fill='#b2dfc8')

    # ── "SALES RECEIPT" title ────────────────────────────────
    draw.text((40, 112), 'SALES RECEIPT', font=f(20), fill=DARK)
    label_y = 116
    draw.text((W - 40 - draw.textlength('VAT RECEIPT', font=f(11)), label_y),
              'VAT RECEIPT', font=f(11), fill=LIGHT)

    draw.line([(40, 142), (W - 40, 142)], fill=ACCENT, width=2)

    # ── Receipt meta ─────────────────────────────────────────
    def meta_row(y, label, value, value_color=DARK):
        draw.text((40, y),       label, font=f(11), fill=LIGHT)
        draw.text((180, y),      value, font=f(11), fill=value_color)

    meta_row(158, 'Date:',        '14 January 2024')
    meta_row(176, 'Receipt No:',  'TD-2024-00147')
    meta_row(194, 'Payment:',     'Business Card  ···· ···· ···· 4521')
    meta_row(212, 'Auth code:',   '847291')

    draw.line([(40, 238), (W - 40, 238)], fill=RULE, width=1)

    # ── Line items table ─────────────────────────────────────
    COL_QTY   = 40
    COL_DESC  = 90
    COL_UNIT  = 580
    COL_TOTAL = W - 40

    # Header row
    th_y = 252
    draw.rectangle([40, th_y, W - 40, th_y + 22], fill='#f4f4f4')
    draw.text((COL_QTY,  th_y + 4), 'Qty',         font=f(11), fill=MID)
    draw.text((COL_DESC, th_y + 4), 'Description', font=f(11), fill=MID)
    draw.text((COL_UNIT, th_y + 4), 'Unit price',  font=f(11), fill=MID)
    tw = draw.textlength('Total', font=f(11))
    draw.text((COL_TOTAL - tw, th_y + 4), 'Total', font=f(11), fill=MID)

    items = [
        (1, 'Ergonomic Monitor Stand (27")',  '£289.99', '£289.99'),
        (1, 'USB-C Hub 7-Port (Anker)',        '£45.00',  '£45.00'),
        (1, 'Cable Management Kit',            '£12.50',  '£12.50'),
        (2, 'Desk Cable Clips x10 (pack)',     '£2.50',   '£4.99'),
    ]

    row_y = th_y + 28
    for qty, desc, unit, total in items:
        draw.text((COL_QTY,  row_y), str(qty),  font=f(12), fill=DARK)
        draw.text((COL_DESC, row_y), desc,       font=f(12), fill=DARK)
        draw.text((COL_UNIT, row_y), unit,       font=f(12), fill=DARK)
        tw = draw.textlength(total, font=f(12))
        draw.text((COL_TOTAL - tw, row_y), total, font=f(12), fill=DARK)
        row_y += 26
        draw.line([(40, row_y - 4), (W - 40, row_y - 4)], fill='#eeeeee', width=1)

    # ── Totals block ─────────────────────────────────────────
    tot_x = 520
    tot_y = row_y + 12
    draw.line([(tot_x, tot_y), (W - 40, tot_y)], fill=RULE, width=1)
    tot_y += 10

    def tot_row(y, label, value, bold=False):
        font = f(13 if bold else 12)
        col  = DARK if bold else MID
        lw   = draw.textlength(label, font=font)
        vw   = draw.textlength(value, font=font)
        draw.text((W - 40 - 160 - lw // 2, y), label, font=font, fill=col)
        draw.text((W - 40 - vw, y),              value, font=font, fill=col)
        return y + (22 if bold else 20)

    tot_y = tot_row(tot_y, 'Subtotal (ex. VAT)', '£352.48')
    tot_y = tot_row(tot_y, 'VAT @ 20%',          '£70.50')
    draw.line([(tot_x, tot_y), (W - 40, tot_y)], fill=ACCENT, width=1)
    tot_y += 6
    tot_y = tot_row(tot_y, 'TOTAL (inc. VAT)',   '£422.98', bold=True)

    # ── VAT registration ─────────────────────────────────────
    vat_y = tot_y + 40
    draw.line([(40, vat_y), (W - 40, vat_y)], fill=RULE, width=1)
    vat_y += 14
    draw.text((40, vat_y), 'VAT Registration Number: GB987654321',
              font=f(11), fill=MID)
    draw.text((40, vat_y + 18),
              'Goods remain the property of TechDesk Solutions Ltd until payment is received in full.',
              font=f(10), fill=LIGHT)
    draw.text((40, vat_y + 34),
              'This document is your VAT receipt. Please retain for your records.',
              font=f(10), fill=LIGHT)

    # ── Footer bar ───────────────────────────────────────────
    draw.rectangle([0, H - 40, W, H], fill='#f4f4f4')
    draw.text((40, H - 26), 'TechDesk Solutions Ltd  ·  Company No. 09876543  ·  VAT No. GB987654321',
              font=f(10), fill=LIGHT)

    # Slight JPEG compression to feel like a scanned document
    path = os.path.join(OUT_DIR, 'office-receipt.jpg')
    img.save(path, 'JPEG', quality=88)
    print(f'✓  {path}')


# ══════════════════════════════════════════════════════════════
# 2. EV CHARGING RECEIPT  (thermal receipt photo style)
# ══════════════════════════════════════════════════════════════

def make_fuel_receipt():
    # Thermal receipt: narrow, long, slightly off-white
    W, H = 400, 680
    rng  = random.Random(42)   # fixed seed for reproducibility

    # Off-white thermal paper background
    img  = Image.new('RGB', (W, H), '#faf8f3')
    draw = ImageDraw.Draw(img)

    mono = lambda s: ImageFont.truetype(COURIER, s)
    f    = lambda s: ImageFont.truetype(HELVETICA, s)

    DARK    = '#1a1a1a'
    MID     = '#444444'
    LIGHT   = '#888888'

    # ── Subtle thermal paper noise ───────────────────────────
    # Add very faint horizontal scan lines characteristic of thermal paper
    for y in range(0, H, 3):
        shade = rng.randint(0, 6)
        draw.line([(0, y), (W, y)], fill=(250 - shade, 248 - shade, 242 - shade))

    # ── Content ───────────────────────────────────────────────
    cx = W // 2   # centre x

    def ctext(y, text, font, fill=DARK):
        tw = draw.textlength(text, font=font)
        draw.text((cx - tw // 2, y), text, font=font, fill=fill)

    def ltext(y, left, right, font=None, fill=DARK):
        font = font or mono(11)
        draw.text((28, y), left, font=font, fill=fill)
        rw = draw.textlength(right, font=font)
        draw.text((W - 28 - rw, y), right, font=font, fill=fill)

    def rule(y, dashed=False):
        if dashed:
            x = 28
            while x < W - 28:
                draw.line([(x, y), (min(x + 8, W - 28), y)], fill='#bbbbbb', width=1)
                x += 14
        else:
            draw.line([(28, y), (W - 28, y)], fill='#aaaaaa', width=1)

    y = 30
    ctext(y, 'GRIDCHARGE RAPID EV', mono(13)); y += 20
    ctext(y, 'Motorway Services, M40 J4',    mono(10)); y += 15
    ctext(y, 'Oxford  OX29 7EG',             mono(10)); y += 15
    ctext(y, '0800 234 5678',                mono(10)); y += 18
    rule(y); y += 12

    ctext(y, '*** EV CHARGING RECEIPT ***', mono(11)); y += 20
    rule(y, dashed=True); y += 12

    ltext(y, 'Date:',    '15 Jan 2024'); y += 16
    ltext(y, 'Time:',    '09:21');       y += 16
    ltext(y, 'Session:', 'GC-20240115-3847'); y += 16
    ltext(y, 'Charger:', 'GC-M40-07');  y += 16
    ltext(y, 'Type:',    '150kW DC Rapid'); y += 20

    rule(y, dashed=True); y += 12

    ltext(y, 'Start time:',  '08:42'); y += 16
    ltext(y, 'End time:',    '09:21'); y += 16
    ltext(y, 'Duration:',    '39 mins'); y += 16
    ltext(y, 'Energy del.:', '28.4 kWh'); y += 20

    rule(y, dashed=True); y += 12

    # 28.4 kWh @ 60p/kWh inc. VAT = £17.04 total
    # Subtotal ex. VAT = 17.04 / 1.20 = £14.20
    # VAT @ 20% = 14.20 * 0.20 = £2.84  (check: 14.20 + 2.84 = 17.04)
    ltext(y, 'Rate (inc. VAT):', '60p/kWh'); y += 20

    rule(y); y += 12

    ltext(y, 'Subtotal (ex. VAT):', '£14.20'); y += 16
    ltext(y, 'VAT @ 20%:',          '£2.84');  y += 4
    rule(y); y += 10

    # TOTAL — slightly larger
    ltext(y, 'TOTAL:', '£17.04', font=mono(13)); y += 22
    rule(y); y += 12

    ltext(y, 'Payment:',  'Contactless Card'); y += 16
    ltext(y, 'Card:',     '**** **** **** 8834'); y += 20

    rule(y, dashed=True); y += 12

    draw.text((28, y), 'VAT Reg: GB345678912', font=mono(10), fill=MID); y += 14
    draw.text((28, y), 'No fuel duty applicable.',   font=mono(9), fill=LIGHT); y += 13
    draw.text((28, y), 'ZeroEmissions approved.',    font=mono(9), fill=LIGHT); y += 20

    rule(y); y += 12
    ctext(y, 'Thank you for choosing clean energy', mono(9)); y += 13
    ctext(y, 'gridcharge.co.uk', mono(9))

    # ── Simulate a photo: slight rotation + very mild blur ───
    # Rotate by ~1.2 degrees
    img = img.rotate(1.2, fillcolor='#e8e6e0', expand=False)

    # Crop a little to remove rotation border artefacts
    img = img.crop((6, 6, W - 6, H - 6))

    # Very subtle blur to simulate camera lens (not sharp scan)
    img = img.filter(ImageFilter.GaussianBlur(radius=0.4))

    path = os.path.join(OUT_DIR, 'fuel-receipt.jpg')
    img.save(path, 'JPEG', quality=82)
    print(f'✓  {path}')


make_office_receipt()
make_fuel_receipt()

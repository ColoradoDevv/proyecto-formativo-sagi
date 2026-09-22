#!/usr/bin/env python
"""
Seed de datos demo: 10 usuarios + 10 consumibles + 10 devolutivos.
Idempotente (get_or_create): se puede correr varias veces sin duplicar.

Uso:
    cd backend
    .venv/Scripts/python.exe seed_demo_data.py
"""
import os
import django
from dotenv import load_dotenv

load_dotenv()  # backend/.env (Supabase) — manage.py lo hace, el script debe hacerlo también
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'sia_api.settings')
django.setup()

import datetime
from decimal import Decimal

from modules.users.models import User, DocumentType
from modules.products.models import (
    Brand, Inventory, Category, ConsumableMaterial, ReturnableMaterial,
)

TEMP_PASSWORD = "Sgi*2026"
TODAY = datetime.date.today()

# ── Usuarios (10) ─────────────────────────────────────────────────────────
cc = DocumentType.objects.filter(name__icontains="Ciudadan").first()
if cc is None:
    raise SystemExit("No hay tipos de documento. Corre seed_document_types.py primero.")

FIRST = ["Ana", "Luis", "María", "Carlos", "Sofía", "Diego", "Laura", "Andrés", "Camila", "Felipe"]
LAST = ["García", "Martínez", "López", "Hernández", "González", "Pérez", "Sánchez", "Ramírez", "Torres", "Vargas"]

users = []
for i in range(10):
    email = f"demo.aprendiz{i + 1:02d}@sena.edu.co"
    user, created = User.all_objects.get_or_create(
        email=email,
        defaults={
            "first_name": FIRST[i],
            "last_name": LAST[i],
            "document_type": cc,
            "document_number": f"90000000{i + 1:02d}",
            "phone_number": f"39900000{i + 1:02d}",
            "is_accountable": True,          # aparecen como cuentadantes
            "must_change_password": True,    # cambian la temporal al entrar
        },
    )
    if created:
        user.set_password(TEMP_PASSWORD)
        user.save(update_fields=["password"])
        print(f"[OK] Usuario {email} creado")
    else:
        if user.is_deleted:
            user.restore()
        print(f"[--] Usuario {email} ya existe")
    users.append(user)

# ── Catálogos de apoyo ────────────────────────────────────────────────────
brands = {}
for name in ["Truper", "Lenovo", "Fluke", "Stanley"]:
    brands[name], _ = Brand.objects.get_or_create(name=name)

inventories = {}
for name in ["Bodega Principal", "Laboratorio Electrónica"]:
    inventories[name], _ = Inventory.objects.get_or_create(name=name)

categories = {c.name: c for c in Category.objects.all()}
if not categories:
    raise SystemExit("No hay categorías. Corre seed_categories.py primero.")


def make_consumable(name, qty, unit_price, brand=None, inventory=None,
                    category=None, plate=None, serial=None, location="Bodega Principal"):
    total = (Decimal(str(unit_price)) * qty).quantize(Decimal("0.01"))
    mat, created = ConsumableMaterial.objects.get_or_create(
        name=name,
        defaults={
            "quantity": qty,
            "unit_price": Decimal(str(unit_price)),
            "total_price": total,
            "state": "Disponible",
            "description": f"Material demo: {name}",
            "purchase_date": TODAY,
            "entry_date": TODAY,
            "location": location,
            "brand": brand,
            "inventory": inventory,
            "category": category,
            "sena_plate": plate,
            "serial": serial,
        },
    )
    if created:
        mat.cuentadantes.set(users[:2])
        print(f"[OK] Material '{name}' creado")
    else:
        print(f"[--] Material '{name}' ya existe")
    return mat


# ── Consumibles (10): sin placa, con cantidad ─────────────────────────────
CONSUMABLES = [
    ("Resma de papel carta x500", 50, 18.50, "Bodega Principal"),
    ("Caja de bolígrafos x12", 40, 9.90, "Bodega Principal"),
    ("Set de marcadores x6", 30, 12.75, "Bodega Principal"),
    ("Rollo de cinta aislante", 60, 4.25, "Bodega Principal"),
    ("Carrete de soldadura estaño 250g", 20, 32.00, "Laboratorio Electrónica"),
    ("Caja de guantes de nitrilo x100", 25, 28.90, "Bodega Principal"),
    ("Caja de tapabocas x50", 35, 15.00, "Bodega Principal"),
    ("Alcohol isopropílico 1L", 45, 11.50, "Laboratorio Electrónica"),
    ("Bobina de cable UTP cat6 100m", 10, 89.99, "Laboratorio Electrónica"),
    ("Bolsa de conectores RJ45 x100", 30, 22.40, "Laboratorio Electrónica"),
]
for name, qty, price, inv in CONSUMABLES:
    make_consumable(name, qty, price, inventory=inventories[inv])

# ── Devolutivos (10): con placa/serial + categoría y modelo obligatorios ──
RETURNABLES = [
    # (nombre, precio, marca, inventario, categoria, modelo, placa, serial)
    ("Taladro percutor 750W", 349.99, "Truper", "Bodega Principal", "Herramienta", "TAL-750X", "SENA-PL-1001", "TRP-T001"),
    ("Multímetro digital", 189.50, "Fluke", "Laboratorio Electrónica", "Maquinaria y Equipos", "FLK-117", "SENA-PL-1002", "FLK-M117"),
    ("Laptop 14 pulg 16GB", 2899.00, "Lenovo", "Laboratorio Electrónica", "Maquinaria y Equipos", "THINK-E14", "SENA-PL-1003", "LNV-E1401"),
    ("Proyector Full HD", 1599.00, "Lenovo", "Bodega Principal", "Maquinaria y Equipos", "PROJ-FHD2", "SENA-PL-1004", "LNV-P201"),
    ("Pulidora angular 4.5 pulg", 279.99, "Truper", "Bodega Principal", "Herramienta", "PUL-45G", "SENA-PL-1005", "TRP-P045"),
    ("Compresor de aire 50L", 749.00, "Truper", "Bodega Principal", "Maquinaria y Equipos", "COMP-50L", "SENA-PL-1006", "TRP-C050"),
    ("Osciloscopio digital 100MHz", 1299.00, "Fluke", "Laboratorio Electrónica", "Maquinaria y Equipos", "OSC-100M", "SENA-PL-1007", "FLK-O100"),
    ("Kit de herramientas 108 pzas", 199.99, "Stanley", "Bodega Principal", "Herramienta", "KIT-108P", "SENA-PL-1008", "STN-K108"),
    ("Silla ergonómica", 459.00, None, "Bodega Principal", "Muebles y Enseres", "SIL-ERG1", "SENA-PL-1009", None),
    ("Mesa de trabajo 1.8m", 520.00, None, "Bodega Principal", "Muebles y Enseres", "MESA-180", "SENA-PL-1010", None),
]
for name, price, brand_name, inv, cat_name, model, plate, serial in RETURNABLES:
    base = make_consumable(
        name, 1, price,
        brand=brands.get(brand_name) if brand_name else None,
        inventory=inventories[inv],
        plate=plate, serial=serial,
    )
    dev, created = ReturnableMaterial.objects.get_or_create(
        consumable=base,
        defaults={
            "category": categories[cat_name],
            "model": model,
            "serial": serial,
            "dimensions": None,
        },
    )
    print(f"{'[OK]' if created else '[--]'} Devolutivo '{name}' {'creado' if created else 'ya existe'}")

print("\nResumen:")
print(f"  Usuarios (activos): {User.objects.count()}  | clave temporal: {TEMP_PASSWORD}")
print(f"  Consumibles base:   {ConsumableMaterial.objects.count()}")
print(f"  Devolutivos:        {ReturnableMaterial.objects.count()}")

#!/usr/bin/env python
"""
Seed de préstamos demo: 10 préstamos (8 activos firmados + 2 pendientes).
Idempotente: si ya existen 10+ préstamos demo, no crea nada.

Uso:
    cd backend
    .venv/Scripts/python.exe seed_demo_loans.py
"""
import os
import uuid
import django
from dotenv import load_dotenv

load_dotenv()  # backend/.env (Supabase) — manage.py lo hace, el script debe hacerlo también
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'sia_api.settings')
django.setup()

import datetime
from django.utils import timezone

from modules.users.models import User
from modules.products.models import ConsumableMaterial
from modules.loans.models import Loans

MARK = "Préstamo demo #"
TODAY = datetime.date.today()

existing = Loans.objects.filter(justification_use__startswith=MARK).count()
if existing >= 10:
    print(f"[--] Ya existen {existing} préstamos demo, nada que hacer")
    raise SystemExit(0)

users = list(User.objects.filter(is_active=True, is_deleted=False).order_by("id"))
materials = list(ConsumableMaterial.objects.filter(is_active=True).order_by("id"))
if len(users) < 3:
    raise SystemExit("Se necesitan al menos 3 usuarios activos.")
if len(materials) < 5:
    raise SystemExit("Se necesitan al menos 5 materiales activos.")

admin = users[0]
receptors = users[1:]

# (material_idx, receptor_idx, cantidad, días_desde_salida, días_para_devolver, tipo, grupo, estado)
PLAN = [
    (0, 0, 5, 9, 6, "Interno", "2876543", "Activo"),
    (1, 1, 3, 8, 7, "Interno", "2876543", "Activo"),
    (2, 2, 2, 7, 5, "Externo", "3123456", "Activo"),
    (3, 3, 4, 6, 9, "Interno", "2876543", "Activo"),
    (4, 4, 1, 5, 10, "Interno", "2987654", "Activo"),
    (8, 5, 2, 4, 11, "Externo", "3123456", "Activo"),
    (9, 6, 5, 3, 12, "Interno", "2876543", "Activo"),
    (10, 7, 1, 2, 13, "Interno", "2987654", "Activo"),
    (5, 8, 2, 1, 14, "Interno", "2876543", "Pendiente"),
    (6, 0, 3, 0, 15, "Externo", "3123456", "Pendiente"),
]

created = 0
for i, (mi, ri, qty, ago, plus, ltype, group, state) in enumerate(PLAN, start=1):
    mat = materials[mi % len(materials)]
    receptor = receptors[ri % len(receptors)]
    justification = f"{MARK}{i:02d} para prácticas del taller"
    if Loans.objects.filter(
        justification_use=justification, id_material=mat, id_receptor_user=receptor,
    ).exists():
        print(f"[--] {justification} ya existe")
        continue
    qty = max(1, min(qty, (mat.quantity or 1)))
    loan_date = TODAY - datetime.timedelta(days=ago)
    now = timezone.now()
    loan = Loans.objects.create(
        batch_id=uuid.uuid4(),
        id_responsable_user=admin,
        id_receptor_user=receptor,
        id_material=mat,
        amount_lent=qty,
        apprentice_group=group,
        loan_type=ltype,
        justification_use=justification,
        loan_date=loan_date,
        return_date=TODAY + datetime.timedelta(days=plus),
        state=state,
        **(
            dict(
                signed_by_responsable=admin,
                signed_at_responsable=now,
                signed_by_receptor=receptor,
                signed_at_receptor=now,
            )
            if state == "Activo" else {}
        ),
    )
    created += 1
    print(f"[OK] Prestamo #{loan.id_loan} {mat.name} x{qty} -> {receptor.email} ({state})")

print(f"Listo: {created} préstamos demo creados")

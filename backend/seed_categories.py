#!/usr/bin/env python
"""
Script para poblar las 3 categorías de materiales devolutivos.
Ejecutar: python manage.py shell < seed_categories.py
O: python seed_categories.py (si está en el mismo nivel que manage.py)
"""

import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'sia_api.settings')
django.setup()

from modules.products.models import Category

CATEGORIES = [
    "Herramientas",
    "Maquinaria y Equipos",
    "Muebles y Enseres",
]

for category_name in CATEGORIES:
    category, created = Category.objects.get_or_create(name=category_name)
    if created:
        print(f"✓ Categoría '{category_name}' creada")
    else:
        print(f"→ Categoría '{category_name}' ya existe")

print("\nCategorías pobladas exitosamente")

import os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'sia_api.settings')
import django
django.setup()
from modules.users.models import DocumentType

names = [
    'Cédula de Ciudadanía',
    'Cédula de Extranjería',
    'Tarjeta de Identidad',
    'Permiso Especial de Permanencia',
    'Permiso por Protección Temporal',
]

for name in names:
    DocumentType.objects.get_or_create(name=name)

print('seeded')

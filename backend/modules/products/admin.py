# Modelos visibles en el admin para pruebas rapidas.

from django.contrib import admin
from .models import Brand, Category, ConsumableMaterial, ReturnableMaterial

admin.site.register(Brand)
admin.site.register(Category)
admin.site.register(ConsumableMaterial)
admin.site.register(ReturnableMaterial)
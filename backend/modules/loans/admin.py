from django.contrib import admin
from .models import Loans

# Register your models here.
# Modelos visibles en el admin para pruebas rapidas.


admin.site.register(Loans)
from django.contrib import admin
from .models import TaskDefinition, TaskAssignment

# Register your models here.
admin.site.register(TaskDefinition)
admin.site.register(TaskAssignment)

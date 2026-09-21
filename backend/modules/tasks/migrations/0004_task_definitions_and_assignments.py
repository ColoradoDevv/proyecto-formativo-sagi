# Migracion 0004 de tasks:
#   - Elimina el modelo Task antiguo (tabla "Tareas") sin respaldo.
#   - Crea TaskDefinition (tabla "DefinicionesTareas"): plantilla reutilizable.
#   - Crea TaskAssignment (tabla "AsignacionesTareas"): vincula una definicion
#     a un usuario concreto, con su propio estado y fechas, mas trazabilidad
#     basica (assigned_at, completed_at) y constraint unica (task, user).

import datetime

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("tasks", "0003_task_dates_and_states"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        # 1) Eliminar el modelo Task antiguo.
        migrations.DeleteModel(
            name="Task",
        ),

        # 2) Crear TaskDefinition.
        migrations.CreateModel(
            name="TaskDefinition",
            fields=[
                ("id", models.AutoField(primary_key=True, serialize=False)),
                ("name", models.CharField(max_length=100)),
                ("description", models.CharField(max_length=255)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
            ],
            options={
                "db_table": "DefinicionesTareas",
                "verbose_name": "Definicion de tarea",
                "verbose_name_plural": "Definiciones de tareas",
            },
        ),

        # 3) Crear TaskAssignment.
        migrations.CreateModel(
            name="TaskAssignment",
            fields=[
                ("id", models.AutoField(primary_key=True, serialize=False)),
                (
                    "state",
                    models.CharField(
                        choices=[
                            ("Pendiente", "Pendiente"),
                            ("En progreso", "En progreso"),
                            ("Completada", "Completada"),
                            ("Cancelada", "Cancelada"),
                        ],
                        default="Pendiente",
                        max_length=20,
                    ),
                ),
                ("start_date", models.DateField(default=datetime.date.today)),
                ("end_date", models.DateField(default=datetime.date.today)),
                ("assigned_at", models.DateTimeField(auto_now_add=True)),
                ("completed_at", models.DateTimeField(blank=True, null=True)),
                (
                    "task",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="assignments",
                        to="tasks.taskdefinition",
                    ),
                ),
                (
                    "user",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.RESTRICT,
                        related_name="task_assignments",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "db_table": "AsignacionesTareas",
                "verbose_name": "Asignacion de tarea",
                "verbose_name_plural": "Asignaciones de tareas",
                "unique_together": {("task", "user")},
            },
        ),
    ]

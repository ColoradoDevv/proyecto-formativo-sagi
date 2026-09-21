# Migracion 0005 de tasks:
#   - Agrega el campo `scope` (user|group) para distinguir a que tipo de
#     destinatario va dirigida la asignacion.
#   - Agrega FK a `permissions.Group` (nullable).
#   - Hace `user` nullable: una asignacion puede ir a un grupo en lugar de
#     a un usuario individual.
#   - Reemplaza `unique_together = (task, user)` por UniqueConstraints
#     condicionales separados por scope (la FK nula no cuenta para unicidad).
#   - Agrega CheckConstraint que garantiza coherencia scope <-> FK:
#       * scope='user'  => user  IS NOT NULL AND group IS NULL
#       * scope='group' => group IS NOT NULL AND user  IS NULL
#
# Como todas las filas existentes eran de scope='user' con user NOT NULL,
# se rellena scope='user' por default; ninguna fila queda invalida.

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("tasks", "0004_task_definitions_and_assignments"),
        ("permissions", "0001_initial"),
    ]

    operations = [
        # 1) Agregar el campo scope con default 'user' para no romper filas existentes.
        migrations.AddField(
            model_name="taskassignment",
            name="scope",
            field=models.CharField(
                choices=[
                    ("user", "Usuario individual"),
                    ("group", "Grupo de usuarios"),
                ],
                default="user",
                max_length=10,
            ),
            preserve_default=False,
        ),

        # 2) Agregar FK a Group (nullable).
        migrations.AddField(
            model_name="taskassignment",
            name="group",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.RESTRICT,
                related_name="task_assignments",
                to="permissions.group",
            ),
        ),

        # 3) Hacer `user` nullable.
        migrations.AlterField(
            model_name="taskassignment",
            name="user",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.RESTRICT,
                related_name="task_assignments",
                to="users.user",
            ),
        ),

        # 4) Quitar el unique_together antiguo (lo reemplazamos por UniqueConstraints condicionales).
        migrations.AlterUniqueTogether(
            name="taskassignment",
            unique_together=set(),
        ),

        # 5) Agregar las UniqueConstraints condicionales (la FK nula no cuenta).
        migrations.AddConstraint(
            model_name="taskassignment",
            constraint=models.UniqueConstraint(
                condition=models.Q(user__isnull=False),
                fields=("task", "user"),
                name="unique_task_user_assignment",
            ),
        ),
        migrations.AddConstraint(
            model_name="taskassignment",
            constraint=models.UniqueConstraint(
                condition=models.Q(group__isnull=False),
                fields=("task", "group"),
                name="unique_task_group_assignment",
            ),
        ),

        # 6) CheckConstraint que valida scope <-> FK.
        migrations.AddConstraint(
            model_name="taskassignment",
            constraint=models.CheckConstraint(
                name="task_assignment_scope_consistency",
                condition=(
                    models.Q(scope="user",  user__isnull=False, group__isnull=True) |
                    models.Q(scope="group", user__isnull=True,  group__isnull=False)
                ),
            ),
        ),
    ]

# Generated migration - Creación de tablas del módulo de permisos

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='Permission',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('codename', models.CharField(help_text="Identificador único en formato snake_case. Ej: 'list_users'", max_length=100, unique=True)),
                ('name', models.CharField(help_text="Nombre legible para mostrar. Ej: 'Listar usuarios'", max_length=150)),
                ('description', models.TextField(blank=True, help_text='Descripción detallada de qué permite este permiso')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={
                'verbose_name': 'Permiso',
                'verbose_name_plural': 'Permisos',
                'db_table': 'permissions',
                'ordering': ['codename'],
            },
        ),
        migrations.CreateModel(
            name='Group',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(help_text="Nombre del grupo. Ej: 'Administradores'", max_length=100, unique=True)),
                ('description', models.TextField(blank=True, help_text='Descripción del rol y responsabilidades del grupo')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={
                'verbose_name': 'Grupo',
                'verbose_name_plural': 'Grupos',
                'db_table': 'groups',
                'ordering': ['name'],
            },
        ),
        migrations.CreateModel(
            name='UserPermission',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('assigned_at', models.DateTimeField(auto_now_add=True)),
                ('reason', models.TextField(blank=True, help_text='Razón por la cual se asignó este permiso específico')),
                ('permission', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='direct_user_permissions', to='permissions.permission')),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='direct_permissions', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'verbose_name': 'Permiso de Usuario',
                'verbose_name_plural': 'Permisos de Usuario',
                'db_table': 'user_permissions',
                'unique_together': {('user', 'permission')},
            },
        ),
        migrations.CreateModel(
            name='UserGroup',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('joined_at', models.DateTimeField(auto_now_add=True)),
                ('group', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='user_groups', to='permissions.group')),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='user_groups', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'verbose_name': 'Membresía de Usuario',
                'verbose_name_plural': 'Membresías de Usuario',
                'db_table': 'user_groups',
                'unique_together': {('user', 'group')},
            },
        ),
        migrations.CreateModel(
            name='GroupPermission',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('assigned_at', models.DateTimeField(auto_now_add=True)),
                ('group', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='group_permissions', to='permissions.group')),
                ('permission', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='group_permissions', to='permissions.permission')),
            ],
            options={
                'verbose_name': 'Permiso de Grupo',
                'verbose_name_plural': 'Permisos de Grupo',
                'db_table': 'group_permissions',
                'unique_together': {('group', 'permission')},
            },
        ),
        migrations.AddField(
            model_name='group',
            name='permissions',
            field=models.ManyToManyField(blank=True, help_text='Permisos asignados a este grupo', through='permissions.GroupPermission', to='permissions.permission'),
        ),
    ]

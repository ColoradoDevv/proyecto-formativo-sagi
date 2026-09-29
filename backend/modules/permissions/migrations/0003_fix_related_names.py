# Migration to fix related_name conflicts

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('permissions', '0002_load_initial_permissions'),
    ]

    operations = [
        migrations.AlterField(
            model_name='userpermission',
            name='permission',
            field=models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='direct_user_permissions', to='permissions.permission'),
        ),
        migrations.AlterField(
            model_name='userpermission',
            name='user',
            field=models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='direct_permissions', to='users.user'),
        ),
    ]

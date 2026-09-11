# 
# Serializers del modulo users.
# Sirven para convertir User a JSON y validar lo que llega.
# 

from rest_framework import serializers
from django.db import transaction

from .models import User
from .models import Role
from .models import DocumentType
from .utils import generate_secure_password, send_welcome_email
from modules.permissions.models import Group, SYSTEM_GROUP_NAME


class RoleSerializer(serializers.ModelSerializer):
    # Serializer para el modelo Role.
    class Meta:
        model = Role
        fields = "__all__"

class DocumentTypeSerializer(serializers.ModelSerializer):
    # Serializer para el modelo DocumentType.
    class Meta:
        model = DocumentType
        fields = "__all__"
        extra_kwargs = {
            "description": {"required": False, "allow_null": True},
        }        

class UserGroupSerializer(serializers.Serializer):
    """Serializer para mostrar los grupos de un usuario"""
    id = serializers.IntegerField(source='group.id')
    name = serializers.CharField(source='group.name')


class UserSerializer(serializers.ModelSerializer):
    # Para leer - devuelve el objeto completo en GET
    document_type = DocumentTypeSerializer(read_only=True)
    groups = serializers.SerializerMethodField()

    def get_groups(self, obj):
        memberships = obj.user_groups.exclude(group__name__iexact=SYSTEM_GROUP_NAME).select_related('group')
        return UserGroupSerializer(memberships, many=True).data
    
    # URL absoluta para la foto de perfil (devuelve /media/... para que el proxy de Vite la redirija).
    # Se usa get_profile_picture solo para leer; el campo del modelo acepta escritura
    # normalmente via ImageField, pero lo necesitamos declarar explícitamente para
    # que DRF no lo sobreescriba con el SerializerMethodField (que es read-only).
    profile_picture = serializers.SerializerMethodField()
    profile_picture_upload = serializers.ImageField(
        write_only=True, required=False, source="profile_picture"
    )

    # Para escribir - acepta solo el ID en POST
    document_type_id = serializers.PrimaryKeyRelatedField(
        queryset=DocumentType.objects.all(),
        source='document_type',
        write_only=True,
        required=False,
        allow_null=True
    )

    # La contraseña SOLO entra (write_only): se puede enviar, pero nunca se devuelve
    password = serializers.CharField(write_only=True, required=False)
    deactivation_reason = serializers.CharField(write_only=True, required=False, allow_blank=True)

    def get_profile_picture(self, obj):
        # Devuelve la ruta con /media/ al inicio para que el proxy de Vite la redirija
        if obj.profile_picture:
            return f"/media/{obj.profile_picture}"
        return None

    class Meta:
        model = User
        # Ocultamos los campos internos de Django que no deben salir
        exclude = ["is_superuser", "user_permissions", "last_login", "is_deleted", "deleted_at"]
        extra_kwargs = {
            "is_active": {"required": False, "default": True},
            "is_instructor_planta": {"required": False, "default": False},
            "is_accountable": {"required": False, "default": False},
            "second_phone_number": {"required": False, "allow_null": True},
            "institutional_email": {"required": False, "allow_null": True},
            "start_date": {"required": False, "allow_null": True},
            "end_date": {"required": False, "allow_null": True},
            # Se valida manualmente para devolver un mensaje claro y mapearlo
            # al input documentNumber del formulario.
            "document_number": {
                "required": False,
                "allow_null": True,
                "allow_blank": True,
                "validators": [],
            },
            # is_primary_admin se expone en lectura para que el frontend pueda
            # saber si está editando al superadmin primigenio y deshabilitar
            # los controles sensibles. Nunca debe ser escritura desde la API.
            "is_primary_admin": {"read_only": True},
            # is_staff da acceso al panel /admin de Django. Ningún flujo del
            # frontend lo necesita escribir; bloquearlo evita que un usuario
            # con edit_user se autoconceda (o le conceda a otro) ese acceso.
            "is_staff": {"read_only": True},
        }

    def validate_document_number(self, value):
        if value is None:
            return None

        document_number = value.strip()
        if not document_number:
            return None

        users_with_document = User.objects.filter(document_number=document_number)
        if self.instance:
            users_with_document = users_with_document.exclude(pk=self.instance.pk)

        if users_with_document.exists():
            raise serializers.ValidationError(
                "El número de documento ya está registrado para otro usuario."
            )

        return document_number

    def _validate_dates(self, attrs):
        if self.instance is None:
            # Creación: ambas fechas son obligatorias, sin excepción.
            start = attrs.get("start_date")
            end = attrs.get("end_date")
            if not start:
                raise serializers.ValidationError(
                    {"start_date": "La fecha de inicio es obligatoria."}
                )
            if not end:
                raise serializers.ValidationError(
                    {"end_date": "La fecha de finalización es obligatoria."}
                )
        else:
            # Edición (incluye PATCH parciales, p.ej. MyProfileView.patch()
            # que solo manda la foto): solo se exige un valor cuando el
            # propio request está tocando ese campo y lo manda vacío. No se
            # vuelve a exigir un campo que ni siquiera vino en este PATCH,
            # aunque el registro ya lo tenga incompleto por datos previos
            # (p.ej. un usuario creado saltándose campos obligatorios) — de
            # lo contrario CUALQUIER PATCH parcial sobre esa cuenta quedaría
            # bloqueado hasta que alguien complete esos campos aparte, sin
            # relación con lo que el PATCH actual está modificando.
            if "start_date" in attrs and not attrs["start_date"]:
                raise serializers.ValidationError(
                    {"start_date": "La fecha de inicio es obligatoria."}
                )
            if "end_date" in attrs and not attrs["end_date"]:
                raise serializers.ValidationError(
                    {"end_date": "La fecha de finalización es obligatoria."}
                )
            start = attrs.get("start_date", self.instance.start_date)
            end = attrs.get("end_date", self.instance.end_date)

        if start and end and end < start:
            raise serializers.ValidationError(
                {"end_date": "La fecha de finalización no puede ser anterior a la de inicio."}
            )

        return attrs

    def create(self, validated_data):
        # Ignoramos cualquier password que llegue del frontend: siempre se genera
        # automaticamente y se envia por correo, nunca la define el usuario.
        validated_data.pop("password", None)
        plain_password = generate_secure_password()

        with transaction.atomic():
            user = User(**validated_data)
            user.set_password(plain_password)
            user.must_change_password = True
            user.save()

            try:
                send_welcome_email(user, plain_password)
            except Exception:
                # Si el correo falla, revertimos la creacion del usuario:
                # de lo contrario quedaria una cuenta sin que nadie conozca su contraseña.
                raise serializers.ValidationError(
                    {"email": "No se pudo enviar el correo con las credenciales. Verifica el correo o intenta nuevamente."}
                )

        return user
    

    def update(self, instance, validated_data):
        # El flujo de edicion no cambia: aqui si se respeta una password
        # si el admin decide asignarla manualmente al editar.
        password = validated_data.pop("password", None)
        if password:
            # Import local para evitar un ciclo de imports (views.py ya
            # importa este modulo). Reutiliza la misma politica de
            # contraseñas que el flujo de OTP y el de primer login.
            from .views import ResetPasswordView
            if not ResetPasswordView._password_is_valid(password):
                raise serializers.ValidationError({
                    "password": "La contraseña debe tener al menos 10 caracteres, "
                                 "una mayúscula, una minúscula, un número y un carácter especial."
                })

        # Campos unique+nullable: convertir string vacío a None para no romper
        # la constraint UNIQUE (la BD acepta múltiples NULL pero no múltiples '').
        nullable_unique_fields = {
            "institutional_email", "phone_number", "document_number",
            "second_phone_number",
        }
        for attr, value in validated_data.items():
            if attr in nullable_unique_fields and value == "":
                value = None
            setattr(instance, attr, value)

        if password:
            instance.set_password(password)
            instance.must_change_password = True
        instance.save()
        return instance

    def validate(self, attrs):
        """
        Valida manualmente los campos unique contra la BD excluyendo la instancia
        actual, para que un PATCH con el mismo email/teléfono del propio usuario
        no lance un falso error de unicidad.
        """
        instance = self.instance  # None en creación, User en edición
        attrs = self._validate_dates(attrs)

        if instance is None:
            return attrs

        is_disabling_user = (
            instance.is_active
            and attrs.get("is_active") is False
        )
        if is_disabling_user:
            reason = str(attrs.get("deactivation_reason") or "").strip()
            if len(reason) < 10:
                raise serializers.ValidationError({
                    "deactivation_reason": (
                        "Debe indicar un motivo de inactivación de al menos 10 caracteres."
                    )
                })
            attrs["deactivation_reason"] = reason

        # Mapa campo_validado -> campo_en_modelo (para los que son distintos)
        unique_fields = {
            "email": "email",
            "institutional_email": "institutional_email",
            "phone_number": "phone_number",
            "document_number": "document_number",
        }

        for field_name, model_field in unique_fields.items():
            value = attrs.get(field_name)
            # Ignorar si no viene en el payload o es vacío/None
            if not value:
                continue
            qs = User.objects.filter(**{model_field: value}).exclude(pk=instance.pk)
            if qs.exists():
                raise serializers.ValidationError(
                    {field_name: f"Ya existe un usuario con este {field_name.replace('_', ' ')}."}
                )

        return attrs
    
class UserTrashSerializer(UserSerializer):
    class Meta(UserSerializer.Meta):
        exclude = ["is_superuser", "user_permissions", "last_login"]  # sin excluir borrado logico

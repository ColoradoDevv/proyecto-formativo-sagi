# URL configuration for sia_api project.
#
# The `urlpatterns` list routes URLs to views. For more information please see:
#     https://docs.djangoproject.com/en/6.0/topics/http/urls/
# Examples:
# Function views
#     1. Add an import:  from my_app import views
#     2. Add a URL to urlpatterns:  path('', views.home, name='home')
# Class-based views
#     1. Add an import:  from other_app.views import Home
#     2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
# Including another URLconf
#     1. Import the include() function: from django.urls import include, path
#     2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
from django.contrib import admin
from django.urls import path, include, re_path
from rest_framework.documentation import include_docs_urls
from rest_framework.permissions import AllowAny
from django.conf.urls.static import static
from django.conf import settings
from .media_views import AuthenticatedMediaView

urlpatterns = [
    # Aquí juntamos las rutas del admin, docs y las apps.
    path('admin/', admin.site.urls),
    path('docs/', include_docs_urls(title="SGI API")),
    # Archivos multimedia SOLO con sesión (Ley 1581: fotos, fichas y
    # cotizaciones contienen datos personales). Va antes del static()
    # para que siempre gane; en producción el servidor web debe
    # redirigir /media/* a Django en vez de servirlo directo.
    re_path(r'^media/(?P<path>.*)$', AuthenticatedMediaView.as_view(), name='auth-media'),
    path("", include("modules.home.urls")),
    path("api/users/", include("modules.users.urls")),
    path("api/permissions/", include("modules.permissions.urls")),
    path("api/products/", include("modules.products.urls")),
    path("api/loans/", include("modules.loans.urls")),
    path("api/returns/", include("modules.returns.urls")),
    path("api/tasks/", include("modules.tasks.urls")),
    path("api/audit/", include("modules.audit.urls")),
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

from django.urls import path
from . import views
from rest_framework_simplejwt.views import (
    TokenRefreshView,
)


urlpatterns = [
    path('users/login/', views.MyTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('users/auth/user/', views.get_user, name='get_user'),
    path('users/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('register/', views.Register, name='register'),
    path('posts/', views.articlePost, name='postArticle'),
    path('', views.getRoutes, name="routes")
]

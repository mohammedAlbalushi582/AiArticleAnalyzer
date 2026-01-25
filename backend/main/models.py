from django.db import models
from django.contrib.auth.models import User

# Create your models here.



class articleUrl(models.Model):
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    urls = models.CharField(max_length=200, null=True, blank=True)

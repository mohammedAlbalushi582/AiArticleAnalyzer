from django.contrib import admin

from .models import ContradictionReport


@admin.register(ContradictionReport)
class ContradictionReportAdmin(admin.ModelAdmin):
    list_display = ("title", "user", "created_at")
    list_filter = ("created_at",)
    search_fields = ("title",)
    filter_horizontal = ("articles",)

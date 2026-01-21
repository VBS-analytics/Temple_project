"""Seed default Pooja Catalogue with headers and entries."""

from django.db import migrations


POOJA_HEADERS = [
    ("GENERAL", "General Pooja"),
    ("ONE-DAY", "One Day Archana"),
    ("ABISHEKAM", "One Day Abishekam"),
    ("SPECIAL", "Special Pooja"),
]

POOJA_ENTRIES = [
    # General Pooja entries (6 entries) - (parent_code, code, name, description, min_amount, max_amount, default_amount)
    ("GENERAL", "GP1", "Till Oil for Lamps", None, "100.00", "4000.00", None),
    ("GENERAL", "GP2", "2 Pradosha Pooja per month", None, "100.00", "3000.00", None),
    ("GENERAL", "GP3", "4 Saturday Navagraha Pooja per month", None, "100.00", "1500.00", None),
    ("GENERAL", "GP4", "Gau Samrakshana Seva", None, "100.00", "5000.00", None),
    ("GENERAL", "GP5", "Kalabhairavar archana on 2 Ashtami", None, "200.00", None, "200.00"),
    ("GENERAL", "GP6", "Nitya Neivedhyam", None, "100.00", "10000.00", None),
    
    # One Day Archana entries (9 entries)
    ("ONE-DAY", "AR1", "Pillayar Koil", None, "100.00", None, "100.00"),
    ("ONE-DAY", "AR2", "Shivan Koil (lord Shiva + Ambal)", None, "200.00", None, "200.00"),
    ("ONE-DAY", "AR3", "Shivan Koil for Murugan", None, "100.00", None, "100.00"),
    ("ONE-DAY", "AR4", "Shivan Koil for Kalabhairavar", None, "100.00", None, "100.00"),
    ("ONE-DAY", "AR5", "Shivan Koil for Kasivishwanathar", None, "100.00", None, "100.00"),
    ("ONE-DAY", "AR6", "Ayyanar Koil for Ayyappan", None, "100.00", None, "100.00"),
    ("ONE-DAY", "AR7", "Ayyanar Koil for Saptakanni", None, "100.00", None, "100.00"),
    ("ONE-DAY", "AR8", "Perumal Koil for Lakshmi-Narayanar", None, "100.00", None, "100.00"),
    ("ONE-DAY", "AR9", "Perumal Koil for Aanjaneyar", None, "100.00", None, "100.00"),
    
    # One Day Abishekam entries (9 entries)
    ("ABISHEKAM", "AB1", "Pillayar Koil", None, "500.00", None, "500.00"),
    ("ABISHEKAM", "AB2", "Shivan Koil (lord Shiva + Ambal)", None, "1000.00", None, "1000.00"),
    ("ABISHEKAM", "AB3", "Shivan Koil for Murugan", None, "500.00", None, "500.00"),
    ("ABISHEKAM", "AB4", "Shivan Koil for Kalabhairavar", None, "500.00", None, "500.00"),
    ("ABISHEKAM", "AB5", "Shivan Koil for Kasivishwanathar", None, "500.00", None, "500.00"),
    ("ABISHEKAM", "AB6", "Ayyanar Koil for Ayyappan", None, "500.00", None, "500.00"),
    ("ABISHEKAM", "AB7", "Ayyanar Koil for Saptakanni", None, "500.00", None, "500.00"),
    ("ABISHEKAM", "AB8", "Perumal Koil for Lakshmi-Narayanar", None, "500.00", None, "500.00"),
    ("ABISHEKAM", "AB9", "Perumal Koil for Aanjaneyar", None, "500.00", None, "500.00"),
    
    # Special Pujas entries (7 entries)
    ("SPECIAL", "SP1", "Sivan Koil Kumbabishekam", None, "100.00", "10000000.00", None),
    ("SPECIAL", "SP2", "Aarudhra Darsanam Pooja", None, "100.00", "2500.00", None),
    ("SPECIAL", "SP3", "Gen Donation", None, "1.00", "10000000.00", None),
    ("SPECIAL", "SP4", "Mahashivratri -4 Kalam Pooja @ Shivan Koil", None, "100.00", "10000.00", None),
    ("SPECIAL", "SP5", "Navaratri Pooja for 10 days @ Shivan Koil", None, None, None, "10000.00"),
    ("SPECIAL", "SP6", "Diwali abishekam at all 4 temples", None, None, None, "2500.00"),
    ("SPECIAL", "SP7", "New Vastram for all deities in 4 temples", None, None, None, "6000.00"),
]


def create_pooja_catalogue(apps, schema_editor):
    """Create pooja headers and entries."""
    PoojaOption = apps.get_model("pooja", "PoojaOption")
    
    # Create headers mapping for reference
    header_map = {}
    
    for display_order, (header_code, header_name) in enumerate(POOJA_HEADERS, start=1):
        header, _ = PoojaOption.objects.get_or_create(
            code=header_code,
            defaults={
                "name": header_name,
                "is_group_header": True,
                "is_active": True,
                "display_order": display_order,
            },
        )
        header_map[header_code] = header
    
    # Create pooja entries
    for entry_order, entry_data in enumerate(POOJA_ENTRIES, start=1):
        # Unpack the entry data
        if len(entry_data) == 4:
            # Old format without amounts
            parent_code, pooja_code, pooja_name, description = entry_data
            min_amount = None
            max_amount = None
            default_amount = None
        else:
            # New format with amounts
            parent_code, pooja_code, pooja_name, description, min_amount, max_amount, default_amount = entry_data
        
        parent = header_map.get(parent_code)
        if parent:
            PoojaOption.objects.get_or_create(
                code=pooja_code,
                defaults={
                    "name": pooja_name,
                    "description": description or "",
                    "parent": parent,
                    "is_group_header": False,
                    "is_active": True,
                    "display_order": entry_order,
                    "min_amount": min_amount,
                    "max_amount": max_amount,
                    "default_amount": default_amount,
                },
            )


def remove_pooja_catalogue(apps, schema_editor):
    """Remove seeded pooja catalogue."""
    PoojaOption = apps.get_model("pooja", "PoojaOption")
    
    # Get all header codes
    header_codes = [code for code, _ in POOJA_HEADERS]
    
    # Delete headers (will cascade delete their children)
    PoojaOption.objects.filter(code__in=header_codes).delete()


class Migration(migrations.Migration):
    dependencies = [
        ("pooja", "0015_add_display_order_to_pooja_option"),
    ]

    operations = [
        migrations.RunPython(
            create_pooja_catalogue,
            remove_pooja_catalogue,
        ),
    ]

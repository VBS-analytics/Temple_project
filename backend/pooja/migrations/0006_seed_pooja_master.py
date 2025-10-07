from django.db import migrations


def seed_poojas(apps, schema_editor):
    PoojaOption = apps.get_model('pooja', 'PoojaOption')

    entries = [
        {'code': '1', 'name': 'Till Oil for Lamps', 'description': 'Min Rs 100. Max up to Rs 4000', 'is_group_header': False},
        {'code': '2', 'name': '2 Pradosha Pooja per month', 'description': 'Min Rs 100. Max up to Rs 3000', 'is_group_header': False},
        {'code': '3', 'name': '4 Saturday Navagraha Pooja per month', 'description': 'Min Rs 100. Max up to Rs 1500', 'is_group_header': False},
        {'code': '4', 'name': 'Gau Samrakshana Seva', 'description': 'Min Rs 100. Max up to Rs 5000', 'is_group_header': False},
        {'code': '5', 'name': 'Kalabhairavar Archana on 2 Ashtami', 'description': 'Rs 200', 'is_group_header': False},
        {'code': '6', 'name': 'Nitya Neivedhyam', 'description': 'Min Rs 100. Max Rs 10000', 'is_group_header': False},
        {'code': 'header-archana', 'name': 'One day Archana in a month', 'description': '', 'is_group_header': True},
        {'code': '8.1', 'name': 'Pillayar Koil', 'description': 'Rs 100', 'is_group_header': False, 'parent_code': 'header-archana'},
        {'code': '8.2', 'name': 'Shivan Koil (Lord Shiva + Ambal)', 'description': 'Rs 200', 'is_group_header': False, 'parent_code': 'header-archana'},
        {'code': '8.3', 'name': 'Shivan Koil for Murugan', 'description': 'Rs 100', 'is_group_header': False, 'parent_code': 'header-archana'},
        {'code': '8.4', 'name': 'Shivan Koil for Kalabhairavar', 'description': 'Rs 100', 'is_group_header': False, 'parent_code': 'header-archana'},
        {'code': '8.5', 'name': 'Shivan Koil for Kasi Vishwanathar', 'description': 'Rs 100', 'is_group_header': False, 'parent_code': 'header-archana'},
        {'code': '8.6', 'name': 'Avvayar Koil for Avvayaar', 'description': 'Rs 100', 'is_group_header': False, 'parent_code': 'header-archana'},
        {'code': '8.7', 'name': 'Avvayar Koil for Saptakanni', 'description': 'Rs 100', 'is_group_header': False, 'parent_code': 'header-archana'},
        {'code': '8.8', 'name': 'Perumal Koil for Lakshmi-Narayanar', 'description': 'Rs 100', 'is_group_header': False, 'parent_code': 'header-archana'},
        {'code': '8.9', 'name': 'Perumal Koil for Aanjaneyar', 'description': 'Rs 100', 'is_group_header': False, 'parent_code': 'header-archana'},
        {'code': 'header-abishekam', 'name': 'One day Abishekam in a month', 'description': '', 'is_group_header': True},
        {'code': '9.1', 'name': 'Pillayar Koil', 'description': 'Rs 500', 'is_group_header': False, 'parent_code': 'header-abishekam'},
        {'code': '9.2', 'name': 'Shivan Koil (Lord Shiva + Ambal)', 'description': 'Rs 1000', 'is_group_header': False, 'parent_code': 'header-abishekam'},
        {'code': '9.3', 'name': 'Shivan Koil for Murugan', 'description': 'Rs 500', 'is_group_header': False, 'parent_code': 'header-abishekam'},
        {'code': '9.4', 'name': 'Shivan Koil for Kalabhairavar', 'description': 'Rs 500', 'is_group_header': False, 'parent_code': 'header-abishekam'},
        {'code': '9.5', 'name': 'Shivan Koil for Kasi Vishwanathar', 'description': 'Rs 500', 'is_group_header': False, 'parent_code': 'header-abishekam'},
        {'code': '9.6', 'name': 'Shivan Koil for Natarajar', 'description': 'Rs 500', 'is_group_header': False, 'parent_code': 'header-abishekam'},
        {'code': '9.7', 'name': 'Avvayar Koil for Avvayaar', 'description': 'Rs 500', 'is_group_header': False, 'parent_code': 'header-abishekam'},
        {'code': '9.8', 'name': 'Avvayar Koil for Saptakanni', 'description': 'Rs 500', 'is_group_header': False, 'parent_code': 'header-abishekam'},
        {'code': '9.9', 'name': 'Perumal Koil for Lakshmi-Narayanar', 'description': 'Rs 500', 'is_group_header': False, 'parent_code': 'header-abishekam'},
        {'code': '9.10', 'name': 'Perumal Koil for Aanjaneyar', 'description': 'Rs 500', 'is_group_header': False, 'parent_code': 'header-abishekam'},
    ]

    created_objects = {}

    for entry in entries:
        parent_code = entry.pop('parent_code', None)
        code = entry['code']
        defaults = {
            'name': entry['name'],
            'description': entry['description'],
            'is_group_header': entry['is_group_header'],
            'is_active': True,
        }
        obj, _created = PoojaOption.objects.get_or_create(code=code, defaults=defaults)
        if not _created:
            obj.name = entry['name']
            obj.description = entry['description']
            obj.is_group_header = entry['is_group_header']
            obj.is_active = True
            obj.save(update_fields=['name', 'description', 'is_group_header', 'is_active'])
        created_objects[code] = obj
        if parent_code:
            parent = created_objects.get(parent_code)
            if parent is None:
                parent = PoojaOption.objects.get(code=parent_code)
                created_objects[parent_code] = parent
            if obj.parent_id != parent.id:
                obj.parent = parent
                obj.save(update_fields=['parent'])


def unseed_poojas(apps, schema_editor):
    PoojaOption = apps.get_model('pooja', 'PoojaOption')
    codes = [
        '1',
        '2',
        '3',
        '4',
        '5',
        '6',
        'header-archana',
        '8.1',
        '8.2',
        '8.3',
        '8.4',
        '8.5',
        '8.6',
        '8.7',
        '8.8',
        '8.9',
        'header-abishekam',
        '9.1',
        '9.2',
        '9.3',
        '9.4',
        '9.5',
        '9.6',
        '9.7',
        '9.8',
        '9.9',
        '9.10',
    ]
    PoojaOption.objects.filter(code__in=codes).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('pooja', '0005_poojaoption_grouping_fields'),
    ]

    operations = [
        migrations.RunPython(seed_poojas, unseed_poojas),
    ]

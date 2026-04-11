from src.app_registry import app_registry
print(f"Total apps in registry: {len(app_registry.registry)}")
apps_to_test = ["to do", "todo", "my asus", "asus", "Microsoft Store"]
for app in apps_to_test:
    target, display = app_registry.resolve(app)
    print(f"Input: '{app}' -> Target: {target}, Display: {display}")

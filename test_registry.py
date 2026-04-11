from src.app_registry import app_registry
print(f"Total apps in registry: {len(app_registry.registry)}")
apps_to_test = ["Microsoft Store", "Clock", "Photos", "vs", "edge"]
for app in apps_to_test:
    resolved = app_registry.resolve(app)
    print(f"Input: '{app}' -> Resolved: {resolved}")

from src.app_registry import app_registry
import os

print(f"Total apps in registry: {len(app_registry.registry)}")

test_cases = [
    "spotify",
    "copilot",
    "music",
    "browser",
    "code",
    "edge",
    "to do",
    "discord",
    "slack"
]

for test in test_cases:
    target, display = app_registry.resolve(test)
    if target:
        print(f"Input: '{test}' -> Target: {target}, Display: {display}")
    else:
        print(f"Input: '{test}' -> NOT FOUND")

# Check for a few common system paths
print("\nChecking for common system apps:")
for name in ["notepad", "calc", "cmd"]:
    target, display = app_registry.resolve(name)
    print(f"'{name}' -> {target}")

import os
import json
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
import base64

# --- Constants ---
CONFIG_FILE = 'config.json'
SALT_FILE = 'salt.key'

# --- Key Management ---
def get_encryption_key():
    """Generates a key from a password and salt for encryption."""
    password = b"cognitive-os-super-secret-password" # In a real app, use a secure password mechanism
    
    if os.path.exists(SALT_FILE):
        with open(SALT_FILE, 'rb') as f:
            salt = f.read()
    else:
        salt = os.urandom(16)
        with open(SALT_FILE, 'wb') as f:
            f.write(salt)
            
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,
        salt=salt,
        iterations=100000,
    )
    key = base64.urlsafe_b64encode(kdf.derive(password))
    return Fernet(key)

# --- Credential Storage ---
def save_credentials(provider, api_key):
    """Encrypts and saves API key for a given provider."""
    fernet = get_encryption_key()
    encrypted_key = fernet.encrypt(api_key.encode()).decode()
    
    config = load_all_credentials()
    config[provider] = {"api_key": encrypted_key}
    
    with open(CONFIG_FILE, 'w') as f:
        json.dump(config, f)

def load_credentials(provider):
    """Loads and decrypts the API key for a given provider."""
    config = load_all_credentials()
    provider_config = config.get(provider)
    
    if provider_config and 'api_key' in provider_config:
        fernet = get_encryption_key()
        decrypted_key = fernet.decrypt(provider_config['api_key'].encode()).decode()
        return decrypted_key
    return None

def load_all_credentials():
    """Loads the entire configuration file."""
    if os.path.exists(CONFIG_FILE):
        with open(CONFIG_FILE, 'r') as f:
            try:
                return json.load(f)
            except json.JSONDecodeError:
                return {}
    return {}

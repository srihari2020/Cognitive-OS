import tkinter as tk
from tkinter import ttk, messagebox
from src.provider_manager import provider_manager
from src.credentials import save_credentials, load_credentials

class SettingsWindow(tk.Toplevel):
    def __init__(self, parent):
        super().__init__(parent)
        self.title("AI Provider Settings")
        self.geometry("500x400")
        self.configure(bg="#2b2b2b")

        self.provider_manager = provider_manager
        self.selected_provider = tk.StringVar(value=self.provider_manager.active_provider_name)

        self._setup_styles()
        self._build_ui()

    def _setup_styles(self):
        style = ttk.Style(self)
        style.configure("TLabel", background="#2b2b2b", foreground="#ffffff")
        style.configure("TRadiobutton", background="#2b2b2b", foreground="#ffffff")
        style.configure("TEntry", padding=5)
        style.configure("TButton", padding=5)

    def _build_ui(self):
        main_frame = ttk.Frame(self, padding=20)
        main_frame.pack(fill=tk.BOTH, expand=True)

        # --- Provider Selection ---
        provider_frame = ttk.LabelFrame(main_frame, text="Select AI Provider", padding=15)
        provider_frame.pack(fill=tk.X)

        for provider_name in self.provider_manager.providers.keys():
            rb = ttk.Radiobutton(provider_frame, text=provider_name, variable=self.selected_provider, value=provider_name, command=self._on_provider_change)
            rb.pack(anchor="w", pady=2)

        # --- API Key Management ---
        self.key_frame = ttk.LabelFrame(main_frame, text="API Key", padding=15)
        self.key_frame.pack(fill=tk.X, pady=20)

        self.api_key_label = ttk.Label(self.key_frame, text="API Key:")
        self.api_key_label.pack(anchor="w")

        self.api_key_entry = ttk.Entry(self.key_frame, show="*", width=50)
        self.api_key_entry.pack(fill=tk.X)

        self.save_key_btn = ttk.Button(self.key_frame, text="Save Key", command=self._save_api_key)
        self.save_key_btn.pack(pady=10)

        # --- Save Button ---
        save_btn = ttk.Button(main_frame, text="Save and Close", command=self._save_and_close)
        save_btn.pack(side=tk.BOTTOM, pady=10)

        self._on_provider_change() # Initial UI state setup

    def _on_provider_change(self):
        provider = self.selected_provider.get()
        if provider == "Ollama":
            self.key_frame.pack_forget()
        else:
            self.key_frame.pack(fill=tk.X, pady=20)
            self.key_frame.config(text=f"{provider} API Key")
            # Load and display existing key if available
            key = load_credentials(provider)
            self.api_key_entry.delete(0, tk.END)
            if key:
                self.api_key_entry.insert(0, key)

    def _save_api_key(self):
        provider = self.selected_provider.get()
        api_key = self.api_key_entry.get().strip()

        if not api_key:
            messagebox.showerror("Error", "API key cannot be empty.", parent=self)
            return

        try:
            save_credentials(provider, api_key)
            messagebox.showinfo("Success", f"{provider} API key saved securely.", parent=self)
        except Exception as e:
            messagebox.showerror("Error", f"Failed to save key: {e}", parent=self)

    def _save_and_close(self):
        active_provider = self.selected_provider.get()
        self.provider_manager.set_active_provider(active_provider)
        messagebox.showinfo("Active Provider Set", f"{active_provider} is now the active AI provider.", parent=self)
        self.destroy()

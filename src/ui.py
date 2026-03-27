import tkinter as tk
from tkinter import ttk, scrolledtext
import time
from src.router import router
from src.settings_ui import SettingsWindow
from src.prediction_engine import prediction_engine
from src.suggestion_engine import suggestion_engine
from src.context_builder import context_builder
from src.ui_mode_manager import ui_mode_manager, UIMode
from src.performance_monitor import performance_monitor
from src.animation_controller import animation_controller
from src.interaction_analyzer import interaction_analyzer
from src.anticipation_engine import anticipation_engine

class CognitiveOS_UI:
    def __init__(self, root):
        self.root = root
        self.root.title("Cognitive OS - Production Prototype")
        self.root.geometry("800x700")
        self.root.configure(bg="#2b2b2b")
        
        self.router = router
        self.last_activity_time = time.time()
        self.is_typing = False
        
        self._setup_styles()
        self._build_ui()
        self._setup_adaptive_ui()
        self.update_suggestions()

    def _setup_adaptive_ui(self):
        """Initialize the adaptive UI loop and context awareness."""
        self.root.bind("<Any-KeyPress>", self._on_activity)
        self.root.bind("<Motion>", self._on_mouse_move)
        self.input_field.bind("<KeyPress>", self._on_typing_start)
        self.input_field.bind("<KeyRelease>", self._on_typing_stop)
        
        # Start the periodic update loop
        self._update_adaptive_loop()

    def _on_activity(self, event=None):
        self.last_activity_time = time.time()
        if event and event.type == tk.EventType.KeyPress:
            interaction_analyzer.record_keypress()

    def _on_mouse_move(self, event):
        self.last_activity_time = time.time()
        interaction_analyzer.record_mouse(event.x_root, event.y_root)

    def _on_typing_start(self, event=None):
        self.is_typing = True
        self._on_activity(event)

    def _on_typing_stop(self, event=None):
        self.is_typing = False

    def _update_adaptive_loop(self):
        """The heartbeat of the adaptive UI system."""
        performance_monitor.tick()
        
        # 1. Update Interaction Context
        idle_time = time.time() - self.last_activity_time
        context_factor = 0.0 if self.is_typing else min(1.0, idle_time / 5.0)
        performance_factor = performance_monitor.get_performance_factor()
        
        # 2. Update UI Modes
        intensity_score = interaction_analyzer.update_interaction_intensity()
        attention_factor = 1.0 - intensity_score
        ui_mode_manager.update_smart_intensity(context_factor, performance_factor, attention_factor)
        intensity = ui_mode_manager.get_intensity()
        
        # 3. Anticipation Logic
        anticipation = anticipation_engine.evaluate_anticipation()
        if anticipation:
            # Trigger 'pre-action' hints
            animation_controller.apply_expansion(self.suggestion_frame, intensity.glow)
            animation_controller.apply_focus_shift(self.suggestion_frame, intensity.glow)
            
            # Show suggestions if:
            # a) Idle for 3s
            # b) Typing pause for 1s
            typing_pause = interaction_analyzer.get_typing_pause_duration()
            if (anticipation["type"] == "IDLE_PREDICTION" and idle_time > 3.0) or \
               (interaction_analyzer.is_typing and typing_pause > 1.0):
                self.update_suggestions()
        
        # 4. Attention Tracking (Optional UI feedback)
        attention = anticipation_engine.get_attention_level()
        if hasattr(self, 'attention_label'):
            self.attention_label.config(text=f"Attention: {attention}")

        # Update FPS label
        if hasattr(self, 'fps_label'):
            self.fps_label.config(text=f"FPS: {int(performance_monitor.get_fps())}")
            
        # Schedule next update (approx 60fps)
        self.root.after(16, self._update_adaptive_loop)

    def _setup_styles(self):
        style = ttk.Style()
        style.theme_use("clam")
        style.configure("TFrame", background="#2b2b2b")
        style.configure("TLabel", background="#2b2b2b", foreground="#ffffff", font=("Segoe UI", 10))
        style.configure("Header.TLabel", font=("Segoe UI", 14, "bold"))
        style.configure("TButton", font=("Segoe UI", 10, "bold"), padding=5)
        style.configure("Suggestion.TButton", font=("Segoe UI", 9), padding=5)

    def _build_ui(self):
        main_frame = ttk.Frame(self.root, padding="20")
        main_frame.pack(fill=tk.BOTH, expand=True)

        header_frame = ttk.Frame(main_frame)
        header_frame.pack(fill=tk.X, pady=(0, 20))
        header = ttk.Label(header_frame, text="Cognitive OS - AI Action Engine", style="Header.TLabel")
        header.pack(side=tk.LEFT)
        
        # --- UI Mode Selector ---
        self.mode_var = tk.StringVar(value=ui_mode_manager.current_mode.value)
        mode_menu = ttk.Combobox(header_frame, textvariable=self.mode_var, 
                                 values=[m.value for m in UIMode], width=12, state="readonly")
        mode_menu.pack(side=tk.RIGHT, padx=5)
        mode_menu.bind("<<ComboboxSelected>>", self._on_mode_change)
        
        settings_btn = ttk.Button(header_frame, text="Connect AI", command=self._open_settings)
        settings_btn.pack(side=tk.RIGHT, padx=5)
        
        # --- Performance Monitor Labels ---
        self.fps_label = ttk.Label(header_frame, text="FPS: 0", font=("Segoe UI", 8))
        self.fps_label.pack(side=tk.RIGHT, padx=10)
        
        self.attention_label = ttk.Label(header_frame, text="Attention: IDLE", font=("Segoe UI", 8))
        self.attention_label.pack(side=tk.RIGHT, padx=10)

        input_label = ttk.Label(main_frame, text="Enter Command (e.g., 'Open VS Code', 'Search Google for AI'):")
        input_label.pack(anchor="w")
        self.input_field = ttk.Entry(main_frame, font=("Segoe UI", 11))
        self.input_field.pack(fill=tk.X, pady=(5, 10))
        self.input_field.bind("<Return>", lambda event: self._execute_command_from_input())
        
        # Bind mouse click for ripple effect
        self.input_field.bind("<Button-1>", self._on_input_click)
        
        self.execute_btn = ttk.Button(main_frame, text="EXECUTE INTENT", command=self._execute_command_from_input)
        self.execute_btn.pack(pady=(0, 10))

        # --- Suggestion Panel ---
        self.suggestion_frame = ttk.LabelFrame(main_frame, text="Suggestions", padding=10)
        self.suggestion_frame.pack(fill=tk.X, pady=10)

        self.console = scrolledtext.ScrolledText(main_frame, height=20, font=("Consolas", 10), bg="#1e1e1e", fg="#dcdcdc", state=tk.DISABLED)
        self.console.pack(fill=tk.BOTH, expand=True)
        self._log_to_console("System initialized and ready for commands...")

    def _on_mode_change(self, event=None):
        new_mode_str = self.mode_var.get()
        new_mode = UIMode(new_mode_str)
        ui_mode_manager.set_mode(new_mode, manual=True)
        self._log_to_console(f"UI Mode changed to: {new_mode.value}")

    def _on_input_click(self, event):
        intensity = ui_mode_manager.get_intensity().ripple
        animation_controller.apply_ripple(self.input_field, event.x, event.y, intensity)

    def _open_settings(self):
        SettingsWindow(self.root)

    def _execute_command_from_input(self):
        user_input = self.input_field.get().strip()
        if user_input:
            self.input_field.delete(0, tk.END)
            self._execute_command(user_input)

    def _execute_command(self, command_text):
        self._log_to_console(f"\n>>> USER INPUT: {command_text}")
        
        # Trigger window shake based on current intensity
        intensity = ui_mode_manager.get_intensity().camera_shake
        animation_controller.shake_window(self.root, intensity)
        
        try:
            result = self.router.process_command(command_text)
            intent = result.get("intent", "UNKNOWN")
            safety = result.get("safety", {})
            action = result.get("action", {})
            
            self._log_to_console(f"Detected Intent: {intent}")
            self._log_to_console(f"Safety Status: {safety.get('status')} ({safety.get('reason')})")
            
            if action.get("status") == "SUCCESS":
                self._log_to_console(f"Action Success: {action.get('message')}")
                # Post-action success animation
                animation_controller.apply_ripple(self.execute_btn, 0, 0, 1.0)
            elif action.get("status") == "FAILED":
                self._log_to_console(f"Action Failed: {action.get('message')}", color="red")
            elif action.get("status") == "SKIPPED":
                self._log_to_console(f"Action Skipped: {action.get('message')}", color="yellow")
        except Exception as e:
            self._log_to_console(f"FATAL ERROR: {str(e)}", color="red")
        finally:
            self.update_suggestions()

    def update_suggestions(self):
        for widget in self.suggestion_frame.winfo_children():
            widget.destroy()

        context = context_builder.build_context()
        predicted_intents = prediction_engine.predict_next(context)
        suggestions = suggestion_engine.generate_suggestions(predicted_intents)

        if not suggestions:
            no_sugg_label = ttk.Label(self.suggestion_frame, text="No suggestions at the moment.")
            no_sugg_label.pack()
            return

        for sugg in suggestions:
            btn = ttk.Button(self.suggestion_frame, text=sugg['text'], style="Suggestion.TButton", 
                             command=lambda s=sugg: self._execute_suggestion(s))
            btn.pack(side=tk.LEFT, padx=5, pady=5)
            
            # Apply anticipation hint if this is the top suggestion
            if suggestions.index(sugg) == 0:
                intensity = ui_mode_manager.get_intensity().glow
                animation_controller.apply_pre_action_hint(btn, intensity)

    def _execute_suggestion(self, suggestion):
        self._log_to_console(f"\n>>> ACCEPTED SUGGESTION: {suggestion['text']}")
        # A bit of a hack for now, we should ideally pass the intent object directly
        command_map = {
            "OPEN_CODE": "open vs code",
            "OPEN_YOUTUBE": "open youtube"
        }
        command_text = command_map.get(suggestion['intent'], suggestion['intent'])
        self._execute_command(command_text)

    def _log_to_console(self, message, color=None):
        self.console.config(state=tk.NORMAL)
        self.console.insert(tk.END, message + "\n")
        self.console.see(tk.END)
        self.console.config(state=tk.DISABLED)

def start_ui():
    root = tk.Tk()
    app = CognitiveOS_UI(root)
    root.mainloop()

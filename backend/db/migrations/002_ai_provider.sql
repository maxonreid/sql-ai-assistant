-- AI provider configuration (added in v1.3)
INSERT OR IGNORE INTO settings (key, value) VALUES
  ('ai_provider', 'external'),
  ('local_model', 'deepseek-coder'),
  ('ollama_url', 'http://localhost:11434');
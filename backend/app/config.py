from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

ROOT = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=(ROOT / ".env", ROOT / "backend/.env"), extra="ignore")

    gemini_api_key: str = ""
    # Exact Gemma 4 model id. Leave empty to auto-detect (prefers the fast MoE model, e.g. gemma-4-26b-a4b-it).
    gemma_model: str = ""
    # Gemma 4 thinking level: "minimal" is ~3x faster for structured extraction; "" uses the model default.
    gemma_thinking: str = "minimal"
    # "auto" tries EmbeddingGemma (sentence-transformers) and falls back to LSA; or force "embeddinggemma" / "lsa".
    embedder: str = "auto"
    embedding_model: str = "google/embeddinggemma-300m"

    data_dir: Path = ROOT / "data"
    max_upload_mb: int = 10
    max_pages: int = 40
    max_images: int = 4
    top_leads: int = 12
    gemma_concurrency: int = 6
    # Input-token budget per model per minute (Gemini API free tier allows 16k for Gemma). 0 disables pacing.
    gemma_tpm: int = 15000
    cors_origins: str = "*"

    @property
    def collection_dir(self) -> Path:
        return self.data_dir / "collection"

    @property
    def db_path(self) -> Path:
        return self.data_dir / "ideaforge.db"


settings = Settings()

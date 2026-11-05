"""Environment-only configuration. Never place Supabase service-role secrets here."""
from dataclasses import dataclass
import os


@dataclass(frozen=True)
class Settings:
    supabase_url: str
    publishable_key: str
    cors_origins: tuple[str, ...]
    environment: str

    @property
    def configured(self) -> bool:
        return self.supabase_url.startswith("https://") and bool(self.publishable_key)


def get_settings() -> Settings:
    origins = os.getenv(
        "CORS_ORIGINS",
        "https://iet-grid.vercel.app,http://localhost:5123,http://127.0.0.1:5123",
    )
    return Settings(
        supabase_url=(
            os.getenv("SUPABASE_URL")
            or os.getenv("VITE_SUPABASE_URL")
            or ""
        ).rstrip("/"),
        publishable_key=(
            os.getenv("SUPABASE_PUBLISHABLE_KEY")
            or os.getenv("VITE_SUPABASE_ANON_KEY")
            or ""
        ),
        cors_origins=tuple(x.strip() for x in origins.split(",") if x.strip()),
        environment=os.getenv("APP_ENV", "production"),
    )

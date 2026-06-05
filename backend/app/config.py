from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    database_url: str = "sqlite:///./ecoroute.db"
    secret_key: str = "change-me-to-a-long-random-secret-at-least-32-chars"
    algorithm: str = "HS256"
    access_token_expire_hours: int = 24
    refresh_token_expire_days: int = 7

    web3_rpc_url: str = "https://rpc-amoy.polygon.technology"
    contract_address: str = ""
    minter_private_key: str = ""

    vision_model_path: str = ""

    model_config = {"env_file": ".env"}


@lru_cache
def get_settings() -> Settings:
    return Settings()

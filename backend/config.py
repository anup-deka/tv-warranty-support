from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # DO Inference
    DO_INFERENCE_BASE_URL: str = "https://inference.do-ai.run/v1"
    DO_INFERENCE_API_KEY: str
    DO_LLM_MODEL: str = "meta-llama/Meta-Llama-3.1-8B-Instruct"
    DO_EMBEDDING_MODEL: str = "text-embedding-ada-002"

    # Database
    DATABASE_URL: str

    # DO Spaces
    DO_SPACES_KEY: str = ""
    DO_SPACES_SECRET: str = ""
    DO_SPACES_REGION: str = "nyc3"
    DO_SPACES_BUCKET: str = "tv-warranty-policies"
    DO_SPACES_ENDPOINT: str = "https://nyc3.digitaloceanspaces.com"
    DO_SPACES_POLICY_FILE: str = "warranty_policy.txt"

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()

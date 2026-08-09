# Sidecar that downloads models declared in stack.yaml.
# Pinned pyyaml to match the host (6.0.3). Rebuild after editing:
#   docker compose --profile download build model-downloader
FROM python:3.12-slim
RUN pip install --no-cache-dir pyyaml==6.0.3
ENTRYPOINT ["python3"]
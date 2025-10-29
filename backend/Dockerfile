FROM python:3.12-slim AS builder

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./
RUN pip install --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

COPY . .


FROM python:3.12-slim

ARG APP_UID=1000
ARG APP_GID=1000

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    TZ=Asia/Kolkata

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    tzdata \
    libpq5 \
    libjpeg62-turbo \
    libopenblas0 \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/* && \
    ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone && \
    (getent group ${APP_GID} || groupadd --gid ${APP_GID} app) && \
    useradd --uid ${APP_UID} --gid ${APP_GID} --shell /usr/sbin/nologin --create-home appuser

COPY --from=builder /usr/local /usr/local
COPY --from=builder /app /app

RUN chown -R appuser:${APP_GID} /app && chmod +x /app/entrypoint.sh

USER appuser

EXPOSE 8000

ENTRYPOINT ["./entrypoint.sh"]

FROM python:3.12-slim

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy the Python server and agent code
COPY apps/server/server.py .
COPY apps/server/agent_api.py .
COPY apps/server/.env* .
COPY apps/server/db/ ./db/

# Copy static HTML files for serving
COPY apps/desktop/login.html ./static/
COPY apps/desktop/landlord-app.html ./static/
COPY apps/desktop/tenant-app.html ./static/

# Install Python dependencies
RUN pip install --no-cache-dir fastapi uvicorn httpx pydantic aiofiles

# Create a unified entrypoint that runs both servers
RUN echo '#!/bin/bash\n\
cd /app\n\
python3 server.py &\n\
python3 agent_api.py &\n\
python3 -c "from http.server import HTTPServer, SimpleHTTPRequestHandler; import os; os.chdir(\"/app/static\"); s = HTTPServer((\"0.0.0.0\", 8080), SimpleHTTPRequestHandler); print(\"Static server on :8080\"); s.serve_forever()" &\n\
wait' > /app/start.sh && chmod +x /app/start.sh

# Expose ports
EXPOSE 3002 3001 8080

CMD ["/app/start.sh"]
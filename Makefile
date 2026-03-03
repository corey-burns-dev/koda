SHELL := /usr/bin/env bash

FRONTEND_DIR := frontend
BACKEND_DIR := backend

.PHONY: run up down dev run-local backend frontend install setup-hooks lint format format-check test build check smoke

run:
	docker compose up --build

up:
	docker compose up --build -d

down:
	docker compose down

define find_free_port
	PORT=$(1); \
	while :; do \
		if ! (lsof -i :$$PORT -sTCP:LISTEN -t >/dev/null 2>&1 || \
		      netstat -tln | grep -q ":$$PORT " >/dev/null 2>&1 || \
		      ss -tln | grep -q ":$$PORT " >/dev/null 2>&1 || \
		      timeout 1 bash -c "cat < /dev/tcp/127.0.0.1/$$PORT" >/dev/null 2>&1); then \
			break; \
		fi; \
		PORT=$$((PORT+1)); \
		if [ $$PORT -gt $$(( $(1) + 100 )) ]; then break; fi; \
	done; \
	echo $$PORT
endef

dev:
	@set -euo pipefail; \
	trap 'kill 0' EXIT INT TERM; \
	BACKEND_PORT=8080; \
	while lsof -i :$$BACKEND_PORT -sTCP:LISTEN -t >/dev/null 2>&1 || netstat -tln | grep -q ":$$BACKEND_PORT " >/dev/null 2>&1; do \
		BACKEND_PORT=$$((BACKEND_PORT+1)); \
	done; \
	FRONTEND_PORT=3000; \
	while lsof -i :$$FRONTEND_PORT -sTCP:LISTEN -t >/dev/null 2>&1 || netstat -tln | grep -q ":$$FRONTEND_PORT " >/dev/null 2>&1; do \
		FRONTEND_PORT=$$((FRONTEND_PORT+1)); \
	done; \
	echo "🚀 Starting development environment..."; \
	echo "   Backend:  http://localhost:$$BACKEND_PORT"; \
	echo "   Frontend: http://localhost:$$FRONTEND_PORT"; \
	(cd $(BACKEND_DIR) && KODA_PORT=$$BACKEND_PORT KODA_CORS_ORIGIN=http://localhost:$$FRONTEND_PORT zig build run) & \
	echo "⏳ Waiting for backend to be healthy..."; \
	for _ in {1..60}; do \
		if curl -fsS http://localhost:$$BACKEND_PORT/health >/dev/null 2>&1; then break; fi; \
		sleep 1; \
	done; \
	echo "✅ Backend is healthy. Starting frontend..."; \
	(cd $(FRONTEND_DIR) && NEXT_PUBLIC_BACKEND_HTTP_URL=http://localhost:$$BACKEND_PORT NEXT_PUBLIC_BACKEND_WS_URL=ws://localhost:$$BACKEND_PORT PORT=$$FRONTEND_PORT bun run dev) & \
	wait

run-local:
	@set -euo pipefail; \
	trap 'kill 0' EXIT INT TERM; \
	BACKEND_PORT=8080; \
	while lsof -i :$$BACKEND_PORT -sTCP:LISTEN -t >/dev/null 2>&1 || netstat -tln | grep -q ":$$BACKEND_PORT " >/dev/null 2>&1; do \
		BACKEND_PORT=$$((BACKEND_PORT+1)); \
	done; \
	FRONTEND_PORT=3000; \
	while lsof -i :$$FRONTEND_PORT -sTCP:LISTEN -t >/dev/null 2>&1 || netstat -tln | grep -q ":$$FRONTEND_PORT " >/dev/null 2>&1; do \
		FRONTEND_PORT=$$((FRONTEND_PORT+1)); \
	done; \
	echo "🚀 Starting local run..."; \
	echo "   Backend:  http://localhost:$$BACKEND_PORT"; \
	echo "   Frontend: http://localhost:$$FRONTEND_PORT"; \
	(cd $(BACKEND_DIR) && KODA_PORT=$$BACKEND_PORT KODA_CORS_ORIGIN=http://localhost:$$FRONTEND_PORT zig build run) & \
	(cd $(FRONTEND_DIR) && NEXT_PUBLIC_BACKEND_HTTP_URL=http://localhost:$$BACKEND_PORT NEXT_PUBLIC_BACKEND_WS_URL=ws://localhost:$$BACKEND_PORT PORT=$$FRONTEND_PORT bun run dev) & \
	wait

backend:
	cd $(BACKEND_DIR) && zig build run

frontend:
	@set -euo pipefail; \
	FRONTEND_PORT=3000; \
	while lsof -i :$$FRONTEND_PORT -sTCP:LISTEN -t >/dev/null 2>&1 || netstat -tln | grep -q ":$$FRONTEND_PORT " >/dev/null 2>&1; do \
		FRONTEND_PORT=$$((FRONTEND_PORT+1)); \
	done; \
	cd $(FRONTEND_DIR) && PORT=$$FRONTEND_PORT bun run dev

install:
	cd $(FRONTEND_DIR) && bun install
	git config core.hooksPath .githooks

setup-hooks:
	git config core.hooksPath .githooks

lint:
	cd $(FRONTEND_DIR) && bun run lint
	cd $(BACKEND_DIR) && zig fmt --check build.zig src && zig fmt --check --zon build.zig.zon

format:
	cd $(FRONTEND_DIR) && bun run format
	cd $(BACKEND_DIR) && zig fmt build.zig src && zig fmt --zon build.zig.zon

format-check:
	cd $(FRONTEND_DIR) && bun run format:check
	cd $(BACKEND_DIR) && zig fmt --check build.zig src && zig fmt --check --zon build.zig.zon

test:
	cd $(BACKEND_DIR) && zig build test
	cd $(FRONTEND_DIR) && bun run test

build:
	cd $(FRONTEND_DIR) && bun run build

check: lint format-check test build

smoke:
	@set -euo pipefail; \
	docker compose up --build -d; \
	trap 'docker compose down' EXIT; \
	FRONTEND_PORT=3000; \
	while lsof -Pi :$$FRONTEND_PORT -sTCP:LISTEN -t >/dev/null || netstat -tln | grep -q ":$$FRONTEND_PORT " >/dev/null 2>&1; do \
		FRONTEND_PORT=$$((FRONTEND_PORT+1)); \
	done; \
	for _ in {1..60}; do \
		if curl -fsS http://localhost:8080/health >/dev/null; then break; fi; \
		sleep 1; \
	done; \
	curl -fsS http://localhost:8080/health >/dev/null; \
	curl -fsS http://localhost:$$FRONTEND_PORT >/dev/null

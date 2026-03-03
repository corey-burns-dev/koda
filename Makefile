SHELL := /usr/bin/env bash

FRONTEND_DIR := frontend
BACKEND_DIR := backend

.PHONY: run up down run-local backend frontend install lint format format-check test build check smoke

run:
	docker compose up --build

up:
	docker compose up --build -d

down:
	docker compose down

run-local:
	@set -euo pipefail; \
	trap 'kill 0' EXIT INT TERM; \
	(cd $(BACKEND_DIR) && zig build run) & \
	(cd $(FRONTEND_DIR) && bun run dev) & \
	wait

backend:
	cd $(BACKEND_DIR) && zig build run

frontend:
	cd $(FRONTEND_DIR) && bun run dev

install:
	cd $(FRONTEND_DIR) && bun install

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
	for _ in {1..60}; do \
		if curl -fsS http://localhost:8080/health >/dev/null; then break; fi; \
		sleep 1; \
	done; \
	curl -fsS http://localhost:8080/health >/dev/null; \
	curl -fsS http://localhost:3000 >/dev/null

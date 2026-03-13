import { act, renderHook, waitFor } from "@testing-library/react";
import type { FormEvent } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useRoomChat } from "./useRoomChat";

const originalFetch = global.fetch;

describe("useRoomChat", () => {
	afterEach(() => {
		global.fetch = originalFetch;
		vi.restoreAllMocks();
	});

	it("prompts for auth before sending when signed out", () => {
		const onAuthRequired = vi.fn();
		const onSessionInvalid = vi.fn();
		const onStatusNote = vi.fn();

		const { result } = renderHook(() =>
			useRoomChat({
				activeRoomId: "room-1",
				buildWsUrl: () => "ws://example.test/ws/chat",
				hydrated: true,
				httpBase: "http://example.test",
				isAuthenticated: false,
				onAuthRequired,
				onSessionInvalid,
				onStatusNote,
				sessionToken: "",
				userId: "",
			}),
		);

		act(() => {
			result.current.setDraft("hello");
		});

		act(() => {
			result.current.submitMessage({
				preventDefault: vi.fn(),
			} as unknown as FormEvent<HTMLFormElement>);
		});

		expect(onStatusNote).toHaveBeenCalledWith("Sign in to chat.");
		expect(onAuthRequired).toHaveBeenCalledTimes(1);
		expect(onSessionInvalid).not.toHaveBeenCalled();
	});

	it("falls back to HTTP post when the chat socket is unavailable", async () => {
		const fetchMock = vi.fn(
			async (
				input: RequestInfo | URL,
				init?: RequestInit,
			): Promise<Partial<Response>> => {
				const url = String(input);

				if (url.includes("/api/messages?room_id=room-1")) {
					return {
						json: async () => [],
					};
				}

				if (url.endsWith("/api/messages") && init?.method === "POST") {
					return {
						ok: true,
						json: async () => ({
							type: "chat.message",
							message: {
								id: "msg-1",
								room_id: "room-1",
								user_id: "user-1",
								username: "alice",
								body: "hello",
								sent_at_unix_ms: 1,
							},
						}),
					};
				}

				throw new Error(`Unexpected fetch: ${url}`);
			},
		);
		global.fetch = fetchMock as typeof fetch;

		const { result } = renderHook(() =>
			useRoomChat({
				activeRoomId: "room-1",
				buildWsUrl: () => "ws://example.test/ws/chat",
				hydrated: false,
				httpBase: "http://example.test",
				isAuthenticated: true,
				onAuthRequired: vi.fn(),
				onSessionInvalid: vi.fn(),
				onStatusNote: vi.fn(),
				sessionToken: "token-1",
				userId: "user-1",
			}),
		);

		await waitFor(() => {
			expect(fetchMock).toHaveBeenCalledWith(
				"http://example.test/api/messages?room_id=room-1",
				expect.objectContaining({
					signal: expect.any(AbortSignal),
				}),
			);
		});

		act(() => {
			result.current.setDraft("hello");
		});

		act(() => {
			result.current.submitMessage({
				preventDefault: vi.fn(),
			} as unknown as FormEvent<HTMLFormElement>);
		});

		await waitFor(() => {
			expect(fetchMock).toHaveBeenCalledWith(
				"http://example.test/api/messages",
				expect.objectContaining({
					method: "POST",
					headers: expect.objectContaining({
						Authorization: "Bearer token-1",
					}),
				}),
			);
		});

		await waitFor(() => {
			expect(result.current.messages).toEqual([
				expect.objectContaining({
					id: "msg-1",
					body: "hello",
				}),
			]);
			expect(result.current.draft).toBe("");
		});
	});
});

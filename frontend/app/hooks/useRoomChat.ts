import type { FormEvent } from "react";
import { useCallback, useEffect, useRef, useState } from "react";

import type {
	ChatEvent,
	ChatMessage,
	ChatTypingEvent,
	PresenceUpdateEvent,
	Reaction,
	ReactionBulkEvent,
	TypingUser,
} from "../types";

type UseRoomChatOptions = {
	activeRoomId: string;
	buildWsUrl: (pathname: string, params: Record<string, string>) => string;
	hydrated: boolean;
	httpBase: string;
	isAuthenticated: boolean;
	onAuthRequired: () => void;
	onSessionInvalid: () => void;
	onStatusNote: (note: string) => void;
	sessionToken: string;
	userId: string;
};

export function useRoomChat({
	activeRoomId,
	buildWsUrl,
	hydrated,
	httpBase,
	isAuthenticated,
	onAuthRequired,
	onSessionInvalid,
	onStatusNote,
	sessionToken,
	userId,
}: UseRoomChatOptions) {
	const chatSocketRef = useRef<WebSocket | null>(null);

	const [messages, setMessages] = useState<ChatMessage[]>([]);
	const [draft, setDraft] = useState("");
	const [chatSocketState, setChatSocketState] = useState("disconnected");
	const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
	const [presenceUsers, setPresenceUsers] = useState<
		{ user_id: string; username: string }[]
	>([]);
	const [reactionsById, setReactionsById] = useState<
		Record<string, Reaction[]>
	>({});

	const typingTimerRef = useRef<number | null>(null);

	const probeSessionToken = useCallback(async (): Promise<
		"valid" | "invalid" | "unreachable"
	> => {
		if (!sessionToken) return "invalid";

		try {
			const response = await fetch(`${httpBase}/api/messages`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${sessionToken}`,
				},
				body: JSON.stringify({ room_id: "", body: "" }),
			});

			if (response.status === 401) return "invalid";
			return "valid";
		} catch {
			return "unreachable";
		}
	}, [httpBase, sessionToken]);

	// Fetch message history when room changes.
	useEffect(() => {
		if (!activeRoomId) {
			setMessages([]);
			setTypingUsers([]);
			setPresenceUsers([]);
			setReactionsById({});
			return;
		}

		const controller = new AbortController();

		fetch(
			`${httpBase}/api/messages?room_id=${encodeURIComponent(activeRoomId)}`,
			{
				signal: controller.signal,
			},
		)
			.then((r) => r.json())
			.then((payload: ChatMessage[]) => setMessages(payload))
			.catch((error: unknown) => {
				if (error instanceof DOMException && error.name === "AbortError")
					return;
				setMessages([]);
			});

		return () => controller.abort();
	}, [activeRoomId, httpBase]);

	// WebSocket lifecycle.
	useEffect(() => {
		if (
			!activeRoomId ||
			!hydrated ||
			!isAuthenticated ||
			!userId ||
			!sessionToken
		) {
			if (chatSocketRef.current) {
				chatSocketRef.current.close();
				chatSocketRef.current = null;
			}
			setChatSocketState(
				hydrated && !isAuthenticated ? "login required" : "disconnected",
			);
			setTypingUsers([]);
			setPresenceUsers([]);
			return;
		}

		let socket: WebSocket | null = null;
		let cancelled = false;
		let reconnectTimer: number | null = null;
		let reconnectAttempt = 0;

		const scheduleReconnect = () => {
			if (cancelled || reconnectTimer !== null) return;
			const delayMs = Math.min(1000 * 2 ** reconnectAttempt, 5000);
			reconnectAttempt += 1;
			reconnectTimer = window.setTimeout(() => {
				reconnectTimer = null;
				connect();
			}, delayMs);
		};

		const connect = () => {
			if (cancelled) return;

			const currentSocket = new WebSocket(
				buildWsUrl("/ws/chat", { room_id: activeRoomId, token: sessionToken }),
			);
			socket = currentSocket;
			let opened = false;

			currentSocket.onopen = () => {
				opened = true;
				reconnectAttempt = 0;
				setChatSocketState("connected");
			};

			currentSocket.onerror = () => {
				if (!opened) setChatSocketState("error");
			};

			currentSocket.onclose = () => {
				if (chatSocketRef.current === currentSocket)
					chatSocketRef.current = null;
				if (cancelled) return;

				if (opened) {
					setChatSocketState("disconnected");
					scheduleReconnect();
					return;
				}

				setChatSocketState("error");
				void probeSessionToken().then((status) => {
					if (cancelled) return;
					if (status === "invalid") {
						onSessionInvalid();
						setChatSocketState("login required");
						return;
					}
					scheduleReconnect();
				});
			};

			currentSocket.onmessage = (event) => {
				try {
					const payload = JSON.parse(event.data as string) as
						| ChatEvent
						| ChatTypingEvent
						| PresenceUpdateEvent
						| ReactionBulkEvent;

					if (payload.type === "chat.message") {
						if (payload.message.room_id !== activeRoomId) return;
						setMessages((prev) => [...prev, payload.message]);
						return;
					}

					if (payload.type === "chat.typing") {
						if (payload.room_id !== activeRoomId) return;
						// Filter out self.
						setTypingUsers(payload.users.filter((u) => u.user_id !== userId));
						return;
					}

					if (payload.type === "presence.update") {
						if (payload.room_id !== activeRoomId) return;
						setPresenceUsers(payload.users);
						return;
					}

					if (payload.type === "reaction.bulk") {
						if (payload.room_id !== activeRoomId) return;
						setReactionsById((prev) => ({ ...prev, ...payload.by_message }));
						return;
					}
				} catch {
					// Ignore malformed payloads.
				}
			};

			chatSocketRef.current = currentSocket;
		};

		setChatSocketState("connecting");
		connect();

		return () => {
			cancelled = true;
			if (reconnectTimer !== null) window.clearTimeout(reconnectTimer);
			if (socket) socket.close();
			if (chatSocketRef.current === socket) chatSocketRef.current = null;
		};
	}, [
		activeRoomId,
		buildWsUrl,
		hydrated,
		isAuthenticated,
		onSessionInvalid,
		probeSessionToken,
		sessionToken,
		userId,
	]);

	// Auto-expire typing users client-side.
	useEffect(() => {
		if (typingUsers.length === 0) return;

		const nearestExpiry = Math.min(...typingUsers.map((u) => u.expires_at_ms));
		const delay = Math.max(nearestExpiry - Date.now(), 0);

		const timer = window.setTimeout(() => {
			const now = Date.now();
			setTypingUsers((prev) => prev.filter((u) => u.expires_at_ms > now));
		}, delay + 100);

		return () => window.clearTimeout(timer);
	}, [typingUsers]);

	const sendTypingSignal = useCallback(() => {
		const socket = chatSocketRef.current;
		if (!socket || socket.readyState !== WebSocket.OPEN) return;

		// Throttle: send at most once per 2 s.
		if (typingTimerRef.current !== null) return;
		socket.send(JSON.stringify({ type: "typing" }));
		typingTimerRef.current = window.setTimeout(() => {
			typingTimerRef.current = null;
		}, 2000);
	}, []);

	const handleDraftChange = useCallback(
		(value: string) => {
			setDraft(value);
			if (value.trim()) sendTypingSignal();
		},
		[sendTypingSignal],
	);

	const submitMessage = useCallback(
		(event: FormEvent<HTMLFormElement>): void => {
			event.preventDefault();

			if (!activeRoomId) {
				onStatusNote("Pick a room to chat.");
				return;
			}

			if (!isAuthenticated) {
				onStatusNote("Sign in to chat.");
				onAuthRequired();
				return;
			}

			const text = draft.trim();
			if (!text) return;

			const socket = chatSocketRef.current;
			if (socket && socket.readyState === WebSocket.OPEN) {
				socket.send(JSON.stringify({ type: "message", body: text }));
				setDraft("");
				return;
			}

			// Fallback: HTTP POST.
			fetch(`${httpBase}/api/messages`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${sessionToken}`,
				},
				body: JSON.stringify({ room_id: activeRoomId, body: text }),
			})
				.then(async (response) => {
					if (!response.ok) throw new Error("failed to send chat message");
					const payload = (await response.json()) as ChatEvent;
					if (payload.type === "chat.message") {
						setMessages((prev) => [...prev, payload.message]);
					}
					setDraft("");
				})
				.catch(() => onStatusNote("Could not send message."));
		},
		[
			activeRoomId,
			draft,
			httpBase,
			isAuthenticated,
			onAuthRequired,
			onStatusNote,
			sessionToken,
		],
	);

	const toggleReaction = useCallback(
		(messageId: string, emoji: string) => {
			if (!isAuthenticated || !activeRoomId) return;

			// Optimistic update.
			setReactionsById((prev) => {
				const current = prev[messageId] ?? [];
				const existing = current.find((r) => r.emoji === emoji);
				if (existing) {
					const updated = existing.reacted_by_me
						? current
								.map((r) =>
									r.emoji === emoji
										? { ...r, count: r.count - 1, reacted_by_me: false }
										: r,
								)
								.filter((r) => r.count > 0)
						: current.map((r) =>
								r.emoji === emoji
									? { ...r, count: r.count + 1, reacted_by_me: true }
									: r,
							);
					return { ...prev, [messageId]: updated };
				}
				return {
					...prev,
					[messageId]: [...current, { emoji, count: 1, reacted_by_me: true }],
				};
			});

			fetch(`${httpBase}/api/reactions`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${sessionToken}`,
				},
				body: JSON.stringify({
					message_id: messageId,
					room_id: activeRoomId,
					emoji,
				}),
			}).catch(() => {
				// Server will reconcile via WS reaction.bulk event.
			});
		},
		[activeRoomId, httpBase, isAuthenticated, sessionToken],
	);

	return {
		chatSocketState,
		draft,
		messages,
		presenceUsers,
		reactionsById,
		setDraft: handleDraftChange,
		submitMessage,
		toggleReaction,
		typingUsers,
	};
}

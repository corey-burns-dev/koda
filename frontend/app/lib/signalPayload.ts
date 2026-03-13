import type { SignalPayload } from "../types";

export function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

export function isSignalPayload(value: unknown): value is SignalPayload {
	if (
		!isRecord(value) ||
		typeof value.kind !== "string" ||
		typeof value.mode !== "string"
	) {
		return false;
	}

	if (value.mode !== "stream" && value.mode !== "video") {
		return false;
	}

	if (value.kind === "peer.announce" || value.kind === "peer.leave") {
		return typeof value.role === "string";
	}

	if (value.kind === "webrtc.offer" || value.kind === "webrtc.answer") {
		return (
			typeof value.target_user_id === "string" && isRecord(value.description)
		);
	}

	if (value.kind === "webrtc.ice") {
		return (
			typeof value.target_user_id === "string" && isRecord(value.candidate)
		);
	}

	if (value.kind === "stream.status") {
		return typeof value.is_live === "boolean";
	}

	return false;
}

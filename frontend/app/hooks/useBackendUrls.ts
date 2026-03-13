import { useCallback, useMemo } from "react";

type WsParams = Record<string, string>;

export function useBackendUrls() {
	const { httpBase, wsBase } = useMemo(() => {
		const defaultBackendPort = "8080";

		if (typeof window === "undefined") {
			return {
				httpBase:
					process.env.NEXT_PUBLIC_BACKEND_HTTP_URL ??
					`http://localhost:${defaultBackendPort}`,
				wsBase:
					process.env.NEXT_PUBLIC_BACKEND_WS_URL ??
					`ws://localhost:${defaultBackendPort}`,
			};
		}

		const hostname = window.location.hostname;
		const httpProtocol =
			window.location.protocol === "https:" ? "https:" : "http:";
		const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";

		return {
			httpBase:
				process.env.NEXT_PUBLIC_BACKEND_HTTP_URL ??
				`${httpProtocol}//${hostname}:${defaultBackendPort}`,
			wsBase:
				process.env.NEXT_PUBLIC_BACKEND_WS_URL ??
				`${wsProtocol}//${hostname}:${defaultBackendPort}`,
		};
	}, []);

	const buildWsUrl = useCallback(
		(pathname: string, params: WsParams): string => {
			const base = wsBase.endsWith("/") ? wsBase : `${wsBase}/`;
			const url = new URL(pathname, base);

			for (const [key, value] of Object.entries(params)) {
				url.searchParams.set(key, value);
			}

			return url.toString();
		},
		[wsBase],
	);

	return {
		HTTP_BASE: httpBase,
		WS_BASE: wsBase,
		buildWsUrl,
	};
}

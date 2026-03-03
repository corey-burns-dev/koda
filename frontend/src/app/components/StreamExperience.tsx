import { RefObject } from "react";

type StreamExperienceProps = {
  knownStreamHostId: string | null;
  onFindStream: () => void;
  onStartBroadcast: () => void;
  onStopBroadcast: () => void;
  streamLocalVideoRef: RefObject<HTMLVideoElement | null>;
  streamMode: "idle" | "hosting" | "watching";
  streamPreviewVideoRef: RefObject<HTMLVideoElement | null>;
  streamRemoteVideoRef: RefObject<HTMLVideoElement | null>;
  streamTitleDraft: string;
  streamViewerCount: number;
  onStreamTitleDraftChange: (title: string) => void;
};

export function StreamExperience({
  knownStreamHostId,
  onFindStream,
  onStartBroadcast,
  onStopBroadcast,
  onStreamTitleDraftChange,
  streamLocalVideoRef,
  streamMode,
  streamPreviewVideoRef,
  streamRemoteVideoRef,
  streamTitleDraft,
  streamViewerCount,
}: StreamExperienceProps) {
  return (
    <section className="mode-panel">
      <div className="mode-toolbar">
        <input
          onChange={(event) => onStreamTitleDraftChange(event.target.value)}
          placeholder="Stream title"
          value={streamTitleDraft}
        />
        {streamMode === "hosting" ? (
          <button onClick={onStopBroadcast} type="button">
            Stop Broadcast
          </button>
        ) : (
          <button onClick={onStartBroadcast} type="button">
            Go Live
          </button>
        )}
        <button onClick={onFindStream} type="button">
          Find Stream
        </button>
      </div>

      <p className="muted">
        Host: {knownStreamHostId ?? "none"}. Viewers connected:{" "}
        {streamViewerCount}.
      </p>

      <div className="video-stack">
        <article>
          <h3>{streamMode === "hosting" ? "Your Broadcast" : "Live Stream"}</h3>
          {streamMode === "hosting" ? (
            <video
              autoPlay
              className="video-frame"
              muted
              playsInline
              ref={streamLocalVideoRef}
            />
          ) : (
            <video
              autoPlay
              className="video-frame"
              playsInline
              ref={streamRemoteVideoRef}
            />
          )}
        </article>
        <article>
          <h3>Preview</h3>
          <video
            autoPlay
            className="video-frame"
            muted
            playsInline
            ref={streamPreviewVideoRef}
          />
        </article>
      </div>
    </section>
  );
}
